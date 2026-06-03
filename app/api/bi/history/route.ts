// app/api/bi/history/route.ts
// GET → histórico de queries BI da org (+ pinned)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*ai_queries.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const pinnedOnly = req.nextUrl.searchParams.get('pinned') === '1'
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('ai_queries')
    .select('id, question, answer, rows_returned, duration_ms, error, pinned, pin_label, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(pinnedOnly ? 50 : 30)
  if (pinnedOnly) q = q.eq('pinned', true)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ queries: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ queries: data || [] })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { id?: string; pinned?: boolean; pin_label?: string } | null
  if (!body?.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  const update: Record<string, any> = {}
  if (typeof body.pinned === 'boolean') update.pinned = body.pinned
  if (typeof body.pin_label === 'string') update.pin_label = body.pin_label
  const { data, error } = await db.from('ai_queries').update(update).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ query: data })
}
