import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 60, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox OSCE')
  const body = await req.json().catch(() => ({}))
  const { persona, messages = [], course = 'medicine' } = body

  const history = messages.map((m: any) =>
    `${m.role === 'student' ? 'PROFISSIONAL' : 'DOENTE'}: ${m.content}`
  ).join('\n')

  const result = await aiComplete([
    {
      role: 'system',
      content: `És um doente numa simulação OSCE para estudantes de ${course}. Persona: ${persona}\n\nRegras: responde como doente real (emocional, com dúvidas); não dás toda a informação de uma vez; espera que te perguntem directamente; usa linguagem simples; máx 3 frases; mantém consistência com o que já disseste.`,
    },
    {
      role: 'user',
      content: `Historial:\n${history || '(início da consulta)'}\n\nResponde ao profissional como o doente.`,
    },
  ], { maxTokens: 200, temperature: 0.7 })

  const aiResult = result as {
    text?: string
    content?: string
    message?: { content?: string }
  }

  const response =
    aiResult.text ??
    aiResult.content ??
    aiResult.message?.content ??
    ''

  return NextResponse.json({ response })
}