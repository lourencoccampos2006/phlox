import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code) return NextResponse.json({ error: 'Código inválido' }, { status: 400 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Configuração do servidor em falta' }, { status: 500 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    const { data: link, error: linkError } = await supabase
      .from('phlox_links')
      .select('user_id, access_level, label, expires_at, active, views')
      .eq('code', code.toUpperCase())
      .single()

    if (linkError || !link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    if (!link.active) return NextResponse.json({ error: 'Este link foi revogado' }, { status: 410 })
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este link expirou' }, { status: 410 })
    }

    // Increment view count (fire-and-forget)
    supabase.from('phlox_links').update({ views: (link.views || 0) + 1 }).eq('code', code.toUpperCase()).then(() => {})

    const userId = link.user_id
    const level = link.access_level

    const [{ data: meds }, { data: card }] = await Promise.all([
      supabase
        .from('personal_meds')
        .select('name, dose, frequency, indication, started_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('emergency_tokens')
        .select('name, allergies, blood_type, emergency_contact')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle(),
    ])

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
  } catch (err: any) {
    console.error('link/[code] GET error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
