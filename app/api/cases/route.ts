import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 6

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  // Plan gate — Student+
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('cases', plan)

  const body = await req.json().catch(() => null)
  if (!body?.prompt) return NextResponse.json({ error: 'Caso clínico obrigatório' }, { status: 400 })

  const prompt = String(body.prompt).trim().slice(0, 500)
  const cacheKey = prompt.toLowerCase().slice(0, 100)

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const result = await aiJSON<any>(messages, { maxTokens: 2000, temperature: 0.4, preferFast: false })

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Cases route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar caso. Tenta novamente.' }, { status: 500 })
  }
}