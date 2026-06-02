// app/api/hospital/surgeries/[id]/route.ts
// PATCH → transições de estado e checklist OMS
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

type Action =
  | 'arrive' | 'induction' | 'incision' | 'closure' | 'recovery' | 'complete'
  | 'cancel' | 'signin' | 'timeout' | 'signout' | 'update'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: Action
    outcome?: string
    complication_notes?: string
    surgical_notes?: string
    operating_room?: string
    scheduled_start?: string
    scheduled_duration?: number
    asa_score?: number
    anaesthesia_kind?: string
  } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const now = new Date().toISOString()
  const update: Record<string, any> = {}

  switch (body.action) {
    case 'arrive':
      update.status = 'arrived'
      update.arrived_at = now
      break
    case 'induction':
      update.status = 'induction'
      update.induction_at = now
      break
    case 'incision':
      update.status = 'in_progress'
      update.incision_at = now
      break
    case 'closure':
      update.status = 'closing'
      update.closure_at = now
      break
    case 'recovery':
      update.status = 'recovery'
      update.recovery_at = now
      break
    case 'complete':
      update.status = 'completed'
      update.completed_at = now
      if (body.outcome) update.outcome = body.outcome
      if (typeof body.complication_notes === 'string') update.complication_notes = body.complication_notes
      if (typeof body.surgical_notes === 'string') update.surgical_notes = body.surgical_notes
      break
    case 'cancel':
      update.status = 'cancelled'
      if (typeof body.complication_notes === 'string') update.complication_notes = body.complication_notes
      break
    case 'signin':
      update.signin_done = true
      update.signin_at = now
      break
    case 'timeout':
      update.timeout_done = true
      update.timeout_at = now
      break
    case 'signout':
      update.signout_done = true
      update.signout_at = now
      break
    case 'update':
      if (body.operating_room) update.operating_room = body.operating_room
      if (body.scheduled_start) update.scheduled_start = body.scheduled_start
      if (body.scheduled_duration != null) update.scheduled_duration = body.scheduled_duration
      if (body.asa_score != null) update.asa_score = body.asa_score
      if (body.anaesthesia_kind) update.anaesthesia_kind = body.anaesthesia_kind
      break
    default:
      return NextResponse.json({ error: 'action inválido' }, { status: 400 })
  }

  const db = sb(req)
  const { data, error } = await db.from('surgeries').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ surgery: data })
}
