// lib/careSignals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Camada "O Phlox não deixa escapar nada" — ORGANIZACIONAL, não clínica.
//
// O que faz: reúne, para cada utente, TUDO o que a EQUIPA registou (medicação,
// registos do dia, sinais vitais, peso, ingestão, dejeções, ocorrências, feridas,
// avaliações) e DESTACA o que saiu do padrão habitual ou ficou por fazer — para a
// equipa não deixar escapar nada. Junta-se ao motor existente lib/residentSignals
// (analyzeResident), que já cruza estes dados.
//
// ENQUADRAMENTO REGULATÓRIO (importante): isto NÃO é um dispositivo médico. NÃO
// prevê, NÃO diagnostica, NÃO estratifica risco clínico nem recomenda tratamento.
// Apenas organiza e mostra o que a equipa registou, cruzando-o com limiares
// definidos, para apoiar a ORGANIZAÇÃO do trabalho. A avaliação e a decisão são
// SEMPRE do profissional de saúde. A linguagem reflete isto: "saiu do padrão
// habitual", "pode merecer revisão da equipa" — nunca "risco/prognóstico".
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeResident, type Severity, type Signal } from './residentSignals'

export const CARE_DISCLAIMER =
  'Esta vista apoia a organização do trabalho da equipa: reúne o que foi registado e ' +
  'destaca o que saiu do padrão habitual. Não é um diagnóstico nem uma avaliação clínica — ' +
  'a avaliação e a decisão são sempre do profissional de saúde.'

export interface CareRecordRow { patient_id: string; date: string; shift?: string; mood?: any; nutrition?: any; notes?: string; vitals?: any }
export interface MarRow { patient_id: string; date: string; shift?: string; status: string }
export interface IncidentRow { patient_id: string; type: string; severity: string; status: string }
export interface WoundRow { patient_id: string; status: string; stage?: string | null }
export interface AssessmentRow { patient_id: string; scale: string; date: string }
export interface WeightRow { patient_id: string; date: string; weight: number }
export interface HydrationRow { patient_id: string; at: string; fluid_ml?: number | null }
export interface ResidentRequestRow { patient_id: string; kind: string; content: string; status: string; created_at: string }

export interface PatientLite { id: string; name: string; age?: number | null; conditions?: string | null; allergies?: string | null; room_number?: string | null }

export interface CareSignalsInput {
  patient: PatientLite
  meds: string[]
  careToday: CareRecordRow[]          // registos de hoje deste utente
  careHistory: CareRecordRow[]        // registos com vitais/peso (longitudinal)
  mar: MarRow[]                       // tomas de hoje deste utente
  marExpectedToday?: number          // nº de tomas esperadas hoje (se conhecido)
  incidents: IncidentRow[]
  wounds: WoundRow[]
  assessments: AssessmentRow[]
  weights: WeightRow[]
  hydrationToday: HydrationRow[]
  /** pedidos/observações/queixas do utente EM ABERTO (sprint98) — o que a equipa não deve deixar escapar. */
  residentRequests: ResidentRequestRow[]
}

export interface CareItem { kind: string; severity: Severity; title: string; detail: string }

export interface CareResult {
  patientId: string
  name: string
  room?: string | null
  score: number
  level: Severity
  /** sinais que saíram do padrão habitual (organizacional) */
  outOfPattern: CareItem[]
  /** itens por fazer/registar (organizacional) */
  openItems: CareItem[]
  /** frase curta e neutra */
  note: string
}

const num = (v: any): number | undefined => (v == null || v === '' || isNaN(Number(v)) ? undefined : Number(v))

// Lê vitais do registo mais recente que os tenha (care_records.vitals é jsonb).
function latestVitals(history: CareRecordRow[]): { temp?: number; spo2?: number; bp_sys?: number; hr?: number; at?: string } | null {
  const withV = history
    .filter(r => r.vitals && typeof r.vitals === 'object')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  for (const r of withV) {
    const v = r.vitals
    const out = { temp: num(v.temp ?? v.temperature), spo2: num(v.spo2), bp_sys: num(v.bp_sys ?? v.systolic), hr: num(v.hr ?? v.pulse), at: r.date }
    if (out.temp != null || out.spo2 != null || out.bp_sys != null || out.hr != null) return out
  }
  return null
}

// Última recusa alimentar registada hoje (organizacional, do care_records.mood/nutrition).
function refusedMealToday(careToday: CareRecordRow[]): boolean {
  return careToday.some(r => {
    const n = (typeof r.nutrition === 'string' ? r.nutrition : r.nutrition?.appetite || r.mood?.appetite || '') as string
    return /recus/i.test(String(n))
  })
}

