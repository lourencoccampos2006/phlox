import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

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
    const result = await aiJSON<any>(messages, { maxTokens: 500, temperature: 0.1, preferFast: true })

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Compatibility route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}