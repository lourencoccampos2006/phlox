import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

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
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico especializado em segurança do medicamento.
Responde APENAS com JSON válido sem markdown:
{
  "drug": "nome DCI correcto em PT-PT",
  "drug_class": "classe farmacológica",
  "driving": { "level": "SEGURO"|"PRECAUCAO"|"RISCO"|"CONTRA"|"DESCONHECIDO", "detail": "explicação clínica", "legal_note": "nota legal (opcional)" },
  "sport": { "level": "SEGURO"|"PRECAUCAO"|"RISCO"|"CONTRA"|"DESCONHECIDO", "detail": "WADA e circunstâncias", "legal_note": "doping (opcional)" },
  "pregnancy": { "level": "SEGURO"|"PRECAUCAO"|"RISCO"|"CONTRA"|"DESCONHECIDO", "detail": "categoria FDA/EMA + justificação" },
  "alcohol": { "level": "SEGURO"|"PRECAUCAO"|"RISCO"|"CONTRA"|"DESCONHECIDO", "detail": "mecanismo e consequências" },
  "elderly": { "level": "SEGURO"|"PRECAUCAO"|"RISCO"|"CONTRA"|"DESCONHECIDO", "detail": "Beers 2023/STOPP se aplicável" },
  "summary_note": "nota clínica geral (opcional)"
}`,
      },
      { role: 'user', content: `Perfil de segurança completo de: ${drug}` },
    ], { maxTokens: 1000, temperature: 0.1 })

        cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Safety route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}