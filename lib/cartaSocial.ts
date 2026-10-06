// lib/cartaSocial.ts
// ─────────────────────────────────────────────────────────────────────────────
// O relatório anual que a Segurança Social pede.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa ao MySenior (2026-10-01), que tem 68 funcionalidades na lista de
// novidades. Uma delas é portuguesa até ao osso e nenhum dos outros a tem:
//
//     «A Segurança Social exige que comunique à Carta Social no reporte anual.»
//
// A Carta Social é o registo nacional das respostas sociais. Toda a
// instituição com acordo tem de reportar lá, uma vez por ano, e o que é pedido
// são números: quem entrou, quantos anos têm, quantos homens e quantas
// mulheres, e quão dependentes são.
//
// ── PORQUE É QUE ISTO NÃO É UM MÓDULO NOVO ─────────────────────────────────
// Porque o Phlox já tem todos estes números. Estão nas fichas (data de
// nascimento, sexo, data de entrada, data de saída) e nas avaliações (Barthel).
// O que faltava era a FOLHA — alguém sentado em dezembro a contar à mão o que
// a base de dados sabe desde janeiro.
//
// Por isso vive em cima do que o /estatisticas já carrega, e não tem tabela
// nenhuma. Uma tabela aqui seria uma segunda cópia dos mesmos números, a
// envelhecer sozinha.
//
// ── E NÃO INVENTA UM ÚNICO NÚMERO ──────────────────────────────────────────
// Cada linha diz de quantas pessoas saiu. Quando metade das fichas não tem
// data de nascimento, a folha diz «de 14 pessoas com data de nascimento», e
// não finge que são as 30. Um relatório que arredonda silenciosamente sobre
// dados em falta é um relatório que se entrega à Segurança Social e que não se
// consegue defender.
// ─────────────────────────────────────────────────────────────────────────────

import { anosDesde } from './estatisticas'

export interface LinhaDeQuadro {
  rotulo: string
  valor: number
  /** Para as percentagens do quadro. */
  pct?: number | null
}

export interface Quadro {
  id: string
  titulo: string
  /** O que a Segurança Social pede, por palavras deles. */
  porque: string
  linhas: LinhaDeQuadro[]
  /** «de 14 pessoas com data de nascimento na ficha» — a base da conta. */
  base: string
  /** Quantas pessoas ficaram de fora por falta de dados. Zero é o objetivo. */
  emFalta: number
  /** Onde se preenche o que falta. */
  ondeResolver?: string
}

export interface Dados {
  /** Quem cá está. */
  utentes: any[]
  /** Quem saiu (arquivados). */
  arquivados: any[]
  /** `assessments` — para a dependência. */
  avaliacoes: any[]
  /** A lotação declarada da casa, se houver. */
  capacidade?: number | null
}

/** As faixas etárias da Carta Social. */
const FAIXAS: [string, number, number][] = [
  ['Menos de 65', 0, 64],
  ['65 a 69', 65, 69],
  ['70 a 74', 70, 74],
  ['75 a 79', 75, 79],
  ['80 a 84', 80, 84],
  ['85 a 89', 85, 89],
  ['90 ou mais', 90, 200],
]

const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null)

/** A data de nascimento, venha ela da coluna nova ou da antiga. */
const nascimento = (p: any): string | null => p?.date_of_birth || p?.birth_date || null

/**
 * O grau de dependência, pelo Barthel.
 *
 * Os cortes são os do índice: 0-20 total, 21-60 grave, 61-90 moderada, 91-99
 * ligeira, 100 independente. Não são uma escolha nossa — mudá-los faria o
 * relatório discordar de qualquer outro documento clínico da casa.
 */
export function grauDeDependencia(score: number): string {
  if (score <= 20) return 'Total'
  if (score <= 60) return 'Grave'
  if (score <= 90) return 'Moderada'
  if (score <= 99) return 'Ligeira'
  return 'Independente'
}

const GRAUS = ['Total', 'Grave', 'Moderada', 'Ligeira', 'Independente']

/**
 * O relatório, em quadros.
 *
 * @param ano  O ano civil a reportar. Por omissão, o que acabou.
 */
