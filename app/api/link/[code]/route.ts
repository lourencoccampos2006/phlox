import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code) return NextResponse.json({ error: 'Código inválido' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch link
  const { data: link, error: linkError } = await supabase
    .from('phlox_links')
    .select('user_id, access_level, label, expires_at, active')
    .eq('code', code.toUpperCase())
    .single()

  if (linkError || !link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
  if (!link.active) return NextResponse.json({ error: 'Este link foi revogado' }, { status: 410 })
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este link expirou' }, { status: 410 })
  }

  // Increment view count
  await supabase.from('phlox_links').update({ views: supabase.rpc('increment', { x: 1 }) }).eq('code', code.toUpperCase())

  const userId = link.user_id
  const level = link.access_level

  // Always include medications
  const { data: meds } = await supabase
    .from('personal_meds')
    .select('name, dose, frequency, indication, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  // Always include emergency card (name, allergies, blood type)
  const { data: card } = await supabase
    .from('emergency_tokens')
    .select('name, allergies, blood_type, emergency_contact')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  const response: Record<string, unknown> = {
    access_level: level,
    label: link.label,
    medications: meds || [],
    name: card?.name || null,
    allergies: card?.allergies || null,
    blood_type: card?.blood_type || null,
    emergency_contact: level === 'full' ? (card?.emergency_contact || null) : null,
    generated_at: new Date().toISOString(),
  }

  // Include vitals for meds_vitals and full
  if (level === 'meds_vitals' || level === 'full') {
    const { data: vitals } = await supabase
      .from('vitals')
      .select('recorded_at, hr, bp_sys, bp_dia, spo2, weight, glucose, temp')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(30)

    response.vitals = vitals || []
  }

  return NextResponse.json(response)
}
