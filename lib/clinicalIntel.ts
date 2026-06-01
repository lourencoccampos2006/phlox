// lib/clinicalIntel.ts
// Inteligência clínica agregada — cálculos partilhados pelo /clinico360.
//
// Não persiste nada; recebe dados já fetched e devolve métricas.

export interface PatientLike {
  id: string
  name: string
  age?: number | null
  meds?: { name?: string; dose?: string }[]
  conditions?: string[]
  last_intervention_at?: string | null
}

export interface MarLogLike {
  patient_id: string
  med_id?: string
  scheduled_at: string
  administered_at?: string | null
  status?: string  // 'given' | 'missed' | 'late' | 'refused'
}

// ── Polypharmacy + Beers/STOPP risk score (0–100) ────────────────────────────
// Reaproveita as regras conhecidas. Mais alto = mais urgente para rever.
const STOPP_PAIRS: { who: (p: PatientLike) => boolean; what: string; weight: number }[] = [
  { who: p => has(p, 'benzodiazepin') && (p.age || 0) >= 75, what: 'Benzo em ≥75', weight: 20 },
  { who: p => has(p, 'ains') && has(p, 'varfarina'), what: 'AINE + varfarina', weight: 25 },
  { who: p => has(p, 'aas') && has(p, 'clopidogrel') && has(p, 'varfarina'), what: 'Triple antithrombotic', weight: 30 },
  { who: p => has(p, 'glibenclamida') && (p.age || 0) >= 70, what: 'Glibenclamida em idoso', weight: 18 },
  { who: p => has(p, 'digoxin') && (p.age || 0) >= 75, what: 'Digoxina em ≥75', weight: 12 },
  { who: p => has(p, 'amitriptilina') || has(p, 'imipramina'), what: 'TCA anticolinérgico', weight: 15 },
  { who: p => has(p, 'beta') && has(p, 'verapamil'), what: 'Beta-bloqueante + verapamil (BAV)', weight: 22 },
  { who: p => has(p, 'metoclopramida') && (p.age || 0) >= 70, what: 'Metoclopramida em idoso (extrapir.)', weight: 10 },
]

function has(p: PatientLike, term: string): boolean {
  const lo = term.toLowerCase()
  return (p.meds || []).some(m => (m.name || '').toLowerCase().includes(lo))
}

export interface RiskRanked {
  patient_id: string
  patient_name: string
  score: number
  flags: string[]
  polypharmacy: number
}

export function rankPatientsByRisk(patients: PatientLike[]): RiskRanked[] {
  return patients.map(p => {
    let s = 0
    const flags: string[] = []
    const poly = (p.meds || []).length
    if (poly >= 10) { s += 25; flags.push(`Hiperpolifarmácia (${poly})`) }
    else if (poly >= 5) { s += 10; flags.push(`Polifarmácia (${poly})`) }
    if ((p.age || 0) >= 85) s += 10
    else if ((p.age || 0) >= 75) s += 5
    STOPP_PAIRS.forEach(rule => {
      if (rule.who(p)) { s += rule.weight; flags.push(rule.what) }
    })
    // Última intervenção há > 14 dias
    if (p.last_intervention_at) {
      const days = (Date.now() - new Date(p.last_intervention_at).getTime()) / 86400000
      if (days > 30) { s += 8; flags.push('Sem intervenção há > 30 d') }
      else if (days > 14) { s += 4 }
    }
    return { patient_id: p.id, patient_name: p.name, score: Math.min(100, s), flags, polypharmacy: poly }
  }).sort((a, b) => b.score - a.score)
}

// ── Workflow Pulse: KPIs do turno em tempo real ──────────────────────────────
export interface WorkflowPulse {
  mar_total: number
  mar_given: number
  mar_missed: number
  mar_late: number
  mar_completion_pct: number
  on_time_pct: number
  late_threshold_min: number
}

export function workflowPulse(mar: MarLogLike[], opts?: { lateThresholdMin?: number }): WorkflowPulse {
  const threshold = opts?.lateThresholdMin ?? 30
  let given = 0, missed = 0, late = 0
  mar.forEach(r => {
    if (r.status === 'given' || r.administered_at) {
      const sched = new Date(r.scheduled_at).getTime()
      const adm = new Date(r.administered_at || r.scheduled_at).getTime()
      if ((adm - sched) / 60000 > threshold) late++
      else given++
    } else if (r.status === 'missed' || r.status === 'refused') {
      missed++
    }
  })
  const total = mar.length
  return {
    mar_total: total,
    mar_given: given,
    mar_missed: missed,
    mar_late: late,
    mar_completion_pct: total ? Math.round(((given + late) / total) * 100) : 0,
    on_time_pct: total ? Math.round((given / total) * 100) : 0,
    late_threshold_min: threshold,
  }
}

// ── Antibiotic stewardship (consumo DDD-like simplificado) ───────────────────
// Recebe lista de prescrições com (med_name, days). Calcula top fármacos e
// flag de sobreconsumo simples (> threshold por 1000 doentes-dia).
export interface AbxConsumption {
  top: { med: string; days: number; pct: number }[]
  flags: string[]
}

const ABX_NORMS_RANK = [
  'amoxicilina + ácido clavulânico', 'amoxicilina/ácido clavulânico', 'ciprofloxacina', 'levofloxacina',
  'piperacilina + tazobactam', 'meropenem', 'ceftriaxona', 'vancomicina', 'azitromicina', 'cefuroxima',
]

export function abxConsumption(presc: { med_name: string; days: number }[]): AbxConsumption {
  const m = new Map<string, number>()
  presc.forEach(r => {
    const k = (r.med_name || '').toLowerCase().trim()
    if (!k) return
    m.set(k, (m.get(k) || 0) + (r.days || 1))
  })
  const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1
  const top = Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([med, days]) => ({ med, days, pct: Math.round((days / total) * 100) }))
  const flags: string[] = []
  // Heurística simples: se quinolonas (cipro+levo) > 25% do total → flag
  const quinolones = (m.get('ciprofloxacina') || 0) + (m.get('levofloxacina') || 0)
  if (quinolones / total > 0.25) flags.push(`Quinolonas representam ${Math.round(quinolones / total * 100)}% — verificar adequação (risco C. difficile, tendinite, QTc).`)
  // Se carbapenemes > 10%
  const carba = (m.get('meropenem') || 0) + (m.get('imipenem') || 0)
  if (carba / total > 0.1) flags.push(`Carbapenemes representam ${Math.round(carba / total * 100)}% — risco de pressão seletiva. Reavaliar de-escalation.`)
  return { top, flags }
}
