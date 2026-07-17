// lib/healthAlerts.ts
// PRO — Alertas proativos DETERMINÍSTICOS (sem custo de IA). Lê a medicação,
// sinais vitais recentes e adesão da pessoa ativa e devolve avisos acionáveis:
//   - interações/critérios clínicos (via decisionEngine — STOPP/Beers/renal/QTc…)
//   - sinais vitais fora de intervalo seguro
//   - adesão a cair
// Usado pelo HealthAlertsCard em /inicio. Tudo a partir de dados já guardados.

import { runRules, type Finding } from '@/lib/decisionEngine'
import { vitalTrendSignals, stockSignals, symptomSignals, type TrendSignal, type TrendVital, type TrendMed, type TrendSymptom, type TrendSeverity } from '@/lib/healthTrends'
import { computeRiskScore, type RiskResult } from '@/lib/riskIndex'

export interface HealthAlert {
  level: 'high' | 'medium' | 'low'
  icon: string
  title: string
  detail: string
  href?: string
  cta?: string
}

interface AlertInput {
  meds: TrendMed[]
  age?: number | null
  sex?: string | null
  conditions?: string | null
  // Última leitura (retrocompatível) E/OU série completa (preferida — dá tendências).
  vitals?: { bp_sys?: number | null; bp_dia?: number | null; hr?: number | null; spo2?: number | null; glucose?: number | null; recorded_at?: string } | null
  vitalSeries?: TrendVital[]
  symptoms?: TrendSymptom[]
  adherencePct?: number | null
}

const SEV_TO_LEVEL: Record<Finding['severity'], HealthAlert['level'] | null> = {
  critical: 'high', major: 'high', moderate: 'medium', minor: 'low', info: null,
}

const TREND_TO_LEVEL: Record<TrendSeverity, HealthAlert['level'] | null> = {
  critical: 'high', major: 'high', moderate: 'medium', minor: 'low', info: null,
}

// CTA + ícone por tipo de sinal de tendência, na perspetiva da PRÓPRIA pessoa.
const SELF_CTA: Record<string, { icon: string; href: string; cta: string }> = {
  bp_high: { icon: '🩸', href: '/timeline', cta: 'Ver histórico' },
  bp_crisis: { icon: '🩸', href: '/saude-agora', cta: 'O que fazer' },
  spo2_low: { icon: '🫁', href: '/saude-agora', cta: 'O que fazer' },
  glucose_out: { icon: '🍬', href: '/vitals', cta: 'Ver vitais' },
  weight_loss: { icon: '⚖️', href: '/timeline', cta: 'Ver histórico' },
  vitals_stale: { icon: '📏', href: '/vitals', cta: 'Registar' },
  vitals_none: { icon: '📏', href: '/vitals', cta: 'Começar' },
  stock_out: { icon: '💊', href: '/mymeds', cta: 'Ver medicação' },
  stock_low: { icon: '💊', href: '/mymeds', cta: 'Ver medicação' },
  fever_recurrent: { icon: '🌡️', href: '/saude-agora', cta: 'O que fazer' },
  pain_high: { icon: '🩹', href: '/sintomas', cta: 'Diário' },
}

function trendToAlert(t: TrendSignal): HealthAlert | null {
  const level = TREND_TO_LEVEL[t.severity]
  if (!level) return null
  const meta = SELF_CTA[t.kind]
  return { level, icon: meta?.icon || (level === 'high' ? '⚠️' : '!'), title: t.title, detail: t.action || t.detail, href: meta?.href, cta: meta?.cta }
}

/** Achados clínicos (Decision Engine) da pessoa, a partir dos mesmos dados usados nos alertas. */
function gatherFindings(input: AlertInput): Finding[] {
  const medNames = (input.meds || []).map(m => m.name).filter(Boolean)
  // BUG CORRIGIDO 2026-07-17: este guard fazia return [] com 0-1 medicamentos,
  // saltando TODAS as regras do Decision Engine (não só as de interação entre
  // fármacos — também as de fármaco único: renal, QTc, idade, etc.). O caminho
  // paralelo do familiar (lib/caregiverWatch.ts analyzeFamilyMember) chama
  // runRules() sem este guard, por isso o Índice de Risco pessoal subestimava
  // o risco face ao do familiar com os mesmos dados.
  try {
    return runRules({
      age: input.age ?? undefined,
      sex: input.sex === 'M' || input.sex === 'F' ? input.sex : undefined,
      conditions: input.conditions ? input.conditions.split(/[,;]\s*/).filter(Boolean) : undefined,
      meds: medNames,
    })
  } catch { return [] }
}

