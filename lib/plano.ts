// lib/plano.ts
// ─────────────────────────────────────────────────────────────────────────────
// O Plano Individual — a caixa que faltava.
//
// ── O QUE ESTAVA EM FALTA, E PORQUE É QUE SE NOTAVA ────────────────────────
// O concorrente trabalha em quatro caixas: Planear → Ordens de Serviço →
// Registar → Evolução. O Phlox tinha só a terceira. Registava muito bem o que
// aconteceu, e não tinha onde dizer o que era suposto acontecer.
//
// A consequência prática: o dia da casa vive na cabeça das pessoas. Quem entra
// de novo aprende a semana por imitação, e quando alguém falta, falta também o
// que só essa pessoa sabia que se fazia às quintas.
//
// E há a consequência formal: a Segurança Social pede um plano individual por
// utente, escrito, com objetivos, com quem faz o quê, e revisto de tempos a
// tempos. Sem isso não há resposta para dar numa visita.
//
// ── O QUE ISTO NÃO É ────────────────────────────────────────────────────────
// Não é o `care_plans`, que já existia: esse é a folha das preferências
// permanentes — dieta, textura, posicionamento, prevenção de quedas. Coisas
// que são verdade sobre a pessoa e não mudam de semana para semana. O plano é
// outra coisa: objetivos com prazo e ações com cadência. Os dois convivem, e o
// plano lê o outro em vez de o repetir.
//
// ── A ESTRUTURA, E PORQUÊ ───────────────────────────────────────────────────
//   Plano  →  Objetivos  →  Ações
//
// Um objetivo diz o que se quer para esta pessoa («voltar a almoçar na mesa
// grande»). Uma ação diz o que se faz para lá chegar, e com que frequência
// («acompanhar à mesa ao almoço, todos os dias»).
//
// São dois níveis e não um porque a pergunta «porque é que fazemos isto?» tem
// de ter resposta. Uma lista de tarefas sem objetivo é uma lista de tarefas; ao
// fim de seis meses ninguém sabe se serviu para alguma coisa, e a revisão do
// plano passa a ser um carimbo.
//
// ── O OBJETIVO PERTENCE A UMA ÁREA ──────────────────────────────────────────
// A mesma área das permissões (`lib/permissoes.ts`). Não é decoração: é o que
// decide quem vê e quem mexe. Um objetivo de medicação é da enfermagem; um de
// animação é de quem faz animação. Sem isto, ou o plano era visível a todos ou
// era preciso inventar um segundo sistema de acessos.
//
// ── PORQUE É QUE A CADÊNCIA VIVE AQUI ───────────────────────────────────────
// É daqui que sai «O Dia». Uma ação com cadência é a única coisa no produto
// que sabe dizer o que devia acontecer amanhã de manhã — e é isso que
// transforma um registo passivo num plano de trabalho.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'

// ─────────────────────────────────────────────────────────────────────────────
// VOCABULÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Num lar chama-se Plano Individual de Cuidados; num centro de dia, Plano
 * Individual de Intervenção. São nomes diferentes para a mesma peça, e usar o
 * errado numa visita dá logo a entender que o programa não foi feito para a
 * casa que o está a usar.
 */
export function nomeDoPlano(tipoDeCasa: string): { curto: string; longo: string } {
  return tipoDeCasa === 'nursing_home'
    ? { curto: 'PIC', longo: 'Plano Individual de Cuidados' }
    : { curto: 'PII', longo: 'Plano Individual de Intervenção' }
}

export type EstadoPlano = 'rascunho' | 'ativo' | 'arquivado'
export type EstadoObjetivo = 'aberto' | 'atingido' | 'suspenso'
export type Cadencia =
  | 'diaria'
  | 'dias_da_semana'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'quando_necessario'

export interface OpcaoCadencia {
  id: Cadencia
  label: string
  /** O que isto quer dizer para quem está a preencher. */
  ajuda: string
  /** Entra sozinha no dia de trabalho? */
  noDia: boolean
}

export const CADENCIAS: OpcaoCadencia[] = [
  { id: 'diaria', label: 'Todos os dias', noDia: true,
    ajuda: 'Aparece no dia de trabalho, todos os dias.' },
  { id: 'dias_da_semana', label: 'Em certos dias', noDia: true,
    ajuda: 'Escolha os dias. Aparece só nesses — é o caso da fisioterapia à terça e à quinta.' },
  { id: 'semanal', label: 'Uma vez por semana', noDia: true,
    ajuda: 'Aparece uma vez por semana, a contar do dia em que a ação começou.' },
  { id: 'quinzenal', label: 'De quinze em quinze dias', noDia: true,
    ajuda: 'De duas em duas semanas, a contar do dia em que começou.' },
  { id: 'mensal', label: 'Uma vez por mês', noDia: true,
    ajuda: 'No mesmo dia do mês em que a ação começou.' },
  { id: 'quando_necessario', label: 'Quando for preciso', noDia: false,
    ajuda: 'Não entra no dia de trabalho. Fica escrita no plano porque faz parte dele — é o que se faz quando a situação aparece.' },
]

