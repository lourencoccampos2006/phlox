import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

// Comunidade estudante — mural de dúvidas/partilha por área. Autenticado.

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}
const NO_TABLE = (m: string) => /relation .*community_.* does not exist/i.test(m)

// GET ?area=&post= → lista de posts da área, OU respostas de um post
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const postId = req.nextUrl.searchParams.get('post')

  if (postId) {
    const { data, error } = await db.from('community_answers').select('*').eq('post_id', postId).order('upvotes', { ascending: false }).order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ answers: data || [] })
  }

  const area = req.nextUrl.searchParams.get('area') || ''
  let q = db.from('community_posts').select('*').order('created_at', { ascending: false }).limit(60)
  if (area) q = q.eq('area', area)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: NO_TABLE(error.message) ? 'A comunidade ainda não está ativa (aplicar sprint30_comunidade.sql).' : error.message }, { status: NO_TABLE(error.message) ? 503 : 500 })
  // votos do utilizador (para marcar o que já votou)
  const { data: votes } = await db.from('community_votes').select('target_id').eq('user_id', userId)
  return NextResponse.json({ posts: data || [], voted: (votes || []).map((v: any) => v.target_id) })
}

// POST → criar post OU resposta OU votar
export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const authorName = String(body.author_name || '').slice(0, 60) || 'Estudante'

  // votar (toggle simples: insere voto e incrementa; se já existir, ignora)
  if (body.vote) {
    const target = String(body.vote)
    const table = body.voteKind === 'answer' ? 'community_answers' : 'community_posts'
    const ins = await db.from('community_votes').insert({ user_id: userId, target_id: target })
    if (ins.error) return NextResponse.json({ ok: true, already: true }) // já votou
    const { data: cur } = await db.from(table).select('upvotes').eq('id', target).single()
    await db.from(table).update({ upvotes: (cur?.upvotes || 0) + 1 }).eq('id', target)
    return NextResponse.json({ ok: true })
  }

  // responder
  if (body.post_id && body.answer) {
    const { data, error } = await db.from('community_answers').insert({ post_id: body.post_id, user_id: userId, author_name: authorName, body: String(body.answer).slice(0, 2000) }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data: cur } = await db.from('community_posts').select('answer_count').eq('id', body.post_id).single()
    await db.from('community_posts').update({ answer_count: (cur?.answer_count || 0) + 1 }).eq('id', body.post_id)
    return NextResponse.json({ answer: data })
  }

  // criar post
  if (body.title) {
    const record = {
      user_id: userId, author_name: authorName, area: String(body.area || '').slice(0, 40) || null,
      kind: ['question', 'resource', 'tip'].includes(body.kind) ? body.kind : 'question',
      subject: String(body.subject || '').slice(0, 60) || null,
      title: String(body.title).slice(0, 160), body: String(body.body || '').slice(0, 2000) || null,
      link: String(body.link || '').slice(0, 300) || null,
    }
    const { data, error } = await db.from('community_posts').insert(record).select().single()
    if (error) return NextResponse.json({ error: NO_TABLE(error.message) ? 'A comunidade ainda não está ativa (aplicar sprint30_comunidade.sql).' : error.message }, { status: NO_TABLE(error.message) ? 503 : 500 })
    return NextResponse.json({ post: data })
  }

  return NextResponse.json({ error: 'Nada a fazer' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await db.from('community_posts').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
