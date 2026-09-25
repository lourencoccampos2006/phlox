// app/api/contadores/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os números que aparecem ao lado de cada ferramenta.
//
// ── PORQUE É QUE ISTO É UMA ROTA E NÃO QUINZE PEDIDOS DO BROWSER ───────────
// Quinze contagens feitas do lado do cliente são quinze ligações abertas em
// cada mudança de página, e todas elas antes de a primeira coisa útil aparecer
// no ecrã. Aqui é uma chamada; as quinze consultas correm em paralelo dentro
// do servidor, que está ao lado da base de dados.
//
// ── PERMISSÕES, DUAS VEZES ─────────────────────────────────────────────────
// 1. Antes de perguntar: um contador cuja área a pessoa não vê é saltado. Não
//    se faz a consulta, não se gasta tempo, e não se corre o risco de contar.
// 2. Ao perguntar: usa-se o TOKEN de quem pediu, nunca a chave de serviço. Se
//    a área 1 falhasse, a RLS (sprint153) continuava a devolver zero. Duas
//    fechaduras diferentes na mesma porta.
//
// A chave de serviço não aparece neste ficheiro de propósito. Um contador é
// uma conveniência; não vale a pena dar-lhe poderes de administrador.
//
// ── PORQUE É QUE UM ERRO NÃO VIRA ZERO ─────────────────────────────────────
// Uma consulta falhada devolvia um zero, e um zero num contador lê-se como
// «está tudo tratado». É exatamente a mentira que não podemos contar: a
// ferramenta fica sem número (undefined), e o distintivo simplesmente não
// aparece. Sem sinal é melhor do que sinal errado.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authedClient } from '@/lib/orgAuth'
import { permissoesNaOrg } from '@/lib/orgAuth'
import { pode } from '@/lib/permissoes'
import { CONTADORES, type Contador } from '@/lib/contadores'
import { ptDate } from '@/lib/ptTime'
import { currentShiftFor, type Shift } from '@/lib/institutionConfig'
import type { InstitutionType } from '@/lib/useClinicPrefs'

export const runtime = 'nodejs'
// Contar é barato, mas são dezasseis consultas: num dia mau da base de dados
// o pedido não pode ficar pendurado a segurar a navegação.
export const maxDuration = 15

interface Ctx {
  sb: SupabaseClient
  orgId: string
  userId: string
  /** A hora a que esta pessoa abriu cada ferramenta pela última vez. */
  visto: Record<string, string>
  tipo: InstitutionType
}

// ─────────────────────────────────────────────────────────────────────────────
// As contas que não cabem num filtro
// ─────────────────────────────────────────────────────────────────────────────
// Cada uma destas compara duas colunas ou cruza duas tabelas — coisas que o
// PostgREST não sabe exprimir num filtro. Devolvem `null` quando a consulta
// falha, para o distintivo não aparecer com um número inventado.

