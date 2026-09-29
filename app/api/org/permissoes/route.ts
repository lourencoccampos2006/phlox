// app/api/org/permissoes/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dar e tirar acessos às pessoas da casa.
//
// ── PORQUE É QUE ISTO É UMA ROTA E NÃO UMA ESCRITA DIRETA ──────────────────
// A interface esconde o que a pessoa não pode ver. Esconder um botão não
// impede ninguém de chamar a API — quem souber o endereço escreve na mesma.
// Todas as regras abaixo são verificadas AQUI, do lado do servidor, com a
// chave de serviço, e é esta a verificação que conta.
//
// ── AS TRÊS REGRAS ─────────────────────────────────────────────────────────
// 1. Só mexe quem tem `permissoes.editar`. Por omissão é o Dono e a Direção
//    Técnica — mas o Dono pode tirar esse direito à Direção, e a partir daí a
//    Direção deixa de poder.
// 2. Ninguém mexe no Dono. Nem o próprio, por engano: o Dono tem tudo, sempre,
//    e é a única garantia de que ninguém fica fechado fora da sua própria casa.
// 3. Ninguém se dá permissões a si mesmo. Sem isto, bastava uma pessoa com
//    `permissoes.editar` para se promover a tudo — que é a forma mais banal de
//    uma escalada de privilégios, e já aconteceu neste projeto (ver a memória
//    sobre a auto-atribuição de `plan`/`org` em 2026-07-28).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  TODAS, POR_PAPEL, PAPEIS_ATRIBUIVEIS, permissoesDe, pode, DETALHES, negar,
  PAPEL_ANTIGO_PARA_NOVO,
} from '@/lib/permissoes'

export const runtime = 'nodejs'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

/** Quem está a pedir, em que casa, e com que direito. */
async function contexto(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: 'Serviço indisponível.', estado: 503 as const }
  }
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return { erro: 'Inicia sessão.', estado: 401 as const }

  const a = admin()
  const { data: auth, error: erroSessao } = await a.auth.getUser(token)
  const user = auth?.user
  if (erroSessao || !user) return { erro: 'Inicia sessão.', estado: 401 as const }

  // Se a leitura do perfil falhar, NAO se cai no ramo seguinte como se a
  // pessoa nao tivesse instituicao: isso mandava-a para a organizacao errada.
  const { data: perfil, error: erroPerfil } = await a.from('profiles')
    .select('active_org_id, org_id').eq('id', user.id).maybeSingle()
  if (erroPerfil) {
    console.error('[phlox:permissoes-perfil]', erroPerfil)
    return { erro: 'Não foi possível confirmar a sua instituição.', estado: 503 as const }
  }
  let orgId: string | null = perfil?.active_org_id || perfil?.org_id || null
  if (!orgId) {
    const { data: m, error: erroMembro } = await a.from('org_members')
      .select('org_id').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle()
    if (erroMembro) {
      console.error('[phlox:permissoes-org]', erroMembro)
      return { erro: 'Não foi possível confirmar a sua instituição.', estado: 503 as const }
    }
    orgId = m?.org_id || null
  }
  if (!orgId) return { erro: 'Sem instituição ativa.', estado: 400 as const }

  const { data: eu, error } = await a.from('org_members')
    .select('role, capabilities').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  if (error) return { erro: 'Não foi possível confirmar o seu acesso.', estado: 503 as const }
  if (!eu) return { erro: 'Não pertence a esta instituição.', estado: 403 as const }

  // Entende os dois vocabulários: entre o dia em que isto sobe e o dia em que
  // a migração corre, a base de dados ainda tem os papéis antigos.
  const meuPapel = PAPEL_ANTIGO_PARA_NOVO[eu.role] || eu.role
  const minhas = permissoesDe(meuPapel, eu.capabilities)

  return { a, user, orgId, meuPapel, minhas }
}

