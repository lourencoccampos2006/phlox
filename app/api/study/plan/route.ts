// app/api/study/plan/route.ts
// GET  → lista planos do utilizador
// POST → cria novo plano (gera schedule via IA)
// PATCH → marca dias como concluídos
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*study_plans.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('study_plans').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ plans: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ plans: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Plano de Estudo IA')

  const body = await req.json().catch(() => null) as any
  if (!body?.name || !body.weeks || !body.hours_per_week || !body.domains?.length) {
    return NextResponse.json({ error: 'name, weeks, hours_per_week e domains obrigatórios' }, { status: 400 })
  }

  // Gera schedule via IA
  let schedule: any = null
  try {
    schedule = await aiJSON<{ schedule: any[] }>([
      {
        role: 'system',
        content: `És coach de estudo médico. Crias planos detalhados em PT-PT.
Dado: ${body.weeks} semanas, ${body.hours_per_week}h/semana, domínios ${body.domains.join(', ')}, objectivo "${body.goal || 'consolidação'}".

Cria um schedule semana a semana, dia a dia. Cada entrada é um bloco de estudo com:
- week (1..${body.weeks})
- day (Seg/Ter/Qua/Qui/Sex/Sab/Dom)
- topic (tema específico do dia)
- type (theory/quiz/cases/flashcards/review)
- minutes (duração)
- completed (false)

Princípios:
- Repetição espaçada — revisita temas após 1, 3, 7, 21 dias.
- Mistura tipos: 40% teoria/resumos, 25% quiz, 20% casos clínicos, 10% flashcards, 5% revisão integrada.
- Domingo de revisão geral.
- Não excedas hours_per_week × 60 / 7 minutos por dia.

Responde APENAS JSON: { "schedule": [{ "week": 1, "day": "Seg", "topic": "...", "type": "theory", "minutes": 90, "completed": false }, ...] }`,
      },
      { role: 'user', content: `Cria o plano completo de ${body.weeks} semanas.` },
    ], { maxTokens: 4000, temperature: 0.2 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro a gerar plano: ' + e.message }, { status: 500 })
  }

  const db = sb(req)
  const { data, error } = await db.from('study_plans').insert({
    user_id: userId,
    name: body.name,
    goal: body.goal || null,
    weeks: body.weeks,
    hours_per_week: body.hours_per_week,
    domains: body.domains,
    schedule: schedule?.schedule || [],
    status: 'active',
    current_week: 1,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { id?: string; action?: string; week?: number; day?: string; schedule?: any; status?: string } | null
  if (!body?.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  const update: Record<string, any> = {}
  if (body.schedule) update.schedule = body.schedule
  if (body.status) update.status = body.status
  if (typeof body.week === 'number') update.current_week = body.week
  const { data, error } = await db.from('study_plans').update(update).eq('id', body.id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}
