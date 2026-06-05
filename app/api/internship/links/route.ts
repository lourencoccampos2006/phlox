// app/api/internship/links/route.ts
// Links do estágio. Operações por TOKEN são públicas (supervisor sem conta);
// operações de gestão exigem o dono.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Cliente anónimo (para RPCs públicas por token)
function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
// Cliente com o token do utilizador (RLS) para gestão
function userClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}

// ── GET público: ler avaliação ou portefólio por token ──
export async function GET(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 60, 60_000).allowed) return rateLimitResponse()
  const evalToken = req.nextUrl.searchParams.get('eval')
  const portfolioToken = req.nextUrl.searchParams.get('portfolio')
  const db = anon()
  if (evalToken) {
    const { data, error } = await db.rpc('get_eval_by_token', { p_token: evalToken })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
    return NextResponse.json({ evaluation: data })
  }
  if (portfolioToken) {
    const { data, error } = await db.rpc('get_portfolio_by_token', { p_token: portfolioToken })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Portefólio não disponível.' }, { status: 404 })
    return NextResponse.json({ portfolio: data })
  }
  return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 40, 60_000).allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  // ── Submeter avaliação por token (PÚBLICO — supervisor sem conta) ──
  if (body.action === 'submit_eval') {
    const db = anon()
    const { data, error } = await db.rpc('submit_eval_by_token', {
      p_token: body.token,
      p_knowledge: body.knowledge, p_skills: body.skills, p_attitude: body.attitude,
      p_professionalism: body.professionalism, p_overall: body.overall,
      p_strengths: body.strengths || null, p_improvements: body.improvements || null,
      p_comments: body.comments || null, p_evaluator_name: body.evaluator_name || '',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Avaliação já submetida ou link inválido.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  // ── A partir daqui exige dono autenticado ──
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = userClient(req)

  // ── Criar pedido de avaliação (gera token) ──
  if (body.action === 'create_eval') {
    if (!body.internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })
    const { data, error } = await db.rpc('create_eval_request', {
      p_internship_id: body.internship_id, p_kind: body.kind || 'formative',
      p_evaluator_name: body.evaluator_name || null, p_evaluator_role: body.evaluator_role || null,
    })
    if (error) return NextResponse.json({ error: error.message, hint: 'Aplica supabase/sprint80_internship_links.sql' }, { status: 500 })
    return NextResponse.json({ evaluation: data })
  }

  // ── Ligar/desligar partilha do portefólio ──
  if (body.action === 'set_portfolio') {
    if (!body.internship_id) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })
    const { data, error } = await db.rpc('set_portfolio_share', { p_internship_id: body.internship_id, p_public: body.public !== false })
    if (error) return NextResponse.json({ error: error.message, hint: 'Aplica supabase/sprint80_internship_links.sql' }, { status: 500 })
    return NextResponse.json({ token: data, public: body.public !== false })
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
