// lib/periodo.ts
// ─────────────────────────────────────────────────────────────────────────────
// Um intervalo de dias, e as perguntas que se lhe fazem.
//
// ── PORQUE É QUE ISTO É UM FICHEIRO SÓ PARA SI ─────────────────────────────
// Porque há duas coisas no Phlox com exactamente a mesma forma — uma ausência
// de um funcionário e uma ausência de um utente — e duas implementações da
// mesma aritmética de datas acabam sempre por discordar num limite.
//
// E os limites são onde isto erra. «Está fora no primeiro dia?» e «no último?»
// são as duas perguntas que uma versão escrita à pressa responde mal, e o erro
// é invisível: põe alguém na escala no dia em que está de férias, ou conta
// dois dias onde são três.
//
// ── `fim` A NULL É «AINDA NÃO ACABOU», E NÃO «UM DIA SÓ» ───────────────────
// Uma baixa sem alta e uma ida ao hospital sem data de regresso são reais, e
// são frequentes. Tratá-las como um dia só punha a pessoa de volta na escala
// no dia seguinte — que é precisamente o contrário do que se sabe.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'

export interface Periodo {
  inicio: string
  /** Null = ainda não acabou. */
  fim: string | null
}

/**
 * Dias entre duas datas. Negativo quando a segunda é anterior.
 *
 * Fixa as horas ao meio-dia antes de subtrair. Sem isso, a noite em que a hora
 * muda tem 23 ou 25 horas e a divisão por 86400000 dá 0,96 ou 1,04 — que
 * arredondado dá o número certo por sorte, e não por construção.
 */
export function diasEntre(de: string, ate: string): number {
  const a = new Date(de + 'T12:00:00').getTime()
  const b = new Date(ate + 'T12:00:00').getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

/**
 * Este dia cai dentro do período?
 *
 * Inclusivo nos DOIS extremos: quem começa férias a 5 está de férias no dia 5,
 * e quem as acaba a 10 ainda está fora no dia 10. Volta no 11.
 */
export function dentroDoPeriodo(p: Periodo, dia = ptDate()): boolean {
  if (dia < p.inicio) return false
  if (!p.fim) return true
  return dia <= p.fim
}

/**
 * Quantos dias do período caem dentro de um intervalo.
 *
 * Conta dias de CALENDÁRIO, e está escrito porque não é óbvio: não desconta
 * fins de semana nem feriados. Para contar dias úteis seria preciso saber a
 * escala de cada pessoa — e uma auxiliar que trabalha ao domingo tem um
 * calendário diferente do de quem está no escritório.
 *
 * Um número que parece exacto e não é vale menos do que um que se sabe
 * aproximado.
 */
export function diasNoIntervalo(p: Periodo, de: string, ate: string): number {
  const inicio = p.inicio > de ? p.inicio : de
  const fim = !p.fim || p.fim > ate ? ate : p.fim
  if (fim < inicio) return 0
  return diasEntre(inicio, fim) + 1
}

/** O período já acabou antes deste dia? */
export function jaAcabou(p: Periodo, dia = ptDate()): boolean {
  return !!p.fim && p.fim < dia
}

/** Ainda não começou? */
export function aindaNaoComecou(p: Periodo, dia = ptDate()): boolean {
  return p.inicio > dia
}

/** `2026-10-05` → `05/10/2026`. */
export const emPortugues = (d: string | null | undefined): string =>
  (d ? d.split('-').reverse().join('/') : '')
