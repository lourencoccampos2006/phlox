// app/api/mnemonicas/deck/route.ts
// Baralho pessoal de mnemónicas guardadas (sprint118). Persistido na conta,
// cross-device — mesmo espírito do study_progress_sync/study_notes: local
// degrada com graça se a tabela ainda não existir (needs_migration).
//   GET  → lista o baralho do utilizador (mais recente primeiro)
//   POST → guarda uma mnemónica gerada no baralho
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const NO_TABLE = (msg?: string) => /does not exist|could not find the table|schema cache/i.test(msg || '')

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('saved_mnemonics').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ items: [], needs_migration: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data || [] })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  const concept = String(body.concept || '').trim().slice(0, 160)
  const mnemonic = String(body.mnemonic || '').trim().slice(0, 300)
  if (!concept || !mnemonic) return NextResponse.json({ error: 'concept e mnemonic obrigatórios' }, { status: 400 })

  const row = {
    user_id: userId,
    concept,
    area: body.area ? String(body.area).slice(0, 40) : null,
    technique: body.technique ? String(body.technique).slice(0, 20) : null,
    mnemonic,
    scene: body.scene ? String(body.scene).slice(0, 900) : null,
    icon: body.icon ? String(body.icon).slice(0, 8) : null,
    breakdown: Array.isArray(body.breakdown) ? body.breakdown.slice(0, 20) : null,
    tip: body.tip ? String(body.tip).slice(0, 300) : null,
    alt: body.alt ? String(body.alt).slice(0, 300) : null,
  }

  const db = sb(req)
  const { data, error } = await db.from('saved_mnemonics').insert(row).select().single()
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ error: 'Baralho ainda não disponível — tenta mais tarde.', needs_migration: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data })
}
