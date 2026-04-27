import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.image) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  const mimeType = String(body.mimeType || 'image/jpeg')

  try {
    const result = await callGeminiVisionJSON<{
      drug_name: string | null
      brand_name: string | null
      confidence: 'high' | 'medium' | 'low'
    }>(
      `Analisa esta imagem de um medicamento — pode ser uma caixa, blister, rótulo, ou comprimido.

Identifica o medicamento principal visível. Responde APENAS com JSON sem markdown:
{
  "drug_name": "nome em inglês DCI/genérico (ex: ibuprofen, metformin) — null se não identificado",
  "brand_name": "nome comercial visível (ex: Brufen, Voltaren) — null se não visível",
  "confidence": "high" | "medium" | "low"
}`,
      body.image,
      mimeType,
      { maxTokens: 200 }
    )

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Drug identify error:', err?.message)
    return NextResponse.json({ drug_name: null, brand_name: null, confidence: 'low', error: err.message }, { status: 500 })
  }
}