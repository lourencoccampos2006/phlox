// app/api/telemed/sessions/route.ts
// GET  → lista sessões (filtros: org_id, status, clinician_id, from, to)
// POST → agenda nova sessão (token gerado por trigger SQL)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*telemed_sessions.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const status = req.nextUrl.searchParams.get('status')
  const clinicianId = req.nextUrl.searchParams.get('clinician_id')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('telemed_sessions')
    .select(`
      id, status, scheduled_at, duration_min, started_at, ended_at,
      room_token, provider, recording_consent, motive, fee_eur, paid,
      patient_id, clinician_id,
      patient:patient_id ( id, name )
    `)
    .eq('org_id', orgId)
    .order('scheduled_at', { ascending: false })
    .limit(100)
  if (status) q = q.eq('status', status)
  if (clinicianId) q = q.eq('clinician_id', clinicianId)
  if (from) q = q.gte('scheduled_at', from)
  if (to)   q = q.lte('scheduled_at', to)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ sessions: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ sessions: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.scheduled_at) {
    return NextResponse.json({ error: 'org_id e scheduled_at obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('telemed_sessions').insert({
    org_id: body.org_id,
    patient_id: body.patient_id || null,
    clinician_id: body.clinician_id || userId,
    scheduled_at: body.scheduled_at,
    duration_min: body.duration_min ?? 20,
    motive: body.motive || null,
    fee_eur: body.fee_eur || null,
    episode_id: body.episode_id || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ session: data })
}
