// app/api/org/perfis-acesso/route.ts
// ───────────────────────────────────────────────────────────────────────────
// PERFIS DE ACESSO — a mesma configuração, com um nome, para várias pessoas.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// A /api/org/permissoes resolve UMA pessoa. Numa casa, o que se diz é «as seis
// auxiliares da noite não veem o financeiro» — e hoje isso faz-se abrindo seis
// fichas e marcando a mesma matriz seis vezes. À sétima contratação alguém se
// engana, e o engano não dá erro: dá acesso a mais do que devia, calado.
//
// ── AS REGRAS SÃO AS MESMAS, E É DE PROPÓSITO ──────────────────────────────
// Esta rota usa o MESMO `contexto()` da /api/org/permissoes e as mesmas três
// regras: só mexe quem tem `permissoes.editar`; ninguém mexe no Dono; ninguém
// se dá permissões a si mesmo. Um perfil aplicado a uma pessoa é exactamente o
// mesmo que configurá-la à mão — e por isso não pode ser uma porta das
// traseiras para o que a outra rota recusa.
//
// ── O PERFIL É UM CARIMBO ──────────────────────────────────────────────────
// Aplicar copia as permissões para a pessoa. Mudar o perfil depois NÃO muda
// ninguém. Um perfil que mudasse sozinho o acesso de seis pessoas a meio de um
// turno é a espécie de surpresa que ninguém quer numa casa com inspeção.
// Guarda-se qual foi o último perfil aplicado (`org_members.perfil_acesso_id`)
// para a página poder dizer quantas pessoas o usam e oferecer reaplicar.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TODAS, permissoesDe, pode, PAPEL_ANTIGO_PARA_NOVO, PAPEIS_ATRIBUIVEIS } from '@/lib/permissoes'

export const runtime = 'nodejs'

/** A tabela nasce no sprint181. Até lá, dizer qual é o código em vez de 500. */
const PHX = 'PHX-Z4'
const semTabela = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

async function contexto(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { erro: 'Serviço indisponível.', estado: 503 as const }
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return { erro: 'Inicia sessão.', estado: 401 as const }

  const a = admin()
  const { data: auth, error: erroSessao } = await a.auth.getUser(token)
  const user = auth?.user
  if (erroSessao || !user) return { erro: 'Inicia sessão.', estado: 401 as const }

  const { data: perfil, error: erroPerfil } = await a.from('profiles')
    .select('active_org_id, org_id').eq('id', user.id).maybeSingle()
  if (erroPerfil) return { erro: 'Não foi possível confirmar a sua instituição.', estado: 503 as const }

  let orgId: string | null = perfil?.active_org_id || perfil?.org_id || null
  if (!orgId) {
    const { data: m, error: erroMembro } = await a.from('org_members')
      .select('org_id').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle()
    if (erroMembro) return { erro: 'Não foi possível confirmar a sua instituição.', estado: 503 as const }
    orgId = m?.org_id || null
  }
  if (!orgId) return { erro: 'Sem instituição ativa.', estado: 400 as const }

  const { data: eu, error } = await a.from('org_members')
    .select('role, capabilities').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  if (error) return { erro: 'Não foi possível confirmar o seu acesso.', estado: 503 as const }
  if (!eu) return { erro: 'Não pertence a esta instituição.', estado: 403 as const }

  const meuPapel = PAPEL_ANTIGO_PARA_NOVO[eu.role] || eu.role
  const minhas = permissoesDe(meuPapel, eu.capabilities)
  return { a, user, orgId, meuPapel, minhas }
}

/** Uma permissão que não existe no catálogo não se guarda. */
function limpar(permissoes: unknown): string[] {
  if (!Array.isArray(permissoes)) return []
  const validas = new Set(TODAS)
  return [...new Set(permissoes.filter(p => typeof p === 'string' && validas.has(p)))] as string[]
}

// ─── Ver os perfis da casa ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await contexto(req)
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.estado })
  const { a, orgId, minhas } = ctx

  if (!pode(minhas, 'permissoes', 'ver') && !pode(minhas, 'permissoes', 'editar')) {
    return NextResponse.json({ error: 'Não tem acesso a esta parte.' }, { status: 403 })
  }

  const { data: perfis, error } = await a.from('perfis_acesso')
    .select('id, nome, descricao, papel_base, permissoes, criado_em')
    .eq('org_id', orgId).order('nome')
  if (semTabela(error)) return NextResponse.json({ perfis: [], porInstalar: PHX })
  if (error) return NextResponse.json({ error: 'Não foi possível ler os perfis.' }, { status: 503 })

  // Quantas pessoas usam cada um. Serve para a página avisar antes de apagar.
  const { data: membros, error: erroMembros } = await a.from('org_members')
    .select('perfil_acesso_id').eq('org_id', orgId).eq('active', true)
  /* Falhando esta, os perfis vão todos com «0 pessoas» — e esse zero é uma
     afirmação falsa que alguém usaria para decidir apagar um perfil que seis
     pessoas usam. Mais vale não dizer número nenhum. */
  const semContagem = !!erroMembros
  if (erroMembros) console.error('[phlox:perfis-contagem]', erroMembros)
  const quantos = new Map<string, number>()
  for (const m of (membros || [])) {
    if (m.perfil_acesso_id) quantos.set(m.perfil_acesso_id, (quantos.get(m.perfil_acesso_id) || 0) + 1)
  }

  return NextResponse.json({
    perfis: (perfis || []).map(p => ({ ...p, pessoas: semContagem ? null : (quantos.get(p.id) || 0) })),
  })
}

