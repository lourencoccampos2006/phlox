// lib/ausenciasDoUtente.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quem não está cá, e porquê.
//
// ── PORQUE É QUE ISTO MUDA O «O DIA» ───────────────────────────────────────
// Sem isto, o dia de trabalho continua a pedir a medicação e o banho de quem
// está internado há duas semanas. Numa lista de setenta linhas, as que são
// impossíveis de fazer ensinam a equipa a ignorar a lista toda — e aí também
// se ignoram as que são mesmo para fazer.
//
// ── MAS NÃO SE ESCONDE EM SILÊNCIO ─────────────────────────────────────────
// Tirar as tarefas e não dizer nada é pior: quem conhece a casa conta as
// pessoas, dá menos uma, e fica sem saber se o Phlox se enganou ou se alguém
// apagou alguma coisa.
//
// Por isso quem usa isto recebe as duas coisas — as tarefas sem as de quem
// está fora, E a lista de quem está fora, para o poder dizer.
//
// ── A ARITMÉTICA É A MESMA DA EQUIPA ───────────────────────────────────────
// `lib/periodo.ts`, partilhado. «Está fora neste dia?» erra nos limites, e
// duas implementações acabam por discordar num deles.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'
import { dentroDoPeriodo, diasNoIntervalo, emPortugues, type Periodo } from './periodo'

export type TipoAusenciaUtente = 'hospital' | 'familia' | 'ferias' | 'consulta' | 'outro'

export interface AusenciaDoUtente extends Periodo {
  id: string
  patient_id: string
  tipo: TipoAusenciaUtente
  inicio: string
  fim: string | null
  motivo: string | null
  onde: string | null
  notas: string | null
}

export const TIPOS: { id: TipoAusenciaUtente; label: string; cor: string }[] = [
  { id: 'hospital', label: 'No hospital',   cor: '#a1544c' },
  { id: 'familia',  label: 'Com a família', cor: '#5f7161' },
  { id: 'ferias',   label: 'De férias',     cor: '#5a6d7c' },
  { id: 'consulta', label: 'Em consulta',   cor: '#6b6a80' },
  { id: 'outro',    label: 'Fora',          cor: '#7c6f5a' },
]

export const ROTULO: Record<TipoAusenciaUtente, string> =
  Object.fromEntries(TIPOS.map(t => [t.id, t.label])) as Record<TipoAusenciaUtente, string>

/** Está fora neste dia? */
export const estaFora = (a: AusenciaDoUtente, dia = ptDate()): boolean => dentroDoPeriodo(a, dia)

/** Os ids de quem está fora num dia. É isto que o «O Dia» usa para filtrar. */
export function foraNoDia(ausencias: AusenciaDoUtente[], dia = ptDate()): Set<string> {
  return new Set(ausencias.filter(a => estaFora(a, dia)).map(a => a.patient_id))
}

/** A ausência em curso de uma pessoa, se houver. */
export function ausenciaAtual(
  ausencias: AusenciaDoUtente[], patientId: string, dia = ptDate(),
): AusenciaDoUtente | null {
  return ausencias.find(a => a.patient_id === patientId && estaFora(a, dia)) || null
}

/** «No hospital desde 12/09» / «Com a família até 14/10». */
export function emPalavras(a: AusenciaDoUtente): string {
  const rotulo = ROTULO[a.tipo] || 'Fora'
  // Sem data de regresso diz-se «desde», porque é o que se sabe. Com data
  // diz-se «até», porque é o que interessa a quem faz a escala de amanhã.
  if (!a.fim) return `${rotulo} desde ${emPortugues(a.inicio)}`
  return `${rotulo} até ${emPortugues(a.fim)}`
}

/** Quantos dias fora num intervalo — para a faturação e para a Carta Social. */
export function diasFora(a: AusenciaDoUtente, de: string, ate: string): number {
  return diasNoIntervalo(a, de, ate)
}

/**
 * Quantos dias esta pessoa esteve fora num mês.
 *
 * Soma todas as ausências do mês. Se duas se sobrepuserem — o que acontece
 * quando alguém regista uma consulta no meio de um internamento — os dias
 * repetidos contam UMA vez. Sem isto, um mês de trinta dias podia dar
 * trinta e cinco dias de ausência, e a faturação descontava a mais.
 */
export function diasForaNoMes(ausencias: AusenciaDoUtente[], patientId: string, mes: string): number {
  const de = `${mes}-01`
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const ate = `${mes}-${String(ultimo).padStart(2, '0')}`

  const dias = new Set<string>()
  for (const au of ausencias.filter(x => x.patient_id === patientId)) {
    if (diasNoIntervalo(au, de, ate) === 0) continue
    // Marca-se dia a dia. São no máximo 31 iterações por ausência, e é a
    // única forma honesta de não contar duas vezes o que se sobrepõe.
    const inicio = au.inicio > de ? au.inicio : de
    const fim = !au.fim || au.fim > ate ? ate : au.fim
    const d = new Date(inicio + 'T12:00:00')
    const limite = new Date(fim + 'T12:00:00')
    while (d <= limite) {
      dias.add(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
  }
  return dias.size
}

/** A linha do topo do «O Dia»: «2 pessoas estão fora». */
export function resumoDeQuemEstaFora(
  ausencias: AusenciaDoUtente[],
  nomes: Map<string, string>,
  dia = ptDate(),
): string | null {
  const fora = ausencias.filter(a => estaFora(a, dia))
  if (!fora.length) return null

  if (fora.length === 1) {
    const nome = nomes.get(fora[0].patient_id) || 'Uma pessoa'
    return `${nome}: ${emPalavras(fora[0]).toLowerCase()}.`
  }
  const quem = fora.slice(0, 3).map(a => nomes.get(a.patient_id) || 'alguém').join(', ')
  return `${fora.length} pessoas estão fora: ${quem}${fora.length > 3 ? ' e mais' : ''}.`
}
