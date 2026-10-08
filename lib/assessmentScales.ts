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
  barthel:  { label: 'Índice de Barthel',    max: 100, desc: 'Avaliação das actividades de vida diária (AVD)', color: 'var(--blue)' },
  braden:   { label: 'Escala de Braden',     max: 23,  desc: 'Risco de desenvolvimento de úlceras de pressão',  color: 'var(--roxo)' },
  morse:    { label: 'Escala de Morse',      max: 125, desc: 'Risco de queda',                                   color: 'var(--amber)' },
  mmse:     { label: 'MMSE',                 max: 30,  desc: 'Mini Mental State Examination — avaliação cognitiva', color: 'var(--green)' },
  mna:      { label: 'MNA — Triagem',        max: 14,  desc: 'Mini Nutritional Assessment — estado nutricional', color: 'var(--green)' },
}

// Direção clínica: para Morse (quedas) maior pontuação = pior; nas restantes maior = melhor.
export const BETTER_WHEN_HIGHER: Record<ScaleType, boolean> = { barthel: true, braden: true, morse: false, mmse: true, mna: true }

export function barthelLevel(score: number) {
  if (score <= 20) return { label: 'Dependência Total',   color: 'var(--red)', bg: 'var(--red-light)' }
  if (score <= 60) return { label: 'Dependência Grave',   color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score <= 90) return { label: 'Dependência Moderada',color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score <= 99) return { label: 'Dependência Ligeira', color: 'var(--green)', bg: 'var(--green-light)' }
  return                   { label: 'Independente',        color: 'var(--green)', bg: 'var(--green-light)' }
}

export function bradenLevel(score: number) {
  if (score <= 9)  return { label: 'Risco Muito Alto',color: 'var(--badge-red-fg)', bg: 'var(--red-light)' }
  if (score <= 12) return { label: 'Risco Alto',      color: 'var(--red)', bg: 'var(--red-light)' }
  if (score <= 14) return { label: 'Risco Moderado',  color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score <= 18) return { label: 'Risco Ligeiro',   color: 'var(--amber)', bg: 'var(--amber-light)' }
  return                   { label: 'Sem Risco',       color: 'var(--green)', bg: 'var(--green-light)' }
}

export function morseLevel(score: number) {
  if (score <= 24) return { label: 'Baixo Risco',  color: 'var(--green)', bg: 'var(--green-light)' }
  if (score <= 50) return { label: 'Risco Moderado',color: 'var(--amber)', bg: 'var(--amber-light)' }
  return                   { label: 'Risco Elevado', color: 'var(--red)', bg: 'var(--red-light)' }
}

export function mmseLevel(score: number) {
  if (score >= 27) return { label: 'Normal',           color: 'var(--green)', bg: 'var(--green-light)' }
  if (score >= 22) return { label: 'Défice Ligeiro',   color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score >= 10) return { label: 'Défice Moderado',  color: 'var(--amber)', bg: 'var(--amber-light)' }
  return                   { label: 'Défice Grave',     color: 'var(--red)', bg: 'var(--red-light)' }
}

export function mnaLevel(score: number) {
  if (score >= 12) return { label: 'Normal', color: 'var(--green)', bg: 'var(--green-light)', sub: 'Estado nutricional normal' }
  if (score >= 8)  return { label: 'Em Risco', color: 'var(--amber)', bg: 'var(--amber-light)', sub: 'Risco de desnutrição' }
  return                   { label: 'Desnutrição', color: 'var(--red)', bg: 'var(--red-light)', sub: 'Desnutrição confirmada' }
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
  if (delta === 0) return { arrow: '→', label: 'sem alteração', color: 'var(--blue)', delta }
  const improved = BETTER_WHEN_HIGHER[scale] ? delta > 0 : delta < 0
  return {
    arrow: delta > 0 ? '▲' : '▼',
    label: `${improved ? 'melhorou' : 'agravou'} ${Math.abs(delta)} pts`,
    color: improved ? 'var(--green)' : 'var(--red)',
    delta,
  }
}
