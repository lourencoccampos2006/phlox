// lib/ptTime.ts
// Hora de PORTUGAL (Europe/Lisbon) no servidor. O servidor (Vercel) corre em UTC,
// por isso new Date().getHours() devolve a hora errada para lógica local (saudações,
// turnos, lembretes). Estas funções convertem corretamente, tratando verão/inverno.

const TZ = 'Europe/Lisbon'

/** Hora atual em Portugal (0–23). */
export function ptHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d)
  return parseInt(h, 10) % 24
}

/** "HH:MM" em Portugal. */
export function ptHHMM(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const hh = parts.find(p => p.type === 'hour')?.value || '00'
  const mm = parts.find(p => p.type === 'minute')?.value || '00'
  return `${hh}:${mm}`
}

/** Data "YYYY-MM-DD" em Portugal (útil perto da meia-noite). */
export function ptDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d) // en-CA = YYYY-MM-DD
}

/** Saudação por hora de Portugal. */
export function ptGreeting(d: Date = new Date()): string {
  const h = ptHour(d)
  return h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'
}

/**
 * O instante UTC correspondente a uma hora de PORTUGAL num certo dia.
 *
 *   instanteEmPortugal('2026-09-12', '09:00')  →  2026-09-12T08:00:00Z  (verão)
 *   instanteEmPortugal('2026-01-12', '09:00')  →  2026-01-12T09:00:00Z  (inverno)
 *
 * Serve para comparar horas que a pessoa escolheu (sempre de Portugal) com
 * colunas timestamptz, que estão em UTC. O cron fazia essa comparação com uma
 * concatenação de texto — `${dia}T${hora}:00Z` — e por isso, no verão, olhava
 * sempre para a hora seguinte.
 *
 * Não depende do fuso onde o código corre: os dois `toLocaleString` são lidos
 * com o mesmo relógio, por isso a DIFERENÇA entre eles é sempre o desvio real
 * de Lisboa, quer isto corra na Vercel (UTC) quer no portátil (Lisboa).
 */
export function instanteEmPortugal(dia: string, hhmm: string): Date {
  const aprox = new Date(`${dia}T${hhmm.slice(0, 5)}:00Z`)
  if (isNaN(aprox.getTime())) return new Date(NaN)
  const emLisboa = new Date(aprox.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }))
  const emUTC = new Date(aprox.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(aprox.getTime() - (emLisboa.getTime() - emUTC.getTime()))
}
