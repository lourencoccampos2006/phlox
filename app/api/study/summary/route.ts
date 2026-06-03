// app/api/study/summary/route.ts
// POST → gera resumo personalizado de um tema, em vários formatos.
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const FORMATS: Record<string, { instruction: string; tokens: number }> = {
  flash:  { instruction: 'Resumo flash de 5 bullet points essenciais para exame. Máximo 80 palavras totais.', tokens: 350 },
  curto:  { instruction: 'Resumo curto (200-300 palavras) focado no essencial para a prática clínica.', tokens: 600 },
  medio:  { instruction: 'Resumo médio (500-700 palavras) com mecanismos, manifestações, abordagem e tratamento.', tokens: 1200 },
  completo: { instruction: 'Resumo completo (1000-1500 palavras) com fisiopatologia, diagnóstico diferencial, exames complementares, tratamento detalhado, complicações.', tokens: 2200 },
  exame:  { instruction: 'Resumo focado em exame: definições-chave, critérios diagnósticos, fármacos de primeira linha, mnemónicas, "pearls" comuns. Máximo 400 palavras.', tokens: 800 },
  pratica: { instruction: 'Resumo focado em prática clínica: o que pedir, quando suspeitar, quando tratar empiricamente, red flags. Máximo 500 palavras.', tokens: 900 },
}

const LEVELS: Record<string, string> = {
  estudante: 'estudante do 3º ano',
  finalista: 'finalista da licenciatura',
  interno: 'médico interno / pós-graduado',
  especialista: 'especialista a rever',
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Resumos IA')

  const body = await req.json().catch(() => null) as { topic?: string; format?: string; level?: string; domain?: string } | null
  if (!body?.topic) return NextResponse.json({ error: 'topic obrigatório' }, { status: 400 })

  const fmt = FORMATS[body.format || 'medio'] || FORMATS.medio
  const lvl = LEVELS[body.level || 'finalista'] || LEVELS.finalista

  try {
    const { text } = await aiComplete([
      {
        role: 'system',
        content: `És médico/farmacêutico especialista e autor de manuais clínicos em Portugal.
Produzes resumos clínicos rigorosos em PT-PT, baseados em guidelines actualizadas (ESC, DGS, NICE, UpToDate).

Nível alvo: ${lvl}.
Formato: ${fmt.instruction}
${body.domain ? `Foco no domínio: ${body.domain}.` : ''}

Regras:
- PT-PT estrito (decisão, não "decisão").
- Termos clínicos correctos, com nomes DCI (não marcas) excepto quando relevante.
- Doses concretas quando aplicável.
- Sem disclaimers genéricos do tipo "consulte sempre um médico".
- Markdown leve: **negritos** para termos-chave, listas com -, secções com ##.
- Se for tema com critérios diagnósticos, lista-os.
- Se for tema farmacológico, inclui dose, via, efeitos adversos.`,
      },
      { role: 'user', content: `Faz um resumo sobre: "${body.topic}"` },
    ], { maxTokens: fmt.tokens, temperature: 0.2 })

    return NextResponse.json({ summary: text, topic: body.topic, format: body.format || 'medio', level: body.level || 'finalista' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 })
  }
}
