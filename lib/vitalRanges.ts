// lib/vitalRanges.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sinais Vitais Inteligentes (Ronda 12) — fonte ÚNICA para avaliar se um valor
// vital está dentro do intervalo seguro para AQUELA pessoa, com severidade,
// intervalo de referência e o que vigiar. Reutilizável em /vitals, /care-log, na
// ficha do utente e na timeline. Antes cada sítio tinha limiares fixos soltos.
//
// ENQUADRAMENTO: organiza e informa a partir de limiares de referência gerais —
// NÃO diagnostica. Ajusta ao idoso (>=65) onde é clinicamente relevante. A
// decisão é sempre do profissional. Sem alarmismo: "fora do intervalo habitual".
// ─────────────────────────────────────────────────────────────────────────────

export type VitalField = 'bp_sys' | 'bp_dia' | 'hr' | 'spo2' | 'temp' | 'glucose' | 'weight'
export type VitalLevel = 'normal' | 'warning' | 'critical'

export interface VitalContext { age?: number | null; conditions?: string | null }
export interface VitalReading {
  level: VitalLevel
  label: string          // ex.: "Tensão alta", "Febre", "Normal"
  range: string          // intervalo de referência legível
  watch?: string         // o que vigiar / próximo passo (organizacional, não prescritivo)
}

const has = (conditions: string | null | undefined, re: RegExp) => !!conditions && re.test(conditions)

// Avalia UM valor. Determinístico. Ajusta ao contexto quando relevante.
export function evaluateVital(field: VitalField, value: number, ctx: VitalContext = {}): VitalReading {
  const old = (ctx.age || 0) >= 65
  const diabetic = has(ctx.conditions, /diabet|dm2|dm1/i)
  const dpoc = has(ctx.conditions, /dpoc|epoc|respirat|oxig/i)

  switch (field) {
    case 'bp_sys': {
      if (value >= 180) return { level: 'critical', label: 'Tensão muito alta', range: '90–140 mmHg', watch: 'Repetir a medição em repouso; se mantém, contactar o médico.' }
      if (value > 140) return { level: 'warning', label: 'Tensão alta', range: '90–140 mmHg', watch: 'Vigiar e registar; ver tendência dos últimos dias.' }
      if (value < 90) return { level: 'warning', label: 'Tensão baixa', range: '90–140 mmHg', watch: 'Ver se há tonturas/quedas; hidratação.' }
      return { level: 'normal', label: 'Tensão normal', range: '90–140 mmHg' }
    }
    case 'bp_dia': {
      if (value >= 120) return { level: 'critical', label: 'Diastólica muito alta', range: '60–90 mmHg', watch: 'Repetir; contactar o médico se mantém.' }
      if (value > 90) return { level: 'warning', label: 'Diastólica alta', range: '60–90 mmHg', watch: 'Vigiar e registar.' }
      if (value < 60) return { level: 'warning', label: 'Diastólica baixa', range: '60–90 mmHg' }
      return { level: 'normal', label: 'Normal', range: '60–90 mmHg' }
    }
    case 'hr': {
      if (value > 120) return { level: 'critical', label: 'Frequência muito alta', range: '60–100 bpm', watch: 'Ver se há febre, dor ou falta de ar.' }
      if (value > 100) return { level: 'warning', label: 'Frequência alta', range: '60–100 bpm', watch: 'Repetir em repouso.' }
      if (value < 45) return { level: 'critical', label: 'Frequência muito baixa', range: '60–100 bpm', watch: 'Ver se há tonturas; contactar o médico.' }
      if (value < 50) return { level: 'warning', label: 'Frequência baixa', range: '60–100 bpm' }
      return { level: 'normal', label: 'Normal', range: '60–100 bpm' }
    }
    case 'spo2': {
      // DPOC tolera valores um pouco mais baixos como habituais.
      const critical = dpoc ? 85 : 90
      const warn = dpoc ? 88 : 94
      if (value < critical) return { level: 'critical', label: 'Oxigénio baixo', range: dpoc ? '≥88% (DPOC)' : '≥95%', watch: 'Verificar o sensor; se mantém, atenção urgente.' }
      if (value < warn) return { level: 'warning', label: 'Oxigénio a vigiar', range: dpoc ? '≥88% (DPOC)' : '≥95%', watch: 'Repetir; ver esforço respiratório.' }
      return { level: 'normal', label: 'Oxigénio normal', range: dpoc ? '≥88% (DPOC)' : '≥95%' }
    }
    case 'temp': {
      if (value >= 39) return { level: 'critical', label: 'Febre alta', range: '36–37.5 °C', watch: 'Vigiar de perto; hidratação; contactar o médico.' }
      if (value >= 38) return { level: 'warning', label: 'Febre', range: '36–37.5 °C', watch: 'Repetir dentro de 1–2h; registar.' }
      if (value < 35) return { level: 'warning', label: 'Temperatura baixa', range: '36–37.5 °C', watch: old ? 'No idoso pode ser sinal de infeção — vigiar.' : undefined }
      return { level: 'normal', label: 'Temperatura normal', range: '36–37.5 °C' }
    }
    case 'glucose': {
      const hi = diabetic ? 250 : 200
      if (value < 60) return { level: 'critical', label: 'Glicemia muito baixa', range: '70–140 mg/dL', watch: 'Dar açúcar de ação rápida; repetir; atenção urgente.' }
      if (value < 70) return { level: 'warning', label: 'Glicemia baixa', range: '70–140 mg/dL', watch: 'Ver sintomas; repetir.' }
      if (value >= hi + 100) return { level: 'critical', label: 'Glicemia muito alta', range: '70–140 mg/dL', watch: 'Repetir; contactar o médico se mantém.' }
      if (value > hi) return { level: 'warning', label: 'Glicemia alta', range: '70–140 mg/dL', watch: 'Vigiar; ver tendência.' }
      return { level: 'normal', label: 'Glicemia normal', range: '70–140 mg/dL' }
    }
    case 'weight':
      return { level: 'normal', label: '', range: '' } // peso avalia-se por tendência, não por valor único
  }
}

export const VITAL_LEVEL_COLOR: Record<VitalLevel, { color: string; bg: string; border: string }> = {
  normal:   { color: '#0d6e42', bg: '#f0fdf4', border: '#bbf7d0' },
  warning:  { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  critical: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

// Avalia um conjunto de campos de uma leitura e devolve só os que NÃO estão normais,
// pelo mais grave. Útil para o aviso instantâneo ao registar.
export function flagReading(values: Partial<Record<VitalField, number | null | undefined>>, ctx: VitalContext = {}): { field: VitalField; reading: VitalReading }[] {
  const out: { field: VitalField; reading: VitalReading }[] = []
  ;(Object.keys(values) as VitalField[]).forEach(field => {
    const v = values[field]
    if (v == null || isNaN(Number(v)) || field === 'weight') return
    const reading = evaluateVital(field, Number(v), ctx)
    if (reading.level !== 'normal') out.push({ field, reading })
  })
  const rank = { critical: 0, warning: 1, normal: 2 }
  return out.sort((a, b) => rank[a.reading.level] - rank[b.reading.level])
}

export const VITAL_LABEL: Record<VitalField, string> = {
  bp_sys: 'Tensão sistólica', bp_dia: 'Tensão diastólica', hr: 'Frequência cardíaca',
  spo2: 'Oxigénio (SpO₂)', temp: 'Temperatura', glucose: 'Glicemia', weight: 'Peso',
}
