// app/api/study/exam-generator/route.ts
// Gerador de exame a partir do material do PRÓPRIO estudante (sebentas, slides,
// testes do professor — via RAG / document_chunks). Prevê perguntas prováveis,
// incluindo perguntas DE ESCREVER (desenvolvimento), e corrige as respostas.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Gerador de exame')

  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
  const db = sb(req)

  // ── GENERATE: prevê o exame a partir do material do estudante ──
  if (body.action === 'generate') {
    const topic = String(body.topic || '').trim()
    const count = Math.min(Math.max(Number(body.count) || 6, 3), 12)
    const style = body.style || 'misto'  // 'escrita' | 'escolha' | 'misto'

    // Recupera trechos do material do utilizador (RAG). Se não houver, usa o tópico.
    let material = ''
    try {
      const { data: hits } = await db.rpc('search_my_documents', { p_query: topic || 'matéria de exame', p_limit: 8 })
      material = (hits as any[] || []).map((h: any) => h.content).join('\n\n---\n\n').slice(0, 8000)
    } catch {}

    if (!material && !topic) return NextResponse.json({ error: 'Carrega documentos em /study/documentos ou indica um tópico.' }, { status: 400 })

    try {
      const res = await aiJSON<{ questions: any[] }>([
        {
          role: 'system',
          content: `És professor de ciências da saúde a PREVER um exame, em PT-PT, com base no MATERIAL DO PRÓPRIO estudante (sebentas/slides/testes do professor dele).
Gera ${count} perguntas que têm ALTA probabilidade de sair, no estilo "${style}".
- "escrita" / "misto": inclui perguntas de DESENVOLVIMENTO (resposta livre) — define a resposta-modelo e os pontos que uma boa resposta deve conter.
- Baseia-te no que o material enfatiza (se um tema aparece muito, é provável que saia).
Responde APENAS JSON:
{
  "questions": [
    {
      "type": "escrita" | "escolha",
      "question": "enunciado",
      "options": ["A","B","C","D"],          // só se type=escolha
      "correct_index": 0,                      // só se type=escolha
      "model_answer": "resposta-modelo",        // só se type=escrita
      "key_points": ["ponto que a resposta deve conter"],  // só se type=escrita
      "why_likely": "porque é provável sair (1 frase)"
    }
  ]
}`,
        },
        { role: 'user', content: `Tópico/cadeira: ${topic || '(geral)'}\n\nMaterial do estudante:\n${material || '(sem material — usa o teu conhecimento do tópico)'}` },
      ], { maxTokens: 3000, temperature: 0.4 })
      return NextResponse.json({ questions: res?.questions || [] })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── GRADE: corrige uma resposta de DESENVOLVIMENTO do estudante ──
  if (body.action === 'grade') {
    const { question, model_answer, key_points, answer } = body
    if (!question || !answer) return NextResponse.json({ error: 'question e answer obrigatórios' }, { status: 400 })
    try {
      const res = await aiJSON<any>([
        {
          role: 'system',
          content: `És examinador. Corriges a resposta de desenvolvimento de um estudante, em PT-PT, com rigor mas justiça.
Responde APENAS JSON:
{ "score": 0-100, "covered": ["ponto que acertou"], "missing": ["ponto-chave que faltou"], "errors": ["imprecisão/erro, se houver"], "feedback": "1-2 frases" }`,
        },
        { role: 'user', content: `Pergunta: ${question}\nResposta-modelo: ${model_answer || ''}\nPontos-chave esperados: ${(key_points || []).join('; ')}\n\nResposta do estudante:\n${String(answer).slice(0, 3000)}` },
      ], { maxTokens: 800, temperature: 0.2 })
      return NextResponse.json({ result: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
