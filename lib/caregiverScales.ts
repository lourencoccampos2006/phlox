// lib/caregiverScales.ts
// Escala Zarit-12 (Bedard 2001) — versão curta validada para uso prático.
// Cada item 0 (nunca) → 4 (quase sempre). Total 0-48.
//
// Bandas (Bedard 2001; Ankri 2005 validação francesa):
//   0–10  sem sobrecarga
//   11–20 leve
//   21–30 moderada
//   ≥ 31  grave

export const ZARIT12_QUESTIONS = [
  'Acha que o seu familiar lhe pede mais ajuda do que aquela de que realmente precisa?',
  'Acha que, devido ao tempo que dispensa ao seu familiar, já não tem tempo suficiente para si próprio?',
  'Sente-se tenso/a quando tem de cuidar do seu familiar e ainda tem outras tarefas para fazer?',
  'Sente-se envergonhado/a com o comportamento do seu familiar?',
  'Sente-se irritado/a quando está perto do seu familiar?',
  'Sente que o seu familiar afecta negativamente as suas relações com outros membros da família ou amigos?',
  'Tem receio do que o futuro reserva ao seu familiar?',
  'Sente que o seu familiar está dependente de si?',
  'Sente-se esgotado/a quando está com o seu familiar?',
  'Sente que a sua saúde tem sido afectada por ter de cuidar do seu familiar?',
  'Sente que não tem a vida privada que desejaria devido ao seu familiar?',
  'No geral, sente-se muito sobrecarregado/a por cuidar do seu familiar?',
]

export const ZARIT12_OPTIONS = [
  { v: 0, label: 'Nunca' },
  { v: 1, label: 'Raramente' },
  { v: 2, label: 'Às vezes' },
  { v: 3, label: 'Quase sempre' },
  { v: 4, label: 'Sempre' },
]

export function zarit12Band(total: number): 'sem_sobrecarga' | 'sobrecarga_leve' | 'sobrecarga_moderada' | 'sobrecarga_grave' {
  if (total <= 10) return 'sem_sobrecarga'
  if (total <= 20) return 'sobrecarga_leve'
  if (total <= 30) return 'sobrecarga_moderada'
  return 'sobrecarga_grave'
}

export const ZARIT12_BAND_META = {
  sem_sobrecarga:        { label: 'Sem sobrecarga',         color: '#16a34a', advice: 'O nível atual é sustentável. Continue a cuidar de si — sono, exercício e tempo pessoal.' },
  sobrecarga_leve:       { label: 'Sobrecarga ligeira',     color: '#d97706', advice: 'Sinais iniciais. Procurar pequenas pausas regulares e identificar tarefas que possa delegar.' },
  sobrecarga_moderada:   { label: 'Sobrecarga moderada',    color: '#ea580c', advice: 'Importa pedir ajuda formal ou informal. Grupos de apoio e respite care fazem diferença real.' },
  sobrecarga_grave:      { label: 'Sobrecarga grave',       color: '#dc2626', advice: 'Risco para a sua saúde e a do familiar. Falar com o médico de família, assistente social ou serviço de cuidados paliativos. Apoio profissional não é luxo.' },
}

// ── Reconciliation diff ──────────────────────────────────────────────────────
export interface MedItem { name: string; dose?: string; frequency?: string; notes?: string }
export interface ReconDiff {
  added: MedItem[]
  removed: MedItem[]
  changed: { name: string; from: MedItem; to: MedItem; what: string[] }[]
  unchanged: MedItem[]
}

function norm(s: string) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' ') }
function dciKey(m: MedItem) { return norm(m.name).replace(/\s+[\d,]+\s*mg.*$/, '') }

export function reconcile(before: MedItem[], after: MedItem[]): ReconDiff {
  const a = new Map(before.map(m => [dciKey(m), m]))
  const b = new Map(after.map(m => [dciKey(m), m]))
  const added: MedItem[] = []
  const removed: MedItem[] = []
  const changed: ReconDiff['changed'] = []
  const unchanged: MedItem[] = []
  for (const [k, m] of b) {
    const prev = a.get(k)
    if (!prev) { added.push(m); continue }
    const what: string[] = []
    if (norm(prev.dose || '') !== norm(m.dose || '')) what.push(`dose: ${prev.dose || '—'} → ${m.dose || '—'}`)
    if (norm(prev.frequency || '') !== norm(m.frequency || '')) what.push(`frequência: ${prev.frequency || '—'} → ${m.frequency || '—'}`)
    if (what.length) changed.push({ name: m.name, from: prev, to: m, what })
    else unchanged.push(m)
  }
  for (const [k, m] of a) if (!b.has(k)) removed.push(m)
  return { added, removed, changed, unchanged }
}
