import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um professor de farmacologia clínica a criar casos clínicos interactivos em português europeu (PT-PT).
Responde APENAS com JSON válido sem markdown:
{
  "title": "título conciso do caso (ex: Anticoagulação no Doente Renal com FA)",
  "presentation": "apresentação clínica detalhada do caso — dados do doente, história, analíticas relevantes, medicação actual. 3-4 parágrafos ricos em dados clínicos.",
  "differential_options": ["opção A", "opção B", "opção C", "opção D"],
  "correct_dx": "opção correcta (deve ser exactamente igual a uma das differential_options)",
  "dx_hint": "dica discreta quando a resposta ao diagnóstico está errada",
  "therapy_options": [
    { "option": "descrição da opção terapêutica", "correct": true/false }
  ],
  "explanation": "explicação clínica completa e detalhada da decisão correcta — mecanismo, evidência, guidelines, porque as outras opções são incorrectas. 3-5 parágrafos.",
  "key_learning": ["ponto de aprendizagem 1", "ponto 2", "ponto 3"]
}
Inclui 4 opções de diagnóstico diferencial e 4 opções terapêuticas (apenas 1 correcta cada).
O caso deve ser clinicamente desafiante mas realista. Usa dados concretos (valores laboratoriais, doses).`
        },
        {
          role: 'user',
          content: `Cria um caso clínico interactivo baseado em: ${prompt}`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Cases route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar caso. Tenta novamente.' }, { status: 500 })
  }
}