/**
 * Resumo organizacional por utente. Reúne tudo o que a equipa registou e destaca
 * o que saiu do padrão + o que ficou por fazer. Determinístico e transparente.
 */
export function summariseResident(input: CareSignalsInput): CareResult {
  const { patient: p } = input

  // Série de peso (do mais antigo para o mais recente é tratada no motor).
  const weightSeries = input.weights
    .filter(w => w.weight != null && w.date)
    .map(w => ({ date: w.date, weight: Number(w.weight) }))

  // Ingestão hídrica de hoje (soma).
  const fluidToday = input.hydrationToday.length
    ? input.hydrationToday.reduce((s, h) => s + (Number(h.fluid_ml) || 0), 0)
    : null

  // Motor existente (analyzeResident) — cruza tudo num estado com sinais explicados.
  const a = analyzeResident({
    age: p.age, conditions: p.conditions, allergies: p.allergies,
    meds: input.meds,
    weightSeries,
    incidents: input.incidents.map(i => ({ type: i.type, severity: i.severity, status: i.status })),
    wounds: input.wounds.map(w => ({ status: w.status, stage: w.stage })),
    assessments: input.assessments.map(x => ({ scale: x.scale, date: x.date })),
    fluidToday,
    lastBowelDays: null,
    careLoggedToday: input.careToday.length > 0,
    latestVitals: latestVitals(input.careHistory),
  })

  // Sinais extra de natureza ORGANIZACIONAL (não clínica): doses por registar,
  // recusa alimentar repetida — coisas que a equipa não deve deixar escapar.
  const extra: Signal[] = []

  // Doses do dia ainda por registar no MAR (organizacional: "falta registar").
  if (input.marExpectedToday && input.marExpectedToday > 0) {
    const given = input.mar.filter(m => m.status === 'taken' || m.status === 'given').length
    const missing = input.marExpectedToday - given
    if (missing > 0) extra.push({ kind: 'mar_open', severity: 'warning', title: `${missing} toma(s) por registar hoje`, detail: 'Há tomas previstas que ainda não foram marcadas como dadas. Confirmar e registar.' })
  }

  // Recusa alimentar hoje (organizacional — a equipa registou; destacar para seguir).
  if (refusedMealToday(input.careToday)) {
    extra.push({ kind: 'meal_refused', severity: 'info', title: 'Recusa alimentar registada hoje', detail: 'A equipa registou recusa de refeição. Pode merecer atenção e seguimento.' })
  }

  // Pedidos/observações/queixas do utente em aberto (o que o utente pediu ou disse,
  // para toda a equipa ficar a saber e poder intervir — sprint98_resident_requests).
  const RR_LABEL: Record<string, string> = { pedido: 'Pedido do utente', observacao: 'Observação registada', queixa: 'Queixa do utente' }
  for (const rr of input.residentRequests) {
    extra.push({
      kind: 'resident_request',
      severity: rr.kind === 'queixa' ? 'warning' : 'info',
      title: RR_LABEL[rr.kind] || 'Pedido/observação do utente',
      detail: String(rr.content || '').slice(0, 200),
    })
  }

  // Junta os sinais do motor + os organizacionais; separa "fora do padrão" de "por fazer".
  const all = [...a.signals, ...extra]
  const openKinds = new Set(['care', 'assess', 'mar_open', 'resident_request'])
  const outOfPattern: CareItem[] = []
  const openItems: CareItem[] = []
  for (const s of all) {
    if (s.severity === 'good') continue
    const item: CareItem = { kind: s.kind, severity: s.severity, title: s.title, detail: s.detail }
    if (openKinds.has(s.kind)) openItems.push(item)
    else outOfPattern.push(item)
  }

  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  outOfPattern.sort((x, y) => ord[x.severity] - ord[y.severity])
  openItems.sort((x, y) => ord[x.severity] - ord[y.severity])

  const note = outOfPattern.length === 0 && openItems.length === 0
    ? 'Sem nada fora do padrão com o que foi registado.'
    : outOfPattern.some(i => i.severity === 'critical')
      ? 'Há registos fora do padrão que podem merecer revisão da equipa.'
      : 'Alguns pontos a confirmar ou completar.'

  return {
    patientId: p.id, name: p.name, room: p.room_number,
    score: a.score, level: a.level,
    outOfPattern, openItems, note,
  }
}

/** Ordena um conjunto de utentes pelo nº/severidade de sinais (organizacional). */
export function rankByAttention(results: CareResult[]): CareResult[] {
  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  return [...results].sort((a, b) =>
    ord[a.level] - ord[b.level] ||
    (b.outOfPattern.length + b.openItems.length) - (a.outOfPattern.length + a.openItems.length) ||
    b.score - a.score
  )
}
