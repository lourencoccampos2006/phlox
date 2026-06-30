// lib/healthTrends.ts
// Deteção de TENDÊNCIAS longitudinais a partir das séries reais de vitais, stock de
// medicação e sintomas — determinística, sem IA. Partilhada por:
//   • lib/caregiverWatch  (vela por um familiar)
//   • lib/healthAlerts     (vela pela própria pessoa)
// Cada função devolve um TrendSignal neutro {kind, severity, title, detail, action} que
// cada chamador adapta (CTA, tom). Evita duplicar a mesma lógica nos dois motores.

export type TrendSeverity = 'critical' | 'major' | 'moderate' | 'minor' | 'info'

export interface TrendVital {
  recorded_at: string
  bp_sys?: number | null; bp_dia?: number | null; hr?: number | null
  spo2?: number | null; weight?: number | null; glucose?: number | null; temp?: number | null
}
export interface TrendMed { name: string; pills_remaining?: number | null; pills_per_day?: number | null }
export interface TrendSymptom { at: string; pain?: number | null; temperature?: number | null; symptoms?: string[] | null }

export interface TrendSignal {
  kind: string
  severity: TrendSeverity
  title: string
  detail: string
  action?: string
}

export const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

/** Ordena vitais do mais recente para o mais antigo. */
export function sortVitals(vitals: TrendVital[]): TrendVital[] {
  return [...vitals].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
}

/**
 * Tendências de sinais vitais a partir da série completa.
 * Devolve sinais para: TA alta repetida / crise hipertensiva, SpO₂ baixa, glicemia fora de
 * alvo, perda de peso ≥5%, e "há muito sem medir".
 */
export function vitalTrendSignals(vitals: TrendVital[], hasMeds: boolean): TrendSignal[] {
  const out: TrendSignal[] = []
  const sorted = sortVitals(vitals)
  const latest = sorted[0]

  // TA alta repetida (≥160 em ≥2 medições) vs crise pontual (≥180).
  const highBp = sorted.filter(v => (v.bp_sys ?? 0) >= 160).slice(0, 5)
  if (highBp.length >= 2) {
    out.push({
      kind: 'bp_high', severity: 'major',
      title: 'Tensão arterial alta repetida',
      detail: `Registada TA ≥160 em ${highBp.length} medições recentes (última: ${highBp[0].bp_sys}/${highBp[0].bp_dia ?? '—'}).`,
      action: 'Falar com o médico — pode ser preciso ajustar a medicação.',
    })
  } else if ((latest?.bp_sys ?? 0) >= 180) {
    out.push({
      kind: 'bp_crisis', severity: 'critical',
      title: 'Tensão muito alta',
      detail: `Última TA ${latest!.bp_sys}/${latest!.bp_dia ?? '—'}. Acima de 180 sistólica.`,
      action: 'Se houver sintomas (dor de cabeça forte, falta de ar), procurar ajuda.',
    })
  }

  // SpO₂ baixa.
  if ((latest?.spo2 ?? 100) < 92) {
    out.push({
      kind: 'spo2_low', severity: latest!.spo2! < 88 ? 'critical' : 'major',
      title: 'Oxigénio baixo', detail: `Última SpO₂ ${latest!.spo2}%.`,
      action: latest!.spo2! < 88 ? 'Valor preocupante — procurar ajuda médica.' : 'Vigiar e repetir a medição.',
    })
  }

  // Glicemia fora de alvo.
  const g = latest?.glucose
  if (g != null && (g >= 250 || g < 70)) {
    out.push({
      kind: 'glucose_out', severity: 'major',
      title: g < 70 ? 'Glicemia baixa' : 'Glicemia alta', detail: `Última glicemia ${g} mg/dL.`,
      action: g < 70 ? 'Tomar um açúcar de absorção rápida e repetir.' : 'Vigiar; se persistir, falar com o médico.',
    })
  }

  // Perda de peso ≥5% em ~60 dias.
  const weights = sorted.filter(v => v.weight != null)
  if (weights.length >= 2) {
    const recent = weights[0]; const old = weights[weights.length - 1]
    const span = daysAgo(old.recorded_at)
    const drop = (old.weight! - recent.weight!) / old.weight!
    if (span <= 60 && drop >= 0.05) {
      out.push({
        kind: 'weight_loss', severity: drop >= 0.1 ? 'critical' : 'major',
        title: 'Perda de peso',
        detail: `Perdeu ${Math.round(drop * 100)}% (${old.weight}→${recent.weight} kg) nas últimas semanas.`,
        action: 'Perda de peso involuntária merece avaliação médica.',
      })
    }
  }

  // Há muito sem medir vitais.
  if (latest) {
    const d = daysAgo(latest.recorded_at)
    if (d >= 14) out.push({ kind: 'vitals_stale', severity: 'minor', title: 'Sem medições recentes', detail: `A última medição foi há ${d} dias.`, action: 'Vale a pena medir a tensão/peso.' })
  } else if (hasMeds) {
    out.push({ kind: 'vitals_none', severity: 'info', title: 'Ainda sem vitais', detail: 'Ainda não há tensão/peso registados.', action: 'Comece a acompanhar os sinais vitais.' })
  }

  return out
}

/** Stock de medicação a acabar (a partir de pills_remaining/pills_per_day). */
export function stockSignals(meds: TrendMed[]): TrendSignal[] {
  const out: TrendSignal[] = []
  meds.forEach(m => {
    if (m.pills_remaining != null && m.pills_per_day && m.pills_per_day > 0) {
      const days = Math.floor(m.pills_remaining / m.pills_per_day)
      if (days <= 0) out.push({ kind: 'stock_out', severity: 'major', title: `${m.name} acabou`, detail: 'Sem comprimidos em casa.', action: 'Renovar a receita / comprar na farmácia.' })
      else if (days <= 5) out.push({ kind: 'stock_low', severity: days <= 2 ? 'major' : 'moderate', title: `${m.name} a acabar`, detail: `Restam para cerca de ${days} ${days === 1 ? 'dia' : 'dias'}.`, action: 'Renovar a receita a tempo.' })
    }
  })
  return out
}

/** Sintomas recentes (dor a subir, febre repetida) nos últimos 7 dias. */
export function symptomSignals(symptoms: TrendSymptom[]): TrendSignal[] {
  const out: TrendSignal[] = []
  const recent = symptoms.filter(s => daysAgo(s.at) <= 7)
  const fevers = recent.filter(s => (s.temperature ?? 0) >= 38)
  if (fevers.length >= 2) out.push({ kind: 'fever_recurrent', severity: 'major', title: 'Febre repetida', detail: `Registada febre ≥38°C em ${fevers.length} dias esta semana.`, action: 'Se persistir, contactar o médico.' })
  const highPain = recent.filter(s => (s.pain ?? 0) >= 7)
  if (highPain.length >= 2) out.push({ kind: 'pain_high', severity: 'moderate', title: 'Dor intensa repetida', detail: `Dor ≥7/10 em ${highPain.length} registos recentes.`, action: 'A dor mal controlada deve ser avaliada.' })
  return out
}

export const TREND_SEV_RANK: Record<TrendSeverity, number> = { critical: 4, major: 3, moderate: 2, minor: 1, info: 0 }