const CALCULOS: Record<string, (c: Ctx) => Promise<number | null>> = {
  // Recados novos no mural que me dizem respeito.
  //
  // Três coisas que um filtro simples não sabe fazer: um recado que eu escrevi
  // não é novidade para mim; um recado dirigido a outra pessoa não me diz
  // respeito (e a base de dados nem mo devolve — ver a política `tm_dirigido`
  // do sprint156); e um recado já resolvido não volta a chamar ninguém.
  async mural(c) {
    const desde = c.visto['mural'] || new Date(Date.now() - 7 * 86400000).toISOString()
    const r = await c.sb.from('team_messages').select('id', { count: 'exact', head: true })
      .eq('org_id', c.orgId)
      .eq('resolved', false)
      .neq('author_id', c.userId)
      .gt('created_at', desde)
      // Os dirigidos a mim, mais os que são para a casa toda. A política da
      // base de dados já esconde os dos outros; isto poupa a contagem deles.
      .or(`para_ids.is.null,para_ids.cs.{${c.userId}}`)
    if (r.error) {
      console.error('[phlox:contadores] mural', r.error.message)
      return null
    }
    return r.count || 0
  },

  // Tomas devidas neste turno, menos as que já foram registadas.
  //
  // O turno é o de AGORA e depende do tipo de casa: um centro de dia não tem
  // turno da noite. `shifts` vazio num medicamento significa «todos os turnos»
  // — é a compatibilidade com os que foram criados antes de haver turnos, e o
  // /mar lê-o da mesma maneira (dueInShift).
  async medicacao(c) {
    const turno: Shift = currentShiftFor(c.tipo)
    const hoje = ptDate()

    const utentes = await c.sb.from('patients').select('id')
      .eq('org_id', c.orgId).eq('active', true)
    if (utentes.error) return null
    const ids = (utentes.data || []).map(p => p.id)
    if (!ids.length) return 0

    const [meds, feitos] = await Promise.all([
      c.sb.from('patient_meds').select('id, patient_id, shifts')
        .eq('active', true).in('patient_id', ids),
      c.sb.from('mar_records').select('med_id, patient_id')
        .eq('date', hoje).eq('shift', turno).in('patient_id', ids),
    ])
    if (meds.error || feitos.error) return null

    const jaFeito = new Set((feitos.data || []).map(r => `${r.patient_id}|${r.med_id}`))
    let devidas = 0
    for (const m of meds.data || []) {
      const turnos: string[] | null = (m as any).shifts
      const devidoAgora = !turnos || turnos.length === 0 || turnos.includes(turno)
      if (devidoAgora && !jaFeito.has(`${m.patient_id}|${m.id}`)) devidas++
    }
    return devidas
  },

  // Quem está cá hoje e ainda não tem uma linha escrita.
  //
  // «Está cá» é quem tem presença marcada como presente. Se ninguém marcou
  // presenças (há casas que não usam), cai para todos os utentes ativos — que
  // é o que um lar quer de qualquer maneira, porque lá estão todos.
  async registos(c) {
    const hoje = ptDate()
    const [utentes, presencas, registos] = await Promise.all([
      c.sb.from('patients').select('id').eq('org_id', c.orgId).eq('active', true),
      c.sb.from('attendance').select('patient_id, status').eq('org_id', c.orgId).eq('date', hoje),
      c.sb.from('care_records').select('patient_id').eq('org_id', c.orgId).eq('date', hoje),
    ])
    if (utentes.error || registos.error) return null

    const ativos = (utentes.data || []).map(p => p.id)
    const marcadas = presencas.error ? [] : (presencas.data || [])
    const cá = marcadas.length
      ? marcadas.filter(a => a.status === 'present').map(a => a.patient_id)
      : ativos

    const comRegisto = new Set((registos.data || []).map(r => r.patient_id))
    return cá.filter(id => !comRegisto.has(id)).length
  },

  // Artigos abaixo do mínimo — os do armazém da casa E os de cada pessoa.
  //
  // `quantity <= min_quantity` compara duas colunas, e isso o PostgREST não
  // faz; por isso a conta é aqui.
  //
  // Um mínimo por definir (null ou 0) não conta: ninguém pediu para ser
  // avisado sobre esse artigo, e avisar à mesma seria encher o número de
  // coisas que a casa não quer ver. A exceção é o que chegou a ZERO — isso
  // avisa sempre, tenha mínimo ou não, porque acabou mesmo.
  //
  // Este é o «alerta para quem o precisar de ver, apenas» que o Fernando
  // pediu: o contador só é calculado para quem tem `stock.ver` (ver o filtro
  // por área no fim deste ficheiro), por isso uma auxiliar sem essa permissão
  // nunca recebe o número.
  async stock(c) {
    const [casa, pessoas] = await Promise.all([
      c.sb.from('stock_items').select('quantity, min_quantity').eq('org_id', c.orgId),
      c.sb.from('stock_utente').select('quantidade, minimo').eq('org_id', c.orgId),
    ])
    if (casa.error) return null

    const abaixo = (q: unknown, min: unknown) => {
      const quantidade = Number(q)
      if (!Number.isFinite(quantidade)) return false
      if (quantidade <= 0) return true
      const minimo = Number(min)
      return Number.isFinite(minimo) && minimo > 0 && quantidade <= minimo
    }

    const nCasa = (casa.data || []).filter(i => abaixo(i.quantity, i.min_quantity)).length
    // A tabela pode ainda não existir (migração por correr). Isso não pode
    // apagar o número do armazém da casa, que está certo.
    const nPessoas = pessoas.error ? 0 : (pessoas.data || []).filter(i => abaixo(i.quantidade, i.minimo)).length
    return nCasa + nPessoas
  },

  // Pastilheiros desta semana por preparar.
  //
  // Conta PESSOAS, não caixas: «faltam 3 pessoas» é uma frase que se resolve;
  // «faltam 42 compartimentos» é uma frase que se ignora.
  async preparacao(c) {
    const inicio = inicioDaSemana()
    const [utentes, prep] = await Promise.all([
      c.sb.from('patients').select('id').eq('org_id', c.orgId).eq('active', true),
      c.sb.from('medication_prep_logs').select('patient_id, packed')
        .eq('org_id', c.orgId).eq('week_start', inicio).eq('packed', true),
    ])
    if (utentes.error || prep.error) return null
    const feitos = new Set((prep.data || []).map(p => p.patient_id))
    return (utentes.data || []).filter(p => !feitos.has(p.id)).length
  },

  // Quem não é avaliado há mais de seis meses. É o que a inspeção pergunta, e
  // é a pergunta que ninguém se lembra de fazer a si próprio.
  async avaliacoes(c) {
    const limite = new Date()
    limite.setMonth(limite.getMonth() - 6)
    const desde = ptDate(limite)

    const [utentes, recentes] = await Promise.all([
      c.sb.from('patients').select('id').eq('org_id', c.orgId).eq('active', true),
      c.sb.from('assessments').select('patient_id').eq('org_id', c.orgId).gte('date', desde),
    ])
    if (utentes.error || recentes.error) return null
    const avaliados = new Set((recentes.data || []).map(a => a.patient_id))
    return (utentes.data || []).filter(p => !avaliados.has(p.id)).length
  },

  // Planos individuais a precisar de revisão.
  //
  // Conta os que já passaram da data e os que estão a trinta dias dela — o
  // aviso tem de chegar com tempo de marcar a conversa, não no dia em que já
  // é tarde. `estadoDaRevisao` em lib/plano usa o mesmo limite, para o número
  // aqui e a frase na ficha nunca discordarem.
  async planos(c) {
    const limite = new Date()
    limite.setDate(limite.getDate() + 30)
    const r = await c.sb.from('planos').select('id', { count: 'exact', head: true })
      .eq('org_id', c.orgId).eq('estado', 'ativo')
      .not('rever_em', 'is', null)
      .lte('rever_em', ptDate(limite))
    if (r.error) {
      console.error('[phlox:contadores] planos', r.error.message)
      return null
    }
    return r.count || 0
  },

  // A ementa de hoje: ou está posta, ou não está. Um só, ou nenhum.
  async refeicoes(c) {
    const r = await c.sb.from('meal_plan_entries').select('id', { count: 'exact', head: true })
      .eq('org_id', c.orgId).eq('date', ptDate())
    if (r.error) return null
    return (r.count || 0) > 0 ? 0 : 1
  },
}

