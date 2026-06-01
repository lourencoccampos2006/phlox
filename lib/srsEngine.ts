// lib/srsEngine.ts
// SuperMemo-2 (SM-2) — Wozniak 1985. Mesmo algoritmo base do Anki/Mnemosyne.
//
// Input: rating 0–5 (qualidade da resposta)
//   0 — falha total, esqueci completamente
//   1 — errei e a resposta certa pareceu familiar
//   2 — errei mas pareceu fácil quando vista
//   3 — acertei com dificuldade significativa
//   4 — acertei com alguma hesitação
//   5 — perfeito, sem esforço
//
// Output: novo ease, interval, repetitions, due_at.

export interface CardState {
  ease: number          // ease factor (>=1.3)
  interval_d: number    // intervalo em dias até nova revisão
  repetitions: number   // sequência consecutiva de acertos (rating>=3)
}

export function sm2(prev: CardState, rating: number, now = new Date()): CardState & { due_at: Date } {
  const q = Math.max(0, Math.min(5, Math.round(rating)))

  // Ease update — fórmula clássica
  let ease = prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ease < 1.3) ease = 1.3

  let reps = prev.repetitions
  let interval: number

  if (q < 3) {
    // falhou — reinicia
    reps = 0
    interval = 1   // revê amanhã
  } else {
    reps += 1
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 6
    else interval = Math.round(prev.interval_d * ease)
  }

  const due = new Date(now.getTime() + interval * 86400 * 1000)
  return { ease, interval_d: interval, repetitions: reps, due_at: due }
}

// Estatísticas simples sobre um conjunto de cards
export interface DeckStats {
  total: number
  due_today: number
  new_today: number       // criados hoje, ainda sem revisão
  mature: number          // intervalo >= 21 dias
  young: number           // intervalo < 21 dias e revisitado pelo menos 1 vez
  avg_ease: number
}

export function deckStats(cards: { ease: number; interval_d: number; repetitions: number; due_at: string | Date; last_review_at: string | Date | null; created_at: string | Date }[]): DeckStats {
  const now = Date.now()
  const today0 = new Date(); today0.setHours(0, 0, 0, 0)
  let due = 0, newt = 0, mature = 0, young = 0
  let easeSum = 0
  cards.forEach(c => {
    const dueT = new Date(c.due_at).getTime()
    if (dueT <= now) due++
    if (!c.last_review_at && new Date(c.created_at) >= today0) newt++
    if (c.interval_d >= 21) mature++
    else if (c.repetitions > 0) young++
    easeSum += c.ease
  })
  return { total: cards.length, due_today: due, new_today: newt, mature, young, avg_ease: cards.length ? +(easeSum / cards.length).toFixed(2) : 2.5 }
}
