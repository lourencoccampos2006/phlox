// app/api/study/notes/route.ts
// GET    → lista notas (search opcional)
// POST   → cria nova nota
// PATCH  → actualiza (incluindo linked_ids)
// DELETE → apaga
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

const NO_TABLE = (m: string) => /relation .*study_notes.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const q = req.nextUrl.searchParams.get('q')
  const db = sb(req)
  let qb = db.from('study_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200)
  if (q) qb = qb.or(`title.ilike.%${q}%,body.ilike.%${q}%`)
  const { data, error } = await qb
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ notes: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ notes: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.title) return NextResponse.json({ error: 'title obrigatório' }, { status: 400 })
  const db = sb(req)
  const { data, error } = await db.from('study_notes').insert({
    user_id: userId,
    title: body.title,
    body: body.body || null,
    domain: body.domain || null,
    tags: body.tags || null,
    linked_ids: body.linked_ids || null,
    pinned: !!body.pinned,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, any> | null
  if (!body?.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const u: Record<string, any> = {}
  for (const k of ['title','body','domain','tags','linked_ids','pinned']) if (k in body) u[k] = body[k]
  const db = sb(req)
  const { data, error } = await db.from('study_notes').update(u).eq('id', body.id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  await db.from('study_notes').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
