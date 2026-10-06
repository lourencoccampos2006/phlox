// app/api/team-messages/route.ts
// Mural de comunicação da equipa (institucional).
//   GET               → mensagens da org ativa (canais: geral/doentes/stock/avisos)
//   POST {body,...}   → publica mensagem + push aos destinatários
//   PATCH {id,resolved} → marca aviso/pedido como resolvido
// Escrita/leitura por org via RLS (token do utilizador). O push usa a service key.
//
// ── RECADOS DIRIGIDOS (sprint156) ──────────────────────────────────────────
// `para_ids` vazio = para a casa toda (o que o mural sempre foi). Com pessoas
// lá dentro, só elas e quem escreveu o veem — e o push vai só para elas.
//
// A filtragem da LEITURA não está aqui: está na política `tm_dirigido` da base
// de dados. É de propósito. O browser fala diretamente com o Supabase, por
// isso um filtro nesta rota protegeria de quem usa a aplicação e de mais
// ninguém.
import { NextRequest, NextResponse } from 'next/server'
import { nomesDe } from '@/lib/perfisVisiveis'
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
  // ── Quem já viu o mural depois de cada recado ──────────────────────────
  // Da pesquisa aos programas ingleses: «read receipts» é a peça que faz um
  // recado valer alguma coisa. Sem ela, quem escreve «a Dona Maria não pode
  // levantar-se sozinha» não tem como saber se alguém leu — e no dia em que
  // correr mal, a pergunta «mas isso estava no mural?» não tem resposta.
  //
  // ── O QUE ISTO SABE, E O QUE NÃO SABE ──────────────────────────────────
  // `team_reads` guarda UMA marca por pessoa: a hora a que abriu o mural pela
  // última vez. Não há um registo por mensagem.
  //
  // Daí dá-se para saber que alguém abriu o mural DEPOIS de um recado ter sido
  // escrito. Não dá para saber que o leu. São coisas diferentes, e a interface
  // tem de dizer a segunda — chamar-lhe «leu» seria dar à casa uma certeza que
  // o Phlox não tem, e é exactamente o tipo de certeza falsa que alguém
  // invoca numa reunião difícil.
  //
  // Para quando é preciso mesmo saber que foi lido existe a passagem de turno,
  // onde há um botão e uma linha por pessoa (`passagem_leituras`).
  const todasLeituras = await db.from('team_reads')
    .select('user_id, last_read').eq('org_id', ctx.orgId)
  const leituras = todasLeituras.error ? [] : (todasLeituras.data || [])

  const read = leituras.find((r: any) => r.user_id === ctx.user.id)
  const lastRead = read?.last_read || '1970-01-01'
  const unread = (data || []).filter((m: any) => m.created_at > lastRead && m.author_id !== ctx.user.id).length

  // Os nomes vêm da vista `perfis_visiveis` e não da tabela `profiles`: para
  // escrever «Ana» ao lado de um recado não é preciso o email nem o NIF de
  // ninguém (sprint168).
  const nomes = leituras.length
    ? await nomesDe(db, leituras.map((r: any) => r.user_id))
    : new Map<string, string>()

  const vistoPor = (m: any) => leituras
    .filter((r: any) => r.user_id !== m.author_id && r.last_read > m.created_at)
    .map((r: any) => ({ id: r.user_id, nome: nomes.get(r.user_id) || 'Colega' }))

  // Quantos é que PODIAM ter visto: a casa menos quem escreveu. É o
  // denominador do «2 de 5» — sem ele, dois vistos tanto podem ser toda a
  // gente como quase ninguém.
  const equipa = leituras.length

  return NextResponse.json({
    messages: (data || []).map((m: any) => ({ ...m, visto_por: vistoPor(m) })),
    unread,
    equipa,
  })
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
    // Uma lista vazia é o mesmo que não haver lista: «para ninguém» não é uma
    // coisa que alguém queira dizer, e guardá-la assim criava um recado que
    // nem o próprio voltava a encontrar.
    para_ids: Array.isArray(body.para_ids) && body.para_ids.length
      ? body.para_ids.filter((x: any) => typeof x === 'string').slice(0, 50)
      : null,
  }
  const { data, error } = await db.from('team_messages').insert(row).select().single()
  if (error) { console.error('[phlox:team-messages-post]', error.message); return NextResponse.json({ error: error.message.includes('team_messages') ? 'Esta parte ainda não está disponível nesta conta.' : 'Não foi possível enviar agora. Tenta de novo.' }, { status: 400 }) }

  // Push aos outros membros (best-effort, não bloqueia a resposta se falhar).
  const CHAN_LABEL: Record<string, string> = { geral: 'Equipa', doentes: 'Doentes', stock: 'Stock', avisos: 'Aviso' }
  const prefix = priority === 'urgente' ? '🔴 ' : priority === 'importante' ? '🟠 ' : ''
  // Um recado dirigido só toca o telemóvel de quem está nele. Avisar a casa
  // toda de uma conversa que ela não pode ler seria o pior dos dois mundos.
  notifyOrgMembers(ctx.orgId, ctx.user.id, {
    title: `${prefix}${CHAN_LABEL[channel]} · ${ctx.name || 'Equipa'}`,
    body: text.slice(0, 140),
    url: '/equipa?tab=mural',
    tag: `team-${channel}`,
  }, row.para_ids || undefined).catch(() => {})

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
