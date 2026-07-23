// app/api/team-messages/route.ts
// Mural de comunicação da equipa (institucional).
//   GET               → mensagens da org ativa (canais: geral/doentes/stock/avisos)
//   POST {body,...}   → publica mensagem + push aos outros membros
//   PATCH {id,resolved} → marca aviso/pedido como resolvido
// Escrita/leitura por org via RLS (token do utilizador). O push usa a service key.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyOrgMembers } from '@/lib/notifyTeam'
import { sb } from '@/lib/orgAuth'

async function resolveCtx(db: any) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: prof } = await db.from('profiles').select('active_org_id, org_id, name').eq('id', user.id).maybeSingle()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return { error: 'Sem organização', status: 400 as const }
  return { user, orgId, name: prof?.name || '' }
}

const CHANNELS = ['geral', 'doentes', 'stock', 'avisos']

export async function GET(req: NextRequest) {
  const db = sb(req)
  const ctx = await resolveCtx(db)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const channel = req.nextUrl.searchParams.get('channel')
  let q = db.from('team_messages').select('*').eq('org_id', ctx.orgId).order('created_at', { ascending: false }).limit(100)
  if (channel && CHANNELS.includes(channel)) q = q.eq('channel', channel)
  const { data, error } = await q
  if (error) {
    const missing = /team_messages/.test(error.message) && /does not exist|relation/.test(error.message)
    console.error('[phlox:team-messages-get]', error.message)
    return NextResponse.json({ messages: [], error: missing ? 'Esta parte ainda não está disponível nesta conta.' : 'Não foi possível carregar agora.' })
  }
  // conta não-lidas (mais recentes que a última leitura do membro)
  const { data: read } = await db.from('team_reads').select('last_read').eq('org_id', ctx.orgId).eq('user_id', ctx.user.id).maybeSingle()
  const lastRead = read?.last_read || '1970-01-01'
  const unread = (data || []).filter((m: any) => m.created_at > lastRead && m.author_id !== ctx.user.id).length
  return NextResponse.json({ messages: data || [], unread })
}

export async function POST(req: NextRequest) {
  const db = sb(req)
  const ctx = await resolveCtx(db)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const body = await req.json().catch(() => ({}))
  const text = String(body.body || '').trim()
  if (!text) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
  const channel = CHANNELS.includes(body.channel) ? body.channel : 'geral'
  const priority = ['normal', 'importante', 'urgente'].includes(body.priority) ? body.priority : 'normal'

  const row: any = {
    user_id: ctx.user.id, org_id: ctx.orgId, author_id: ctx.user.id, author_name: ctx.name || 'Equipa',
    channel, body: text.slice(0, 2000), priority,
    patient_id: body.patient_id || null,
  }
  const { data, error } = await db.from('team_messages').insert(row).select().single()
  if (error) { console.error('[phlox:team-messages-post]', error.message); return NextResponse.json({ error: error.message.includes('team_messages') ? 'Esta parte ainda não está disponível nesta conta.' : 'Não foi possível enviar agora. Tenta de novo.' }, { status: 400 }) }

  // Push aos outros membros (best-effort, não bloqueia a resposta se falhar).
  const CHAN_LABEL: Record<string, string> = { geral: 'Equipa', doentes: 'Doentes', stock: 'Stock', avisos: 'Aviso' }
  const prefix = priority === 'urgente' ? '🔴 ' : priority === 'importante' ? '🟠 ' : ''
  notifyOrgMembers(ctx.orgId, ctx.user.id, {
    title: `${prefix}${CHAN_LABEL[channel]} · ${ctx.name || 'Equipa'}`,
    body: text.slice(0, 140),
    url: '/equipa?tab=mural',
    tag: `team-${channel}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, message: data })
}

export async function PATCH(req: NextRequest) {
  const db = sb(req)
  const ctx = await resolveCtx(db)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const body = await req.json().catch(() => ({}))
  if (body.markRead) {
    await db.from('team_reads').upsert({ user_id: ctx.user.id, org_id: ctx.orgId, last_read: new Date().toISOString() }, { onConflict: 'user_id,org_id' })
    return NextResponse.json({ ok: true })
  }
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'id em falta' }, { status: 400 })
  const { error } = await db.from('team_messages').update({ resolved: !!body.resolved }).eq('id', id).eq('org_id', ctx.orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
