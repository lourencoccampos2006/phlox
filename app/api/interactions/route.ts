import { NextRequest, NextResponse } from 'next/server'
import { checkInteractions } from '@/lib/interactionsEngine'

const rateLimitMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 25
const RATE_WINDOW = 60 * 1000

function getIP(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.reset) { rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW }); return true }
  if (record.count >= RATE_LIMIT) return false
  record.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })
  }
  // Limite diário server-side por utilizador (Base/Plus). Pro/Institucional = ilimitado.
  const { enforceDailyLimit } = await import('@/lib/serverLimit')
  const gate = await enforceDailyLimit(req, 'interactions')
  if (!gate.ok) return gate.response!

  const body = await req.json().catch(() => null)

  // ── IMAGE MODE: identify drugs from photo ────────────────────────────────
  if (body?.image) {
    try {
      const { callGeminiVisionJSON } = await import('@/lib/ai')
      const parsed = await callGeminiVisionJSON<{ drugs?: string[] }>(
        'List all medication names visible in this image. Return ONLY a JSON object, no markdown: {"drugs": ["name1", "name2"]}. Use INN/generic names in Portuguese when possible.',
        body.image,
        body.mimeType || 'image/jpeg',
        { maxTokens: 300 }
      )
      return NextResponse.json({ identified_drugs: parsed.drugs || [] })
    } catch (e: any) {
      return NextResponse.json({ error: `Erro ao analisar imagem: ${e.message}` }, { status: 500 })
    }
  }

  // ── TEXT MODE ──────────────────────────────────────────────────────────────
  if (!body?.drugs || !Array.isArray(body.drugs)) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  try {
    const result = await checkInteractions(body.drugs)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err?.code === 'invalid_count') return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('Interactions error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar interações. Tenta novamente.' }, { status: 500 })
  }
}
