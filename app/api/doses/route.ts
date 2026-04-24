import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

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
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico a criar resumos de posologia baseados em guidelines (DGS, IDSA, NICE, ESC, KDIGO, UpToDate).
Responde APENAS com JSON válido sem markdown:
{
  "indication": "nome da indicação formatado",
  "context": "contexto clínico breve",
  "options": [
    { "drug": "Nome DCI", "dose": "Dose completa", "duration": "Duração", "notes": "Notas", "allergy_note": false }
  ],
  "monitoring": "Parâmetros a monitorizar (opcional)"
}
Inclui 2-4 opções por ordem de preferência. Usa nomes DCI em português europeu.`,
      },
      { role: 'user', content: `Posologia para: ${indication}` },
    ], { maxTokens: 800, temperature: 0.1 })

        cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Doses route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar posologia. Tenta novamente.' }, { status: 500 })
  }
}