export const POR_CADENCIA = new Map(CADENCIAS.map(c => [c.id, c]))

/** Os dias da semana como a `Date` os conta: 0 = domingo. */
export const DIAS_DA_SEMANA = [
  { n: 1, curto: '2ª', label: 'Segunda' },
  { n: 2, curto: '3ª', label: 'Terça' },
  { n: 3, curto: '4ª', label: 'Quarta' },
  { n: 4, curto: '5ª', label: 'Quinta' },
  { n: 5, curto: '6ª', label: 'Sexta' },
  { n: 6, curto: 'Sáb', label: 'Sábado' },
  { n: 0, curto: 'Dom', label: 'Domingo' },
]

// ─────────────────────────────────────────────────────────────────────────────
// AS PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

export interface Plano {
  id: string
  patient_id: string
  org_id: string | null
  estado: EstadoPlano
  /** Desde quando está em vigor. */
  inicio: string
  /** Quando toca rever. A Segurança Social quer ver isto revisto; seis meses é
   *  o intervalo habitual, e é o que se propõe por omissão. */
  rever_em: string | null
  elaborado_por: string | null
  /** O que a pessoa e a família disseram que queriam. Fica no topo do plano,
   *  de propósito: um plano escrito só pela equipa é um plano sobre a pessoa e
   *  não com ela. */
  voz_da_pessoa: string | null
  notas: string | null
  created_at?: string
  updated_at?: string
}

export interface Objetivo {
  id: string
  plano_id: string
  /** Área de permissões: quem vê e quem mexe. */
  area: string
  titulo: string
  /** Porque é que isto está no plano. Uma frase. */
  porque: string | null
  estado: EstadoObjetivo
  ordem: number
}

export interface Acao {
  id: string
  objetivo_id: string
  o_que: string
  /** O papel de quem costuma fazer (`auxiliar`, `enfermagem`…), ou null para
   *  «quem estiver». Não é uma pessoa: as pessoas mudam de turno e de casa, e
   *  um plano que nomeia alguém fica errado no dia em que essa pessoa sai. */
  quem: string | null
  cadencia: Cadencia
  /** Só para `dias_da_semana`. 0 = domingo. */
  dias: number[] | null
  /** `manha` | `tarde` | `noite`, ou null para qualquer altura do dia. */
  turno: string | null
  /** Desde quando. É a âncora das cadências semanais, quinzenais e mensais. */
  desde: string
  ativa: boolean
  notas: string | null
}

export interface Avaliacao {
  id: string
  plano_id: string
  data: string
  texto: string
  autor: string | null
  /** O que se decidiu na revisão. Sem isto, uma revisão é uma nota solta. */
  decisao: 'manter' | 'ajustar' | 'fechar' | null
}

// ─────────────────────────────────────────────────────────────────────────────
// O MOTOR: O QUE É QUE ESTA AÇÃO PEDE NESTE DIA
// ─────────────────────────────────────────────────────────────────────────────

/** Diferença em dias inteiros entre duas datas de calendário (não horas). */
function diasEntre(deISO: string, ate: Date): number {
  const [a, m, d] = deISO.split('-').map(Number)
  if (!a || !m || !d) return 0
  const inicio = Date.UTC(a, m - 1, d)
  const fim = Date.UTC(ate.getFullYear(), ate.getMonth(), ate.getDate())
  return Math.round((fim - inicio) / 86400000)
}

/**
 * Esta ação é para hoje?
 *
 * ── UMA DECISÃO DE TOM ──────────────────────────────────────────────────────
 * Não existe aqui nenhum conceito de «atrasado». Uma ação semanal que não foi
 * feita na semana passada não aparece hoje a acusar ninguém: aparece quando
 * voltar a tocar. Um centro de dia não tem equipa clínica a tempo inteiro, e
 * um programa que passa a semana a dizer a quem lá trabalha que está em falta
 * é um programa que se deixa de abrir.
 *
 * O que fica registado é o que foi feito e o que não foi e porquê
 * (`cuidados_nao_prestados`) — isso sim é verdade sobre o dia. Uma dívida
 * calculada por um relógio não é.
 */
