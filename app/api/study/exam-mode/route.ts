// app/api/study/exam-mode/route.ts
// Modo Exame (Plus). Cria/lista objetivos de exame com plano de contagem
// decrescente, gerado por IA a partir da data + tópicos. Reajusta-se à confiança.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*exam_goals.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('exam_goals').select('*').eq('status', 'active').order('exam_date', { ascending: true })
  if (error) { if (NO_TABLE(error.message)) return NextResponse.json({ goals: [], needs_migration: true }); return NextResponse.json({ error: error.message }, { status: 500 }) }
  return NextResponse.json({ goals: data || [] })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  await db.from('exam_goals').update({ status: 'archived' }).eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Modo Exame')

  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
  const db = sb(req)

  // ── Criar objetivo de exame com plano gerado ──
  if (body.action === 'create') {
    const name = String(body.name || '').trim()
    const examDate = String(body.exam_date || '')
    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean) : []
    const daily = Number(body.daily_minutes) || 60
    if (!name || !examDate || topics.length === 0) {
      return NextResponse.json({ error: 'name, exam_date e topics obrigatórios' }, { status: 400 })
    }

    // dias até ao exame
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const exam = new Date(examDate + 'T00:00:00')
    const days = Math.max(1, Math.round((exam.getTime() - today.getTime()) / 86400000))

    let plan: any = { plan: [] }
    try {
      plan = await aiJSON<{ plan: any[] }>([
        {
          role: 'system',
          content: `És um coach de estudo médico. Cria um plano de contagem decrescente até um exame, em PT-PT.
Faltam ${days} dias. Tópicos: ${topics.join(', ')}. ${daily} min/dia.
Princípios:
- Distribui os tópicos pelos dias com revisão espaçada (revisita após 1, 3, 7 dias).
- Mistura: aprender → praticar (quiz/casos) → rever.
- Os últimos 2-3 dias = "sprint": revisão geral + simulacro de exame, SEM matéria nova.
- Cada dia: focus (1-2 tópicos), tasks (2-4 ações concretas), type ('aprender'|'praticar'|'rever'|'sprint').
Responde APENAS JSON: { "plan": [ { "day": 1, "date_offset": 0, "focus": ["..."], "tasks": ["..."], "type": "aprender" } ] }
day começa em 1 (hoje) e vai até ${days}. date_offset = nº de dias a partir de hoje.`,
        },
        { role: 'user', content: `Cria o plano completo de ${days} dias para "${name}".` },
      ], { maxTokens: 3500, temperature: 0.25 })
    } catch (e: any) {
      return NextResponse.json({ error: 'Erro a gerar plano: ' + e.message }, { status: 500 })
    }

    // Tenta RPC (bypassa schema cache), fallback insert direto
    const { data: rpc, error: rpcErr } = await db.rpc('create_exam_goal', {
      p_name: name, p_exam_date: examDate, p_topics: topics, p_daily: daily, p_plan: plan?.plan || [],
    })
    if (!rpcErr && rpc) return NextResponse.json({ goal: rpc })

    const noRpc = rpcErr && /function .*create_exam_goal.* does not exist/i.test(rpcErr.message)
    if (rpcErr && !noRpc) return NextResponse.json({ error: rpcErr.message, hint: 'Aplica supabase/sprint78_exam_mode.sql' }, { status: 500 })

    const { data, error } = await db.from('exam_goals')
      .insert({ user_id: userId, name, exam_date: examDate, topics, daily_minutes: daily, plan: plan?.plan || [] })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goal: data })
  }

  // ── Atualizar confiança de um tópico (reajusta foco) ──
  if (body.action === 'confidence') {
    if (!body.id || !body.topic) return NextResponse.json({ error: 'id e topic obrigatórios' }, { status: 400 })
    const { data: g } = await db.from('exam_goals').select('confidence').eq('id', body.id).eq('user_id', userId).single()
    const conf = { ...(g?.confidence || {}), [body.topic]: Math.max(0, Math.min(1, Number(body.value) || 0)) }
    const { data, error } = await db.from('exam_goals').update({ confidence: conf }).eq('id', body.id).eq('user_id', userId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goal: data })
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
