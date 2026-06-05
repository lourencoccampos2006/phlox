// app/api/study/cards/route.ts
// Motor de revisão espaçada das notas (sprint76).
//   GET                      → dashboard (due_today, total...) + cartões due
//   POST {action:'review'}   → regista uma revisão SM-2
//   POST {action:'generate'} → IA gera flashcards de uma nota e grava-os
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const limit = Number(req.nextUrl.searchParams.get('limit') || 30)
  const [dash, due] = await Promise.all([
    db.rpc('notes_dashboard'),
    db.rpc('cards_due', { p_limit: limit }),
  ])
  if (dash.error && /does not exist/i.test(dash.error.message)) {
    return NextResponse.json({ dashboard: { due_today: 0, total_cards: 0, total_notes: 0, reviewed_today: 0 }, cards: [], needs_migration: true })
  }
  return NextResponse.json({
    dashboard: dash.data || { due_today: 0, total_cards: 0, total_notes: 0, reviewed_today: 0 },
    cards: due.data || [],
  })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 60, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
  const db = sb(req)

  // ── Registar revisão (SM-2) ──
  if (body.action === 'review') {
    if (!body.card_id || typeof body.quality !== 'number') {
      return NextResponse.json({ error: 'card_id e quality obrigatórios' }, { status: 400 })
    }
    const { data, error } = await db.rpc('review_card', { p_card_id: body.card_id, p_quality: body.quality })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ card: data })
  }

  // ── Gerar flashcards de uma nota (IA) e gravá-los ──
  if (body.action === 'generate') {
    if (plan === 'free') return planGateResponse('student', 'Flashcards automáticos das notas')
    if (!body.note_id || !body.text) return NextResponse.json({ error: 'note_id e text obrigatórios' }, { status: 400 })
    try {
      const res = await aiJSON<{ flashcards: { front: string; back: string }[] }>([
        {
          role: 'system',
          content: `Converte esta nota clínica em flashcards de revisão espaçada, em PT-PT.
Regras:
- 3 a 8 flashcards (mais se a nota for densa).
- Cada cartão testa UMA ideia. "front" = pergunta fechada e clara. "back" = resposta concisa com mecanismo/dose quando aplicável.
- Não inventes — usa só o que está na nota.
Responde APENAS JSON: { "flashcards": [{ "front": "...", "back": "..." }] }`,
        },
        { role: 'user', content: `Título: ${body.title || ''}\n\n${body.text}` },
      ], { maxTokens: 2000, temperature: 0.2 })
      const cards = res?.flashcards || []
      const { data, error } = await db.rpc('set_note_cards', { p_note_id: body.note_id, p_cards: cards })
      if (error) return NextResponse.json({ error: error.message, cards }, { status: 500 })
      return NextResponse.json({ count: data, cards })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
