// lib/patientTimeline.ts
// ─────────────────────────────────────────────────────────────────────────────
// Timeline do Utente (Ronda 12) — funde numa ÚNICA linha do tempo cronológica
// tudo o que já se regista sobre uma pessoa, espalhado por várias tabelas:
// medicação dada (mar_records), registos do dia (care_records), sinais vitais,
// ocorrências (incidents), avaliações (assessments), consultas (appointments),
// mensagens à família (family_thread_messages) e pedidos/observações
// (resident_requests). É a "cola" entre as ilhas de dados — determinística, não
// inventa nada, só ORGANIZA e conta o que existe, por ordem do mais recente.
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineKind =
  | 'med' | 'care' | 'vital' | 'incident' | 'assessment' | 'appointment' | 'family' | 'request'

export interface TimelineItem {
  kind: TimelineKind
  at: string           // ISO datetime (para ordenar) — melhor esforço a partir de date/created_at
  icon: string
  title: string        // linha principal, curta
  detail?: string      // sub-linha opcional
  tone?: 'default' | 'good' | 'warn' | 'alert'
}

const SHIFT_LABEL: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }
const SCALE_LABEL: Record<string, string> = {
  barthel: 'Barthel', braden: 'Braden', morse: 'Morse', mmse: 'MMSE',
  mna: 'MNA', lawton: 'Lawton', gds: 'GDS', norton: 'Norton',
}
const INCIDENT_LABEL: Record<string, string> = {
  fall: 'Queda', medication_error: 'Erro de medicação', pressure_ulcer: 'Úlcera de pressão',
  behavioral: 'Alteração comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Ocorrência',
}
const INCIDENT_TONE: Record<string, TimelineItem['tone']> = {
  minor: 'warn', moderate: 'warn', major: 'alert', critical: 'alert',
}

// Cada tabela vem com colunas diferentes; normalizamos para um instante ISO.
function isoOf(date?: string | null, time?: string | null, created?: string | null): string {
  if (created) return created
  if (date) return `${date}T${(time && /^\d{2}:\d{2}/.test(time)) ? time : '12:00'}:00`
  return new Date().toISOString()
}

export interface TimelineInput {
  mar?: any[]           // mar_records: {date, shift, status, med_id, recorded_at, recorded_by, source}
  medNames?: Record<string, string> // med_id → nome (de patient_meds)
  care?: any[]          // care_records: {date, shift, notes, mood, nutrition, created_at}
  vitals?: any[]        // care_records com vitals OU vitals table: {recorded_at/date, bp_sys, bp_dia, hr, spo2, temp, glucose, weight}
  incidents?: any[]     // incidents: {date, type, severity, description, created_at}
  assessments?: any[]   // assessments: {scale, score, date, created_at}
  appointments?: any[]  // appointments: {date, time, title, type, status}
  family?: any[]        // family_thread_messages: {author_side, author_name, content, created_at, kind}
  requests?: any[]      // resident_requests: {kind, content, status, created_at}
}

