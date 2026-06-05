// app/api/internship/coach/route.ts
// Coach do Estágio — a IA interpreta o estágio específico do estudante e gera
// análise de casuística, lacunas, debrief, preparação de turno e FERRAMENTAS à
// medida. Tudo orientado a maximizar a performance naquele estágio concreto.
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

async function snapshot(db: any, internshipId: string) {
  const { data, error } = await db.rpc('internship_snapshot', { p_internship_id: internshipId })
  if (error) throw new Error(error.message)
  return data
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Coach do Estágio')

  const body = await req.json().catch(() => null) as any
  if (!body?.action || !body?.internship_id) return NextResponse.json({ error: 'action e internship_id obrigatórios' }, { status: 400 })
  const db = sb(req)

  let snap: any
  try { snap = await snapshot(db, body.internship_id) }
  catch (e: any) { return NextResponse.json({ error: e.message, hint: 'Aplica supabase/sprint79_internship_coach.sql' }, { status: 500 }) }

  const ctx = `Estágio: ${JSON.stringify(snap?.internship || {})}
Diagnósticos dos doentes vistos: ${JSON.stringify(snap?.diagnoses || [])}
Comorbilidades: ${JSON.stringify(snap?.comorbidities || [])}
Procedimentos: ${JSON.stringify(snap?.procedures || [])}
Objetivos: ${JSON.stringify(snap?.objectives || [])}
Nº de doentes: ${snap?.patient_count || 0}`

  // ── Análise de casuística: o que viste, padrões, distribuição ──
  if (body.action === 'caseload') {
    try {
      const res = await aiJSON<any>([
        { role: 'system', content: `És coach clínico. Analisa a casuística deste estudante NESTE estágio, em PT-PT.
Responde APENAS JSON:
{
  "summary": "2-3 frases sobre o perfil de casos que este estudante está a ver",
  "top_conditions": [{ "name": "...", "count_estimate": 4, "why_matters": "porque é importante dominar nesta área" }],
  "exposure_balance": "1 frase: o que está sobre-representado e o que falta ver",
  "must_master": ["3-5 temas que ESTE estudante TEM de dominar dada a casuística"]
}` },
        { role: 'user', content: ctx },
      ], { maxTokens: 1200, temperature: 0.3 })
      await db.from('internship_insights').insert({ internship_id: body.internship_id, user_id: userId, kind: 'caseload', payload: res })
      return NextResponse.json({ result: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Lacunas: o que falta, com plano de ação ──
  if (body.action === 'gaps') {
    try {
      const res = await aiJSON<any>([
        { role: 'system', content: `És coach clínico. Deteta as LACUNAS de aprendizagem deste estudante dada a casuística e os objetivos do estágio. Sê específico e acionável, em PT-PT.
Responde APENAS JSON:
{
  "gaps": [
    { "gap": "lacuna concreta (ex: 'viste ICs mas nenhum registo de ECG/eco')", "severity": "alta|media|baixa", "action": "o que fazer já", "study": "tema exato a estudar" }
  ],
  "next_best_action": "A única coisa mais importante a fazer a seguir"
}` },
        { role: 'user', content: ctx },
      ], { maxTokens: 1300, temperature: 0.3 })
      await db.from('internship_insights').insert({ internship_id: body.internship_id, user_id: userId, kind: 'gaps', payload: res })
      return NextResponse.json({ result: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Debrief diário ──
  if (body.action === 'debrief') {
    const today = String(body.today_notes || '').slice(0, 2000)
    try {
      const res = await aiJSON<any>([
        { role: 'system', content: `És tutor clínico a fazer o debrief do dia do estudante, em PT-PT. Socrático e prático.
Responde APENAS JSON:
{
  "recap": "2 frases a consolidar o que viu hoje",
  "questions": ["3 perguntas socráticas sobre os casos de hoje, com resposta esperada curta em 'answer'"],
  "questions_detail": [{ "q": "...", "answer": "..." }],
  "one_thing": "Uma coisa para rever esta noite (5 min)"
}` },
        { role: 'user', content: `${ctx}\n\nNotas de hoje do estudante:\n${today || '(sem notas — usa a casuística geral)'}` },
      ], { maxTokens: 1200, temperature: 0.35 })
      await db.from('internship_insights').insert({ internship_id: body.internship_id, user_id: userId, kind: 'debrief', payload: res })
      return NextResponse.json({ result: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Preparação de turno ──
  if (body.action === 'prep') {
    const expect = String(body.expectation || '').slice(0, 600)
    try {
      const res = await aiJSON<any>([
        { role: 'system', content: `És coach clínico a preparar o estudante para o próximo turno NESTE estágio, em PT-PT.
Responde APENAS JSON:
{
  "review": ["3-4 tópicos a rever antes do turno, dados a casuística e a área"],
  "tutor_questions": ["3 perguntas que o tutor/supervisor pode fazer hoje"],
  "red_flags": ["3 red flags a vigiar nos doentes desta área"],
  "skills": ["2-3 competências práticas a tentar treinar hoje"]
}` },
        { role: 'user', content: `${ctx}\n\nO estudante espera hoje: ${expect || '(turno normal na área)'}` },
      ], { maxTokens: 1100, temperature: 0.3 })
      await db.from('internship_insights').insert({ internship_id: body.internship_id, user_id: userId, kind: 'prep', payload: res })
      return NextResponse.json({ result: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Gerar FERRAMENTAS à medida deste estágio (o coração da visão) ──
  if (body.action === 'generate_tools') {
    try {
      const res = await aiJSON<{ tools: any[] }>([
        { role: 'system', content: `És coach clínico. Com base no estágio ESPECÍFICO deste estudante (área, casuística, objetivos), PROPÕE 3-5 ferramentas práticas que o ajudariam a maximizar a performance NESTE estágio concreto. Não genéricas — à medida do que ele realmente vê e precisa. PT-PT.
Tipos possíveis (kind): 'checklist' (passos a seguir), 'drill' (perguntas de treino rápido), 'reference' (cartão de consulta rápida), 'calculator' (fórmula/score relevante), 'protocol' (algoritmo de decisão).
Responde APENAS JSON:
{
  "tools": [
    {
      "title": "nome específico (ex: 'Checklist de admissão em Cardiologia')",
      "rationale": "porque é útil para ESTE estudante neste estágio",
      "kind": "checklist|drill|reference|calculator|protocol",
      "content": { "items": ["passo/pergunta/linha 1", "..."] }
    }
  ]
}
Para 'drill', content.items = perguntas; para 'checklist'/'protocol', passos ordenados; para 'reference', factos-chave; para 'calculator', fórmula + variáveis em items.` },
        { role: 'user', content: ctx },
      ], { maxTokens: 2200, temperature: 0.4 })
      const tools = (res?.tools || []).slice(0, 6)
      // grava as ferramentas geradas
      if (tools.length) {
        await db.from('internship_tools').insert(tools.map((t: any) => ({
          internship_id: body.internship_id, user_id: userId,
          title: String(t.title || 'Ferramenta').slice(0, 160),
          rationale: t.rationale || null, kind: t.kind || 'reference', content: t.content || {},
        })))
      }
      return NextResponse.json({ tools })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Gerar flashcards dos doentes vistos (liga ao sistema de memória) ──
  if (body.action === 'cards_from_cases') {
    try {
      const res = await aiJSON<{ flashcards: { front: string; back: string }[] }>([
        { role: 'system', content: `Gera flashcards de revisão espaçada a partir dos casos que ESTE estudante viu neste estágio, em PT-PT. Foca o que é alto rendimento para a área. 5-10 cartões. Responde APENAS JSON: { "flashcards": [{ "front": "...", "back": "..." }] }` },
        { role: 'user', content: ctx },
      ], { maxTokens: 1800, temperature: 0.3 })
      return NextResponse.json({ flashcards: res?.flashcards || [] })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const internshipId = req.nextUrl.searchParams.get('internship_id')
  if (!internshipId) return NextResponse.json({ error: 'internship_id obrigatório' }, { status: 400 })
  const db = sb(req)
  const { data: tools } = await db.from('internship_tools').select('*').eq('internship_id', internshipId).order('created_at', { ascending: false })
  return NextResponse.json({ tools: tools || [] })
}
