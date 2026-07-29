// lib/adherence.ts
// Motor de padrões de adesão à medicação — determinístico, sobre os MESMOS
// dados que /mymeds já regista (personal_meds.reminder_times + med_logs).
// Propositadamente SEM tabela paralela: lê o que já existe em vez de pedir
// para registar tudo outra vez (era o que o antigo /adherencia fazia, com uma
// tabela própria — `adherence_records` — nunca ligada ao fluxo real de
// "Tomar/Ignorar" do /mymeds; ninguém a alcançava e os dados nunca batiam).
//
// A heurística de "a que horário pertence esta toma" é a MESMA que
// app/mymeds/page.tsx usa para marcar as linhas de hoje (slotIsCovered) —
// aqui aplicada a várias semanas, para dar padrões (não só o dia de hoje).

export interface AdherenceMed {
  id: string
  name: string
  reminder_times: string[] | null
  created_at?: string | null
}

export interface AdherenceLog {
  med_id: string
  date: string          // 'YYYY-MM-DD'
  logged_at: string     // ISO
  status: 'taken' | 'skipped' | 'snoozed'
}

const WEEKDAY_LABELS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

type Bucket = 'madrugada' | 'manha' | 'tarde' | 'noite'
const BUCKET_LABEL: Record<Bucket, string> = { madrugada: 'madrugada', manha: 'manhã', tarde: 'tarde', noite: 'noite' }
const BUCKET_ORDER: Bucket[] = ['manha', 'tarde', 'noite', 'madrugada']

function timeBucket(t: string): Bucket {
  const min = toMinutes(t)
  if (min < 6 * 60) return 'madrugada'
  if (min < 12 * 60) return 'manha'
  if (min < 19 * 60) return 'tarde'
  return 'noite'
}

function dateStr(d: Date) { return d.toISOString().slice(0, 10) }

/**
 * Para um dia + medicamento: atribui os logs 'taken' desse dia aos
 * reminder_times ordenados, sequencialmente (mesma heurística usada em
 * app/mymeds/page.tsx `slotIsCovered`) — devolve, por horário, se ficou coberto.
 */
function daySlotsForMed(med: AdherenceMed, dayLogs: AdherenceLog[]): { time: string; covered: boolean }[] {
  const slots = (med.reminder_times || []).slice().sort()
  if (slots.length === 0) return []
  const taken = dayLogs
    .filter(l => l.med_id === med.id && l.status === 'taken')
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  return slots.map((time, i) => ({ time, covered: i < taken.length }))
}

export interface RateStat { total: number; taken: number; rate: number | null }
export interface WeekdayStat extends RateStat { weekday: number; label: string; short: string }
export interface TimeStat extends RateStat { bucket: Bucket; label: string }
export interface MedStat extends RateStat { med_id: string; name: string }
export interface AdherenceInsight { tone: 'good' | 'warn' | 'neutral'; title: string; detail: string }

export interface AdherenceOverview {
  windowDays: number
  hasSchedule: boolean               // há pelo menos 1 medicamento com horários definidos
  daysWithData: number                // dias, dentro da janela, em que havia pelo menos 1 dose agendada
  overallRate: number | null          // % de tomas cumpridas na janela (null = sem dados suficientes)
  totalSlots: number
  takenSlots: number
  currentStreak: number                // dias consecutivos (mais recente para trás) 100% cumpridos
  bestStreak: number
  weekdayStats: WeekdayStat[]
  timeStats: TimeStat[]
  perMed: MedStat[]
  insights: AdherenceInsight[]
}

function rate(taken: number, total: number): number | null {
  return total === 0 ? null : Math.round((taken / total) * 100)
}