// ─── Criar, mudar, aplicar ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await contexto(req)
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.estado })
  const { a, user, orgId, minhas } = ctx

  if (!pode(minhas, 'permissoes', 'editar')) {
    return NextResponse.json({ error: 'Não tem acesso a esta parte.' }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
  const acao = String(corpo.acao || '')

  // ── Guardar um perfil (novo ou existente) ────────────────────────────────
  if (acao === 'guardar') {
    const nome = String(corpo.nome || '').trim().slice(0, 60)
    if (!nome) return NextResponse.json({ error: 'O perfil precisa de um nome.' }, { status: 400 })

    const papelBase = PAPEIS_ATRIBUIVEIS.some(p => p.id === corpo.papelBase) ? corpo.papelBase : null
    const linha = {
      org_id: orgId,
      nome,
      descricao: String(corpo.descricao || '').trim().slice(0, 240) || null,
      papel_base: papelBase,
      permissoes: limpar(corpo.permissoes),
      criado_por: user.id,
      user_id: user.id,
    }

    const r = corpo.id
      ? await a.from('perfis_acesso').update(linha).eq('id', corpo.id).eq('org_id', orgId).select().single()
      : await a.from('perfis_acesso').insert(linha).select().single()

    if (semTabela(r.error)) return NextResponse.json({ error: `Ainda não disponível (${PHX}).` }, { status: 503 })
    if (r.error?.code === '23505') {
      return NextResponse.json({ error: 'Já existe um perfil com esse nome nesta casa.' }, { status: 409 })
    }
    if (r.error) return NextResponse.json({ error: 'Não foi possível guardar o perfil.' }, { status: 503 })
    return NextResponse.json({ perfil: r.data })
  }

  // ── Apagar ───────────────────────────────────────────────────────────────
  if (acao === 'apagar') {
    if (!corpo.id) return NextResponse.json({ error: 'Falta o perfil.' }, { status: 400 })
    const { error } = await a.from('perfis_acesso').delete().eq('id', corpo.id).eq('org_id', orgId)
    if (semTabela(error)) return NextResponse.json({ error: `Ainda não disponível (${PHX}).` }, { status: 503 })
    if (error) return NextResponse.json({ error: 'Não foi possível apagar o perfil.' }, { status: 503 })
    // Quem o usava fica com as permissões que tem — apagar o perfil não tira
    // acesso a ninguém. O `on delete set null` limpa só a etiqueta.
    return NextResponse.json({ ok: true })
  }

  // ── Aplicar a pessoas ────────────────────────────────────────────────────
  if (acao === 'aplicar') {
    const ids: string[] = Array.isArray(corpo.userIds) ? corpo.userIds.filter((x: any) => typeof x === 'string') : []
    if (!corpo.id || !ids.length) return NextResponse.json({ error: 'Falta o perfil ou as pessoas.' }, { status: 400 })

    const { data: perfil, error: e1 } = await a.from('perfis_acesso')
      .select('id, permissoes').eq('id', corpo.id).eq('org_id', orgId).maybeSingle()
    if (semTabela(e1)) return NextResponse.json({ error: `Ainda não disponível (${PHX}).` }, { status: 503 })
    if (e1 || !perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

    /* AS DUAS REGRAS QUE NÃO SE QUEBRAM, e que são as mesmas da outra rota.
       Aplicar um perfil é exactamente o mesmo que configurar à mão: se fosse
       mais permissivo, seria a porta das traseiras que a outra rota fecha. */
    const { data: alvos, error: e2 } = await a.from('org_members')
      .select('user_id, role').eq('org_id', orgId).eq('active', true).in('user_id', ids)
    if (e2) return NextResponse.json({ error: 'Não foi possível ler a equipa.' }, { status: 503 })

    const recusados: string[] = []
    const aplicar: string[] = []
    for (const m of (alvos || [])) {
      const papel = PAPEL_ANTIGO_PARA_NOVO[m.role] || m.role
      if (papel === 'dono') { recusados.push('o Dono'); continue }
      if (m.user_id === user.id) { recusados.push('a própria conta'); continue }
      aplicar.push(m.user_id)
    }

    if (!aplicar.length) {
      return NextResponse.json({
        error: `Não há ninguém a quem aplicar: ${[...new Set(recusados)].join(' e ')} não pode ser alterado por aqui.`,
      }, { status: 400 })
    }

    const { error: e3 } = await a.from('org_members')
      .update({ capabilities: perfil.permissoes, perfil_acesso_id: perfil.id })
      .eq('org_id', orgId).in('user_id', aplicar)
    if (e3) return NextResponse.json({ error: 'Não foi possível aplicar o perfil.' }, { status: 503 })

    return NextResponse.json({
      aplicados: aplicar.length,
      recusados: [...new Set(recusados)],
    })
  }

  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
}
