import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'

function makeSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7)
  return null
}

function makeCode() {
  // CSPRNG: o código dá acesso (read-only) à medicação do utilizador, por isso
  // não deve ser previsível. 6 chars de alfabeto-32 ≈ 30 bits.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rnd = new Uint32Array(6); globalThis.crypto.getRandomValues(rnd)
  return 'PHL-' + Array.from(rnd, n => chars[n % 32]).join('')
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip, 10, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    let body: { label?: string; access_level?: string; expires_in_days?: number } = {}
    try { body = await req.json() } catch {}

    const accessLevel = ['meds_only', 'meds_vitals', 'full'].includes(body.access_level || '') ? body.access_level! : 'meds_only'
    const expiresAt = body.expires_in_days ? new Date(Date.now() + body.expires_in_days * 86400000).toISOString() : null

    const supabase = makeSupabase(token)

    const { data: existing } = await supabase
      .from('phlox_links')
      .select('id, code')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle()

    if (existing) {
      await supabase.from('phlox_links').update({
        label: body.label ? String(body.label).slice(0, 100) : null,
        access_level: accessLevel,
        expires_at: expiresAt,
      }).eq('id', existing.id)
      return NextResponse.json({ code: existing.code })
    }

    let code = makeCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: conflict } = await supabase.from('phlox_links').select('id').eq('code', code).maybeSingle()
      if (!conflict) break
      code = makeCode()
      attempts++
    }

    const { data: created, error } = await supabase
      .from('phlox_links')
      .insert({
        user_id: userId,
        code,
        label: body.label ? String(body.label).slice(0, 100) : null,
        access_level: accessLevel,
        expires_at: expiresAt,
      })
      .select('code')
      .single()

    if (error || !created) {
      console.error('phlox_links insert error:', error)
      return NextResponse.json({ error: 'Erro ao criar link' }, { status: 500 })
    }
    return NextResponse.json({ code: created.code })
  } catch (err: any) {
    console.error('link/generate POST error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const supabase = makeSupabase(token)
    await supabase.from('phlox_links').update({ active: false }).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('link/generate DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    let body: { access_level?: string } = {}
    try { body = await req.json() } catch {}

    const supabase = makeSupabase(token)
    const accessLevel = ['meds_only', 'meds_vitals', 'full'].includes(body.access_level || '') ? body.access_level! : 'meds_only'
    await supabase.from('phlox_links').update({ access_level: accessLevel }).eq('user_id', userId).eq('active', true)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('link/generate PATCH error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
