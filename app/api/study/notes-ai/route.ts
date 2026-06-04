// app/api/study/notes-ai/route.ts
// Assistente IA para o módulo de notas: resumir, expandir, simplificar,
// converter em flashcards, sugerir ligações entre notas.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete, aiJSON } from '@/lib/ai'
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

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'IA nas notas')

  const body = await req.json().catch(() => null) as { action?: string; text?: string; title?: string; note_id?: string } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const db = sb(req)

  // ── SUMMARIZE: resume nota longa em bullets ──
  if (body.action === 'summarize') {
    if (!body.text) return NextResponse.json({ error: 'text obrigatório' }, { status: 400 })
    try {
      const { text } = await aiComplete([
        { role: 'system', content: 'És assistente clínico. Resume notas em 5-7 bullets concisos em PT-PT. Markdown com - para listas. Preserva números, doses, valores de referência.' },
        { role: 'user', content: body.text },
      ], { maxTokens: 600, temperature: 0.2 })
      return NextResponse.json({ result: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── EXPAND: expande nota concisa em texto completo ──
  if (body.action === 'expand') {
    if (!body.text) return NextResponse.json({ error: 'text obrigatório' }, { status: 400 })
    try {
      const { text } = await aiComplete([
        { role: 'system', content: 'És clínico sénior. Recebes notas concisas e expande-as em explicação clara em PT-PT (~300 palavras), com mecanismos, exemplos clínicos e ligações importantes. Markdown com **negrito** para termos chave.' },
        { role: 'user', content: body.text },
      ], { maxTokens: 1500, temperature: 0.3 })
      return NextResponse.json({ result: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── SIMPLIFY: explica em linguagem mais simples ──
  if (body.action === 'simplify') {
    if (!body.text) return NextResponse.json({ error: 'text obrigatório' }, { status: 400 })
    try {
      const { text } = await aiComplete([
        { role: 'system', content: 'Reescreve esta nota clínica em linguagem mais simples mantendo rigor, em PT-PT. Como se explicasses a um colega que está a ver o tema pela primeira vez. Markdown.' },
        { role: 'user', content: body.text },
      ], { maxTokens: 1200, temperature: 0.3 })
      return NextResponse.json({ result: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── TO FLASHCARDS: converte nota em flashcards SRS ──
  if (body.action === 'to_flashcards') {
    if (!body.text) return NextResponse.json({ error: 'text obrigatório' }, { status: 400 })
    try {
      const res = await aiJSON<{ flashcards: { front: string; back: string }[] }>([
        {
          role: 'system',
          content: `Converte esta nota em flashcards de repetição espaçada em PT-PT.
Regras:
- 5-12 flashcards.
- Cada flashcard testa UMA ideia específica.
- "front" = pergunta clara e fechada.
- "back" = resposta concisa com mecanismo/justificação quando aplicável.
- Inclui mnemónicas se ajudam.
- Doses concretas quando aplicável.

Responde APENAS JSON: { "flashcards": [{ "front": "...", "back": "..." }] }`,
        },
        { role: 'user', content: body.text },
      ], { maxTokens: 2500, temperature: 0.2 })
      return NextResponse.json(res)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── SUGGEST LINKS: sugere ligações a outras notas ──
  if (body.action === 'suggest_links') {
    if (!body.text || !body.title) return NextResponse.json({ error: 'text e title obrigatórios' }, { status: 400 })
    const { data: otherNotes } = await db.from('study_notes')
      .select('id, title, domain, tags')
      .neq('id', body.note_id || '')
      .limit(50)
    try {
      const res = await aiJSON<{ suggestions: { title: string; reason: string }[] }>([
        {
          role: 'system',
          content: `Recebes uma nota e uma lista de outras notas do utilizador.
Sugere quais notas estão relacionadas e devem ser ligadas via [[título]] em PT-PT.

Responde APENAS JSON:
{
  "suggestions": [
    { "title": "exact_title_from_list", "reason": "porquê liga" }
  ]
}

Só sugere se há ligação semântica/clínica REAL. Máximo 5. Usa apenas títulos EXACTAMENTE como na lista.`,
        },
        {
          role: 'user',
          content: `Nota actual: ${body.title}\n${body.text.substring(0, 1500)}\n\nOutras notas:\n${(otherNotes || []).map(n => `- ${n.title}${n.domain ? ` (${n.domain})` : ''}`).join('\n')}`,
        },
      ], { maxTokens: 800, temperature: 0.2 })
      return NextResponse.json(res)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── GENERATE FROM TOPIC: cria nota a partir de um tópico ──
  if (body.action === 'generate_from_topic') {
    const topic = body.title || ''
    if (!topic) return NextResponse.json({ error: 'title obrigatório' }, { status: 400 })
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `Gera uma nota clínica completa e bem estruturada sobre o tópico, em PT-PT, em markdown.
Secções típicas: **Definição/Conceito**, **Fisiopatologia/Mecanismo**, **Manifestações**, **Diagnóstico**, **Tratamento**, **Pearls/Pitfalls**.
Adapta as secções ao tópico. Cita guidelines quando relevante.
500-800 palavras.`,
        },
        { role: 'user', content: `Tópico: ${topic}` },
      ], { maxTokens: 2000, temperature: 0.25 })
      return NextResponse.json({ result: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
