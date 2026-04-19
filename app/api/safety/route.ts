import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 48 // 48h

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })

  const drug = String(body.drug).trim().slice(0, 100)
  const cacheKey = drug.toLowerCase()

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um farmacologista clínico especializado em segurança do medicamento.
Responde APENAS com JSON válido sem markdown:
{
  "drug": "nome DCI correcto em PT-PT",
  "drug_class": "classe farmacológica",
  "driving": {
    "level": "SEGURO" | "PRECAUCAO" | "RISCO" | "CONTRA" | "DESCONHECIDO",
    "detail": "explicação clínica concisa",
    "legal_note": "nota legal se relevante (ex: proibido por lei conduzir com esta substância) — opcional"
  },
  "sport": {
    "level": "SEGURO" | "PRECAUCAO" | "RISCO" | "CONTRA" | "DESCONHECIDO",
    "detail": "indicar se está na lista WADA e em que circunstâncias",
    "legal_note": "nota sobre doping se aplicável — opcional"
  },
  "pregnancy": {
    "level": "SEGURO" | "PRECAUCAO" | "RISCO" | "CONTRA" | "DESCONHECIDO",
    "detail": "categoria FDA (A/B/C/D/X) ou classificação EMA + justificação clínica"
  },
  "alcohol": {
    "level": "SEGURO" | "PRECAUCAO" | "RISCO" | "CONTRA" | "DESCONHECIDO",
    "detail": "mecanismo e consequências da interação com álcool"
  },
  "elderly": {
    "level": "SEGURO" | "PRECAUCAO" | "RISCO" | "CONTRA" | "DESCONHECIDO",
    "detail": "critérios Beers 2023 ou STOPP/START se aplicável, motivo de risco aumentado"
  },
  "summary_note": "nota clínica geral importante que não cabe nas categorias acima — opcional"
}
Níveis: SEGURO = sem restrições conhecidas, PRECAUCAO = usar com cuidado/monitorizar, RISCO = evitar se possível, CONTRA = contraindicado formalmente.`
        },
        {
          role: 'user',
          content: `Perfil de segurança completo de: ${drug}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Safety route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}