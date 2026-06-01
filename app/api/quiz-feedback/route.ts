// app/api/quiz-feedback/route.ts
// Phlox — Recebe reportes de erro em perguntas / casos clínicos gerados.
// Qualquer utilizador autenticado pode reportar; rate-limited; UNIQUE
// constraint na DB evita duplicados do mesmo utilizador para o mesmo item.
// A equipa vê os reportes na tabela quiz_feedback no Supabase.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*quiz_feedback.* does not exist/i.test(m)
const VALID_SOURCES = ['arena', 'cases', 'exam', 'flashcards', 'decisao', 'other'] as const
const VALID_REASONS = ['resposta_errada', 'duas_corretas', 'linguagem', 'referencia_invalida', 'desatualizado', 'outro'] as const

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 12, 60_000).allowed) return rateLimitResponse()

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const source = String(body.source || '').toLowerCase()
  const reason = String(body.reason || '').toLowerCase()
  if (!VALID_SOURCES.includes(source as any)) return NextResponse.json({ error: 'source inválido' }, { status: 400 })
  if (!VALID_REASONS.includes(reason as any)) return NextResponse.json({ error: 'reason inválido' }, { status: 400 })

  const source_key = String(body.source_key || '').slice(0, 200)
  if (!source_key) return NextResponse.json({ error: 'source_key obrigatório' }, { status: 400 })

  const comment = body.comment ? String(body.comment).slice(0, 1000) : null
  const snapshot = body.question_snapshot || null

  const db = sb(req)
  const { error } = await db.from('quiz_feedback').insert({
    user_id: userId,
    source,
    source_key,
    reason,
    comment,
    question_snapshot: snapshot,
  })

  if (error) {
    if (NO_TABLE(error.message)) {
      return NextResponse.json({ error: 'O sistema de reportes ainda não está ativo (aplicar sprint44_quiz_feedback.sql).' }, { status: 503 })
    }
    // Duplicate (já reportou) — não é erro, é idempotência
    if (/duplicate key/i.test(error.message)) {
      return NextResponse.json({ ok: true, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// GET para o utilizador ver os SEUS reportes (transparência).
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('quiz_feedback')
    .select('id,source,source_key,reason,comment,status,created_at,reviewed_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ items: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data || [] })
}
