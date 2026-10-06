// lib/contaCorrente.ts
// ─────────────────────────────────────────────────────────────────────────────
// A conta de cada pessoa, e o extrato que vai à família.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa ao Resilar, cujo produto INTEIRO é isto, a 2 € por utente por
// mês: movimentos por utente, saldo automático, extrato mensal em PDF enviado
// ao familiar responsável.
//
// O Phlox tinha uma linha por mês com quatro números. Isso não responde à
// pergunta que a família faz todos os meses — «os 40 € de extras são de quê?».
//
// ── A DIVISÃO, E PORQUE É ASSIM ────────────────────────────────────────────
// A MENSALIDADE e a comparticipação continuam na `billing_entries`: são um
// acordo, fixas, uma por mês. Os EXTRAS e os PAGAMENTOS são movimentos na
// `conta_do_utente`, um a um, com data e descrição.
//
// O extrato junta as duas e fecha com um saldo.
//
// ── E O SALDO ARRASTA-SE DE MÊS PARA MÊS ───────────────────────────────────
// É o que faz disto uma conta e não uma fatura. Quem pagou a menos em setembro
// começa outubro a dever a diferença, e vê-a na primeira linha do extrato —
// em vez de a descobrir seis meses depois numa chamada difícil.
// ─────────────────────────────────────────────────────────────────────────────

export type Sentido = 'debito' | 'credito'

export type TipoMovimento =
  | 'farmacia' | 'cabeleireiro' | 'transporte' | 'material' | 'saude'
  | 'pagamento' | 'adiantamento' | 'acerto' | 'outro'

export interface Movimento {
  id: string
  patient_id: string
  data: string
  mes: string
  sentido: Sentido
  tipo: TipoMovimento
  descricao: string
  /** SEMPRE positivo. O sinal está em `sentido`. */
  valor: number
  lancado_por?: string | null
  notas?: string | null
}

/** A linha mensal que já existia: o acordo. */
export interface Mensalidade {
  patient_id: string
  month: string
  fee: number
  subsidy: number
  extras: number
  discount: number
  paid: boolean
}

export const TIPOS: { id: TipoMovimento; label: string; sentido: Sentido }[] = [
  { id: 'farmacia',     label: 'Farmácia',      sentido: 'debito' },
  { id: 'saude',        label: 'Saúde',         sentido: 'debito' },
  { id: 'cabeleireiro', label: 'Cabeleireiro',  sentido: 'debito' },
  { id: 'transporte',   label: 'Transporte',    sentido: 'debito' },
  { id: 'material',     label: 'Material',      sentido: 'debito' },
  { id: 'outro',        label: 'Outro',         sentido: 'debito' },
  { id: 'pagamento',    label: 'Pagamento',     sentido: 'credito' },
  { id: 'adiantamento', label: 'Adiantamento',  sentido: 'credito' },
  { id: 'acerto',       label: 'Acerto',        sentido: 'credito' },
]

export const ROTULO_TIPO: Record<TipoMovimento, string> =
  Object.fromEntries(TIPOS.map(t => [t.id, t.label])) as Record<TipoMovimento, string>

/**
 * Dinheiro, à portuguesa, e sempre com duas casas.
 *
 * Arredonda-se aos cêntimos ANTES de formatar. Sem isso, somar 0.1 + 0.2 em
 * vírgula flutuante dá 0.30000000000000004 — e um extrato que mostre isso uma
 * vez perde a confiança de quem o recebe para sempre.
 */
export const euro = (v: number): string =>
  `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`

/** Soma em cêntimos e volta a euros — para não acumular erro de vírgula. */
export function somar(valores: number[]): number {
  return valores.reduce((c, v) => c + Math.round(v * 100), 0) / 100
}

// ─────────────────────────────────────────────────────────────────────────────
// O EXTRATO
// ─────────────────────────────────────────────────────────────────────────────

export interface LinhaDoExtrato {
  data: string | null
  descricao: string
  /** O que a pessoa passou a dever neste movimento. */
  debito: number | null
  /** O que pagou, ou lhe foi creditado. */
  credito: number | null
  /** De onde veio: o acordo mensal ou um movimento lançado. */
  origem: 'acordo' | 'movimento'
  /**
   * O id do movimento, quando a linha vem de um.
   *
   * Vai aqui e não se deduz pela posição: a primeira versão do ecrã calculava
   * qual o movimento a apagar contando linhas e subtraindo as do acordo, e
   * bastava uma mensalidade a zero (que não desenha linha) para apagar o
   * movimento errado. Numa conta de dinheiro, apagar a linha errada é apagar
   * dinheiro.
   */
  movimentoId?: string
}

export interface Extrato {
  mes: string
  /** O que vinha de trás. Positivo = devia. */
  saldoAnterior: number
  linhas: LinhaDoExtrato[]
  totalDebitos: number
  totalCreditos: number
  /** `saldoAnterior + débitos − créditos`. Positivo = fica a dever. */
  saldoFinal: number
}

/** `2026-10` → `2026-09`. */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

/**
 * O extrato de um mês, com o saldo que vem de trás.
 *
 * ── PORQUE É QUE O SALDO ANTERIOR SE CALCULA E NÃO SE GUARDA ───────────────
 * Guardado, seria uma terceira cópia do mesmo número — e bastaria alguém
 * corrigir uma farmácia de agosto para todos os saldos a seguir ficarem
 * errados, em silêncio, para sempre.
 *
 * Calculado sobre tudo o que veio antes, uma correção em agosto arruma-se
 * sozinha em setembro, outubro e novembro.
 */
