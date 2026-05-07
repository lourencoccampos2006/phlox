import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Phlox Connect')

  const body = await req.json().catch(() => null)
  const { type, body: consultBody, medications, patient_age } = body || {}

  const result = await aiComplete([
    {
      role: 'system',
      content: `És um farmacologista clínico sénior a apoiar uma consulta inter-profissional. Analisa a situação e dá uma análise técnica concisa (máx 3 frases) que apoia o profissional que está a fazer a consulta. Inclui evidência clínica relevante (guidelines, graus de evidência). Língua: português PT-PT.`,
    },
    {
      role: 'user',
      content: `Tipo de consulta: ${type}
${patient_age ? `Doente: ${patient_age} anos` : ''}
${medications ? `Medicamentos: ${medications}` : ''}
Situação: ${consultBody}`,
    },
  ], { maxTokens: 300, temperature: 0.2 })

  const suggestion =
    typeof result === 'string'
      ? result
      : typeof result === 'object' && result !== null
        ? ('text' in result && typeof (result as { text?: unknown }).text === 'string'
            ? (result as { text: string }).text
            : 'content' in result && typeof (result as { content?: unknown }).content === 'string'
              ? (result as { content: string }).content
              : '')
        : ''

  return NextResponse.json({ suggestion })
}