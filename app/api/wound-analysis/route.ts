import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

interface WoundAI {
  tissue: string
  exudate: string
  infection_signs: boolean
  infection_notes: string
  suggested_stage: string
  periwound: string
  observations: string
  recommendations: string[]
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 12, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.imageBase64) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  const ctx = body.context || {}
  const prompt = `És enfermeiro(a) especialista em viabilidade tecidular e tratamento de feridas, a apoiar uma equipa de um lar/ERPI em Portugal.
Analisa esta fotografia de uma ferida${ctx.location ? ` localizada em ${ctx.location}` : ''}${ctx.type ? ` (tipo: ${ctx.type})` : ''}.

Responde APENAS com JSON válido em português de Portugal:
{
  "tissue": "granulação | esfacelo | necrótico | epitelização | misto",
  "exudate": "nenhum | escasso | moderado | abundante",
  "infection_signs": true/false,
  "infection_notes": "sinais observados (eritema, edema, exsudado purulento, odor) ou 'sem sinais evidentes'",
  "suggested_stage": "I | II | III | IV | inclassificável | não aplicável",
  "periwound": "estado da pele perilesional",
  "observations": "descrição clínica objetiva da ferida (2-3 frases)",
  "recommendations": ["recomendação prática 1", "recomendação prática 2"]
}

Sê objetivo e prudente. Esta análise é de APOIO e não substitui a avaliação presencial por um profissional.`

  try {
    const result = await callGeminiVisionJSON<WoundAI>(prompt, body.imageBase64, body.mimeType || 'image/jpeg', { maxTokens: 1200 })
    return NextResponse.json({ ...result, disclaimer: 'Análise de apoio por IA — confirmar sempre com avaliação presencial.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível analisar a imagem.' }, { status: 500 })
  }
}
