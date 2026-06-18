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
