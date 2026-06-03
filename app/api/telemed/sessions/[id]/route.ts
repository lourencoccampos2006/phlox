// app/api/telemed/sessions/[id]/route.ts
// PATCH → transições de estado e nota clínica final
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('telemed_sessions')
    .select('*, patient:patient_id ( id, name )')
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ session: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: 'start' | 'end' | 'cancel' | 'no_show' | 'consent' | 'note' | 'pay'
    encounter_summary?: string
    recording_consent?: boolean
    paid?: boolean
  } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const now = new Date().toISOString()
  const u: Record<string, any> = {}
  switch (body.action) {
    case 'start':    u.status = 'in_progress'; u.started_at = now; break
    case 'end':      u.status = 'completed'; u.ended_at = now
                     if (body.encounter_summary) u.encounter_summary = body.encounter_summary
                     break
    case 'cancel':   u.status = 'cancelled'; break
    case 'no_show':  u.status = 'no_show'; break
    case 'consent':  u.recording_consent = body.recording_consent !== false; break
    case 'note':     if (body.encounter_summary) u.encounter_summary = body.encounter_summary; break
    case 'pay':      u.paid = body.paid !== false; break
    default: return NextResponse.json({ error: 'action inválido' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('telemed_sessions').update(u).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ session: data })
}