export function extratoDoMes(
  mes: string,
  mensalidades: Mensalidade[],
  movimentos: Movimento[],
): Extrato {
  // ── O que vinha de trás ───────────────────────────────────────────────────
  const saldoAnterior = saldoAte(mes, mensalidades, movimentos)

  // ── Este mês ──────────────────────────────────────────────────────────────
  const linhas: LinhaDoExtrato[] = []
  const acordo = mensalidades.find(m => m.month === mes)

  if (acordo) {
    // A mensalidade, a comparticipação e o desconto, cada um na sua linha.
    // Juntos num «a pagar» a família não consegue conferir nada — e é
    // exactamente isso que ela quer fazer quando abre o papel.
    if (acordo.fee) {
      linhas.push({ data: null, descricao: 'Mensalidade', debito: acordo.fee, credito: null, origem: 'acordo' })
    }
    if (acordo.subsidy) {
      linhas.push({ data: null, descricao: 'Comparticipação', debito: null, credito: acordo.subsidy, origem: 'acordo' })
    }
    if (acordo.discount) {
      linhas.push({ data: null, descricao: 'Desconto', debito: null, credito: acordo.discount, origem: 'acordo' })
    }
  }

  // Os movimentos do mês, por data. Os `extras` da `billing_entries` NÃO
  // entram: são o espelho da soma destes (ver o gatilho do sprint174), e
  // somá-los outra vez cobrava tudo a dobrar.
  const doMes = movimentos
    .filter(m => m.mes === mes)
    .sort((a, b) => a.data.localeCompare(b.data))

  for (const m of doMes) {
    linhas.push({
      data: m.data,
      descricao: `${ROTULO_TIPO[m.tipo] || 'Movimento'} — ${m.descricao}`,
      debito: m.sentido === 'debito' ? m.valor : null,
      credito: m.sentido === 'credito' ? m.valor : null,
      origem: 'movimento',
      movimentoId: m.id,
    })
  }

  const totalDebitos = somar(linhas.map(l => l.debito || 0))
  const totalCreditos = somar(linhas.map(l => l.credito || 0))

  return {
    mes,
    saldoAnterior,
    linhas,
    totalDebitos,
    totalCreditos,
    saldoFinal: somar([saldoAnterior, totalDebitos, -totalCreditos]),
  }
}

/**
 * ── A REGRA QUE EVITA COBRAR TUDO A DOBRAR ─────────────────────────────────
 * Os débitos do mês existem em DOIS sítios: cada um na sua linha da
 * `conta_do_utente`, e somados em `billing_entries.extras` pelo gatilho do
 * sprint174.
 *
 * Isso é de propósito — é o que faz os três ecrãs antigos continuarem certos
 * sem lhes tocar. Mas obriga a uma regra, e a regra é esta:
 *
 *     `extras` é o TOTAL. Os movimentos de débito são a ITEMIZAÇÃO.
 *     Quem soma os dois cobra tudo a dobrar.
 *
 * Por isso o saldo usa `extras` e NUNCA soma débitos. As linhas do extrato
 * usam os movimentos e NUNCA mostram `extras`. Cada número entra uma vez.
 *
 * (Escrevi primeiro a versão que somava os dois. Num extrato de 40 € de
 * farmácia, cobrava 80.)
 */

/**
 * O que uma linha de acordo deixa a dever.
 *
 * Um mês marcado como pago está liquidado e não arrasta nada. É o que o
 * `paid` sempre quis dizer no Phlox, e mudar-lhe o sentido agora faria
 * reaparecer dívidas de meses que a casa já deu por fechados.
 */
function aDever(m: Mensalidade): number {
  if (m.paid) return 0
  return somar([m.fee, m.extras, -m.subsidy, -m.discount])
}

/**
 * O saldo acumulado ATÉ um mês, sem o incluir.
 *
 * Só os créditos (pagamentos) entram pelos movimentos: os débitos já vieram
 * dentro de `extras`. Ver a regra lá em cima.
 */
function saldoAte(mes: string, mensalidades: Mensalidade[], movimentos: Movimento[]): number {
  return somar([
    ...mensalidades.filter(m => m.month < mes).map(aDever),
    ...movimentos
      .filter(m => m.mes < mes && m.sentido === 'credito')
      // Num mês já dado por pago, o crédito seria contado outra vez: o `paid`
      // já pôs esse mês a zero.
      .filter(m => !mensalidades.some(x => x.month === m.mes && x.paid))
      .map(m => -m.valor),
  ])
}

/**
 * O saldo de uma pessoa, hoje.
 *
 * O mesmo cálculo do extrato, sem as linhas. Positivo = deve à casa.
 */
export function saldoDe(mensalidades: Mensalidade[], movimentos: Movimento[]): number {
  const futuro = '9999-99'
  return saldoAte(futuro, mensalidades, movimentos)
}

/** «Fica a dever 42,50 €» / «Tem 10,00 € a favor» / «Está em dia». */
export function saldoEmPalavras(saldo: number): string {
  const c = Math.round(saldo * 100)
  if (c === 0) return 'Está em dia'
  if (c > 0) return `Fica a dever ${euro(saldo)}`
  return `Tem ${euro(-saldo)} a favor`
}

/** `2026-10` → `outubro de 2026`. */
export function mesPorExtenso(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${nomes[m - 1] || mes} de ${a}`
}
