// lib/adl.ts
// ─────────────────────────────────────────────────────────────────────────────
// Capacidade funcional contínua (Módulo 15, 2026-08-20).
//
// O que resolve: a autonomia só era medida por escalas formais (Barthel/Katz)
// preenchidas de 3 em 3 meses. Quem começa a precisar de mais ajuda em março
// só aparece nos números em junho — o declínio esteve visível para quem cuida
// dele todos os dias, mas não estava registado em lado nenhum.
//
// DUAS DECISÕES DE DESENHO, a pedido do Fernando (2026-08-20), depois de ele
// corrigir o plano inicial:
//
//  1. LINGUAGEM SIMPLES, NÃO CLÍNICA. "Independente / supervisão / ajuda
//     parcial / ajuda total" é vocabulário de instrumento clínico. Num centro
//     de dia pode nem haver profissional a tempo inteiro — pedir a alguém que
//     não é da área para classificar em escala Barthel dá dados maus, e dados
//     maus são piores que dados nenhuns (geram sinais falsos). Perguntamos em
//     português normal: "fez sozinho?", "precisou que alguém fosse com ele?".
//
//  2. SEM CADÊNCIA IMPOSTA. Não é um registo diário obrigatório. Um lar com
//     equipa 24h pode fazer todos os dias; um centro de dia pode fazer uma vez
//     por semana ou de 15 em 15 dias. A deteção usa JANELA DE TEMPO (últimos
//     30 dias vs. os 90 anteriores) em vez de contagem de registos, por isso
//     adapta-se sozinha ao ritmo de cada casa — sem ramificar por tipo de
//     instituição e sem obrigar ninguém a um ritmo que não aguenta.
//
// Perder autonomia é um fenómeno de MESES. Não é preciso (nem útil) medir
// todos os dias: um dia mau não é declínio, e medir demasiado só acrescenta
// ruído e trabalho.
// ─────────────────────────────────────────────────────────────────────────────

import type { Severity } from './residentSignals'

export type AdlTask = 'higiene' | 'alimentacao' | 'mobilidade'

export const ADL_TASKS: { key: AdlTask; label: string; question: string }[] = [
  { key: 'higiene',     label: 'Higiene',     question: 'Na casa de banho e na higiene, como correu?' },
  { key: 'alimentacao', label: 'Alimentação', question: 'À refeição, como correu?' },
  { key: 'mobilidade',  label: 'Mobilidade',  question: 'A andar e a levantar-se, como correu?' },
]

// 3 = mais autónomo. Palavras do dia a dia, não escala clínica.
export const ADL_LEVELS: { value: number; label: string; hint: string; color: string; bg: string }[] = [
  { value: 3, label: 'Sozinho',          hint: 'Fez tudo sem ajuda',                 color: '#15803d', bg: '#f0fdf4' },
  { value: 2, label: 'Só a vigiar',      hint: 'Fez sozinho, alguém por perto',      color: '#0d9488', bg: '#f0fdfa' },
  { value: 1, label: 'Com alguma ajuda', hint: 'Precisou de ajuda em parte',          color: '#b45309', bg: '#fffbeb' },
  { value: 0, label: 'Fizemos nós',      hint: 'Precisou que fizessem por ele/ela',  color: '#b91c1c', bg: '#fef2f2' },
]

export const ADL_MAX = ADL_TASKS.length * 3   // 9 = totalmente autónomo

export interface AdlReview {
  date: string
  higiene: number | null
  alimentacao: number | null
  mobilidade: number | null
}

/** Soma 0-9 de uma revisão. null se não houver nenhuma tarefa preenchida. */
export function adlScore(r: AdlReview): number | null {
  const vals = [r.higiene, r.alimentacao, r.mobilidade].filter((v): v is number => typeof v === 'number')
  if (!vals.length) return null
  // Normaliza para a escala completa quando só algumas tarefas foram
  // respondidas — senão uma revisão parcial parecia sempre uma queda.
  return (vals.reduce((s, v) => s + v, 0) / vals.length) * ADL_TASKS.length
}

/** Etiqueta simples para um score 0-9. */
export function adlLabel(score: number): string {
  const perTask = score / ADL_TASKS.length
  if (perTask >= 2.5) return 'Faz quase tudo sozinho'
  if (perTask >= 1.5) return 'Precisa de alguma ajuda'
  if (perTask >= 0.5) return 'Precisa de bastante ajuda'
  return 'Precisa de ajuda em quase tudo'
}

const daysAgo = (date: string) => {
  const d = new Date(date + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

export interface AdlTrend {
  latest: { date: string; score: number } | null
  recentAvg: number | null
  baselineAvg: number | null
  delta: number | null          // recente − baseline (negativo = perdeu autonomia)
  reliable: boolean
  flag: { kind: string; severity: Severity; title: string; detail: string } | null
}

/**
 * Declínio funcional: média dos últimos 30 dias vs. os 90 anteriores.
 * Janela por TEMPO (não por nº de registos) para funcionar tanto com registo
 * diário como semanal ou quinzenal. Precisa de ≥2 revisões dos dois lados —
 * senão é falta de registo, não perda de autonomia.
 */
export function adlTrend(reviews: AdlReview[]): AdlTrend {
  const scored = reviews
    .map(r => ({ date: r.date, score: adlScore(r) }))
    .filter((x): x is { date: string; score: number } => x.score !== null)
    .sort((a, b) => b.date.localeCompare(a.date))

  const latest = scored[0] || null
  const recent: number[] = []
  const baseline: number[] = []
  scored.forEach(x => {
    const age = daysAgo(x.date)
    if (age <= 30) recent.push(x.score)
    else if (age <= 120) baseline.push(x.score)
  })

  const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
  const recentAvg = avg(recent)
  const baselineAvg = avg(baseline)
  const reliable = recent.length >= 2 && baseline.length >= 2
  const delta = reliable && recentAvg != null && baselineAvg != null ? recentAvg - baselineAvg : null

  let flag: AdlTrend['flag'] = null
  if (delta != null && delta <= -1) {
    // −1 ponto (em 9) ≈ uma tarefa que passou de "sozinho" para "com alguma
    // ajuda". −2 ou mais é uma mudança que a equipa deve mesmo olhar.
    flag = {
      kind: 'trend_adl',
      severity: delta <= -2 ? 'critical' : 'warning',
      title: 'A precisar de mais ajuda do que precisava',
      detail: `Autonomia média de ${recentAvg!.toFixed(1)}/${ADL_MAX} no último mês (era ${baselineAvg!.toFixed(1)}/${ADL_MAX} nos 3 meses anteriores). Pode merecer reavaliação da autonomia e do plano de cuidados.`,
    }
  }

  return { latest, recentAvg, baselineAvg, delta, reliable, flag }
}
