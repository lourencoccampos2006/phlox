// app/api/internship/[id]/route.ts
// GET → estágio completo + objectivos + estatísticas
// PATCH → actualiza
// DELETE → apaga
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
  const [intRes, objRes, patRes, logRes, procRes, caseRes, repRes, reflRes, evalRes, hoursRes] = await Promise.all([
    db.from('internships').select('*').eq('id', id).eq('user_id', userId).single(),
    db.from('internship_objectives').select('*').eq('internship_id', id).order('category, created_at'),
    db.from('internship_patients').select('*').eq('internship_id', id).order('created_at', { ascending: false }),
    db.from('internship_log_entries').select('*').eq('internship_id', id).order('entry_date', { ascending: false }).limit(60),
    db.from('internship_procedures').select('*').eq('internship_id', id).order('performed_at', { ascending: false }),
    db.from('case_presentations').select('id, title, presentation_date, final_diagnosis, ai_assisted, history, exam_findings, investigations, differential, management, outcome, discussion, references_text').eq('internship_id', id).order('created_at', { ascending: false }),
    db.from('internship_reports').select('id, kind, title, ai_assisted, created_at, body').eq('internship_id', id).order('created_at', { ascending: false }),
    db.from('internship_reflections').select('id, created_at, framework').eq('internship_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('supervisor_evaluations').select('id, kind, evaluator_name, evaluation_date, overall_score, submitted_at, strengths, comments').eq('internship_id', id).order('created_at', { ascending: false }),
    db.from('internship_hours').select('hours, hours_date, activity').eq('internship_id', id).order('hours_date', { ascending: false }),
  ])
  if (intRes.error || !intRes.data) return NextResponse.json({ error: intRes.error?.message || 'Não encontrado' }, { status: 404 })
  return NextResponse.json({
    internship: intRes.data,
    objectives: objRes.data || [],
    patients: patRes.data || [],
    log: logRes.data || [],
    procedures: procRes.data || [],
    cases: caseRes.data || [],
    reports: repRes.data || [],
    reflections: reflRes.data || [],
    evaluations: evalRes.data || [],
    hours: hoursRes.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, any> | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const allowed = ['name','specialty','institution','ward','supervisor','supervisor_email','start_date','end_date','hours_required','objectives_summary','status','notes']
  const u: Record<string, any> = {}
  for (const k of allowed) if (k in body) u[k] = body[k]
  const db = sb(req)
  const { data, error } = await db.from('internships').update(u).eq('id', id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ internship: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  await db.from('internships').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
