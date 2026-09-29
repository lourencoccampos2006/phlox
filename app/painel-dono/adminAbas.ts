// app/painel-dono/adminAbas.ts
// ─────────────────────────────────────────────────────────────────────────────
// As contas do painel administrativo, separadas do que se desenha.
//
// ── PORQUE É QUE ISTO ESTÁ NUM FICHEIRO À PARTE ────────────────────────────
// Pelo mesmo motivo que em app/painel/painelAbas.ts: estes números são a base
// de decisões sobre pessoas e sobre dinheiro. Misturados com JSX ninguém os
// consegue ler para confirmar se estão certos, e um painel em que não se
// confia é pior do que painel nenhum — leva a decidir na mesma, mas com a
// falsa sensação de ter olhado para os dados.
//
// ── A REGRA ─────────────────────────────────────────────────────────────────
// Nenhum número é estimado. Onde não há registos, o cartão diz o que falta em
// vez de desenhar uma forma bonita sobre nada.
//
// ── E AS MENSAGENS CONFIDENCIAIS ────────────────────────────────────────────
// Um recado dirigido a alguém (`team_messages.para_ids`) não aparece aqui, e
// não é este ficheiro que o garante: é a política `tm_dirigido` do sprint156,
// que é RESTRITIVA e não abre exceção nenhuma para a direção. Por isso todas
// as leituras deste painel TÊM de ir com a sessão de quem está a ver, nunca
// com a chave de serviço — que passa por cima da RLS e traria tudo.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Kpi, DadosLinha, DadosBarras, DadosRosca, DadosTabela, DadosLista,
} from '../painel/painelPecas'

export type AbaAdminId = 'casa' | 'cuidado' | 'equipa' | 'dinheiro' | 'conformidade'

export const ABAS_ADMIN: { id: AbaAdminId; label: string }[] = [
  { id: 'casa', label: 'A casa' },
  { id: 'cuidado', label: 'Cuidado' },
  { id: 'equipa', label: 'Equipa' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'conformidade', label: 'Conformidade' },
]

export type Aba = {
  eyebrow: string
  headline: string
  acoes: { label: string; href: string; primaria?: boolean }[]
  kpis: Kpi[]
  linha: DadosLinha
  barras: DadosBarras
  rosca: DadosRosca
  tabela: DadosTabela
  lista: DadosLista
}

/* ── O que cada aba precisa de ler ────────────────────────────────────────── */

export type BaseAdmin = {
  utentes: any[]
  membros: any[]
  capacidade: number | null
}
export type CruCasa = { candidaturas: any[]; saidas: any[] }
export type CruCuidado = { mar30: any[]; care30: any[]; inc90: any[]; avaliacoes: any[]; meds: any[] }
export type CruEquipa = { care30: any[]; mar30: any[]; recados: any[] }
export type CruDinheiro = { mensalidades: any[]; financas: any[] }
export type CruConformidade = { planos: any[]; documentos: any[]; incAbertas: any[]; avaliacoes: any[] }

/* ── Utilitários ──────────────────────────────────────────────────────────── */

const DADA = (t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken'
const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null)
const euros = (n: number) => `${n.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} €`