export function cartaSocial(d: Dados, ano: number): Quadro[] {
  const quadros: Quadro[] = []
  const vivos = d.utentes || []
  const todos = [...vivos, ...(d.arquivados || [])]

  // ── 1. Movimento no ano ───────────────────────────────────────────────────
  const entradas = todos.filter(p => String(p.admission_date || '').startsWith(String(ano)))
  const saidas = todos.filter(p => String(p.discharge_date || '').startsWith(String(ano)))
  const semEntrada = todos.filter(p => !p.admission_date).length

  quadros.push({
    id: 'movimento',
    titulo: `Movimento em ${ano}`,
    porque: 'Número de utentes admitidos e saídos no ano.',
    linhas: [
      { rotulo: 'Entradas', valor: entradas.length },
      { rotulo: 'Saídas', valor: saidas.length },
      { rotulo: 'A frequentar a 31 de dezembro', valor: vivos.length },
      ...(d.capacidade ? [{
        rotulo: 'Lotação', valor: d.capacidade,
        pct: pct(vivos.length, d.capacidade),
      }] : []),
    ],
    base: `${todos.length} ${todos.length === 1 ? 'pessoa' : 'pessoas'} no total (incluindo quem já saiu)`,
    emFalta: semEntrada,
    ondeResolver: semEntrada ? 'Ficha da pessoa → data de entrada' : undefined,
  })

  // ── 2. Idade e sexo ───────────────────────────────────────────────────────
  // Os dois no mesmo quadro porque é assim que a Carta Social os pede: o
  // cruzamento, e não duas listas.
  const comIdade = vivos
    .map(p => ({ p, anos: anosDesde(nascimento(p)) }))
    .filter((x): x is { p: any; anos: number } => x.anos !== null)

  const porFaixa: LinhaDeQuadro[] = FAIXAS.map(([rotulo, min, max]) => {
    const dentro = comIdade.filter(x => x.anos >= min && x.anos <= max)
    const h = dentro.filter(x => x.p.sex === 'M').length
    const m = dentro.filter(x => x.p.sex === 'F').length
    return {
      rotulo: `${rotulo}  ·  ${h} H / ${m} M`,
      valor: dentro.length,
      pct: pct(dentro.length, comIdade.length),
    }
  })

  quadros.push({
    id: 'idade_sexo',
    titulo: 'Idades e sexo',
    porque: 'Distribuição dos utentes por escalão etário e por sexo.',
    linhas: porFaixa,
    base: `${comIdade.length} de ${vivos.length} ${vivos.length === 1 ? 'pessoa' : 'pessoas'} com data de nascimento na ficha`,
    emFalta: vivos.length - comIdade.length,
    ondeResolver: vivos.length - comIdade.length
      ? 'Ficha da pessoa → data de nascimento' : undefined,
  })

  // O sexo à parte, porque há fichas com data de nascimento e sem sexo.
  const comSexo = vivos.filter(p => p.sex === 'M' || p.sex === 'F')
  quadros.push({
    id: 'sexo',
    titulo: 'Por sexo',
    porque: 'Total de homens e mulheres a frequentar a resposta social.',
    linhas: [
      { rotulo: 'Homens', valor: comSexo.filter(p => p.sex === 'M').length, pct: pct(comSexo.filter(p => p.sex === 'M').length, comSexo.length) },
      { rotulo: 'Mulheres', valor: comSexo.filter(p => p.sex === 'F').length, pct: pct(comSexo.filter(p => p.sex === 'F').length, comSexo.length) },
    ],
    base: `${comSexo.length} de ${vivos.length} com o sexo preenchido`,
    emFalta: vivos.length - comSexo.length,
    ondeResolver: vivos.length - comSexo.length ? 'Ficha da pessoa → sexo' : undefined,
  })

  // ── 3. Dependência ────────────────────────────────────────────────────────
  // A avaliação MAIS RECENTE de cada pessoa, e não a média de todas: o que se
  // reporta é como a pessoa está, não como esteve.
  const ultimoBarthel = new Map<string, any>()
  for (const a of d.avaliacoes || []) {
    if (String(a.scale || '').toLowerCase() !== 'barthel') continue
    if (a.score === null || a.score === undefined) continue
    const atual = ultimoBarthel.get(a.patient_id)
    if (!atual || String(a.date) > String(atual.date)) ultimoBarthel.set(a.patient_id, a)
  }

  const avaliados = vivos.filter(p => ultimoBarthel.has(p.id))
  const porGrau = GRAUS.map(g => {
    const n = avaliados.filter(p => grauDeDependencia(Number(ultimoBarthel.get(p.id).score)) === g).length
    return { rotulo: g, valor: n, pct: pct(n, avaliados.length) }
  })

  quadros.push({
    id: 'dependencia',
    titulo: 'Grau de dependência',
    porque: 'Resultado da avaliação da dependência nas atividades básicas da vida diária.',
    linhas: porGrau,
    base: `${avaliados.length} de ${vivos.length} com índice de Barthel registado`,
    emFalta: vivos.length - avaliados.length,
    ondeResolver: vivos.length - avaliados.length
      ? 'Avaliações → índice de Barthel' : undefined,
  })

  return quadros
}

/** Quantos campos faltam, ao todo, para a folha estar completa. */
export function totalEmFalta(quadros: Quadro[]): number {
  return quadros.reduce((n, q) => n + q.emFalta, 0)
}

/**
 * Os anos que vale a pena oferecer.
 *
 * Do ano da entrada mais antiga até ao ano passado — e o ano corrente só
 * entra depois de janeiro, porque um relatório anual de um ano que agora
 * começou não tem nada lá dentro.
 */
export function anosDisponiveis(d: Dados, hoje = new Date()): number[] {
  const anoAtual = hoje.getFullYear()
  const datas = [...(d.utentes || []), ...(d.arquivados || [])]
    .map(p => Number(String(p.admission_date || '').slice(0, 4)))
    .filter(n => n > 1900)
  // O ano PASSADO entra sempre, mesmo que ninguém tenha data de entrada. É o
  // ano que se reporta na prática, e uma lista que só oferecesse o ano
  // corrente obrigava a escolher aquele que ainda não acabou.
  //
  // Sem isto havia um desencontro visível: a caixa dizia 2026 e o quadro por
  // baixo dizia «Movimento em 2025», porque o ano por omissão não estava na
  // lista e o `select` caía na primeira opção.
  const primeiro = Math.min(anoAtual - 1, ...(datas.length ? datas : [anoAtual]))
  const anos: number[] = []
  for (let a = anoAtual; a >= primeiro; a--) anos.push(a)
  return anos
}
