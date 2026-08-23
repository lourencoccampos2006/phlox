// lib/trendSignals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Motor de TENDÊNCIAS — complementa o /radar (que mostra o que saiu do padrão
// HOJE) com uma leitura de 2-3 semanas. O objetivo é apanhar a quebra lenta e
// silenciosa: humor, apetite ou adesão à medicação que vão descendo pouco a
// pouco, sem nenhum dia mau isolado que o /radar apanhasse. Também cruza a
// frequência de ocorrências e o sentido das últimas avaliações (Barthel,
// Braden, Morse, MMSE, MNA) — generalizando o mesmo cálculo de tendência que
// já existe em app/assessments/page.tsx (trendInfo/BETTER_WHEN_HIGHER), sem o
// duplicar cegamente: aqui aplica-se à ÚLTIMA leitura vs. a anterior, tal como
// lá, mas por cada utente em lote.
//
// MÉTODO (documentado para quem alterar os limiares no futuro):
//   - Para humor / alimentação / adesão à medicação: compara a média dos
//     ÚLTIMOS 7 DIAS ("recente") com a média dos 14 dias ANTERIORES a esses
//     ("baseline" — uma leitura estável do que é habitual). Isto dá uma janela
//     total de 21 dias (as "2-3 semanas" pedidas) e um baseline mais robusto
//     (14 dias) do que a semana recente (7 dias), que é onde uma quebra
//     gradual aparece primeiro quando se faz a média.
//   - Só assinalamos declínio quando há dados suficientes dos dois lados
//     (mín. 2 registos recentes + 2 no baseline) — evita falsos positivos por
//     falta de registo, que já é assinalado à parte (não é "declínio").
//   - Para ocorrências (eventos raros, não diários): compara CONTAGEM dos
//     últimos 14 dias com os 14 anteriores, e só sinaliza "a subir" quando há
//     pelo menos 2 no período recente — uma ocorrência isolada nova já é
//     mostrada no dia em que acontece (/incidents, /radar); aqui só interessa
//     o padrão a repetir-se.
//   - Para avaliações: compara a pontuação mais recente com a anterior (nem
//     sempre há mais do que 2 no período), na mesma direção clínica que a
//     ferramenta de avaliações já usa (Morse: menor é melhor; as restantes:
//     maior é melhor). Só é "aviso" quando o agravamento é ≥10% da escala.
//
// NÃO é um dispositivo médico: não prevê, não diagnostica, não estratifica
// risco clínico. Só organiza o que já foi registado e assinala padrões ao
// longo do tempo, para a equipa decidir o que fazer com essa informação.
// ─────────────────────────────────────────────────────────────────────────────

import type { Severity } from './residentSignals'

export const TREND_DISCLAIMER =
  'Esta vista cruza o que a equipa já regista — humor, alimentação, medicação, ocorrências e avaliações — ' +
  'e assinala tendências ao longo de 2 a 3 semanas: quebras graduais que uma leitura do dia-a-dia não mostra. ' +
  'Não é um diagnóstico nem uma previsão clínica — é um ponto de partida para a equipa olhar com mais atenção. ' +
  'A avaliação e a decisão são sempre do profissional de saúde.'

// ── Entradas (linhas cruas da base de dados) ─────────────────────────────────
export interface TrendPatientLite { id: string; name: string; room_number?: string | null }
export interface TrendCareRow { patient_id: string; date: string; mood?: any; nutrition?: any }
export interface TrendMarRow { patient_id: string; date: string; status: string | null }
export interface TrendIncidentRow { patient_id: string; date: string; severity: string }
export interface TrendAssessmentRow { patient_id: string; scale: string; date: string; score: number }
export interface TrendActivityRow { patient_id: string; date: string }

// ── Saídas ────────────────────────────────────────────────────────────────────
export interface SparkPoint { date: string; value: number | null }

export type MetricKey = 'mood' | 'nutrition' | 'adherence' | 'activity'

