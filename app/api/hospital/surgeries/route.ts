// app/api/hospital/surgeries/route.ts
// GET  → agenda (filtros: org_id, from, to, room, status)
// POST → agendar nova intervenção
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

const NO_TABLE = (m: string) => /relation .*surgeries.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const from   = req.nextUrl.searchParams.get('from')
  const to     = req.nextUrl.searchParams.get('to')
  const room   = req.nextUrl.searchParams.get('room')
  const status = req.nextUrl.searchParams.get('status')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('surgeries')
    .select(`
      id, procedure_code, procedure_name, specialty, operating_room,
      anaesthesia_kind, asa_score, asa_emergent, status,
      scheduled_start, scheduled_duration, arrived_at, induction_at,
      incision_at, closure_at, recovery_at, completed_at,
      outcome, complication_notes,
      signin_done, timeout_done, signout_done,
      patient_id, episode_id,
      patient:patient_id ( id, name )
    `)
    .eq('org_id', orgId)
    .order('scheduled_start', { ascending: true, nullsFirst: false })

  if (from) q = q.gte('scheduled_start', from)
  if (to)   q = q.lte('scheduled_start', to)
  if (room) q = q.eq('operating_room', room)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ surgeries: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ surgeries: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    org_id?: string
    patient_id?: string
    episode_id?: string
    procedure_name?: string
    procedure_code?: string
    specialty?: string
    surgeon_id?: string
    anaesthetist_id?: string
    anaesthesia_kind?: string
    asa_score?: number
    asa_emergent?: boolean
    operating_room?: string
    scheduled_start?: string
    scheduled_duration?: number
    prophylaxis_abx?: string
  } | null
  if (!body?.org_id || !body.patient_id || !body.procedure_name) {
    return NextResponse.json({ error: 'org_id, patient_id e procedure_name obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('surgeries').insert({
    org_id: body.org_id,
    patient_id: body.patient_id,
    episode_id: body.episode_id || null,
    procedure_name: body.procedure_name,
    procedure_code: body.procedure_code || null,
    specialty: body.specialty || null,
    surgeon_id: body.surgeon_id || null,
    anaesthetist_id: body.anaesthetist_id || null,
    anaesthesia_kind: body.anaesthesia_kind || null,
    asa_score: body.asa_score ?? null,
    asa_emergent: !!body.asa_emergent,
    operating_room: body.operating_room || null,
    scheduled_start: body.scheduled_start || null,
    scheduled_duration: body.scheduled_duration ?? null,
    prophylaxis_abx: body.prophylaxis_abx || null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ surgery: data })
}