export function computeAdherenceOverview(
  meds: AdherenceMed[],
  logs: AdherenceLog[],
  windowDays = 28,
  today: Date = new Date(),
): AdherenceOverview {
  const scheduled = meds.filter(m => (m.reminder_times || []).length > 0)
  const hasSchedule = scheduled.length > 0

  const weekdayAgg = WEEKDAY_LABELS.map((label, i) => ({ weekday: i, label, short: WEEKDAY_SHORT[i], total: 0, taken: 0 }))
  const timeAgg: Record<Bucket, { total: number; taken: number }> = {
    madrugada: { total: 0, taken: 0 }, manha: { total: 0, taken: 0 }, tarde: { total: 0, taken: 0 }, noite: { total: 0, taken: 0 },
  }
  const perMedAgg = new Map<string, { name: string; total: number; taken: number }>()
  scheduled.forEach(m => perMedAgg.set(m.id, { name: m.name, total: 0, taken: 0 }))

  const dayCompletion: { date: string; total: number; taken: number }[] = []
  let totalSlots = 0, takenSlots = 0

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    if (ds > dateStr(today)) continue
    const dayLogs = logs.filter(l => l.date === ds)
    let dayTotal = 0, dayTaken = 0
    for (const med of scheduled) {
      // Só conta a partir do dia em que o medicamento foi criado — evita
      // marcar "falhas" em dias anteriores à própria existência do registo.
      if (med.created_at && new Date(med.created_at).toISOString().slice(0, 10) > ds) continue
      const slots = daySlotsForMed(med, dayLogs)
      for (const s of slots) {
        dayTotal++
        const bucket = timeBucket(s.time)
        const wd = d.getDay()
        weekdayAgg[wd].total++
        timeAgg[bucket].total++
        const pm = perMedAgg.get(med.id)!
        pm.total++
        if (s.covered) {
          dayTaken++
          weekdayAgg[wd].taken++
          timeAgg[bucket].taken++
          pm.taken++
        }
      }
    }
    if (dayTotal > 0) dayCompletion.push({ date: ds, total: dayTotal, taken: dayTaken })
    totalSlots += dayTotal
    takenSlots += dayTaken
  }

  // Streak atual: dias consecutivos (do mais recente para trás, só entre dias
  // COM doses agendadas) totalmente cumpridos.
  let currentStreak = 0
  for (let i = dayCompletion.length - 1; i >= 0; i--) {
    const day = dayCompletion[i]
    if (day.total > 0 && day.taken >= day.total) currentStreak++
    else break
  }
  let bestStreak = 0, run = 0
  for (const day of dayCompletion) {
    if (day.total > 0 && day.taken >= day.total) { run++; bestStreak = Math.max(bestStreak, run) }
    else run = 0
  }

  const weekdayStats: WeekdayStat[] = weekdayAgg.map(w => ({ ...w, rate: rate(w.taken, w.total) }))
  const timeStats: TimeStat[] = BUCKET_ORDER.map(b => ({ bucket: b, label: BUCKET_LABEL[b], total: timeAgg[b].total, taken: timeAgg[b].taken, rate: rate(timeAgg[b].taken, timeAgg[b].total) }))
  const perMed: MedStat[] = Array.from(perMedAgg.entries()).map(([med_id, v]) => ({ med_id, name: v.name, total: v.total, taken: v.taken, rate: rate(v.taken, v.total) }))
  const overallRate = rate(takenSlots, totalSlots)

  const insights = buildInsights({ weekdayStats, timeStats, perMed, currentStreak, overallRate })

  return {
    windowDays, hasSchedule, daysWithData: dayCompletion.length, overallRate, totalSlots, takenSlots,
    currentStreak, bestStreak, weekdayStats, timeStats, perMed, insights,
  }
}

// Só produz um insight quando há dados suficientes (≥3 tomas agendadas nesse
// grupo) — evita apontar um "padrão" a partir de 1 falha isolada.
const MIN_SAMPLE = 3

function buildInsights(input: {
  weekdayStats: WeekdayStat[]
  timeStats: TimeStat[]
  perMed: MedStat[]
  currentStreak: number
  overallRate: number | null
}): AdherenceInsight[] {
  const out: AdherenceInsight[] = []

  const worstWeekday = [...input.weekdayStats]
    .filter(w => w.total >= MIN_SAMPLE && w.rate != null)
    .sort((a, b) => (a.rate as number) - (b.rate as number))[0]
  if (worstWeekday && (worstWeekday.rate as number) < 85) {
    out.push({
      tone: 'warn',
      title: `${worstWeekday.label}s são o dia com mais falhas`,
      detail: `${worstWeekday.rate}% das tomas cumpridas às ${worstWeekday.label.toLowerCase()}s, nas últimas semanas.`,
    })
  }

  const worstTime = [...input.timeStats]
    .filter(t => t.total >= MIN_SAMPLE && t.rate != null)
    .sort((a, b) => (a.rate as number) - (b.rate as number))[0]
  if (worstTime && (worstTime.rate as number) < 85) {
    out.push({
      tone: 'warn',
      title: `As tomas da ${worstTime.label} falham mais`,
      detail: `${worstTime.rate}% cumpridas neste período do dia, nas últimas semanas.`,
    })
  }

  const worstMed = [...input.perMed]
    .filter(m => m.total >= MIN_SAMPLE && m.rate != null)
    .sort((a, b) => (a.rate as number) - (b.rate as number))[0]
  if (worstMed && (worstMed.rate as number) < 75) {
    out.push({
      tone: 'warn',
      title: `${worstMed.name} é o que mais falha`,
      detail: `${worstMed.rate}% cumprido nas últimas semanas — pode valer a pena rever o horário ou falar com o farmacêutico.`,
    })
  }

  if (input.currentStreak >= 7) {
    out.push({ tone: 'good', title: `${input.currentStreak} dias seguidos sem falhas`, detail: 'A rotina está a resultar — vale a pena manter.' })
  }

  if (out.length === 0 && input.overallRate != null && input.overallRate >= 90) {
    out.push({ tone: 'good', title: 'Rotina consistente', detail: `${input.overallRate}% das tomas cumpridas nas últimas semanas.` })
  }

  return out
}

export { WEEKDAY_LABELS, WEEKDAY_SHORT }