// ─── Ver a equipa e os acessos de cada um ───────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await contexto(req)
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.estado })
  const { a, orgId, minhas } = ctx

  if (!pode(minhas, 'permissoes', 'editar')) {
    return NextResponse.json({ error: 'Não tem acesso a esta parte.' }, { status: 403 })
  }

  const { data: membros, error } = await a.from('org_members')
    // `*` e nao a lista: `utentes_etiquetas` so existe depois do sprint164, e
    // com a lista escrita a mao o PostgREST recusava o SELECT INTEIRO ate la —
    // deixando a pagina dos acessos vazia.
    .select('*')
    .eq('org_id', orgId).eq('active', true)
  if (error) {
    return NextResponse.json({ error: 'Não foi possível ler a equipa.' }, { status: 503 })
  }

  const ids = (membros || []).map(m => m.user_id)
  // Se os nomes nao vierem, a lista mostra "Sem nome" — feio, mas nao perigoso.
  // Regista-se para nao ser invisivel, e segue.
  const { data: perfis, error: erroPerfis } = ids.length
    ? await a.from('profiles').select('id, name, email').in('id', ids)
    : { data: [] as any[], error: null }
  if (erroPerfis) console.error('[phlox:permissoes-nomes]', erroPerfis)
  const porId = new Map((perfis || []).map((p: any) => [p.id, p]))

  return NextResponse.json({
    membros: (membros || []).map(m => {
      const papel = PAPEL_ANTIGO_PARA_NOVO[m.role] || m.role
      return {
        user_id: m.user_id,
        nome: porId.get(m.user_id)?.name || 'Sem nome',
        email: porId.get(m.user_id)?.email || '',
        papel,
        // `null` quer dizer "segue o molde do papel" — e é diferente de uma
        // lista igual ao molde, porque assim as mudanças ao papel chegam-lhe.
        sobreposicao: Array.isArray(m.capabilities) && m.capabilities.length ? m.capabilities : null,
        permissoes: permissoesDe(papel, m.capabilities),
        utentesEtiquetas: m.utentes_etiquetas || [],
      }
    }),
  })
}

