// app/api/study-doc/process/route.ts
// Recebe texto já extraído de um documento e gera resumo + mapa conceptual
// + perguntas + flashcards. Usa as regras de qualidade dos quizzes.
//
// O cliente envia apenas o texto (extraído no browser). O endpoint guarda
// o documento + artefactos em study_documents.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'
import { QUIZ_RULES_PT } from '@/lib/quizQuality'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*study_documents.* does not exist/i.test(m)
const MAX_CHARS = 60_000  // truncamos a entrada para caber em contexto da AI

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()
  const { plan, userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Biblioteca de estudo')

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const title = String(body.title || '').slice(0, 200).trim()
  const kind = String(body.kind || 'text')
  const text = String(body.text || '').slice(0, MAX_CHARS)
  const subject = body.subject ? String(body.subject).slice(0, 80) : null
  const source_filename = body.source_filename ? String(body.source_filename).slice(0, 200) : null
  const page_count = typeof body.page_count === 'number' ? body.page_count : null
  const goal = String(body.goal || 'summary')  // summary | quiz | flashcards | full

  if (!title || !text || text.length < 100) {
    return NextResponse.json({ error: 'Título e texto (≥ 100 chars) obrigatórios.' }, { status: 400 })
  }

  // 1) gera resumo + outline + key_concepts numa só chamada (full pipeline)
  const ai = await aiJSON<any>([
    {
      role: 'system',
      content: `És um tutor especialista em saúde a preparar material de estudo a partir de um documento que o estudante carregou. Português PT-PT.

${QUIZ_RULES_PT}

Devolves APENAS JSON com esta estrutura:
{
  "summary": "resumo executivo do documento em 4-8 frases — captura o essencial, mantém a precisão técnica",
  "outline": [
    { "title": "Secção principal", "subsections": ["sub-tópico 1", "sub-tópico 2"] }
  ],
  "key_concepts": [
    { "term": "conceito", "definition": "definição precisa em 1-2 frases", "importance": "alta"|"media"|"baixa" }
  ],
  "quiz": [
    { "question": "pergunta", "options": ["A","B","C","D"], "correct": 0, "explanation": "porque A é correta com mecanismo; porque B/C/D estão erradas", "reference": "se o documento cita uma fonte" }
  ],
  "flashcards": [
    { "front": "pergunta direta", "back": "resposta com mecanismo" }
  ]
}

Regras:
- Tira o conteúdo dos campos APENAS do que está no documento (não inventes nem adicionas fora dele). Se algo no documento parece errado, podes assinalar no resumo ("nota: a fonte original menciona X mas a guideline atual é Y").
- outline: 3-8 secções.
- key_concepts: 6-15 termos essenciais.
- quiz: EXATAMENTE 8 perguntas, formato MCQ 4 opções, EXATAMENTE 1 correta.
- flashcards: EXATAMENTE 10.
- O conteúdo deve ser representativo do documento; não enviesar para um subtema.`,
    },
    {
      role: 'user',
      content: `Título: ${title}
${subject ? `Área: ${subject}` : ''}

Conteúdo do documento (pode estar truncado a ${MAX_CHARS} caracteres):

${text}

Gera o material de estudo segundo o esquema.`,
    },
  ], { maxTokens: 4500, temperature: 0.25 })

  // 2) guarda em study_documents
  const db = sb(req)
  const { data, error } = await db.from('study_documents').insert({
    user_id: userId,
    title,
    kind,
    subject,
    source_filename,
    page_count,
    chars: text.length,
    text_content: text,
    summary: ai.summary || null,
    outline: ai.outline || null,
    key_concepts: ai.key_concepts || null,
    generated_quiz: ai.quiz || null,
    generated_flashcards: ai.flashcards || null,
    last_opened_at: new Date().toISOString(),
  }).select('id,title,kind,subject,summary,page_count,chars,created_at').single()

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ error: 'A biblioteca ainda não está ativa (aplicar sprint45_study_documents.sql).' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document: data, artifacts: ai, goal })
}