/** Segunda-feira desta semana, em data portuguesa. */
function inicioDaSemana(): string {
  const d = new Date()
  const dia = d.getDay()               // 0 = domingo
  const recuo = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - recuo)
  return ptDate(d)
}

/** Uma contagem declarativa: os filtros do catálogo + «desde que eu vi». */
async function contarDeclarado(c: Ctx, def: Contador): Promise<number | null> {
  let q = c.sb.from(def.tabela!).select('id', { count: 'exact', head: true })
    .eq('org_id', c.orgId)

  const filtros = { ...(def.filtros || {}), ...(def.filtrosDeHoje?.() || {}) }
  for (const [coluna, expr] of Object.entries(filtros)) {
    const corte = expr.indexOf('.')
    q = (q as any).filter(coluna, expr.slice(0, corte), expr.slice(corte + 1))
  }

  if (def.tipo === 'novidades' && def.coluna) {
    // Sem marcador (primeira vez que esta pessoa vê esta ferramenta), conta-se
    // a última semana. Um contador que na primeira abertura diz «412 recados»
    // não informa ninguém — só assusta.
    const desde = c.visto[def.id] || new Date(Date.now() - 7 * 86400000).toISOString()
    q = (q as any).gt(def.coluna, desde)
  }

  const r = await q
  if (r.error) {
    console.error(`[phlox:contadores] ${def.id}`, r.error.message)
    return null
  }
  return r.count || 0
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') || ''
  const tipo = (req.nextUrl.searchParams.get('tipo') || 'day_care') as InstitutionType
  if (!orgId) return NextResponse.json({ numeros: {} })

  const sb = authedClient(req)
  const { data: auth } = await sb.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  const minhas = await permissoesNaOrg(sb, userId, orgId)
  if (!minhas.length) return NextResponse.json({ numeros: {} })

  const marcadores = await sb.from('marcadores_leitura')
    .select('ferramenta, visto_em').eq('user_id', userId)
  const visto: Record<string, string> = {}
  for (const m of marcadores.data || []) visto[m.ferramenta] = m.visto_em

  const ctx: Ctx = { sb, orgId, userId, visto, tipo }

  // Só os contadores cuja área esta pessoa vê. O resto nem chega a ser
  // perguntado — é a diferença entre «não te mostro» e «nem te digo».
  const meus = CONTADORES.filter(d => pode(minhas, d.area, 'ver'))

  const resultados = await Promise.all(meus.map(async d => {
    try {
      const n = d.tipo === 'calculado'
        ? await (CALCULOS[d.id]?.(ctx) ?? Promise.resolve(null))
        : await contarDeclarado(ctx, d)
      return [d.id, n] as const
    } catch (e: any) {
      console.error(`[phlox:contadores] ${d.id} rebentou`, e?.message)
      return [d.id, null] as const
    }
  }))

  const numeros: Record<string, number> = {}
  const semResposta: string[] = []
  for (const [id, n] of resultados) {
    if (n === null) semResposta.push(id)
    else numeros[id] = n
  }

  return NextResponse.json({ numeros, semResposta })
}

