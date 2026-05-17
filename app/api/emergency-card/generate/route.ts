import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 10, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { name?: string; allergies?: string; blood_type?: string; emergency_contact?: string } = {}
  try { body = await req.json() } catch {}

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await supabase
    .from('emergency_tokens')
    .select('token')
    .eq('user_id', userId)
    .single()

  const meta = {
    name: body.name ? String(body.name).slice(0, 100) : null,
    allergies: body.allergies ? String(body.allergies).slice(0, 500) : null,
    blood_type: body.blood_type ? String(body.blood_type).slice(0, 10) : null,
    emergency_contact: body.emergency_contact ? String(body.emergency_contact).slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  }

  if (existing?.token) {
    await supabase.from('emergency_tokens').update(meta).eq('user_id', userId)
    return NextResponse.json({ token: existing.token })
  }

  const { data: created, error } = await supabase
    .from('emergency_tokens')
    .insert({ user_id: userId, ...meta })
    .select('token')
    .single()

  if (error || !created) return NextResponse.json({ error: 'Erro ao criar cartão' }, { status: 500 })
  return NextResponse.json({ token: created.token })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await supabase.from('emergency_tokens').update({ active: false }).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
