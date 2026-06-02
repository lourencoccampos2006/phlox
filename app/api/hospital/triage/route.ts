// app/api/hospital/triage/route.ts
// GET  → fila de triagem pendente (ainda não vista)
// POST → cria nova triagem Manchester
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

const NO_TABLE = (m: string) => /relation .*triage_assessments.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const includeSeen = req.nextUrl.searchParams.get('include_seen') === '1'
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('triage_assessments')
    .select(`
      id, priority, flowchart, discriminator, reason, vitals, pain_score, notes,
      target_minutes, seen_at, created_at, patient_id, episode_id,
      patient:patient_id ( id, name )
    `)
    .eq('org_id', orgId)
    .order('priority')
    .order('created_at')

  if (!includeSeen) q = q.is('seen_at', null)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ queue: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ queue: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    org_id?: string
    patient_id?: string
    episode_id?: string
    priority?: number
    flowchart?: string
    discriminator?: string
    reason?: string
    vitals?: any
    pain_score?: number
    notes?: string
  } | null
  if (!body?.org_id || !body.priority || !body.reason) {
    return NextResponse.json({ error: 'org_id, priority e reason obrigatórios' }, { status: 400 })
  }
  if (body.priority < 1 || body.priority > 5) {
    return NextResponse.json({ error: 'priority deve estar entre 1 e 5' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('triage_assessments').insert({
    org_id: body.org_id,
    patient_id: body.patient_id || null,
    episode_id: body.episode_id || null,
    triaged_by: userId,
    priority: body.priority,
    flowchart: body.flowchart || null,
    discriminator: body.discriminator || null,
    reason: body.reason,
    vitals: body.vitals || null,
    pain_score: body.pain_score ?? null,
    notes: body.notes || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ triage: data })
}
