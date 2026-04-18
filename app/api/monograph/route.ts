import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um farmacologista clínico a criar monografias farmacológicas rigorosas em português europeu (PT-PT).
Responde APENAS com JSON válido sem markdown:
{
  "name": "nome DCI correcto em PT-PT",
  "class": "classe farmacológica",
  "atc": "código ATC (ex: C10AA01)",
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
}
Cada secção deve ter 2–5 frases clínicas precisas. Usa terminologia farmacológica portuguesa correcta.
Para Posologia: inclui doses habituais por indicação principal.
Para Farmacocinética: Tmáx, t½, ligação proteica, metabolismo, excreção.
Para Efeitos Adversos: lista por frequência (muito frequente ≥10%, frequente 1–10%, pouco frequente).
Para Interações: foca nas clinicamente significativas (CYP, transportadores, farmacodinâmicas).
Se o fármaco não existir ou for desconhecido, retorna um erro claro no campo name.`
        },
        {
          role: 'user',
          content: `Monografia clínica completa de: ${drug}`
        }
      ],
      temperature: 0.15,
      max_tokens: 2500,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Monograph route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao gerar monografia. Tenta novamente.' }, { status: 500 })
  }
}