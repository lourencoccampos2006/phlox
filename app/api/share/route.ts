// app/api/share/route.ts — Phlox Partilhar
// Cria uma URL pública partilhável para qualquer resultado.
// Usado em: interações, análises, care plan, resultados Arena.

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

function randomId(n = 8) {
  // CSPRNG: o id é a única coisa que protege um resultado clínico partilhado.
  // Math.random é previsível → permitiria enumerar partilhas de outros.
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const rnd = new Uint32Array(n); globalThis.crypto.getRandomValues(rnd)
  return Array.from(rnd, x => chars[x % 36]).join('')
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.data) {
    return NextResponse.json({ error: 'type e data obrigatórios' }, { status: 400 })
  }

  const VALID_TYPES = ['interaction', 'labs', 'care_plan', 'arena_result', 'medication_review', 'counter']
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  // Use service role for insert (no auth required to share)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const id = randomId(10)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('shared_results').insert({
    id,
    type: body.type,
    data: body.data,
    title: body.title || 'Resultado Phlox',
    expires_at: expiresAt,
    views: 0,
  })

  if (error) {
    // If table doesn't exist yet, return a mock URL (graceful degradation)
    if (error.code === '42P01') {
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'}/r/${id}`,
        id,
        note: 'Cria a tabela shared_results no Supabase para activar esta funcionalidade.'
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'
  return NextResponse.json({ url: `${baseUrl}/r/${id}`, id, expires_at: expiresAt })
}