// lib/rateLimit.ts
// Rate limiter partilhado por todas as API routes que usam Groq
// Cloudflare Workers não tem memória persistente entre requests,
// mas dentro do mesmo isolate (mesmo pedido / warm instance) isto funciona.

const rateLimitMap = new Map<string, { count: number; reset: number }>()

export function checkRateLimit(
  ip: string,
  limit = 15,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count }
}

export function getIP(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  )
}

export function rateLimitResponse() {
  return Response.json(
    { error: 'Demasiados pedidos. Aguarda um minuto e tenta novamente.' },
    { status: 429 }
  )
}