import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 48 // 48h

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Nome do fármaco obrigatório' }, { status: 400 })

  const drug = String(body.drug).trim().slice(0, 100)
  const cacheKey = drug.toLowerCase()

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico a criar monografias farmacológicas rigorosas em português europeu (PT-PT).
Responde APENAS com JSON válido sem markdown:
{
  "name": "nome DCI correcto em PT-PT",
  "class": "classe farmacológica",
  "atc": "código ATC",
  "sections": [
    { "title": "Mecanismo de Acção", "content": "..." },
    { "title": "Indicações", "content": "..." },
    { "title": "Posologia", "content": "..." },
    { "title": "Farmacocinética", "content": "..." },
    { "title": "Efeitos Adversos", "content": "..." },
    { "title": "Contraindicações", "content": "..." },
    { "title": "Interações Relevantes", "content": "..." },
    { "title": "Monitorização", "content": "..." },
    { "title": "Gravidez e Aleitamento", "content": "..." },
    { "title": "Observações Clínicas", "content": "..." }
  ]
}`,
      },
      { role: 'user', content: `Monografia clínica completa de: ${drug}` },
    ], { maxTokens: 2500, temperature: 0.15 })

        cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Monograph route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar monografia. Tenta novamente.' }, { status: 500 })
  }
}