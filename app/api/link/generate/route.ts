import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'PHL-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 10, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { label?: string; access_level?: string; expires_in_days?: number } = {}
  try { body = await req.json() } catch {}

  const accessLevel = ['meds_only', 'meds_vitals', 'full'].includes(body.access_level || '') ? body.access_level! : 'meds_only'
  const expiresAt = body.expires_in_days ? new Date(Date.now() + body.expires_in_days * 86400000).toISOString() : null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if user already has an active link
  const { data: existing } = await supabase
    .from('phlox_links')
    .select('id, code')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  if (existing) {
    // Update access level and label
    await supabase.from('phlox_links').update({
      label: body.label ? String(body.label).slice(0, 100) : null,
      access_level: accessLevel,
      expires_at: expiresAt,
    }).eq('id', existing.id)
    return NextResponse.json({ code: existing.code })
  }

  // Generate unique code
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

  if (error || !created) return NextResponse.json({ error: 'Erro ao criar link' }, { status: 500 })
  return NextResponse.json({ code: created.code })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await supabase.from('phlox_links').update({ active: false }).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { access_level?: string } = {}
  try { body = await req.json() } catch {}

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const accessLevel = ['meds_only', 'meds_vitals', 'full'].includes(body.access_level || '') ? body.access_level! : 'meds_only'
  await supabase.from('phlox_links').update({ access_level: accessLevel }).eq('user_id', userId).eq('active', true)
  return NextResponse.json({ ok: true })
}
