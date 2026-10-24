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

/* ── SEM RÓTULO CLÍNICO (2026-10-23) ─────────────────────────────────────
   Braden, Morse, MMSE e MNA davam rótulos sobre a pessoa: «risco alto de
   úlcera», «risco elevado de queda», «défice grave», «desnutrição
   confirmada». Isso é software a classificar o estado de um doente
   identificado — Regra 11 do Regulamento (UE) 2017/745. Agora mostram a
   pontuação e o máximo do instrumento. Quem avalia sabe ler a escala.

   O Barthel fica com o grau de dependência: é a classificação ADMINISTRATIVA
   que a Segurança Social pede (Carta Social, comparticipação), não um juízo
   clínico. */
const NEUTRO = { color: 'var(--ink-3)', bg: 'var(--bg-2)' }

export function bradenLevel(score: number) { return { label: `${score} de ${SCALES.braden.max}`, ...NEUTRO } }

export function morseLevel(score: number) { return { label: `${score} de ${SCALES.morse.max}`, ...NEUTRO } }

export function mmseLevel(score: number) { return { label: `${score} de ${SCALES.mmse.max}`, ...NEUTRO } }

export function mnaLevel(score: number): { label: string; color: string; bg: string; sub?: string } { return { label: `${score} de ${SCALES.mna.max}`, ...NEUTRO } }

export function levelOf(scale: ScaleType, score: number): { label: string; color: string; bg: string; sub?: string } {
  if (scale === 'barthel') return barthelLevel(score)
  if (scale === 'braden') return bradenLevel(score)
  if (scale === 'morse') return morseLevel(score)
  if (scale === 'mmse') return mmseLevel(score)
  return mnaLevel(score)
}

export function trendInfo(scale: ScaleType, current: number, prev: number | null) {
  // Subiu ou desceu, e quanto. Se isso é melhor ou pior, quem avalia sabe.
  if (prev == null) return null
  const delta = current - prev
  if (delta === 0) return { arrow: '→', label: 'sem alteração', color: 'var(--ink-3)', delta }
  return {
    arrow: delta > 0 ? '▲' : '▼',
    label: `${delta > 0 ? 'subiu' : 'desceu'} ${Math.abs(delta)} pts`,
    color: 'var(--ink-3)',
    delta,
  }
}
