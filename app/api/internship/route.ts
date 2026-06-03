// app/api/internship/route.ts
// GET    → lista estágios do utilizador
// POST   → cria estágio + objectivos default da área
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

const NO_TABLE = (m: string) => /relation .*internships.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('internships').select('*').eq('user_id', userId).order('start_date', { ascending: false })
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ internships: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ internships: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.name || !body.area || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: 'name, area, start_date e end_date obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('internships').insert({
    user_id: userId,
    name: body.name,
    area: body.area,
    specialty: body.specialty || null,
    institution: body.institution || null,
    ward: body.ward || null,
    supervisor: body.supervisor || null,
    supervisor_email: body.supervisor_email || null,
    start_date: body.start_date,
    end_date: body.end_date,
    hours_required: body.hours_required || 0,
    objectives_summary: body.objectives_summary || null,
    status: body.status || 'active',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cria objectivos default da área
  if (data) {
    db.rpc('seed_default_objectives', { p_internship_id: data.id, p_area: body.area, p_user: userId }).then(() => {}, () => {})
  }

  return NextResponse.json({ internship: data })
}
