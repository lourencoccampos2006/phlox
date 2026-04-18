import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 12 // 12h

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null)
  if (!body?.indication) return NextResponse.json({ error: 'Indicação obrigatória' }, { status: 400 })

  const indication = String(body.indication).trim().slice(0, 200)
  const cacheKey = indication.toLowerCase().replace(/\s+/g, ' ')

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
          content: `És um farmacologista clínico a criar resumos de posologia baseados em guidelines (DGS, IDSA, NICE, ESC, KDIGO, UpToDate).
Responde APENAS com JSON válido sem markdown:
{
  "indication": "nome da indicação formatado",
  "context": "contexto clínico breve (ex: adulto sem comorbilidades, ambulatório)",
  "options": [
    {
      "drug": "Nome DCI do fármaco",
      "dose": "Dose completa (ex: 875/125 mg 2x/dia oral)",
      "duration": "Duração (ex: 5–7 dias)",
      "notes": "Observações clínicas relevantes (opcional)",
      "allergy_note": false
    }
  ],
  "monitoring": "Parâmetros a monitorizar ou notas de follow-up (opcional, omite se não relevante)"
}
Inclui 2–4 opções por ordem de preferência (1ª linha, 2ª linha, alternativa em caso de alergia).
Usa nomes DCI em português europeu. Doses em unidades europeias (mg, não mcg para doses orais comuns).
Se for antibiótico: inclui sempre duração. Se for doença crónica: especifica que é início de tratamento.`
        },
        {
          role: 'user',
          content: `Posologia para: ${indication}`
        }
      ],
      temperature: 0.1,
      max_tokens: 800,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Doses route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar posologia. Tenta novamente.' }, { status: 500 })
  }
}