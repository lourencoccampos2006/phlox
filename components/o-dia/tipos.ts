// components/o-dia/tipos.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que os dois desenhos do /o-dia recebem.
//
// ── PORQUE É QUE OS DADOS VÊM DE FORA ──────────────────────────────────────
// Para a comparação valer alguma coisa, os dois desenhos têm de estar a olhar
// EXATAMENTE para os mesmos dados, com as mesmas permissões, o mesmo filtro e
// o mesmo relógio. Se cada um carregasse o seu, a diferença que se visse podia
// ser de carregamento e não de desenho — e escolhia-se a versão errada.
//
// Por isso a página continua a ser dona de tudo o que é lógica, e isto é só a
// cara. Quando um deles ganhar, o outro apaga-se e a página passa a chamar o
// vencedor diretamente.
// ─────────────────────────────────────────────────────────────────────────────

import type { Tarefa, Grupo } from '@/lib/oDia'
import type { Shift } from '@/lib/institutionConfig'

export type Vista = 'hora' | 'pessoa' | 'tarefa'

export interface DadosDoDia {
  /** Como esta casa chama as pessoas. */
  pessoasPlural: string
  /** A data por extenso, já escrita. */
  data: string
  /** `HH:MM` — anda de minuto a minuto, por isso vem de fora. */
  agora: string

  turnos: Shift[]
  turno: Shift
  aoMudarTurno: (t: Shift) => void

  vista: Vista
  aoMudarVista: (v: Vista) => void

  soMeu: boolean
  aoMudarSoMeu: (v: boolean) => void
  /** Quantas são minhas e ainda não estão tratadas. */
  meuTotal: number

  /** Já filtradas e já agrupadas pela vista escolhida. */
  grupos: Grupo[]
  /** As mesmas tarefas, sem agrupar — é daqui que saem os blocos de tempo. */
  visiveis: Tarefa[]
  /** Quantas têm hora marcada. Zero significa que «por hora» não diz nada. */
  comHora: number

  progresso: { pct: number; feitos: number; total: number } | null
  /** «10 coisas por fazer, com 3 pessoas.» */
  linhaResumo: string
  /** Quem está fora hoje, numa linha. `null` quando está cá toda a gente. */
  linhaDeQuemEstaFora: string | null

  carregando: boolean
  erro: string

  marcar: (t: Tarefa) => void
  /** As que estão a ser gravadas neste momento. */
  aMarcar: Set<string>
  /** Abre a caixa do «não foi feito, e porquê». */
  aoExplicar: (t: Tarefa) => void
  podeEditar: boolean
}
