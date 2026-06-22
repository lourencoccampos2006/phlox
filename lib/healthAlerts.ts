// lib/healthAlerts.ts
// PRO — Alertas proativos DETERMINÍSTICOS (sem custo de IA). Lê a medicação,
// sinais vitais recentes e adesão da pessoa ativa e devolve avisos acionáveis:
//   - interações/critérios clínicos (via decisionEngine — STOPP/Beers/renal/QTc…)
//   - sinais vitais fora de intervalo seguro
//   - adesão a cair
// Usado pelo HealthAlertsCard em /inicio. Tudo a partir de dados já guardados.

import { runRules, type Finding } from '@/lib/decisionEngine'

export interface HealthAlert {
  level: 'high' | 'medium' | 'low'
  icon: string
  title: string
  detail: string
  href?: string
  cta?: string
}

interface AlertInput {
  meds: { name: string }[]
  age?: number | null
  sex?: string | null
  conditions?: string | null
  vitals?: { bp_sys?: number | null; bp_dia?: number | null; hr?: number | null; spo2?: number | null; glucose?: number | null; recorded_at?: string } | null
  adherencePct?: number | null
}

const SEV_TO_LEVEL: Record<Finding['severity'], HealthAlert['level'] | null> = {
  critical: 'high', major: 'high', moderate: 'medium', minor: 'low', info: null,
}

export function computeHealthAlerts(input: AlertInput): HealthAlert[] {
  const alerts: HealthAlert[] = []
  const medNames = (input.meds || []).map(m => m.name).filter(Boolean)

  // 1) Regras clínicas determinísticas (interações, polimedicação, renal, QTc…)
  if (medNames.length >= 2) {
    let findings: Finding[] = []
    try {
      findings = runRules({
        age: input.age ?? undefined,
        sex: input.sex === 'M' || input.sex === 'F' ? input.sex : undefined,
        conditions: input.conditions ? input.conditions.split(/[,;]\s*/).filter(Boolean) : undefined,
        meds: medNames,
      })
    } catch { findings = [] }
    findings
      .map(f => ({ f, level: SEV_TO_LEVEL[f.severity] }))
      .filter(x => x.level)
      .slice(0, 3)
      .forEach(({ f, level }) => alerts.push({
        level: level!, icon: level === 'high' ? '⚠️' : '!',
        title: f.title,
        detail: f.action || f.detail,
        href: '/interactions', cta: 'Verificar',
      }))
  }

  // 2) Sinais vitais fora de intervalo seguro (do registo mais recente)
  const v = input.vitals
  if (v) {
    if (v.bp_sys != null && (v.bp_sys >= 180 || (v.bp_dia != null && v.bp_dia >= 110)))
      alerts.push({ level: 'high', icon: '🩸', title: 'Tensão arterial muito alta', detail: `Última leitura ${v.bp_sys}/${v.bp_dia ?? '—'} mmHg. Se persistir ou houver sintomas, procura ajuda.`, href: '/vitals', cta: 'Ver vitais' })
    else if (v.bp_sys != null && (v.bp_sys >= 140 || (v.bp_dia != null && v.bp_dia >= 90)))
      alerts.push({ level: 'medium', icon: '🩸', title: 'Tensão arterial acima do alvo', detail: `Última leitura ${v.bp_sys}/${v.bp_dia ?? '—'} mmHg. Vale a pena vigiar.`, href: '/vitals', cta: 'Ver vitais' })
    if (v.spo2 != null && v.spo2 < 92)
      alerts.push({ level: 'high', icon: '🫁', title: 'Oxigenação baixa', detail: `SpO₂ ${v.spo2}%. Abaixo de 92% merece atenção.`, href: '/vitals', cta: 'Ver vitais' })
    if (v.glucose != null && (v.glucose >= 250 || v.glucose < 70))
      alerts.push({ level: 'high', icon: '🍬', title: v.glucose < 70 ? 'Glicemia baixa' : 'Glicemia alta', detail: `Última glicemia ${v.glucose} mg/dL.`, href: '/vitals', cta: 'Ver vitais' })
    if (v.hr != null && (v.hr >= 120 || v.hr < 45))
      alerts.push({ level: 'medium', icon: '💓', title: 'Frequência cardíaca fora do normal', detail: `Última FC ${v.hr} bpm.`, href: '/vitals', cta: 'Ver vitais' })
  }

  // 3) Adesão a cair
  if (input.adherencePct != null && input.adherencePct < 60 && medNames.length > 0)
    alerts.push({ level: 'medium', icon: '💊', title: 'Adesão à medicação a descer', detail: `Tens tomado ${input.adherencePct}% das doses recentes. Ativar lembretes pode ajudar.`, href: '/mymeds', cta: 'Ver medicação' })

  // Ordena por gravidade
  const rank = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 5)
}
