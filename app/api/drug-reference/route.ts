import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Free, no-key public reference data:
//  • RxNorm / RxNav (NIH) — normalização do nome do fármaco
//  • OpenFDA drug label — interações, avisos, posologia, RAM (fonte FDA)
// Tudo server-side para evitar CORS. Falha graciosamente.

const TIMEOUT = 7000

async function fetchJSON(url: string): Promise<any | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function clean(arr: unknown, max = 1200): string | null {
  if (!Array.isArray(arr) || !arr.length) return null
  const text = String(arr[0]).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, '') + '…' : text
}

import { rotuloDe } from '@/lib/rotuloFDA'

/* A lógica mudou-se para `lib/rotuloFDA.ts` — ver lá a razão. Esta rota fica
   como o que sempre foi: a porta pública, com limite de pedidos. */
export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 2) return NextResponse.json({ error: 'Nome do fármaco obrigatório' }, { status: 400 })

  const r = await rotuloDe(q)
  if (!r.found) {
    return NextResponse.json({
      ...r,
      message: 'Sem ficha de referência FDA para este termo. A informação clínica em PT continua disponível pela análise por IA.',
    })
  }
  return NextResponse.json(r)
}