export function buildPatientTimeline(input: TimelineInput): TimelineItem[] {
  const out: TimelineItem[] = []
  const names = input.medNames || {}

  for (const m of input.mar || []) {
    const given = m.status === 'administered' || m.status === 'given' || m.status === 'taken'
    const medName = names[m.med_id] || 'medicação'
    out.push({
      kind: 'med',
      at: isoOf(m.date, null, m.recorded_at),
      icon: '💊',
      title: given ? `Deu ${medName}` : `${medName} — ${m.status === 'refused' ? 'recusada' : m.status || 'por dar'}`,
      detail: [SHIFT_LABEL[m.shift] && `turno ${SHIFT_LABEL[m.shift]}`, m.source === 'home' && 'em casa', m.recorded_by].filter(Boolean).join(' · ') || undefined,
      tone: given ? 'good' : m.status === 'refused' ? 'warn' : 'default',
    })
  }

  for (const c of input.care || []) {
    const bits: string[] = []
    const mood = c.mood?.level
    if (mood) bits.push(['', 'em baixo', 'menos bem', 'calma', 'bem-disposta', 'muito animada'][mood] || '')
    const n = c.nutrition || {}
    const meals = ['breakfast', 'lunch', 'dinner'].map(k => n[k]).filter((x: any) => typeof x === 'number')
    if (meals.length) { const avg = Math.round(meals.reduce((a: number, b: number) => a + b, 0) / meals.length); bits.push(avg >= 75 ? 'comeu bem' : avg >= 40 ? 'comeu razoável' : 'comeu pouco') }
    if (c.notes) bits.push(String(c.notes).slice(0, 80))
    out.push({
      kind: 'care', at: isoOf(c.date, null, c.created_at), icon: '📝',
      title: `Registo do dia${c.shift ? ` (${SHIFT_LABEL[c.shift] || c.shift})` : ''}`,
      detail: bits.filter(Boolean).join(' · ') || undefined,
    })
  }

  for (const v of input.vitals || []) {
    const parts = [
      v.bp_sys && v.bp_dia && `TA ${v.bp_sys}/${v.bp_dia}`,
      v.hr && `FC ${v.hr}`, v.spo2 && `SpO₂ ${v.spo2}%`,
      v.temp && `${v.temp}°`, v.glucose && `gli ${v.glucose}`, v.weight && `${v.weight}kg`,
    ].filter(Boolean)
    if (!parts.length) continue
    out.push({ kind: 'vital', at: isoOf(v.date, null, v.recorded_at), icon: '❤️', title: 'Sinais vitais', detail: parts.join(' · ') })
  }

  for (const i of input.incidents || []) {
    out.push({
      kind: 'incident', at: isoOf(i.date, null, i.created_at), icon: '⚠️',
      title: INCIDENT_LABEL[i.type] || 'Ocorrência',
      detail: String(i.description || '').slice(0, 120),
      tone: INCIDENT_TONE[i.severity] || 'warn',
    })
  }

  for (const a of input.assessments || []) {
    out.push({
      kind: 'assessment', at: isoOf(a.date, null, a.created_at), icon: '📐',
      title: `Avaliação ${SCALE_LABEL[a.scale] || a.scale}`, detail: `Pontuação: ${a.score}`,
    })
  }

  for (const ap of input.appointments || []) {
    const future = ap.date >= new Date().toISOString().slice(0, 10)
    out.push({
      kind: 'appointment', at: isoOf(ap.date, ap.time), icon: '📅',
      title: ap.title || (ap.type === 'consulta' ? 'Consulta' : 'Marcação'),
      detail: [ap.time, future ? 'agendada' : ap.status === 'completed' ? 'realizada' : ap.status].filter(Boolean).join(' · ') || undefined,
    })
  }

  for (const f of input.family || []) {
    const who = f.author_side === 'family' ? (f.author_name || 'Família') : 'Equipa'
    out.push({
      kind: 'family', at: f.created_at || new Date().toISOString(), icon: '👨‍👩‍👧',
      title: `${who}: ${f.kind === 'photo' ? 'partilhou uma foto' : String(f.content || '').slice(0, 90)}`,
    })
  }

  for (const r of input.requests || []) {
    const lbl = r.kind === 'queixa' ? 'Queixa' : r.kind === 'observacao' ? 'Observação' : 'Pedido'
    out.push({
      kind: 'request', at: r.created_at || new Date().toISOString(), icon: '🙋',
      title: `${lbl}: ${String(r.content || '').slice(0, 90)}`,
      detail: r.status && r.status !== 'aberto' ? r.status : undefined,
      tone: r.kind === 'queixa' ? 'warn' : 'default',
    })
  }

  // Mais recente primeiro.
  out.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  return out
}

// Agrupa por dia (rótulo pt-PT) para render em secções.
export function groupTimelineByDay(items: TimelineItem[]): { day: string; label: string; items: TimelineItem[] }[] {
  const map = new Map<string, TimelineItem[]>()
  for (const it of items) {
    const day = (it.at || '').slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(it)
  }
  const today = new Date().toISOString().slice(0, 10)
  const yst = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return [...map.entries()].map(([day, items]) => {
    let label: string
    if (day === today) label = 'Hoje'
    else if (day === yst) label = 'Ontem'
    else { try { label = new Date(day + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { label = day } }
    return { day, label: label.charAt(0).toUpperCase() + label.slice(1), items }
  })
}
