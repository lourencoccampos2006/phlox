// lib/caregiverWatch.ts
// Motor de Vigilância do Cuidador — determinístico, auditável, SEM AI.
// Reúne, por familiar, os achados clínicos (reutiliza o Decision Engine de 26
// regras) com sinais LONGITUDINAIS dos dados reais (tendências de vitais, adesão,
// stock de medicação, sintomas recentes, tempo desde a última medição).
// Devolve sinais acionáveis com severidade + ação — a base do "Anjo da Guarda".

import { runRules, riskScore, type ClinicalCase, type Finding } from './decisionEngine'
import { vitalTrendSignals, stockSignals, symptomSignals, type TrendSignal, type TrendVital, type TrendMed, type TrendSymptom } from './healthTrends'

export type WatchVital = TrendVital
export type WatchMed = TrendMed
export type WatchSymptom = TrendSymptom

export interface WatchInput {
  age?: number | null; sex?: string | null; weight?: number | null
  conditions?: string | null; allergies?: string | null
  meds: WatchMed[]
  vitals: WatchVital[]        // ordenados do mais recente para o mais antigo (ou qualquer ordem — ordenamos)
  symptoms: WatchSymptom[]
}

export interface WatchSignal {
  kind: string
  severity: 'critical' | 'major' | 'moderate' | 'minor' | 'info'
  title: string
  detail: string
  action?: string
  cta?: { label: string; href: string }
}

export interface WatchResult {
  score: number                 // 0-100 (mais alto = mais atenção)
  level: 'critical' | 'warning' | 'info' | 'ok'
  signals: WatchSignal[]
}

const SEV_RANK = { critical: 4, major: 3, moderate: 2, minor: 1, info: 0 } as const

// Converte um Finding do Decision Engine em WatchSignal (com CTA útil ao cuidador).
function fromFinding(f: Finding): WatchSignal {
  return {
    kind: f.id, severity: f.severity, title: f.title, detail: f.detail,
    action: f.action,
    cta: { label: 'Verificar interações', href: '/interactions' },
  }
}

// CTA por tipo de sinal de tendência, na perspetiva do CUIDADOR.
const CAREGIVER_CTA: Record<string, { label: string; href: string }> = {
  bp_high: { label: 'Preparar a consulta', href: '/consult-prep' },
  bp_crisis: { label: 'O que fazer agora', href: '/saude-agora' },
  spo2_low: { label: 'O que fazer agora', href: '/saude-agora' },
  glucose_out: { label: 'Registar vitais', href: '/vitals' },
  weight_loss: { label: 'Preparar a consulta', href: '/consult-prep' },
  vitals_stale: { label: 'Registar vitais', href: '/vitals' },
  vitals_none: { label: 'Registar vitais', href: '/vitals' },
  stock_out: { label: 'Ver medicação', href: '/mymeds' },
  stock_low: { label: 'Ver medicação', href: '/mymeds' },
  fever_recurrent: { label: 'O que fazer agora', href: '/saude-agora' },
  pain_high: { label: 'Diário de sintomas', href: '/sintomas' },
}

function withCaregiverCTA(t: TrendSignal): WatchSignal {
  return { ...t, cta: CAREGIVER_CTA[t.kind] }
}

export function analyzeFamilyMember(input: WatchInput): WatchResult {
  const signals: WatchSignal[] = []
  const condArr = (input.conditions || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
  const medNames = input.meds.map(m => m.name).filter(Boolean)

  // 1) Achados clínicos (26 regras) — medicação/condições/idade.
  const cse: ClinicalCase = {
    age: input.age ?? undefined,
    sex: (input.sex === 'M' || input.sex === 'F') ? input.sex : undefined,
    weight_kg: input.weight ?? undefined,
    conditions: condArr,
    meds: medNames,
    allergies: (input.allergies || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean),
  }
  const findings = runRules(cse)
  findings.forEach(f => signals.push(fromFinding(f)))

  // 2-4) Tendências de vitais + stock + sintomas — lógica partilhada (lib/healthTrends),
  // com o CTA na perspetiva do cuidador.
  vitalTrendSignals(input.vitals, input.meds.length > 0).forEach(t => signals.push(withCaregiverCTA(t)))
  stockSignals(input.meds).forEach(t => signals.push(withCaregiverCTA(t)))
  symptomSignals(input.symptoms).forEach(t => signals.push(withCaregiverCTA(t)))

  // ── Score + nível ──
  // Reaproveita o peso do Decision Engine para os findings clínicos + os sinais novos.
  const baseScore = riskScore(findings)
  const extraWeight = { critical: 25, major: 12, moderate: 6, minor: 2, info: 0 }
  const extra = signals.filter(s => !findings.some(f => f.id === s.kind)).reduce((a, s) => a + extraWeight[s.severity], 0)
  const score = Math.min(100, baseScore + extra)

  const maxSev = signals.reduce((m, s) => Math.max(m, SEV_RANK[s.severity]), 0)
  const level: WatchResult['level'] = maxSev >= 4 ? 'critical' : maxSev >= 3 ? 'warning' : maxSev >= 1 ? 'info' : 'ok'

  // Ordena por severidade (crítico primeiro).
  signals.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])

  return { score, level, signals }
}

export const WATCH_LEVEL_META = {
  critical: { label: 'Precisa de atenção', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  warning:  { label: 'A acompanhar',       color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  info:     { label: 'Tudo sob controlo',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  ok:       { label: 'Tudo bem',           color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
} as const