export interface MetricTrend {
  key: MetricKey
  label: string
  unit: string                 // '/5' | '%'
  scaleMax: number
  points: SparkPoint[]         // série diária, 21 dias, mais antigo → mais recente
  recentAvg: number | null
  baselineAvg: number | null
  sampleRecent: number
  sampleBaseline: number
  reliable: boolean            // dados suficientes dos dois lados para comparar
  delta: number | null         // recentAvg - baselineAvg (com dados fiáveis)
  declining: boolean
  severity: Severity | null    // severidade do declínio, quando reliable && declining
}

export interface IncidentTrend {
  recentCount: number          // últimos 14 dias
  baselineCount: number        // 14 dias anteriores
  rising: boolean
  severity: Severity | null
}

export interface AssessmentTrendItem {
  scale: string
  label: string
  latestScore: number
  latestDate: string
  previousScore: number | null
  previousDate: string | null
  direction: 'melhorou' | 'agravou' | 'sem alteração' | null
  deltaPct: number | null      // |delta| como % da escala
  concerning: boolean          // agravou ≥10% da escala
}

export interface ResidentTrend {
  patientId: string
  name: string
  room?: string | null
  metrics: MetricTrend[]
  incidents: IncidentTrend
  assessments: AssessmentTrendItem[]
  flags: { kind: string; severity: Severity; title: string; detail: string }[]
  score: number
  level: Severity
  hasEnoughData: boolean       // pelo menos uma métrica com dados fiáveis, ou avaliações/ocorrências suficientes
}

// ── Constantes de escala ──────────────────────────────────────────────────────
const MOOD_MAX = 5
const PCT_MAX = 100
// Teto de atividades/dia para a escala do sparkline — não é uma meta oficial,
// só serve para desenhar a barra (um centro de dia típico tem 1-3 por dia).
const ACTIVITY_MAX = 3

// Espelha SCALES/BETTER_WHEN_HIGHER de app/assessments/page.tsx (não exportadas
// de lá) — mantido sincronizado à mão se ali mudar.
const SCALE_META: Record<string, { label: string; max: number; betterHigh: boolean }> = {
  barthel: { label: 'Barthel', max: 100, betterHigh: true },
  braden: { label: 'Braden', max: 23, betterHigh: true },
  morse: { label: 'Morse (quedas)', max: 125, betterHigh: false },
  mmse: { label: 'MMSE', max: 30, betterHigh: true },
  mna: { label: 'MNA', max: 14, betterHigh: true },
}

const num = (v: any): number | undefined => (v == null || v === '' || isNaN(Number(v)) ? undefined : Number(v))

