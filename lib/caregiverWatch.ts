// lib/caregiverWatch.ts
// Motor de Vigilância do Cuidador — determinístico, auditável, SEM AI.
// Reúne, por familiar, os achados clínicos (reutiliza o Decision Engine de 26
// regras) com sinais LONGITUDINAIS dos dados reais (tendências de vitais, adesão,
// stock de medicação, sintomas recentes, tempo desde a última medição).
// Devolve sinais acionáveis com severidade + ação — a base do "Anjo da Guarda".

import { runRules, type ClinicalCase, type Finding } from './decisionEngine'
import { vitalTrendSignals, stockSignals, symptomSignals, type TrendSignal, type TrendVital, type TrendMed, type TrendSymptom } from './healthTrends'
import { computeRiskScore } from './riskIndex'

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
// bp_crisis/spo2_low apontavam a /saude-agora (removida 2026-08-09) — liga
// direto, é a mesma ação principal que a página mostrava.
const CAREGIVER_CTA: Record<string, { label: string; href: string }> = {
  bp_high: { label: 'Ver histórico', href: '/timeline' },
  bp_crisis: { label: 'Ligar 112', href: 'tel:112' },
  spo2_low: { label: 'Ligar 112', href: 'tel:112' },
  glucose_out: { label: 'Registar vitais', href: '/vitals' },
  weight_loss: { label: 'Ver histórico', href: '/timeline' },
  vitals_stale: { label: 'Registar vitais', href: '/vitals' },
  vitals_none: { label: 'Registar vitais', href: '/vitals' },
  stock_out: { label: 'Ver medicação', href: '/mymeds' },
  stock_low: { label: 'Ver medicação', href: '/mymeds' },
  fever_recurrent: { label: 'Diário de sintomas', href: '/sintomas' },
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
  const trendSignals: TrendSignal[] = [
    ...vitalTrendSignals(input.vitals, input.meds.length > 0),
    ...stockSignals(input.meds),
    ...symptomSignals(input.symptoms),
  ]
  trendSignals.forEach(t => signals.push(withCaregiverCTA(t)))

  // ── Score + nível — motor partilhado com o Índice de Risco pessoal (lib/riskIndex),
  // para o "self" e o "familiar" usarem exatamente a mesma fórmula. ──
  const { score, level } = computeRiskScore(findings, trendSignals)

  // Ordena por severidade (crítico primeiro).
  signals.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])

  return { score, level, signals }
}

export { RISK_LEVEL_META as WATCH_LEVEL_META } from './riskIndex'