/** Sinais de tendência (lib/healthTrends) + adesão, na mesma "moeda" partilhada com o /familia. */
function gatherTrendSignals(input: AlertInput): TrendSignal[] {
  const medNames = (input.meds || []).map(m => m.name).filter(Boolean)
  const out: TrendSignal[] = [
    ...vitalTrendSignals(input.vitalSeries || [], medNames.length > 0),
    ...stockSignals(input.meds || []),
    ...symptomSignals(input.symptoms || []),
  ]
  if (input.adherencePct != null && input.adherencePct < 60 && medNames.length > 0) {
    out.push({
      kind: 'adherence_low', severity: input.adherencePct < 40 ? 'major' : 'moderate',
      title: 'Adesão à medicação a descer',
      detail: `Tomou ${input.adherencePct}% das doses recentes.`,
      action: 'Ativar lembretes pode ajudar.',
    })
  }
  return out
}

export function computeHealthAlerts(input: AlertInput): HealthAlert[] {
  const alerts: HealthAlert[] = []
  const medNames = (input.meds || []).map(m => m.name).filter(Boolean)

  // 1) Regras clínicas determinísticas (interações, polimedicação, renal, QTc…)
  gatherFindings(input)
    .map(f => ({ f, level: SEV_TO_LEVEL[f.severity] }))
    .filter(x => x.level)
    .slice(0, 3)
    .forEach(({ f, level }) => alerts.push({
      level: level!, icon: level === 'high' ? '⚠️' : '!',
      title: f.title,
      detail: f.action || f.detail,
      href: '/interactions', cta: 'Verificar',
    }))

  // 2) Tendências de vitais — se houver a SÉRIE, usa o motor partilhado (TA alta repetida,
  // perda de peso, etc.); caso contrário, fica pelos limiares da última leitura.
  const series = input.vitalSeries || []
  if (series.length > 0) {
    vitalTrendSignals(series, medNames.length > 0).forEach(t => { const a = trendToAlert(t); if (a) alerts.push(a) })
  } else {
    const v = input.vitals
    if (v) {
      if (v.bp_sys != null && (v.bp_sys >= 180 || (v.bp_dia != null && v.bp_dia >= 110)))
        alerts.push({ level: 'high', icon: '🩸', title: 'Tensão arterial muito alta', detail: `Última leitura ${v.bp_sys}/${v.bp_dia ?? '—'} mmHg. Se persistir ou houver sintomas, procure ajuda.`, href: '/vitals', cta: 'Ver vitais' })
      else if (v.bp_sys != null && (v.bp_sys >= 140 || (v.bp_dia != null && v.bp_dia >= 90)))
        alerts.push({ level: 'medium', icon: '🩸', title: 'Tensão arterial acima do alvo', detail: `Última leitura ${v.bp_sys}/${v.bp_dia ?? '—'} mmHg. Vale a pena vigiar.`, href: '/vitals', cta: 'Ver vitais' })
      if (v.spo2 != null && v.spo2 < 92)
        alerts.push({ level: 'high', icon: '🫁', title: 'Oxigenação baixa', detail: `SpO₂ ${v.spo2}%. Abaixo de 92% merece atenção.`, href: '/vitals', cta: 'Ver vitais' })
      if (v.glucose != null && (v.glucose >= 250 || v.glucose < 70))
        alerts.push({ level: 'high', icon: '🍬', title: v.glucose < 70 ? 'Glicemia baixa' : 'Glicemia alta', detail: `Última glicemia ${v.glucose} mg/dL.`, href: '/vitals', cta: 'Ver vitais' })
    }
  }
  // FC fora do normal (não está no motor de tendências — leitura pontual).
  const lastHr = input.vitals?.hr ?? series[0]?.hr
  if (lastHr != null && (lastHr >= 120 || lastHr < 45))
    alerts.push({ level: 'medium', icon: '💓', title: 'Frequência cardíaca fora do normal', detail: `Última FC ${lastHr} bpm.`, href: '/vitals', cta: 'Ver vitais' })

  // 3) Stock de medicação a acabar.
  stockSignals(input.meds || []).forEach(t => { const a = trendToAlert(t); if (a) alerts.push(a) })

  // 4) Sintomas recentes (febre/dor repetidas).
  symptomSignals(input.symptoms || []).forEach(t => { const a = trendToAlert(t); if (a) alerts.push(a) })

  // 5) Adesão a cair
  if (input.adherencePct != null && input.adherencePct < 60 && medNames.length > 0)
    alerts.push({ level: 'medium', icon: '💊', title: 'Adesão à medicação a descer', detail: `Tem tomado ${input.adherencePct}% das doses recentes. Ativar lembretes pode ajudar.`, href: '/mymeds', cta: 'Ver medicação' })

  // Dedup por título + ordena por gravidade.
  const seen = new Set<string>()
  const unique = alerts.filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true })
  const rank = { high: 0, medium: 1, low: 2 }
  return unique.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 6)
}

/**
 * Índice de Risco Contínuo (self) — a MESMA fórmula usada em lib/caregiverWatch
 * para o familiar (lib/riskIndex.computeRiskScore), aplicada aos dados da
 * própria pessoa. Usado por /api/risk-index.
 */
export function computeSelfRiskScore(input: AlertInput): RiskResult {
  return computeRiskScore(gatherFindings(input), gatherTrendSignals(input))
}
