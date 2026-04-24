import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

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
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico internista e farmacologista clínico a criar protocolos terapêuticos em português europeu (PT-PT). Baseia-te em guidelines actuais: ESC 2023, ADA 2024, NICE, DGS, ACC/AHA.
Responde APENAS com JSON válido sem markdown:
{
  "title": "título do protocolo",
  "guideline": "guidelines de referência",
  "steps": [
    {
      "phase": "nome da fase",
      "drugs": [{ "name": "nome DCI", "dose": "dose inicial e alvo", "notes": "condições específicas" }],
      "targets": "alvos terapêuticos desta fase"
    }
  ],
  "monitoring": "parâmetros a monitorizar e frequência",
  "warnings": ["advertência específica ao caso"]
}
Inclui 3-4 fases. Adapta ao contexto específico do doente.`,
      },
      { role: 'user', content: `Protocolo terapêutico para: ${patient}` },
    ], { maxTokens: 1500, temperature: 0.1 })

    cache.set(patient.slice(0, 80), { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Protocol route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar protocolo. Tenta novamente.' }, { status: 500 })
  }
}