function isoDaysAgo(n: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
/** dias entre `date` (YYYY-MM-DD) e hoje, 0 = hoje. */
function daysAgo(date: string): number {
  const d = new Date(date + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

/** Janela de fetch: 21 dias para métricas diárias, mais folga p/ ocorrências (28d). */
export const TREND_WINDOW_DAYS = 21
export const INCIDENT_WINDOW_DAYS = 28
export const ASSESSMENT_WINDOW_DAYS = 180

function moodValue(r: TrendCareRow): number | undefined {
  const m = r.mood
  return num(typeof m === 'object' ? m?.level : undefined)
}
function nutritionValue(r: TrendCareRow): number | undefined {
  const n = r.nutrition
  if (!n || typeof n !== 'object') return undefined
  const vals = [num(n.breakfast), num(n.lunch), num(n.dinner)].filter((v): v is number => v != null)
  if (!vals.length) return undefined
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/** Constrói a série diária (21 dias) + médias recente/baseline para uma métrica. */
function buildMetric(key: MetricKey, label: string, unit: string, scaleMax: number,
  rows: TrendCareRow[], valueOf: (r: TrendCareRow) => number | undefined,
  decliningThresholds: { warning: number; critical: number }): MetricTrend {
  // agrupa por dia (pode haver >1 registo/dia — manhã/tarde/noite)
  const byDate: Record<string, number[]> = {}
  rows.forEach(r => {
    const v = valueOf(r)
    if (v == null) return
    ;(byDate[r.date] ||= []).push(v)
  })
  const points: SparkPoint[] = []
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = isoDaysAgo(i)
    const vals = byDate[d]
    points.push({ date: d, value: vals && vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null })
  }
  const recentVals: number[] = []
  const baselineVals: number[] = []
  Object.entries(byDate).forEach(([d, vals]) => {
    const age = daysAgo(d)
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    if (age <= 6) recentVals.push(avg)
    else if (age <= 20) baselineVals.push(avg)
  })
  const recentAvg = recentVals.length ? recentVals.reduce((s, v) => s + v, 0) / recentVals.length : null
  const baselineAvg = baselineVals.length ? baselineVals.reduce((s, v) => s + v, 0) / baselineVals.length : null
  const reliable = recentVals.length >= 2 && baselineVals.length >= 2
  const delta = reliable && recentAvg != null && baselineAvg != null ? recentAvg - baselineAvg : null
  let declining = false
  let severity: Severity | null = null
  if (reliable && delta != null) {
    const drop = -delta // positivo = baixou
    if (drop >= decliningThresholds.critical) { declining = true; severity = 'critical' }
    else if (drop >= decliningThresholds.warning) { declining = true; severity = 'warning' }
  }
  return { key, label, unit, scaleMax, points, recentAvg, baselineAvg, sampleRecent: recentVals.length, sampleBaseline: baselineVals.length, reliable, delta, declining, severity }
}

function buildIncidentTrend(rows: TrendIncidentRow[]): IncidentTrend {
  let recentCount = 0, baselineCount = 0
  rows.forEach(r => {
    const age = daysAgo(r.date)
    if (age <= 13) recentCount++
    else if (age <= 27) baselineCount++
  })
  const rising = recentCount >= 2 && recentCount > baselineCount
  let severity: Severity | null = null
  if (rising) severity = (recentCount - baselineCount >= 3 || recentCount >= 4) ? 'critical' : 'warning'
  return { recentCount, baselineCount, rising, severity }
}

function buildAssessmentTrends(rows: TrendAssessmentRow[]): AssessmentTrendItem[] {
  const byScale: Record<string, TrendAssessmentRow[]> = {}
  rows.forEach(r => { (byScale[r.scale] ||= []).push(r) })
  const out: AssessmentTrendItem[] = []
  Object.entries(byScale).forEach(([scale, recs]) => {
    const meta = SCALE_META[scale]
    if (!meta) return
    const sorted = [...recs].sort((a, b) => b.date.localeCompare(a.date))
    const latest = sorted[0]
    const previous = sorted[1] || null
    if (!latest) return
    let direction: AssessmentTrendItem['direction'] = null
    let deltaPct: number | null = null
    let concerning = false
    if (previous) {
      const delta = latest.score - previous.score
      if (delta === 0) direction = 'sem alteração'
      else {
        const improved = meta.betterHigh ? delta > 0 : delta < 0
        direction = improved ? 'melhorou' : 'agravou'
        deltaPct = Math.round((Math.abs(delta) / meta.max) * 100)
        concerning = direction === 'agravou' && deltaPct >= 10
      }
    }
    out.push({ scale, label: meta.label, latestScore: latest.score, latestDate: latest.date, previousScore: previous?.score ?? null, previousDate: previous?.date ?? null, direction, deltaPct, concerning })
  })
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export interface BuildResidentTrendInput {
  patient: TrendPatientLite
  care: TrendCareRow[]
  mar: TrendMarRow[]
  incidents: TrendIncidentRow[]
  assessments: TrendAssessmentRow[]
  /** dias em que ESTE utente participou (uma linha por participação) */
  activities?: TrendActivityRow[]
  /** dias (YYYY-MM-DD) em que houve atividades na instituição — permite
   *  distinguir "não foi" (0) de "não há dados". Ver comentário em
   *  buildResidentTrend. Opcional: sem isto, mantém-se o comportamento antigo. */
  activityDays?: string[]
  /** consumo de material de incontinência atribuído a este utente (Módulo 11) */
  incontinence?: IncontinenceRow[]
  /** sinal de perda de autonomia já calculado em lib/adl (Módulo 15) */
  adlFlag?: ResidentTrend['flags'][number] | null
}

export function buildResidentTrend(input: BuildResidentTrendInput): ResidentTrend {
  const { patient: p } = input

  const mood = buildMetric('mood', 'Humor', '/5', MOOD_MAX, input.care, moodValue, { warning: 0.6, critical: 1.2 })
  const nutrition = buildMetric('nutrition', 'Alimentação', '%', PCT_MAX, input.care, nutritionValue, { warning: 15, critical: 25 })

  // Adesão: % de tomas 'administered' sobre o total de eventos registados
  // (administered+refused+held) por dia. 'held' conta como evento registado
  // (decisão clínica documentada) mas não como toma dada.
  const marByDate: Record<string, { given: number; total: number }> = {}
  input.mar.forEach(r => {
    if (!r.status) return
    const b = (marByDate[r.date] ||= { given: 0, total: 0 })
    b.total++
    if (r.status === 'administered') b.given++
  })
  const adherenceRows: TrendCareRow[] = Object.entries(marByDate).map(([date, b]) => ({ patient_id: p.id, date, nutrition: undefined, mood: undefined, __pct: b.total ? (b.given / b.total) * 100 : null } as any))
  const adherence = buildMetric('adherence', 'Adesão à medicação', '%', PCT_MAX, adherenceRows, (r: any) => (r.__pct == null ? undefined : r.__pct), { warning: 15, critical: 25 })

  // Participação em atividades — mesmo padrão de pré-agregação por dia que a
  // adesão à medicação usa (uma linha por dia com a contagem, não uma linha
  // por atividade — "média de 1s" perderia o sinal). "Mais dados/inteligência"
  // pedido na auditoria: apanha quem está a ir a menos atividades do que ia.
  //
  // BUG CORRIGIDO 2026-08-16 (apanhado a testar o Módulo 5): só entravam aqui
  // os dias em que a pessoa PARTICIPOU. Um dia com atividades oferecidas em
  // que ela não foi não gerava linha nenhuma — ou seja, "deixou de ir" era
  // indistinguível de "não há dados", e a métrica ficava não-fiável (precisa
  // de ≥2 pontos recentes). Resultado: quem parava de ir por completo — o
  // caso exato deste módulo ("ia a todas, passa a ir a uma") — ficava
  // INVISÍVEL. Agora, quando se sabe em que dias houve atividades
  // (activityDays), os dias sem participação contam como 0.
  const activityByDate: Record<string, number> = {}
  ;(input.activityDays || []).forEach(d => { activityByDate[d] = 0 })
  ;(input.activities || []).forEach(r => { activityByDate[r.date] = (activityByDate[r.date] || 0) + 1 })
  const activityRows: TrendCareRow[] = Object.entries(activityByDate).map(([date, count]) => ({ patient_id: p.id, date, nutrition: undefined, mood: undefined, __count: count } as any))
  const activity = buildMetric('activity', 'Atividades', '/dia', ACTIVITY_MAX, activityRows, (r: any) => (r.__count == null ? undefined : r.__count), { warning: 0.6, critical: 1.2 })

  const incidentTrend = buildIncidentTrend(input.incidents)
  const assessmentTrends = buildAssessmentTrends(input.assessments)

  const metrics = [mood, nutrition, adherence, activity]

  const flags: ResidentTrend['flags'] = []
  metrics.forEach(m => {
    if (m.declining && m.severity) {
      const arrowDetail = m.key === 'mood'
        ? `Média dos últimos 7 dias: ${m.recentAvg!.toFixed(1)}/5 (era ${m.baselineAvg!.toFixed(1)}/5 nas 2 semanas anteriores).`
        : m.key === 'activity'
          ? `Média dos últimos 7 dias: ${m.recentAvg!.toFixed(1)}/dia (era ${m.baselineAvg!.toFixed(1)}/dia nas 2 semanas anteriores).`
          : `Média dos últimos 7 dias: ${Math.round(m.recentAvg!)}% (era ${Math.round(m.baselineAvg!)}% nas 2 semanas anteriores).`
      const title = m.key === 'activity' ? 'Participação em atividades a descer há 2-3 semanas' : `${m.label} a descer há 2-3 semanas`
      flags.push({ kind: `trend_${m.key}`, severity: m.severity, title, detail: arrowDetail })
    }
  })
  if (incidentTrend.rising && incidentTrend.severity) {
    flags.push({ kind: 'trend_incidents', severity: incidentTrend.severity, title: 'Ocorrências a repetir-se', detail: `${incidentTrend.recentCount} nos últimos 14 dias (eram ${incidentTrend.baselineCount} nos 14 dias anteriores).` })
  }
  const incont = incontinenceSignal(input.incontinence || [])
  if (incont) flags.push(incont)
  // Perda de autonomia (Módulo 15) — calculado em lib/adl (janela própria, de
  // meses, porque a cadência de registo é livre) e só injetado aqui.
  if (input.adlFlag) flags.push(input.adlFlag)
  assessmentTrends.forEach(a => {
    if (a.concerning) {
      flags.push({ kind: 'trend_assessment', severity: 'warning', title: `${a.label} agravou`, detail: `${a.previousScore} → ${a.latestScore} pts (${a.previousDate} → ${a.latestDate}), ${a.deltaPct}% da escala.` })
    }
  })

  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  flags.sort((a, b) => ord[a.severity] - ord[b.severity])

  const w = { critical: 40, warning: 18, info: 6, good: 0 } as Record<Severity, number>
  const score = flags.reduce((s, f) => s + w[f.severity], 0)
  const level: Severity = flags.some(f => f.severity === 'critical') ? 'critical'
    : flags.some(f => f.severity === 'warning') ? 'warning'
    : flags.length ? 'info' : 'good'

  const hasEnoughData = metrics.some(m => m.reliable) || assessmentTrends.some(a => a.previousScore != null) || incidentTrend.recentCount + incidentTrend.baselineCount > 0

  return {
    patientId: p.id, name: p.name, room: p.room_number,
    metrics, incidents: incidentTrend, assessments: assessmentTrends,
    flags, score, level, hasEnoughData,
  }
}

// ─── Consumo de incontinência como sinal (Módulo 11, 2026-08-19) ─────────────
// Ao contrário do humor/apetite/atividades (onde só DESCER é mau), aqui os
// dois sentidos importam e por isso não passa pelo buildMetric, que assume
// "menos é pior":
//   • subida acentuada — pode acompanhar infeção urinária, perda de
//     mobilidade ou agravamento da incontinência;
//   • descida acentuada — pode acompanhar menor ingestão de líquidos,
//     desidratação ou obstipação.
// Em qualquer dos casos o que afirmamos é a OBSERVAÇÃO ("mudou face ao
// habitual"), sugerindo avaliar — nunca um diagnóstico. Mesmo enquadramento
// do resto do motor (ver TREND_DISCLAIMER).
export interface IncontinenceRow { date: string; qty: number }

export function incontinenceSignal(rows: IncontinenceRow[]): ResidentTrend['flags'][number] | null {
  const recent: number[] = []
  const baseline: number[] = []
  const byDate: Record<string, number> = {}
  rows.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + (Number(r.qty) || 0) })
  Object.entries(byDate).forEach(([d, qty]) => {
    const age = daysAgo(d)
    if (age <= 6) recent.push(qty)
    else if (age <= 20) baseline.push(qty)
  })
  // Precisa de dados dos dois lados — senão é ausência de registo, não mudança.
  if (recent.length < 3 || baseline.length < 3) return null

  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const r = avg(recent), b = avg(baseline)
  if (b <= 0) return null
  const pct = (r - b) / b

  if (pct >= 0.4) {
    return {
      kind: 'trend_incontinence_up',
      severity: pct >= 0.7 ? 'critical' : 'warning',
      title: 'Uso de material de incontinência acima do habitual',
      detail: `Média de ${r.toFixed(1)}/dia nos últimos 7 dias (era ${b.toFixed(1)}/dia nas 2 semanas anteriores). Uma subida assim pode merecer avaliação — por exemplo despiste de infeção urinária ou alteração da mobilidade.`,
    }
  }
  if (pct <= -0.4) {
    return {
      kind: 'trend_incontinence_down',
      severity: pct <= -0.7 ? 'critical' : 'warning',
      title: 'Uso de material de incontinência abaixo do habitual',
      detail: `Média de ${r.toFixed(1)}/dia nos últimos 7 dias (era ${b.toFixed(1)}/dia nas 2 semanas anteriores). Uma descida assim pode merecer avaliação — por exemplo ingestão de líquidos, desidratação ou obstipação.`,
    }
  }
  return null
}

// ─── Erosão psico-social (Módulo 5, 2026-08-16) ──────────────────────────────
// O /apoio-psicossocial tinha só um limiar ESTÁTICO (humor médio ≤2/5 em ≥4
// registos de 14 dias). Isso apanha quem está persistentemente em baixo, mas
// é cego a quem ESTÁ A CAIR: alguém que passou de 5/5 para 3,5/5 nunca chega
// a ≤2 e ficava invisível — exatamente o caso que o Fernando descreveu
// ("ia a todas as atividades, passa a ir a uma por mês").
//
// A deteção de queda de padrão já existia aqui (baseline 14d vs recente 7d);
// só faltava alguém pedi-la para este fim. Esta função é o subconjunto
// PSICO-SOCIAL das métricas: humor (engagement), alimentação (apetite) e
// participação em atividades. NÃO inclui adesão à medicação — isso é
// farmacológico, tem outro dono (o /vigia e o co-piloto de unidoses).
export const PSYCHOSOCIAL_KEYS: MetricKey[] = ['mood', 'nutrition', 'activity']

export interface ErosionResult {
  /** métricas psico-sociais, com ou sem declínio (para mostrar contexto) */
  metrics: MetricTrend[]
  /** só as que estão mesmo a descer */
  declining: MetricTrend[]
  flags: ResidentTrend['flags']
  score: number
  level: Severity
}

export function psychosocialErosion(t: ResidentTrend): ErosionResult {
  const metrics = t.metrics.filter(m => PSYCHOSOCIAL_KEYS.includes(m.key))
  const declining = metrics.filter(m => m.declining)
  const flags = t.flags.filter(f => PSYCHOSOCIAL_KEYS.some(k => f.kind === `trend_${k}`))
  const w = { critical: 40, warning: 18, info: 6, good: 0 } as Record<Severity, number>
  const score = flags.reduce((s, f) => s + w[f.severity], 0)
  // Duas métricas psico-sociais a cair ao mesmo tempo é um sinal mais forte
  // do que uma isolada, mesmo que nenhuma sozinha seja crítica.
  const level: Severity = flags.some(f => f.severity === 'critical') || declining.length >= 2 ? 'critical'
    : flags.some(f => f.severity === 'warning') ? 'warning'
    : flags.length ? 'info' : 'good'
  return { metrics, declining, flags, score, level }
}

export function rankByTrendAttention(results: ResidentTrend[]): ResidentTrend[] {
  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  return [...results].sort((a, b) => ord[a.level] - ord[b.level] || b.score - a.score || a.name.localeCompare(b.name))
}
