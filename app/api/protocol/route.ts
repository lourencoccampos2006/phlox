import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um médico internista e farmacologista clínico a criar protocolos terapêuticos em português europeu (PT-PT).
Baseia-te em guidelines actuais: ESC 2023, ADA 2024, NICE, DGS, ACC/AHA.
Responde APENAS com JSON válido sem markdown:
{
  "title": "título do protocolo (ex: Protocolo de IC com FE Reduzida)",
  "guideline": "guidelines de referência (ex: ESC Heart Failure Guidelines 2023)",
  "steps": [
    {
      "phase": "nome da fase (ex: 1ª LINHA — OBRIGATÓRIO, 2ª LINHA — ADICIONAR, etc.)",
      "drugs": [
        {
          "name": "nome DCI do fármaco",
          "dose": "dose inicial e alvo (ex: 10mg → 40mg 1x/dia)",
          "notes": "condições, contraindicações locais ou ajustes ao caso específico"
        }
      ],
      "targets": "alvos terapêuticos desta fase (ex: TA < 130/80, FC 55-60, FEVE > 40%)"
    }
  ],
  "monitoring": "parâmetros a monitorizar e frequência de follow-up",
  "warnings": ["advertência específica ao caso 1", "advertência 2"]
}
Inclui 3-4 fases/steps. Adapta ao contexto específico do doente (comorbilidades, valores analíticos, contraindicações).
Sê específico com doses (dose inicial → dose alvo). Menciona contraindicações relevantes ao caso.`
        },
        {
          role: 'user',
          content: `Protocolo terapêutico para: ${patient}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(patient.slice(0, 80), { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Protocol route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar protocolo. Tenta novamente.' }, { status: 500 })
  }
}