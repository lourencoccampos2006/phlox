import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length > 64) return NextResponse.json({ error: 'Inválido' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: row } = await supabase
    .from('emergency_tokens')
    .select('user_id, name, allergies, blood_type, emergency_contact, updated_at')
    .eq('token', token)
    .eq('active', true)
    .single()

  if (!row) return NextResponse.json({ error: 'Cartão não encontrado ou desativado' }, { status: 404 })

  const { data: meds } = await supabase
    .from('personal_meds')
    .select('name, dose, frequency, indication')
    .eq('user_id', row.user_id)
    .eq('active', true)
    .order('name', { ascending: true })

  return NextResponse.json({
    name: row.name,
    allergies: row.allergies,
    blood_type: row.blood_type,
    emergency_contact: row.emergency_contact,
    updated_at: row.updated_at,
    medications: (meds || []).map((m: any) => ({
      name: m.name,
      dose: m.dose || null,
      frequency: m.frequency || null,
      indication: m.indication || null,
    })),
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
