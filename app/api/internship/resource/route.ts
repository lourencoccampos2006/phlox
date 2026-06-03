// app/api/internship/resource/route.ts
// Endpoint genérico para CRUD em todas as sub-tabelas do estágio.
// Vantagem: 1 endpoint apenas, em vez de 10. Acoplado pelo nome da tabela.
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

const TABLES = new Set([
  'internship_patients','patient_followups','internship_log_entries',
  'internship_objectives','internship_procedures','case_presentations',
  'internship_reports','internship_reflections','supervisor_evaluations',
  'internship_hours',
])

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { table?: string; data?: any } | null
  if (!body?.table || !TABLES.has(body.table)) return NextResponse.json({ error: 'Tabela inválida' }, { status: 400 })
  if (!body.data) return NextResponse.json({ error: 'data obrigatório' }, { status: 400 })
  const db = sb(req)
  const payload = { ...body.data, user_id: userId }
  const { data, error } = await db.from(body.table).insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { table?: string; id?: string; data?: any } | null
  if (!body?.table || !TABLES.has(body.table) || !body.id) return NextResponse.json({ error: 'table e id obrigatórios' }, { status: 400 })
  const db = sb(req)
  const { data, error } = await db.from(body.table).update(body.data || {}).eq('id', body.id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const table = req.nextUrl.searchParams.get('table')
  const id = req.nextUrl.searchParams.get('id')
  if (!table || !TABLES.has(table) || !id) return NextResponse.json({ error: 'table e id obrigatórios' }, { status: 400 })
  const db = sb(req)
  const { error } = await db.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const table = req.nextUrl.searchParams.get('table')
  const filter = req.nextUrl.searchParams.get('internship_id')
  const patientId = req.nextUrl.searchParams.get('patient_id') || req.nextUrl.searchParams.get('internship_patient_id')
  if (!table || !TABLES.has(table)) return NextResponse.json({ error: 'table inválida' }, { status: 400 })
  const db = sb(req)
  let q = db.from(table).select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500)
  if (filter && (table === 'internship_patients' || table === 'internship_log_entries' || table === 'internship_procedures' || table === 'internship_objectives' || table === 'case_presentations' || table === 'internship_reports' || table === 'internship_reflections' || table === 'supervisor_evaluations' || table === 'internship_hours')) {
    q = q.eq('internship_id', filter)
  }
  if (patientId && table === 'patient_followups') {
    q = q.eq('internship_patient_id', patientId)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data || [] })
}
