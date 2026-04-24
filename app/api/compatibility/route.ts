import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 48 // 48h — compatibilidade muda pouco

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null)
  if (!body?.drug1 || !body?.drug2) {
    return NextResponse.json({ error: 'Dois fármacos obrigatórios' }, { status: 400 })
  }

  const drug1 = String(body.drug1).trim().slice(0, 80)
  const drug2 = String(body.drug2).trim().slice(0, 80)
  const solution = String(body.solution || 'NaCl 0.9%').slice(0, 50)

  const cacheKey = [drug1, drug2].sort().join('|').toLowerCase() + ':' + solution.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico hospitalar especialista em compatibilidade de fármacos IV. Baseia-te em Trissel's Handbook of Injectable Drugs, King Guide to Parenteral Admixtures, e publicações científicas.
Responde APENAS com JSON válido sem markdown:
{
  "status": "COMPATIVEL" | "INCOMPATIVEL" | "CONDICIONAL" | "DESCONHECIDO",
  "summary": "Resumo claro em 1-2 frases em português europeu",
  "mechanism": "Mecanismo de incompatibilidade se aplicável (opcional)",
  "conditions": "Condições para compatibilidade se CONDICIONAL (opcional)",
  "concentration_limits": "Limites de concentração se relevantes (opcional)",
  "time_limit": "Estabilidade temporal se relevante (opcional)",
  "alternative": "Alternativa recomendada se INCOMPATIVEL (opcional)",
  "source": "Trissel's / King Guide / Literatura"
}`,
      },
      { role: 'user', content: `Compatibilidade IV de ${drug1} com ${drug2} em ${solution}.` },
    ], { maxTokens: 500, temperature: 0.1 })

        cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Compatibility route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}