/**
 * «Já vi isto.» Guarda a hora em que esta pessoa abriu esta ferramenta.
 *
 * Só mexe nos marcadores de quem está a pedir — o `user_id` vem da sessão e
 * não do corpo do pedido, por isso ninguém pode marcar como lido em nome de
 * outra pessoa (e com isso apagar-lhe um aviso).
 */
export async function POST(req: NextRequest) {
  const { ferramenta, org } = await req.json().catch(() => ({} as any))
  if (!ferramenta || typeof ferramenta !== 'string') {
    return NextResponse.json({ error: 'Falta a ferramenta.' }, { status: 400 })
  }
  if (!CONTADORES.some(c => c.id === ferramenta && (c.tipo === 'novidades' || c.comMarcador))) {
    // Só as ferramentas com marcador. Marcar «visto» num contador de trabalho
    // por fazer não faria nada — e deixaria a impressão de que fez.
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const sb = authedClient(req)
  const { data: auth } = await sb.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  const { error } = await sb.from('marcadores_leitura').upsert({
    user_id: userId,
    org_id: org || null,
    ferramenta,
    visto_em: new Date().toISOString(),
  }, { onConflict: 'user_id,ferramenta' })

  if (error) {
    console.error('[phlox:contadores] marcar', error.message)
    return NextResponse.json({ error: 'Não ficou marcado.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
