// lib/assessmentScales.ts
// Tradução das escalas clínicas (Barthel/Braden/Morse/MMSE/MNA) para nível em
// linguagem simples + tendência com seta — EXTRAÍDO de app/assessments/page.tsx
// (2026-08-10) para deixar de estar preso a essa página: /perfil/[id] agora
// também precisa desta tradução para mostrar avaliações à família SEM expor a
// pontuação em bruto (pedido explícito do Fernando — família vê "Mobilidade:
// Boa, estável", não "Barthel 85/100"). Lógica clínica idêntica, zero
// duplicação: app/assessments/page.tsx importa daqui agora.

export type ScaleType = 'barthel' | 'braden' | 'morse' | 'mmse' | 'mna'

export const SCALES: Record<ScaleType, { label: string; max: number; desc: string; color: string }> = {
  barthel:  { label: 'Índice de Barthel',    max: 100, desc: 'Avaliação das actividades de vida diária (AVD)', color: '#1d4ed8' },
  braden:   { label: 'Escala de Braden',     max: 23,  desc: 'Risco de desenvolvimento de úlceras de pressão',  color: '#7c3aed' },
  morse:    { label: 'Escala de Morse',      max: 125, desc: 'Risco de queda',                                   color: '#d97706' },
  mmse:     { label: 'MMSE',                 max: 30,  desc: 'Mini Mental State Examination — avaliação cognitiva', color: '#0891b2' },
  mna:      { label: 'MNA — Triagem',        max: 14,  desc: 'Mini Nutritional Assessment — estado nutricional', color: '#16a34a' },
}

// Direção clínica: para Morse (quedas) maior pontuação = pior; nas restantes maior = melhor.
export const BETTER_WHEN_HIGHER: Record<ScaleType, boolean> = { barthel: true, braden: true, morse: false, mmse: true, mna: true }

export function barthelLevel(score: number) {
  if (score <= 20) return { label: 'Dependência Total',   color: '#dc2626', bg: '#fee2e2' }
  if (score <= 60) return { label: 'Dependência Grave',   color: '#d97706', bg: '#fef3c7' }
  if (score <= 90) return { label: 'Dependência Moderada',color: '#ca8a04', bg: '#fefce8' }
  if (score <= 99) return { label: 'Dependência Ligeira', color: '#0284c7', bg: '#e0f2fe' }
  return                   { label: 'Independente',        color: '#16a34a', bg: '#dcfce7' }
}

export function bradenLevel(score: number) {
  if (score <= 9)  return { label: 'Risco Muito Alto',color: '#7f1d1d', bg: '#fee2e2' }
  if (score <= 12) return { label: 'Risco Alto',      color: '#dc2626', bg: '#fee2e2' }
  if (score <= 14) return { label: 'Risco Moderado',  color: '#d97706', bg: '#fef3c7' }
  if (score <= 18) return { label: 'Risco Ligeiro',   color: '#ca8a04', bg: '#fefce8' }
  return                   { label: 'Sem Risco',       color: '#16a34a', bg: '#dcfce7' }
}

export function morseLevel(score: number) {
  if (score <= 24) return { label: 'Baixo Risco',  color: '#16a34a', bg: '#dcfce7' }
  if (score <= 50) return { label: 'Risco Moderado',color: '#d97706', bg: '#fef3c7' }
  return                   { label: 'Risco Elevado', color: '#dc2626', bg: '#fee2e2' }
}

export function mmseLevel(score: number) {
  if (score >= 27) return { label: 'Normal',           color: '#16a34a', bg: '#dcfce7' }
  if (score >= 22) return { label: 'Défice Ligeiro',   color: '#ca8a04', bg: '#fefce8' }
  if (score >= 10) return { label: 'Défice Moderado',  color: '#d97706', bg: '#fef3c7' }
  return                   { label: 'Défice Grave',     color: '#dc2626', bg: '#fee2e2' }
}

export function mnaLevel(score: number) {
  if (score >= 12) return { label: 'Normal', color: '#16a34a', bg: '#dcfce7', sub: 'Estado nutricional normal' }
  if (score >= 8)  return { label: 'Em Risco', color: '#d97706', bg: '#fef3c7', sub: 'Risco de desnutrição' }
  return                   { label: 'Desnutrição', color: '#dc2626', bg: '#fee2e2', sub: 'Desnutrição confirmada' }
}

export function levelOf(scale: ScaleType, score: number): { label: string; color: string; bg: string; sub?: string } {
  if (scale === 'barthel') return barthelLevel(score)
  if (scale === 'braden') return bradenLevel(score)
  if (scale === 'morse') return morseLevel(score)
  if (scale === 'mmse') return mmseLevel(score)
  return mnaLevel(score)
}

// Tendência entre pontuação atual e a anterior, interpretada clinicamente.
export function trendInfo(scale: ScaleType, current: number, prev: number | null) {
  if (prev == null) return null
  const delta = current - prev
  if (delta === 0) return { arrow: '→', label: 'sem alteração', color: '#64748b', delta }
  const improved = BETTER_WHEN_HIGHER[scale] ? delta > 0 : delta < 0
  return {
    arrow: delta > 0 ? '▲' : '▼',
    label: `${improved ? 'melhorou' : 'agravou'} ${Math.abs(delta)} pts`,
    color: improved ? '#16a34a' : '#dc2626',
    delta,
  }
}
