import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 4

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.medications) return NextResponse.json({ error: 'Lista de medicamentos obrigatória' }, { status: 400 })

  const medications = String(body.medications).trim().slice(0, 1000)
  const mode: 'simple' | 'technical' = body.mode === 'technical' ? 'technical' : 'simple'

  const cacheKey = `${mode}:${medications.toLowerCase().slice(0, 150)}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  const systemPrompt = mode === 'simple'
    ? `És um farmacêutico a explicar medicação a um doente comum, de forma clara e sem jargão técnico.
Usa linguagem simples, como explicarias a um familiar. Evita termos médicos complexos.
Responde APENAS com JSON válido sem markdown:
{
  "overall": {
    "level": "green" | "yellow" | "red",
    "title": "Título resumo (ex: 'A sua medicação está bem combinada' ou 'Encontrámos alguns pontos a verificar')",
    "summary": "Resumo geral em 2-3 frases, linguagem simples"
  },
  "findings": [
    {
      "level": "red" | "yellow" | "green",
      "title": "O que encontrámos (linguagem simples)",
      "explanation": "Explicação clara sem jargão (o que significa, porquê importa)",
      "action": "O que o doente deve fazer (ex: 'Fala com o teu médico sobre isto na próxima consulta')"
    }
  ],
  "positives": ["Aspecto positivo da medicação em linguagem simples"]
}
Máximo 4 findings. Foca no que é clinicamente relevante. Sê positivo quando possível.`
    : `És um farmacologista clínico a fazer revisão de medicação para um profissional de saúde.
Usa terminologia técnica adequada. Cita mecanismos, interações farmacológicas, e guidelines.
Responde APENAS com JSON válido sem markdown:
{
  "overall": {
    "level": "green" | "yellow" | "red",
    "title": "Classificação técnica",
    "summary": "Resumo técnico da revisão de medicação"
  },
  "findings": [
    {
      "level": "red" | "yellow" | "green",
      "title": "Problema/observação técnica",
      "explanation": "Mecanismo farmacológico, gravidade, evidência clínica",
      "action": "Recomendação clínica específica"
    }
  ],
  "positives": ["Aspecto positivo técnico da medicação"]
}
Máximo 5 findings. Inclui: interações clinicamente relevantes, redundâncias, omissões evidentes, problemas de dose, adequação para perfil do doente se descrito.`

  try {
    const result = await aiJSON<any>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analisa esta medicação:\n\n${medications}` },
    ], { maxTokens: 1000, temperature: 0.1 })

        cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Quickcheck error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}