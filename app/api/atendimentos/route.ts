import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

// Atendimentos avulsos (instituições sem doentes fixos). Autenticado.

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}
const NO_TABLE = (m: string) => /relation .*encounters.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const days = Math.min(120, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30')))
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await db.from('encounters').select('*').eq('user_id', userId).gte('at', since).order('at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ error: NO_TABLE(error.message) ? 'Os atendimentos ainda não estão ativos (aplicar sprint31_atendimentos.sql).' : error.message }, { status: NO_TABLE(error.message) ? 503 : 500 })
  return NextResponse.json({ encounters: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  // promover a ficha de doente
  if (b.promote) {
    const { data: enc } = await db.from('encounters').select('*').eq('id', b.promote).eq('user_id', userId).single()
    if (!enc) return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })
    const { data: pat, error: pErr } = await db.from('patients').insert({ user_id: userId, name: enc.person_name || 'Utente', age: enc.age || null, active: true }).select().single()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    await db.from('encounters').update({ patient_id: pat.id }).eq('id', enc.id)
    return NextResponse.json({ patient: pat })
  }

  const rec = {
    user_id: userId,
    person_name: String(b.person_name || '').slice(0, 80) || null,
    age: b.age ? parseInt(b.age) : null,
    type: ['atendimento', 'indicacao', 'rastreio', 'vacina', 'consulta', 'transporte', 'outro'].includes(b.type) ? b.type : 'atendimento',
    reason: String(b.reason || '').slice(0, 300) || null,
    action: String(b.action || '').slice(0, 600) || null,
    outcome: String(b.outcome || '').slice(0, 300) || null,
    follow_up: String(b.follow_up || '').slice(0, 300) || null,
    professional: String(b.professional || '').slice(0, 80) || null,
  }
  const { data, error } = await db.from('encounters').insert(rec).select().single()
  if (error) return NextResponse.json({ error: NO_TABLE(error.message) ? 'Os atendimentos ainda não estão ativos (aplicar sprint31_atendimentos.sql).' : error.message }, { status: NO_TABLE(error.message) ? 503 : 500 })
  return NextResponse.json({ encounter: data })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await db.from('encounters').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