// ─── Mudar o papel e/ou os acessos de uma pessoa ────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await contexto(req)
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.estado })
  const { a, user, orgId, minhas } = ctx

  // REGRA 1
  if (!pode(minhas, 'permissoes', 'editar')) {
    return NextResponse.json({ error: 'Não tem acesso a dar ou tirar acessos.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as
    { userId?: string; papel?: string; permissoes?: string[] | null } | null
  const alvoId = String(body?.userId || '')
  if (!alvoId) return NextResponse.json({ error: 'Falta dizer de quem.' }, { status: 400 })

  // REGRA 3
  if (alvoId === user.id) {
    return NextResponse.json({
      error: 'Não pode mudar os seus próprios acessos. Peça a outra pessoa com esse direito.',
    }, { status: 403 })
  }

  const { data: alvo, error: erroAlvo } = await a.from('org_members')
    .select('role').eq('org_id', orgId).eq('user_id', alvoId).eq('active', true).maybeSingle()
  if (erroAlvo) return NextResponse.json({ error: 'Não foi possível ler essa pessoa.' }, { status: 503 })
  if (!alvo) return NextResponse.json({ error: 'Essa pessoa não está nesta instituição.' }, { status: 404 })

  // REGRA 2
  const papelAlvo = PAPEL_ANTIGO_PARA_NOVO[alvo.role] || alvo.role
  if (papelAlvo === 'dono') {
    return NextResponse.json({ error: 'O Dono da casa não pode ser limitado.' }, { status: 403 })
  }

  // ── O papel ───────────────────────────────────────────────────────────────
  const papel = body?.papel ? String(body.papel) : papelAlvo
  if (!PAPEIS_ATRIBUIVEIS.some(p => p.id === papel)) {
    return NextResponse.json({ error: 'Esse papel não existe.' }, { status: 400 })
  }

  // ── As permissões ─────────────────────────────────────────────────────────
  // `null` (ou igual ao molde) grava-se como null: a pessoa segue o papel, e
  // uma mudança futura ao papel chega-lhe. Guardar uma cópia congelava-a no
  // dia em que foi gravada.
  let sobreposicao: string[] | null = null
  if (Array.isArray(body?.permissoes)) {
    // As chaves validas sao de DOIS tipos, e falhar o segundo custou-me quase
    // um bug silencioso: `area.nivel` (o que a pessoa PODE) e `nao:detalhe`
    // (um pedaco de ferramenta que lhe foi TIRADO, sprint164).
    //
    // A primeira versao disto filtrava so contra TODAS — e portanto deitava
    // fora todos os `nao:` sem dizer nada. A interface deixava esconder a
    // parte do dinheiro, o servidor aceitava o pedido, e nada ficava guardado.
    const validas = new Set<string>([...TODAS, ...DETALHES.map(d => negar(d.id))])
    const limpas = [...new Set(body.permissoes.filter(x => validas.has(x)))].sort()
    const molde = [...(POR_PAPEL.get(papel as any)?.omissao || [])].sort()
    const igualAoMolde = limpas.length === molde.length && limpas.every((x, i) => x === molde[i])
    sobreposicao = igualAoMolde ? null : limpas
  }

  // ── Que utentes e que esta pessoa ve (sprint164) ──────────────────────────
  // Vazio grava-se como NULL, que quer dizer «ve todos». Um array vazio na
  // base de dados seria «ve nenhum», e a diferenca entre as duas coisas e
  // alguem que chega ao turno e nao encontra ninguem.
  let etiquetasDeUtentes: string[] | null | undefined = undefined
  if ('utentesEtiquetas' in (body || {})) {
    const cru = (body as any).utentesEtiquetas
    if (!Array.isArray(cru) || !cru.length) etiquetasDeUtentes = null
    else {
      // So etiquetas DESTA casa. Sem isto, um id de outra organizacao passava
      // a restringir uma pessoa a um conjunto que nunca corresponde a ninguem.
      const { data: nossas, error: erroEt } = await a.from('etiquetas')
        .select('id').eq('org_id', orgId).in('id', cru.filter((x: any) => typeof x === 'string'))
      if (erroEt) {
        return NextResponse.json({ error: 'Não foi possível confirmar as etiquetas.' }, { status: 503 })
      }
      const validos = (nossas || []).map(e => e.id)
      etiquetasDeUtentes = validos.length ? validos : null
    }
  }

  const mudanca: Record<string, any> = { role: papel, capabilities: sobreposicao }
  // `undefined` quer dizer «nao veio no pedido» — e nesse caso nao se toca.
  // Quem envia o papel nao pode, sem querer, limpar a restricao de utentes.
  if (etiquetasDeUtentes !== undefined) mudanca.utentes_etiquetas = etiquetasDeUtentes

  const { error } = await a.from('org_members')
    .update(mudanca)
    .eq('org_id', orgId).eq('user_id', alvoId)
  if (error) {
    console.error('[phlox:permissoes-update]', error)
    return NextResponse.json({ error: 'Não foi possível guardar. Tente de novo.' }, { status: 503 })
  }

  // Fica registado quem mudou o quê. Dar acesso a alguém é uma decisão, e uma
  // decisão sem rasto é uma decisão que ninguém assume.
  try {
    const { data: quem, error: e1 } = await a.from('profiles').select('name').eq('id', user.id).maybeSingle()
    const { data: sobre, error: e2 } = await a.from('profiles').select('name').eq('id', alvoId).maybeSingle()
    if (e1 || e2) console.error('[phlox:permissoes-log-nomes]', e1 || e2)
    const nomeAlvo = sobre?.name || 'um membro da equipa'
    const { error: erroLog } = await a.from('activity_log').insert({
      org_id: orgId,
      user_id: user.id,
      actor_name: quem?.name || 'Alguém',
      action: 'permissoes.alteradas',
      entity: 'membro',
      entity_id: alvoId,
      subject_name: nomeAlvo,
      summary: `Mudou os acessos de ${nomeAlvo} para ${POR_PAPEL.get(papel as any)?.label || papel}${sobreposicao ? ', com afinações' : ''}.`,
    })
    // O registo é desejável, não é condição: os acessos já mudaram e não se
    // desfaz isso por causa do histórico. Mas não fica invisível.
    if (erroLog) console.error('[phlox:permissoes-log]', erroLog)
  } catch (e) { console.error('[phlox:permissoes-log]', e) }

  return NextResponse.json({
    ok: true,
    papel,
    sobreposicao,
    permissoes: permissoesDe(papel, sobreposicao),
  })
}
