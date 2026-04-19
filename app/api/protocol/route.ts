import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 4

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 8, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.patient) return NextResponse.json({ error: 'Contexto do doente obrigatório' }, { status: 400 })

  const patient = String(body.patient).trim().slice(0, 600)

  try {
    const result = await aiJSON<any>(messages, { maxTokens: 1500, temperature: 0.1, preferFast: false })

    cache.set(patient.slice(0, 80), { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Protocol route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar protocolo. Tenta novamente.' }, { status: 500 })
  }
}