export function ehParaHoje(acao: Pick<Acao, 'cadencia' | 'dias' | 'desde' | 'ativa'>, dia: Date = new Date()): boolean {
  if (!acao.ativa) return false
  const c = POR_CADENCIA.get(acao.cadencia)
  if (!c?.noDia) return false

  const decorridos = diasEntre(acao.desde, dia)
  if (decorridos < 0) return false      // ainda não começou

  switch (acao.cadencia) {
    case 'diaria':
      return true
    case 'dias_da_semana':
      return Array.isArray(acao.dias) && acao.dias.includes(dia.getDay())
    case 'semanal':
      return decorridos % 7 === 0
    case 'quinzenal':
      return decorridos % 14 === 0
    case 'mensal': {
      // Mesmo dia do mês. O dia 31 num mês de 30 cai no último dia — senão uma
      // ação marcada a 31 desaparecia sete vezes por ano sem ninguém perceber.
      const [, , d] = acao.desde.split('-').map(Number)
      const ultimoDoMes = new Date(dia.getFullYear(), dia.getMonth() + 1, 0).getDate()
      return dia.getDate() === Math.min(d, ultimoDoMes)
    }
    default:
      return false
  }
}

/** As ações de um plano que tocam neste dia, já separadas por turno. */
export function acoesDoDia(acoes: Acao[], dia: Date = new Date()): Acao[] {
  return acoes.filter(a => ehParaHoje(a, dia))
}

/** A cadência em palavras, para quem lê o plano impresso. */
export function cadenciaEmPalavras(a: Pick<Acao, 'cadencia' | 'dias' | 'turno'>): string {
  const base = (() => {
    switch (a.cadencia) {
      case 'diaria': return 'todos os dias'
      case 'dias_da_semana': {
        // `filter(Boolean)` não estreita o tipo em TypeScript, e um `!` a
        // seguir é exatamente a asserção que já rebentou uma página deste
        // projeto. O `flatMap` faz as duas coisas de uma vez: tira os que não
        // existem e devolve `string[]` a sério.
        const ds = (a.dias || []).flatMap(n => {
          const d = DIAS_DA_SEMANA.find(x => x.n === n)
          return d ? [d.label.toLowerCase()] : []
        })
        if (!ds.length) return 'em dias a combinar'
        if (ds.length === 1) return `às ${ds[0]}s`
        return `às ${ds.slice(0, -1).join('s, ')}s e ${ds[ds.length - 1]}s`
      }
      case 'semanal': return 'uma vez por semana'
      case 'quinzenal': return 'de quinze em quinze dias'
      case 'mensal': return 'uma vez por mês'
      case 'quando_necessario': return 'quando for preciso'
      default: return ''
    }
  })()
  const turno = a.turno === 'manha' ? 'de manhã' : a.turno === 'tarde' ? 'à tarde' : a.turno === 'noite' ? 'à noite' : ''
  return turno ? `${base}, ${turno}` : base
}

// ─────────────────────────────────────────────────────────────────────────────
// A REVISÃO
// ─────────────────────────────────────────────────────────────────────────────

/** Seis meses a partir de hoje, que é o intervalo habitual de revisão. */
export function proximaRevisao(de: Date = new Date()): string {
  const d = new Date(de)
  d.setMonth(d.getMonth() + 6)
  return ptDate(d)
}

export interface EstadoDaRevisao {
  /** Quantos dias faltam. Negativo quando a data já passou. */
  dias: number
  /** Merece ser mostrado na lista do que precisa de atenção? */
  chama: boolean
  /** A frase, escrita para não acusar ninguém. */
  frase: string
}

/**
 * Como está a revisão deste plano.
 *
 * O tom é deliberado. «Revisão em atraso há 40 dias» é a frase que um programa
 * clínico escreveria, e é a frase que faz uma diretora técnica de um centro de
 * dia fechar a página. A revisão de um plano não é uma dívida — é uma conversa
 * que ainda não houve.
 */
export function estadoDaRevisao(rever_em: string | null | undefined, hoje: Date = new Date()): EstadoDaRevisao | null {
  if (!rever_em) return null
  const dias = -diasEntre(rever_em, hoje)   // positivo = ainda falta

  if (dias > 30) {
    return { dias, chama: false, frase: `Próxima revisão em ${new Date(rever_em).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}.` }
  }
  if (dias > 0) {
    return { dias, chama: true, frase: dias === 1 ? 'Toca rever amanhã.' : `Toca rever daqui a ${dias} dias.` }
  }
  if (dias === 0) {
    return { dias, chama: true, frase: 'Toca rever hoje.' }
  }
  const passaram = -dias
  return {
    dias,
    chama: true,
    frase: passaram < 60
      ? `A data de revisão foi há ${passaram} dias. Vale a pena marcar.`
      : 'Este plano não é revisto há mais de dois meses.',
  }
}

/**
 * Um plano com objetivos mas sem ações nenhumas é o erro mais fácil de cometer
 * e o mais difícil de ver: fica bonito no ecrã, passa numa leitura rápida, e
 * não produz trabalho nenhum no dia.
 */
export function objetivosSemAcoes(objetivos: Objetivo[], acoes: Acao[]): Objetivo[] {
  const comAcao = new Set(acoes.filter(a => a.ativa).map(a => a.objetivo_id))
  return objetivos.filter(o => o.estado === 'aberto' && !comAcao.has(o.id))
}
