// app/api/study/progress/route.ts
// Cérebro de progresso de estudo NA CONTA (cross-device). Espelha o localStorage do
// lib/studyProgress, para o estudante manter streak/XP/áreas-fracas entre dispositivos.
//   GET  → { events, daily_goal, last_tool }            (vazio se tabela/linha em falta)
//   PUT  { events, daily_goal, last_tool } → faz UPSERT (o cliente já fez o merge)
// Tolerante: se a tabela não existir (sprint96 não corrido) devolve needs_migration e
// o cliente continua em localStorage puro.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

const MAX_EVENTS = 400

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// Trata "tabela/coluna em falta" (sprint96 não corrido) como precisa-migração — cobre as
// mensagens do Postgres ("does not exist") e do PostgREST ("Could not find the table ...").
const NO_TABLE = (msg?: string) => /does not exist|could not find the table|schema cache/i.test(msg || '')

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db.from('study_progress_sync').select('events, daily_goal, last_tool').eq('user_id', userId).maybeSingle()
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ needs_migration: true, events: [], daily_goal: 50, last_tool: null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ events: data?.events || [], daily_goal: data?.daily_goal ?? 50, last_tool: data?.last_tool ?? null })
}

export async function PUT(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { events?: any[]; daily_goal?: number; last_tool?: any } | null
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const db = sb(req)

  // Sanitiza + cap (o merge real é feito no cliente, que tem o localStorage).
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : []
  const daily_goal = Math.max(10, Math.min(500, Number(body.daily_goal) || 50))
  const last_tool = body.last_tool && typeof body.last_tool === 'object' ? body.last_tool : null

  const { error } = await db.from('study_progress_sync').upsert({
    user_id: userId, events, daily_goal, last_tool, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ needs_migration: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
