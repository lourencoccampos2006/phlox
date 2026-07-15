// lib/riskIndex.ts
// Índice de Risco Contínuo — motor de pontuação PARTILHADO entre "self" (o
// próprio Pro) e "familiar" (objetivo=cuidador). Score 0-100 = quanto a
// situação atual merece atenção, a partir dos MESMOS sinais que já alimentam
// o /medico-bolso e o /familia (Decision Engine + lib/healthTrends) —
// resumidos num único número, com histórico diário persistido (risk_snapshots)
// para mostrar tendência, não só o instante.

import { type Finding, riskScore as findingsScore } from './decisionEngine'
import type { TrendSignal, TrendSeverity } from './healthTrends'

export type RiskLevel = 'critical' | 'warning' | 'info' | 'ok'
export interface RiskFactor { title: string; severity: Finding['severity'] }
export interface RiskResult { score: number; level: RiskLevel; topFactors: RiskFactor[] }

const EXTRA_WEIGHT: Record<TrendSeverity, number> = { critical: 25, major: 12, moderate: 6, minor: 2, info: 0 }
const SEV_RANK: Record<Finding['severity'], number> = { critical: 4, major: 3, moderate: 2, minor: 1, info: 0 }

/** Pontuação partilhada: achados clínicos (Decision Engine) + tendências longitudinais. */
export function computeRiskScore(findings: Finding[], trendSignals: TrendSignal[]): RiskResult {
  const base = findingsScore(findings)
  const extra = trendSignals.reduce((a, s) => a + EXTRA_WEIGHT[s.severity], 0)
  const score = Math.min(100, base + extra)

  const maxSev = Math.max(
    findings.reduce((m, f) => Math.max(m, SEV_RANK[f.severity]), 0),
    trendSignals.reduce((m, s) => Math.max(m, SEV_RANK[s.severity]), 0),
  )
  const level: RiskLevel = maxSev >= 4 ? 'critical' : maxSev >= 3 ? 'warning' : maxSev >= 1 ? 'info' : 'ok'

  const topFactors: RiskFactor[] = [
    ...findings.map(f => ({ title: f.title, severity: f.severity })),
    ...trendSignals.map(s => ({ title: s.title, severity: s.severity })),
  ]
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
    .slice(0, 4)

  return { score, level, topFactors }
}

export const RISK_LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Precisa de atenção', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  warning:  { label: 'A acompanhar',       color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  info:     { label: 'Tudo sob controlo',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  ok:       { label: 'Tudo bem',           color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
}

export interface RiskSnapshotRow { snapshot_date: string; score: number; level: RiskLevel }

/** Seta de tendência simples: compara o score de hoje com o snapshot mais antigo do histórico dado. */
export function riskTrend(history: RiskSnapshotRow[]): { delta: number; arrow: '↑' | '↓' | '→' } | null {
  if (history.length < 2) return null
  const sorted = [...history].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const delta = sorted[sorted.length - 1].score - sorted[0].score
  return { delta, arrow: delta > 3 ? '↑' : delta < -3 ? '↓' : '→' }
}
