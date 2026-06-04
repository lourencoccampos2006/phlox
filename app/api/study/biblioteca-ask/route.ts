// app/api/study/biblioteca-ask/route.ts
// POST → pergunta clínica → resposta baseada em guidelines locais + IA.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete } from '@/lib/ai'
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
  if (plan === 'free') return planGateResponse('student', 'Biblioteca IA')

  const body = await req.json().catch(() => null) as { question?: string } | null
  if (!body?.question || body.question.trim().length < 3) {
    return NextResponse.json({ error: 'Pergunta obrigatória' }, { status: 400 })
  }

  const db = sb(req)
  const q = body.question.trim()

  // Recupera entradas da biblioteca relevantes — search no título, tags e domínio.
  // Procura por palavras-chave da pergunta.
  const keywords = q.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 8)
  const orFilter = keywords.map(k => `title.ilike.%${k}%,summary.ilike.%${k}%,domain.ilike.%${k}%`).join(',')

  const { data: entries } = await db.from('medical_library')
    .select('id, title, source, year, domain, summary, body, tags')
    .or(orFilter || 'title.ilike.%a%')
    .limit(8)

  const context = (entries || []).map(e => `
[${e.source} ${e.year || ''}] ${e.title} (${e.domain})
${e.summary || ''}
${(e.body || '').substring(0, 800)}
`).join('\n---\n')

  try {
    const { text } = await aiComplete([
      {
        role: 'system',
        content: `És clínico sénior com acesso a guidelines actualizadas.
Respondes em PT-PT com rigor clínico, citando fonte e ano quando aplicável.
Quando a pergunta tem várias dimensões, estrutura em: definição, abordagem diagnóstica, tratamento, "pearls".
Usa markdown leve (**negrito** para termos chave, listas com -, secções com ##).
Se a pergunta sair do âmbito da biblioteca disponível, diz que estás a responder com base no teu conhecimento geral (sem citar guidelines específicas).
Máximo 600 palavras.`,
      },
      {
        role: 'user',
        content: `Pergunta: ${q}\n\nFontes disponíveis na biblioteca:\n${context || '(sem fontes na biblioteca para esta pergunta)'}\n\nResponde de forma rigorosa e útil para um estudante/profissional de saúde.`,
      },
    ], { maxTokens: 1500, temperature: 0.2 })

    return NextResponse.json({
      answer: text,
      sources: (entries || []).map(e => ({ id: e.id, title: e.title, source: e.source, year: e.year, domain: e.domain })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
