// lib/ics.ts
// Gerador de ficheiros .ics (iCalendar RFC 5545). Funciona em Apple Calendar,
// Google Calendar, Outlook. Sem dependências.

export interface CalendarEvent {
  uid?: string                          // opcional; geramos um se faltar
  title: string
  description?: string
  location?: string
  start: string | Date                  // local ou ISO
  end?: string | Date                   // se ausente, +1h
  durationMin?: number                  // alternativa a end
  alarmMinBefore?: number               // alerta X minutos antes
  url?: string
  // Recorrência. 'daily' = todos os dias (lembretes de medicação). count = nº de
  // ocorrências (ex.: 90 dias). until = data final ISO (alternativa a count).
  repeat?: 'daily' | 'weekly'
  repeatCount?: number
  repeatUntil?: string | Date
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n) }

function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  )
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function uid(prefix = 'phlox'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@phloxclinical.com`
}

function fold(line: string): string {
  // RFC 5545: linhas > 75 octetos têm de ser dobradas com CRLF + space
  if (line.length <= 75) return line
  const out: string[] = []
  let i = 0
  out.push(line.slice(0, 75))
  i = 75
  while (i < line.length) {
    out.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return out.join('\r\n')
}

export function buildICS(events: CalendarEvent[], calName: string = 'Phlox'): string {
  const now = toICSDate(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Phlox//Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]

  for (const ev of events) {
    const start = typeof ev.start === 'string' ? new Date(ev.start) : ev.start
    let end: Date
    if (ev.end) end = typeof ev.end === 'string' ? new Date(ev.end) : ev.end
    else if (ev.durationMin) end = new Date(start.getTime() + ev.durationMin * 60_000)
    else end = new Date(start.getTime() + 60 * 60_000)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid || uid()}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      fold(`SUMMARY:${escapeText(ev.title)}`),
    )
    if (ev.description) lines.push(fold(`DESCRIPTION:${escapeText(ev.description)}`))
    if (ev.location) lines.push(fold(`LOCATION:${escapeText(ev.location)}`))
    if (ev.url) lines.push(`URL:${ev.url}`)

    // Recorrência (lembretes de medicação = diários)
    if (ev.repeat) {
      const freq = ev.repeat === 'weekly' ? 'WEEKLY' : 'DAILY'
      let rule = `RRULE:FREQ=${freq}`
      if (ev.repeatUntil) {
        const u = typeof ev.repeatUntil === 'string' ? new Date(ev.repeatUntil) : ev.repeatUntil
        rule += `;UNTIL=${toICSDate(u)}`
      } else {
        rule += `;COUNT=${ev.repeatCount && ev.repeatCount > 0 ? ev.repeatCount : 90}`
      }
      lines.push(rule)
    }

    if (ev.alarmMinBefore != null && ev.alarmMinBefore > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${escapeText(ev.title)}`),
        `TRIGGER:-PT${ev.alarmMinBefore}M`,
        'END:VALARM',
      )
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// Download direto no browser
export function downloadICS(events: CalendarEvent[], filename: string = 'phlox.ics', calName?: string): void {
  if (typeof document === 'undefined') return
  const text = buildICS(events, calName)
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