/** Anos completos a partir de 'AAAA-MM-DD'. */
function anos(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const d = new Date(String(nascimento).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const h = new Date()
  let a = h.getFullYear() - d.getFullYear()
  const m = h.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--
  return a > 0 && a < 130 ? a : null
}

const vazios = {
  linha: (t: string, v: string): DadosLinha => ({
    titulo: t, valor: '—', delta: null, deltaBom: true, a: [], b: null,
    etiquetas: [], legendaA: '', legendaB: null, vazio: v,
  }),
  barras: (t: string, v: string): DadosBarras => ({ titulo: t, itens: [], rodape: '', vazio: v }),
  rosca: (t: string, v: string): DadosRosca => ({
    titulo: t, grande: '—', unidade: '', a: 0, b: 0, total: 0, legenda: [], vazio: v,
  }),
  tabela: (t: string, v: string, cols = '1fr auto', cab: string[] = []): DadosTabela => ({
    titulo: t, rodape: '', cols, cabecalho: cab, linhas: [], vazio: v,
  }),
  lista: (t: string, v: string): DadosLista => ({ titulo: t, contagem: '', itens: [], vazio: v }),
}

/** O esqueleto de uma aba que ainda não carregou. */
function esqueleto(nome: string, casa: string, aDizer: string): Aba {
  return {
    eyebrow: nome, headline: casa, acoes: [], kpis: [],
    linha: vazios.linha(nome, aDizer),
    barras: vazios.barras('', aDizer),
    rosca: vazios.rosca('', aDizer),
    tabela: vazios.tabela('', aDizer),
    lista: vazios.lista('', aDizer),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   A CASA — quem cá está, quem espera, quem entrou e saiu
   ═══════════════════════════════════════════════════════════════════════════ */

export function abaCasa(b: BaseAdmin, c: CruCasa | null, casa: string, pessoas: string): Aba {
  const total = b.utentes.length
  const cap = b.capacidade
  const ocupacao = cap ? pct(total, cap) : null

  const kpis: Kpi[] = [
    { etiqueta: pessoas, valor: total, nota: cap ? `de ${cap} lugares` : 'sem capacidade definida', serie: [] },
    { etiqueta: 'Lotação', valor: ocupacao === null ? '—' : `${ocupacao}%`, nota: ocupacao === null ? 'defina a capacidade' : ocupacao >= 95 ? 'praticamente cheia' : 'há lugar', serie: [], alerta: ocupacao !== null && ocupacao >= 98 },
    { etiqueta: 'Equipa', valor: b.membros.length, nota: 'pessoas com acesso', serie: [] },
    { etiqueta: 'À espera', valor: c ? c.candidaturas.length : '—', nota: c ? 'inscrições por admitir' : 'a carregar', serie: [] },
  ]

  if (!c) return { ...esqueleto('A casa', casa, 'A carregar…'), kpis }

  // ── As idades ───────────────────────────────────────────────────────────
  // Só de quem tem data de nascimento. Uma média calculada sobre metade das
  // pessoas parece um facto e é meia verdade — por isso diz-se sobre quantas.
  const idades = b.utentes.map(p => anos(p.date_of_birth)).filter((x): x is number => x !== null)
  const faixas = [
    { rotulo: 'Até 64', teste: (a: number) => a < 65 },
    { rotulo: '65 a 74', teste: (a: number) => a >= 65 && a < 75 },
    { rotulo: '75 a 84', teste: (a: number) => a >= 75 && a < 85 },
    { rotulo: '85 ou mais', teste: (a: number) => a >= 85 },
  ]
  const contadas = faixas.map(f => ({ rotulo: f.rotulo, valor: idades.filter(f.teste).length }))
  const maiorFaixa = Math.max(1, ...contadas.map(x => x.valor))

  const barras: DadosBarras = idades.length ? {
    titulo: 'Idades',
    itens: contadas.map(x => ({ rotulo: x.rotulo, valor: x.valor, teto: maiorFaixa, texto: String(x.valor) })),
    rodape: idades.length === total
      ? `Média ${Math.round(idades.reduce((s, x) => s + x, 0) / idades.length)} anos.`
      : `Sobre ${idades.length} de ${total} — os outros não têm data de nascimento na ficha.`,
    destaque: contadas.findIndex(x => x.valor === maiorFaixa),
  } : vazios.barras('Idades', 'Ninguém tem data de nascimento na ficha. A inscrição passou a pedi-la.')

  // ── Acordo ou particular ────────────────────────────────────────────────
  const comAcordo = b.utentes.filter(p => p.acordo === 'acordo').length
  const particulares = b.utentes.filter(p => p.acordo === 'particular').length
  const semResposta = total - comAcordo - particulares
  const rosca: DadosRosca = (comAcordo + particulares) ? {
    titulo: 'Como pagam',
    grande: String(comAcordo + particulares), unidade: `de ${total}`,
    a: comAcordo, b: particulares, total: comAcordo + particulares,
    legenda: [
      { rotulo: 'Acordo', valor: String(comAcordo), cor: 'forte' },
      { rotulo: 'Particular', valor: String(particulares), cor: 'meio' },
      ...(semResposta ? [{ rotulo: 'Por preencher', valor: String(semResposta), cor: 'fraco' }] : []),
    ],
  } : vazios.rosca('Como pagam', 'Ainda ninguém tem o tipo de acordo preenchido na ficha.')

  // ── A lista de espera ───────────────────────────────────────────────────
  const tabela: DadosTabela = c.candidaturas.length ? {
    titulo: 'Quem está à espera',
    rodape: `${c.candidaturas.length} por admitir. A ordem por critérios está em Inscrições.`,
    cols: '1fr auto auto',
    cabecalho: ['Nome', 'Inscrito', 'Idade'],
    linhas: c.candidaturas.slice(0, 8).map((x: any) => ({
      id: x.id, href: '/inscricoes',
      a: x.nome || '—',
      b: String(x.criada_em || '').slice(0, 10),
      barra: null,
      c: (() => { const i = anos(x.data_nascimento); return i === null ? '—' : `${i}` })(),
      etiqueta: '', destaque: false,
    })),
  } : vazios.tabela('Quem está à espera',
    'Ninguém inscrito à espera de vaga.', '1fr auto auto', ['Nome', 'Inscrito', 'Idade'])

  // ── Quem entrou este ano ────────────────────────────────────────────────
  const ano = new Date().getFullYear()
  const entradas = b.utentes
    .filter(p => String(p.admission_date || '').startsWith(String(ano)))
    .sort((x, y) => String(y.admission_date).localeCompare(String(x.admission_date)))

  const lista: DadosLista = entradas.length ? {
    titulo: `Entraram em ${ano}`,
    contagem: `${entradas.length}`,
    itens: entradas.slice(0, 6).map(p => ({
      id: p.id, icone: '🏠', titulo: p.name,
      sub: `Entrou a ${String(p.admission_date).slice(8, 10)}/${String(p.admission_date).slice(5, 7)}`,
      cta: 'Ficha', href: `/patients/${p.id}`,
    })),
  } : vazios.lista(`Entraram em ${ano}`,
    'Ninguém com data de entrada registada este ano.')

  return {
    eyebrow: 'A casa', headline: casa,
    acoes: [
      { label: 'Inscrições', href: '/inscricoes', primaria: true },
      { label: pessoas, href: '/patients' },
    ],
    kpis,
    linha: vazios.linha('Lotação ao longo do tempo',
      'A lotação só se pode desenhar ao longo do tempo quando houver histórico de entradas e saídas com data.'),
    barras, rosca, tabela, lista,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUIDADO — o que foi feito, e o que ficou por fazer
   ═══════════════════════════════════════════════════════════════════════════ */

const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** 'AAAA-MM-DD' → 'Seg'. É o eixo do gráfico, e tem de ser curto. */
const curtoDe = (iso: string) => DIA_CURTO[new Date(iso + 'T12:00:00').getDay()]

export function abaCuidado(
  b: BaseAdmin, c: CruCuidado | null, casa: string, dias: string[],
): Aba {
  if (!c) return esqueleto('Cuidado', casa, 'A carregar os últimos 30 dias…')

  const total = b.utentes.length
  const dadas = c.mar30.filter(DADA).length
  const registadas = c.mar30.length
  const adesao = pct(dadas, registadas)

  // Quantas pessoas têm registo em cada um dos últimos 14 dias.
  const ultimos = dias.slice(-14)
  const porDia = ultimos.map(iso =>
    new Set(c.care30.filter((r: any) => r.date === iso).map((r: any) => r.patient_id)).size)

  const kpis: Kpi[] = [
    { etiqueta: 'Doses dadas', valor: dadas, nota: 'últimos 30 dias', serie: [] },
    { etiqueta: 'Adesão', valor: adesao === null ? '—' : `${adesao}%`, nota: adesao === null ? 'sem marcações' : 'do que foi marcado', serie: [], alerta: adesao !== null && adesao < 85 },
    { etiqueta: 'Ocorrências', valor: c.inc90.length, nota: 'últimos 90 dias', serie: [] },
    { etiqueta: 'Avaliações', valor: c.avaliacoes.length, nota: 'escalas aplicadas', serie: [] },
  ]

  const linha: DadosLinha = porDia.some(n => n > 0) ? {
    titulo: 'Quantas pessoas ficam com registo do dia',
    valor: `${porDia[porDia.length - 1]} de ${total}`,
    delta: null, deltaBom: true,
    a: porDia, b: null,
    etiquetas: ultimos.map(curtoDe),
    legendaA: 'com registo', legendaB: null,
  } : vazios.linha('Quantas pessoas ficam com registo do dia',
    'Ainda não há registos do dia nos últimos 14 dias.')

  // ── Ocorrências por tipo ────────────────────────────────────────────────
  const porTipo: Record<string, number> = {}
  for (const i of c.inc90) porTipo[i.type || 'sem tipo'] = (porTipo[i.type || 'sem tipo'] || 0) + 1
  const tipos = Object.entries(porTipo).sort((a, z) => z[1] - a[1]).slice(0, 6)
  const maior = Math.max(1, ...tipos.map(t => t[1]))

  const barras: DadosBarras = tipos.length ? {
    titulo: 'Ocorrências por tipo',
    itens: tipos.map(([rotulo, valor]) => ({ rotulo, valor, teto: maior, texto: String(valor) })),
    rodape: 'Últimos 90 dias.',
    destaque: 0,
  } : vazios.barras('Ocorrências por tipo', 'Nenhuma ocorrência registada nos últimos 90 dias.')

  const abertas = c.inc90.filter((i: any) => i.status !== 'closed').length
  const rosca: DadosRosca = c.inc90.length ? {
    titulo: 'Ocorrências fechadas',
    grande: `${pct(c.inc90.length - abertas, c.inc90.length) ?? 0}%`, unidade: 'fechadas',
    a: c.inc90.length - abertas, b: abertas, total: c.inc90.length,
    legenda: [
      { rotulo: 'Fechadas', valor: String(c.inc90.length - abertas), cor: 'forte' },
      { rotulo: 'Por fechar', valor: String(abertas), cor: 'meio' },
    ],
  } : vazios.rosca('Ocorrências fechadas', 'Nada registado nos últimos 90 dias.')

  // ── Quem tem menos registos ─────────────────────────────────────────────
  // Não é uma acusação: é onde vale a pena olhar. Numa casa, quem tem menos
  // registos costuma ser quem dá menos trabalho — e é precisamente esse que
  // passa despercebido quando piora.
  const registosPorPessoa = new Map<string, number>()
  for (const r of c.care30) registosPorPessoa.set(r.patient_id, (registosPorPessoa.get(r.patient_id) || 0) + 1)
  const ordenadas = b.utentes
    .map(p => ({ p, n: registosPorPessoa.get(p.id) || 0 }))
    .sort((x, y) => x.n - y.n)
  const maxReg = Math.max(1, ...ordenadas.map(x => x.n))

  const tabela: DadosTabela = total ? {
    titulo: 'Quem tem menos registos',
    rodape: 'Últimos 30 dias. Quem dá menos trabalho é quem passa mais despercebido.',
    cols: '1fr 1fr auto',
    cabecalho: ['Pessoa', 'Registos', ''],
    linhas: ordenadas.slice(0, 8).map(({ p, n }) => ({
      id: p.id, href: `/patients/${p.id}`,
      a: p.name, b: `${n}`, barra: Math.round((n / maxReg) * 100),
      c: '', etiqueta: n === 0 ? 'nenhum' : '', destaque: n === 0,
    })),
  } : vazios.tabela('Quem tem menos registos', 'Ainda não há ninguém na casa.', '1fr 1fr auto', ['Pessoa', 'Registos', ''])

  return {
    eyebrow: 'Cuidado', headline: casa,
    acoes: [
      { label: 'O que merece atenção', href: '/radar', primaria: true },
      { label: 'Ocorrências', href: '/incidents' },
    ],
    kpis, linha, barras, rosca, tabela,
    lista: vazios.lista('', ''),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EQUIPA — quem fez o quê
   ═══════════════════════════════════════════════════════════════════════════ */

export function abaEquipa(b: BaseAdmin, c: CruEquipa | null, casa: string): Aba {
  if (!c) return esqueleto('Equipa', casa, 'A carregar…')

  // Quem registou o quê. `recorded_by_id` é quem carregou no botão.
  const porPessoa = new Map<string, { nome: string; registos: number; doses: number }>()
  const nomeDe = new Map<string, string>(b.membros.map((m: any) => [m.user_id, m.nome || 'Colega']))
  const conta = (id: string | null, campo: 'registos' | 'doses') => {
    if (!id) return
    const atual = porPessoa.get(id) || { nome: nomeDe.get(id) || 'Colega', registos: 0, doses: 0 }
    atual[campo]++
    porPessoa.set(id, atual)
  }
  for (const r of c.care30) conta(r.recorded_by_id, 'registos')
  for (const t of c.mar30) if (DADA(t)) conta(t.recorded_by_id, 'doses')

  const linhas = [...porPessoa.entries()]
    .map(([id, x]) => ({ id, ...x, total: x.registos + x.doses }))
    .sort((a, z) => z.total - a.total)
  const maiorTotal = Math.max(1, ...linhas.map(x => x.total))
  const totalMarcacoes = linhas.reduce((s, x) => s + x.total, 0)

  const kpis: Kpi[] = [
    { etiqueta: 'Pessoas com acesso', valor: b.membros.length, nota: 'contas ativas', serie: [] },
    { etiqueta: 'Marcações', valor: totalMarcacoes, nota: 'últimos 30 dias', serie: [] },
    { etiqueta: 'Quem marcou', valor: linhas.length, nota: `de ${b.membros.length} com acesso`, serie: [], alerta: b.membros.length > 0 && linhas.length < b.membros.length / 2 },
    { etiqueta: 'Recados', valor: c.recados.length, nota: 'no mural da casa', serie: [] },
  ]

  const tabela: DadosTabela = linhas.length ? {
    titulo: 'Quem registou o quê',
    rodape: 'Últimos 30 dias. Conta registos do dia e doses marcadas.',
    cols: '1fr auto auto auto',
    cabecalho: ['Pessoa', 'Registos', 'Doses', ''],
    linhas: linhas.slice(0, 10).map(x => ({
      id: x.id, a: x.nome, b: `${x.registos}`, barra: Math.round((x.total / maiorTotal) * 100),
      c: `${x.doses}`, etiqueta: '', destaque: false,
    })),
  } : vazios.tabela('Quem registou o quê',
    'Ninguém marcou nada nos últimos 30 dias.', '1fr auto auto auto', ['Pessoa', 'Registos', 'Doses', ''])

  // ── O mural ─────────────────────────────────────────────────────────────
  // Só os recados para a casa toda. Os dirigidos a alguém nem chegam aqui: a
  // política `tm_dirigido` recusa-os à leitura, mesmo à direção. Isto não é
  // um filtro deste ficheiro — é a base de dados.
  const lista: DadosLista = c.recados.length ? {
    titulo: 'Mural da casa',
    contagem: `${c.recados.length}`,
    itens: c.recados.slice(0, 6).map((m: any) => ({
      id: m.id, icone: m.priority === 'urgente' ? '🔴' : m.priority === 'importante' ? '🟠' : '💬',
      titulo: String(m.body || '').slice(0, 70),
      sub: `${m.author_name || 'Alguém'} · ${String(m.created_at || '').slice(0, 10)}`,
      cta: 'Abrir', href: '/equipa?tab=mural',
    })),
  } : vazios.lista('Mural da casa', 'Sem recados para a casa toda.')

  const semMarcar = b.membros.filter((m: any) => !porPessoa.has(m.user_id))
  const barras: DadosBarras = linhas.length ? {
    titulo: 'Carga por pessoa',
    itens: linhas.slice(0, 6).map(x => ({
      rotulo: x.nome.split(' ')[0], valor: x.total, teto: maiorTotal, texto: String(x.total),
    })),
    rodape: semMarcar.length
      ? `${semMarcar.length} com acesso não marcaram nada em 30 dias.`
      : 'Toda a gente com acesso marcou alguma coisa.',
    destaque: 0,
  } : vazios.barras('Carga por pessoa', 'Sem marcações nos últimos 30 dias.')

  return {
    eyebrow: 'Equipa', headline: casa,
    acoes: [
      { label: 'Equipa e acessos', href: '/equipa', primaria: true },
      { label: 'Escalas', href: '/equipa?tab=escalas' },
    ],
    kpis,
    linha: vazios.linha('', ''),
    barras,
    rosca: vazios.rosca('', ''),
    tabela, lista,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DINHEIRO
   ═══════════════════════════════════════════════════════════════════════════ */

export function abaDinheiro(b: BaseAdmin, c: CruDinheiro | null, casa: string, mes: string): Aba {
  if (!c) return esqueleto('Dinheiro', casa, 'A carregar…')

  const devido = c.mensalidades.reduce((s: number, m: any) =>
    s + (+m.fee || 0) + (+m.extras || 0) - (+m.discount || 0) - (+m.subsidy || 0), 0)
  const pago = c.mensalidades.filter((m: any) => m.paid).reduce((s: number, m: any) =>
    s + (+m.fee || 0) + (+m.extras || 0) - (+m.discount || 0) - (+m.subsidy || 0), 0)
  const porCobrar = devido - pago

  const receitas = c.financas.filter((f: any) => f.kind === 'income')
    .reduce((s: number, f: any) => s + (+f.amount || 0), 0)
  const despesas = c.financas.filter((f: any) => f.kind === 'expense')
    .reduce((s: number, f: any) => s + (+f.amount || 0), 0)

  const kpis: Kpi[] = [
    { etiqueta: 'Mensalidades', valor: euros(devido), nota: mes, serie: [] },
    { etiqueta: 'Recebido', valor: euros(pago), nota: devido ? `${pct(pago, devido)}% do devido` : 'nada lançado', serie: [] },
    { etiqueta: 'Por cobrar', valor: euros(porCobrar), nota: `${c.mensalidades.filter((m: any) => !m.paid).length} por pagar`, serie: [], alerta: porCobrar > 0 },
    { etiqueta: 'Resultado', valor: euros(receitas - despesas), nota: 'receitas menos despesas', serie: [], alerta: receitas - despesas < 0 },
  ]

  const rosca: DadosRosca = devido > 0 ? {
    titulo: 'Mensalidades do mês',
    grande: `${pct(pago, devido) ?? 0}%`, unidade: 'cobrado',
    a: pago, b: Math.max(0, porCobrar), total: devido,
    legenda: [
      { rotulo: 'Recebido', valor: euros(pago), cor: 'forte' },
      { rotulo: 'Por cobrar', valor: euros(Math.max(0, porCobrar)), cor: 'meio' },
    ],
  } : vazios.rosca('Mensalidades do mês', `Nada lançado em ${mes}.`)

  const naoPagas = c.mensalidades.filter((m: any) => !m.paid)
  const nomeDe = new Map<string, string>(b.utentes.map((p: any) => [p.id, p.name]))
  const tabela: DadosTabela = naoPagas.length ? {
    titulo: 'Por cobrar',
    rodape: `${naoPagas.length} mensalidades por regularizar em ${mes}.`,
    cols: '1fr auto auto',
    cabecalho: ['Pessoa', 'Valor', ''],
    linhas: naoPagas.slice(0, 10).map((m: any) => ({
      id: m.id, href: '/faturacao',
      a: nomeDe.get(m.patient_id) || '—',
      b: euros((+m.fee || 0) + (+m.extras || 0) - (+m.discount || 0) - (+m.subsidy || 0)),
      barra: null, c: '', etiqueta: 'por pagar', destaque: true,
    })),
  } : vazios.tabela('Por cobrar', 'Está tudo cobrado.', '1fr auto auto', ['Pessoa', 'Valor', ''])

  const barras: DadosBarras = (receitas || despesas) ? {
    titulo: 'Receitas e despesas',
    itens: [
      { rotulo: 'Receitas', valor: receitas, teto: Math.max(receitas, despesas, 1), texto: euros(receitas) },
      { rotulo: 'Despesas', valor: despesas, teto: Math.max(receitas, despesas, 1), texto: euros(despesas) },
    ],
    rodape: mes,
    destaque: receitas >= despesas ? 0 : 1,
  } : vazios.barras('Receitas e despesas', `Nada lançado em ${mes}.`)

  return {
    eyebrow: 'Dinheiro', headline: casa,
    acoes: [{ label: 'Faturação', href: '/faturacao', primaria: true }],
    kpis,
    linha: vazios.linha('', ''),
    barras, rosca, tabela,
    lista: vazios.lista('', ''),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFORMIDADE — o que uma inspeção pergunta
   ═══════════════════════════════════════════════════════════════════════════ */

export function abaConformidade(
  b: BaseAdmin, c: CruConformidade | null, casa: string, hoje: string, pessoas: string,
): Aba {
  if (!c) return esqueleto('Conformidade', casa, 'A carregar…')

  const total = b.utentes.length
  const comPlano = new Set(c.planos.map((p: any) => p.patient_id)).size
  const porRever = c.planos.filter((p: any) => p.rever_em && p.rever_em <= hoje)
  const docsACaducar = c.documentos.filter((d: any) => d.expiry_date && d.expiry_date <= hoje)
  const docsEmBreve = c.documentos.filter((d: any) =>
    d.expiry_date && d.expiry_date > hoje && d.expiry_date <= addDias(hoje, 60))

  const kpis: Kpi[] = [
    { etiqueta: 'Com plano', valor: total ? `${comPlano}/${total}` : '—', nota: total ? `${pct(comPlano, total) ?? 0}% ${pessoas.toLowerCase()}` : 'sem gente', serie: [], alerta: total > 0 && comPlano < total },
    { etiqueta: 'Planos por rever', valor: porRever.length, nota: 'passou a data de revisão', serie: [], alerta: porRever.length > 0 },
    { etiqueta: 'Documentos caducados', valor: docsACaducar.length, nota: `${docsEmBreve.length} caducam em 60 dias`, serie: [], alerta: docsACaducar.length > 0 },
    { etiqueta: 'Ocorrências por fechar', valor: c.incAbertas.length, nota: 'sem data de fecho', serie: [], alerta: c.incAbertas.length > 0 },
  ]

  const semPlano = b.utentes.filter(p => !c.planos.some((x: any) => x.patient_id === p.id))
  const rosca: DadosRosca = total ? {
    titulo: 'Planos de cuidados',
    grande: `${pct(comPlano, total) ?? 0}%`, unidade: 'com plano',
    a: comPlano, b: total - comPlano, total,
    legenda: [
      { rotulo: 'Com plano', valor: String(comPlano), cor: 'forte' },
      { rotulo: 'Sem plano', valor: String(total - comPlano), cor: 'meio' },
    ],
  } : vazios.rosca('Planos de cuidados', 'Ainda não há ninguém na casa.')

  // Tudo o que está fora de prazo, numa lista só — que é como a pergunta é
  // feita numa inspeção: «mostre-me o que está em falta».
  const emFalta = [
    ...porRever.map((p: any) => ({
      id: `plano-${p.id}`, o: 'Plano por rever',
      quem: b.utentes.find(u => u.id === p.patient_id)?.name || '—',
      quando: p.rever_em, href: `/patients/${p.patient_id}?aba=plano`,
    })),
    ...docsACaducar.map((d: any) => ({
      id: `doc-${d.id}`, o: `Documento caducado: ${d.name || 'sem nome'}`,
      quem: b.utentes.find(u => u.id === d.patient_id)?.name || 'da casa',
      quando: d.expiry_date, href: '/documentos',
    })),
    ...semPlano.map(p => ({
      id: `semplano-${p.id}`, o: 'Sem plano de cuidados',
      quem: p.name, quando: '', href: `/patients/${p.id}?aba=plano`,
    })),
  ].sort((a, z) => (a.quando || '9').localeCompare(z.quando || '9'))

  const tabela: DadosTabela = emFalta.length ? {
    titulo: 'O que está em falta',
    rodape: `${emFalta.length} ${emFalta.length === 1 ? 'coisa' : 'coisas'} por regularizar.`,
    cols: '1fr 1fr auto',
    cabecalho: ['O quê', 'Quem', 'Desde'],
    linhas: emFalta.slice(0, 12).map(x => ({
      id: x.id, href: x.href, a: x.o, b: x.quem, barra: null,
      c: x.quando ? x.quando.slice(0, 10) : '—', etiqueta: '', destaque: true,
    })),
  } : vazios.tabela('O que está em falta',
    'Não há nada fora de prazo. Planos revistos, documentos válidos e ocorrências fechadas.',
    '1fr 1fr auto', ['O quê', 'Quem', 'Desde'])

  const lista: DadosLista = docsEmBreve.length ? {
    titulo: 'Caducam nos próximos 60 dias',
    contagem: `${docsEmBreve.length}`,
    itens: docsEmBreve.slice(0, 6).map((d: any) => ({
      id: d.id, icone: '📄', titulo: d.name || 'Documento',
      sub: `Caduca a ${String(d.expiry_date).slice(0, 10)}`,
      cta: 'Abrir', href: '/documentos',
    })),
  } : vazios.lista('Caducam nos próximos 60 dias', 'Nada a caducar nos próximos dois meses.')

  return {
    eyebrow: 'Conformidade', headline: casa,
    acoes: [
      { label: 'Documentos', href: '/documentos', primaria: true },
      { label: 'Avaliações', href: '/assessments' },
    ],
    kpis,
    linha: vazios.linha('', ''),
    barras: vazios.barras('', ''),
    rosca, tabela, lista,
  }
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
