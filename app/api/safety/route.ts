import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

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
    const result = await aiJSON<any>(messages, { maxTokens: 1000, temperature: 0.1, preferFast: true })

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Safety route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}