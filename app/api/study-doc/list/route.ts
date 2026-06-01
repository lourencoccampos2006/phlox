// app/api/study-doc/list/route.ts
// Lista os documentos da biblioteca pessoal e permite eliminar / atualizar pin.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}
const NO_TABLE = (m: string) => /relation .*study_documents.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await db.from('study_documents').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    // marca last_opened
    await db.from('study_documents').update({ last_opened_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ document: data })
  }
  const { data, error } = await db.from('study_documents')
    .select('id,title,kind,subject,summary,page_count,chars,pinned,tags,created_at,updated_at,last_opened_at')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ items: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data || [] })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  const { error } = await db.from('study_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const updates: any = {}
  if (typeof body.pinned === 'boolean') updates.pinned = body.pinned
  if (Array.isArray(body.tags)) updates.tags = body.tags.slice(0, 12).map((t: any) => String(t).slice(0, 40))
  if (typeof body.title === 'string') updates.title = body.title.slice(0, 200)
  if (typeof body.subject === 'string') updates.subject = body.subject.slice(0, 80)
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  const db = sb(req)
  const { error } = await db.from('study_documents').update(updates).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
