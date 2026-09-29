// lib/servicos.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os serviços de cuidado: o banho, o levante, a ajuda à refeição.
//
// ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
// «O /o-dia está completamente inútil neste momento porque é preciso
// adicionar muitas mais tarefas e serviços ao software — senão apenas aparece
// para registar a medicação.»
//
// Estava certo. O dia de uma casa é feito sobretudo de cuidado de rotina, e o
// produto não tinha onde o descrever. Sabia registar a medicação, as
// atividades e os pedidos de apoio; o resto — que é a maior parte — vivia na
// cabeça de quem lá trabalha.
//
// ── PORQUE É QUE NÃO SÃO AÇÕES DO PLANO ────────────────────────────────────
// O `plano_acoes` tem a forma certa, e seria tentador. Mas uma ação do plano
// existe para chegar a um OBJETIVO, e o banho não é um objetivo: é o que se
// faz às terças e sextas, para sempre. Metê-los lá obrigava a inventar um
// objetivo falso chamado «cuidados de rotina» — e a revisão semestral do plano
// passava a ter de rever o banho.
//
// O que É partilhado é o motor da cadência: `ehParaHoje` vem de lib/plano.
// «Às terças e sextas» tem de querer dizer exatamente o mesmo nos dois sítios,
// e isso não pode ter duas implementações.
// ─────────────────────────────────────────────────────────────────────────────

import { ehParaHoje, type Cadencia } from './plano'

export interface ServicoDoCatalogo {
  id: string
  nome: string
  categoria: string
  /** Área de permissões — decide quem o vê no dia. */
  area: string
  minutos: number | null
  ativo: boolean
  ordem: number
}

export interface ServicoDoUtente {
  id: string
  patient_id: string
  servico_id: string
  cadencia: Cadencia
  dias: number[] | null
  turno: string | null
  desde: string
  quem: string | null
  notas: string | null
  ativo: boolean
}

export interface ExecucaoServico {
  servico_utente_id: string
  turno: string | null
}

export const CATEGORIAS: Record<string, { label: string; icone: string; cor: string }> = {
  higiene:     { label: 'Higiene',     icone: '🛁', cor: '#0891b2' },
  mobilidade:  { label: 'Mobilidade',  icone: '🚶', cor: '#7c3aed' },
  alimentacao: { label: 'Alimentação', icone: '🍽️', cor: '#d97706' },
  saude:       { label: 'Saúde',       icone: '🩺', cor: '#dc2626' },
  social:      { label: 'Companhia',   icone: '💬', cor: '#0d9488' },
  apoio:       { label: 'Apoio',       icone: '🧺', cor: '#64748b' },
  outro:       { label: 'Outro',       icone: '📌', cor: '#64748b' },
}

export const ORDEM_DAS_CATEGORIAS = [
  'higiene', 'mobilidade', 'alimentacao', 'saude', 'social', 'apoio', 'outro',
]

/** Os serviços desta pessoa que tocam hoje, já com o nome do catálogo. */
export interface ServicoDeHoje {
  atribuicao: ServicoDoUtente
  servico: ServicoDoCatalogo
  feito: boolean
}

export function servicosDeHoje(
  atribuicoes: ServicoDoUtente[],
  catalogo: ServicoDoCatalogo[],
  execucoes: ExecucaoServico[],
  dia: Date = new Date(),
): ServicoDeHoje[] {
  const porId = new Map(catalogo.map(c => [c.id, c]))
  const feitas = new Set(execucoes.map(e => `${e.servico_utente_id}|${e.turno ?? '-'}`))

  return atribuicoes.flatMap(a => {
    const s = porId.get(a.servico_id)
    if (!s || !s.ativo) return []
    // `ehParaHoje` vem do plano: é o mesmo motor, de propósito.
    if (!ehParaHoje({ cadencia: a.cadencia, dias: a.dias, desde: a.desde, ativa: a.ativo }, dia)) return []
    return [{
      atribuicao: a,
      servico: s,
      feito: feitas.has(`${a.id}|${a.turno ?? '-'}`),
    }]
  })
}

/**
 * Quanto tempo de cuidado é que este dia pede, em minutos.
 *
 * ── PARA QUE SERVE ESTE NÚMERO ──────────────────────────────────────────────
 * Para a conversa que uma direção técnica tem de ter com uma auxiliar que diz
 * «não tenho mãos a medir». Sem número, é a palavra de uma contra a da outra;
 * com número, é uma conta que as duas podem ver.
 *
 * Só conta os serviços com duração escrita. Um total que inventasse os que
 * faltam seria um número com ar de verdade e sem verdade nenhuma — e este é
 * precisamente um número que alguém vai usar para decidir uma escala.
 */
export function minutosDoDia(servicos: ServicoDeHoje[]): { minutos: number; semDuracao: number } {
  let minutos = 0
  let semDuracao = 0
  for (const s of servicos) {
    if (typeof s.servico.minutos === 'number' && s.servico.minutos > 0) minutos += s.servico.minutos
    else semDuracao++
  }
  return { minutos, semDuracao }
}

/** «1h20» em vez de «80 minutos». */
export function tempoEmPalavras(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Quanto do dia está feito, em percentagem.
 *
 * ── É ESTE O NÚMERO DO /inicio ──────────────────────────────────────────────
 * O Fernando pediu que a percentagem do `/o-dia` fosse a que aparece no
 * `/inicio`. Fica aqui, e não nas duas páginas, para não haver hipótese de
 * discordarem — duas contas da mesma coisa acabam sempre por dar números
 * diferentes, e nesse dia ninguém confia em nenhum dos dois.
 *
 * O que foi assinalado como NÃO PRESTADO conta como tratado: alguém foi lá,
 * tentou, e escreveu porquê. Não contar isso seria dizer a essa pessoa que o
 * trabalho dela não conta.
 *
 * Sem nada para fazer devolve `null`, e não 100%. Um dia vazio não é um dia
 * cumprido, e mostrar «100%» a quem ainda não abriu a casa é mentira.
 */
export function percentagemDoDia(
  total: number, tratados: number,
): { pct: number; frase: string } | null {
  if (total <= 0) return null
  const pct = Math.round((tratados / total) * 100)
  return {
    pct,
    frase: pct >= 100
      ? 'Está tudo tratado.'
      : `${tratados} de ${total} tratados.`,
  }
}
