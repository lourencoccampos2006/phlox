// ─── Motor central de análise do residente ───────────────────────────────────
// Cruza TODOS os dados clínicos num único estado, com sinais explicados.
// É a peça de integração do ecossistema: muda um valor → recalcula tudo e diz
// o que se passa (bom/mau). Função pura → usar em qualquer página (ficha,
// cockpit, gestão, turno) para um resultado consistente.

export type Severity = 'critical' | 'warning' | 'info' | 'good'

export interface Signal {
  kind: string
  severity: Severity
  title: string
  detail: string
}

export interface ResidentInput {
  age?: number | null
  conditions?: string | null
  allergies?: string | null
  meds?: string[]                              // nomes de medicamentos ativos
  weightSeries?: { date: string; weight: number }[]
  incidents?: { type: string; severity: string; status: string }[]
  wounds?: { status: string; stage?: string | null }[]
  assessments?: { scale: string; date: string }[]
  fluidToday?: number | null
  lastBowelDays?: number | null
  careLoggedToday?: boolean
}

const BZD = ['diazepam', 'lorazepam', 'alprazolam', 'midazolam', 'clonazepam', 'oxazepam', 'bromazepam', 'flurazepam']
const ANTICOAG = ['varfarina', 'acenocumarol', 'warfarin', 'rivaroxabano', 'apixabano', 'dabigatrano', 'edoxabano', 'heparina', 'enoxaparina']
const NSAID = ['ibuprofeno', 'diclofenac', 'naproxeno', 'meloxicam', 'piroxicam', 'indometacina', 'celecoxib', 'cetoprofeno']
const SSRI = ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram']
const HIGH_RISK_COND = /cancro|cancer|oncol|terminal|paliat|diálise|hemodiál|insuficiência renal|insuficiência hepática|cirrose|insuficiência cardíaca/i

export function analyzeResident(i: ResidentInput): { score: number; level: Severity; signals: Signal[]; summary: string } {
  const signals: Signal[] = []
  const meds = (i.meds || []).map(m => m.toLowerCase())
  const has = (terms: string[]) => meds.some(m => terms.some(t => m.includes(t)))

  // ── Medicação ──
  if (meds.length >= 10) signals.push({ kind: 'poly', severity: 'critical', title: 'Polimedicação grave', detail: `${meds.length} medicamentos ativos. Risco elevado de interações e efeitos adversos — considerar revisão (STOPP/START).` })
  else if (meds.length >= 5) signals.push({ kind: 'poly', severity: 'warning', title: 'Polimedicação', detail: `${meds.length} medicamentos ativos. Vale a pena uma revisão farmacoterapêutica.` })

  if (has(NSAID) && has(ANTICOAG)) signals.push({ kind: 'inter', severity: 'critical', title: 'Interação grave: AINE + anticoagulante', detail: 'Risco de hemorragia. Confirmar necessidade do AINE com o médico.' })
  if (has(BZD) && (i.age || 0) >= 75) signals.push({ kind: 'stopp', severity: 'warning', title: 'Benzodiazepina em idoso (STOPP)', detail: 'Aumenta o risco de quedas e confusão. Avaliar desprescrição.' })
  if (has(SSRI) && has(ANTICOAG)) signals.push({ kind: 'inter', severity: 'warning', title: 'ISRS + anticoagulante', detail: 'Risco de hemorragia aumentado — vigiar sinais.' })

  // ── Condições / idade ──
  if (i.conditions && HIGH_RISK_COND.test(i.conditions)) signals.push({ kind: 'cond', severity: 'warning', title: 'Condição de alto risco', detail: 'Diagnóstico que exige vigilância clínica reforçada.' })
  if (i.allergies) signals.push({ kind: 'allergy', severity: 'info', title: 'Alergias documentadas', detail: i.allergies })

  // ── Ocorrências ──
  const openInc = (i.incidents || []).filter(x => x.status !== 'closed')
  const graveInc = openInc.filter(x => x.severity === 'critical' || x.severity === 'major')
  if (graveInc.length) signals.push({ kind: 'incident', severity: 'critical', title: `${graveInc.length} ocorrência(s) grave(s) em aberto`, detail: 'Necessita de seguimento imediato.' })
  else if (openInc.length) signals.push({ kind: 'incident', severity: 'warning', title: `${openInc.length} ocorrência(s) em aberto`, detail: 'Resolver e documentar o seguimento.' })

  // ── Feridas ──
  const activeW = (i.wounds || []).filter(w => w.status !== 'healed')
  const severeW = activeW.filter(w => w.stage === 'III' || w.stage === 'IV' || w.stage === 'unstageable')
  if (severeW.length) signals.push({ kind: 'wound', severity: 'critical', title: `Ferida categoria III/IV`, detail: 'Lesão profunda — protocolo de tratamento e vigilância apertada.' })
  else if (activeW.length) signals.push({ kind: 'wound', severity: 'warning', title: `${activeW.length} ferida(s) ativa(s)`, detail: 'Em tratamento — acompanhar a evolução.' })

  // ── Peso / nutrição ──
  if (i.weightSeries && i.weightSeries.length >= 2) {
    const s = [...i.weightSeries].sort((a, b) => a.date.localeCompare(b.date))
    const last = s[s.length - 1], lastT = new Date(last.date).getTime()
    const ref30 = [...s].reverse().find(p => lastT - new Date(p.date).getTime() >= 25 * 86400000)
    if (ref30 && ref30.weight > 0) {
      const pct = ((ref30.weight - last.weight) / ref30.weight) * 100
      if (pct >= 5) signals.push({ kind: 'weight', severity: 'critical', title: 'Perda de peso significativa', detail: `${pct.toFixed(1)}% em ~30 dias (${ref30.weight}→${last.weight} kg). Sinal de desnutrição — referenciar nutrição.` })
      else if (pct >= 2) signals.push({ kind: 'weight', severity: 'warning', title: 'Tendência de perda de peso', detail: `${pct.toFixed(1)}% em ~30 dias. Vigiar ingestão.` })
    }
  }

  // ── Hidratação / eliminação ──
  if (i.lastBowelDays != null && i.lastBowelDays >= 3) signals.push({ kind: 'bowel', severity: 'warning', title: 'Sem dejeção há ' + i.lastBowelDays + ' dias', detail: 'Risco de obstipação — avaliar e atuar conforme protocolo.' })
  if (i.fluidToday != null && i.fluidToday < 600) signals.push({ kind: 'fluid', severity: 'warning', title: 'Ingestão hídrica baixa hoje', detail: `${i.fluidToday} ml registados — risco de desidratação.` })

  // ── Avaliações ──
  const barthel = (i.assessments || []).filter(a => a.scale === 'barthel').sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!barthel || (Date.now() - new Date(barthel.date).getTime()) > 90 * 86400000) signals.push({ kind: 'assess', severity: 'info', title: 'Avaliação Barthel em falta', detail: barthel ? 'Última há mais de 90 dias — reavaliar.' : 'Nunca avaliado — fazer avaliação funcional.' })

  // ── Registo ──
  if (i.careLoggedToday === false) signals.push({ kind: 'care', severity: 'info', title: 'Sem registo diário hoje', detail: 'Registar os cuidados do turno.' })

  // ── Pontuação / nível global ──
  const w = { critical: 40, warning: 18, info: 6, good: 0 } as Record<Severity, number>
  const score = Math.min(100, signals.reduce((s, sig) => s + w[sig.severity], 0))
  const hasCrit = signals.some(s => s.severity === 'critical')
  const hasWarn = signals.some(s => s.severity === 'warning')
  const level: Severity = hasCrit ? 'critical' : hasWarn ? 'warning' : signals.length ? 'info' : 'good'

  if (level === 'good') signals.push({ kind: 'ok', severity: 'good', title: 'Sem sinais de alerta', detail: 'Tudo dentro do esperado com a informação disponível.' })

  const summary =
    level === 'critical' ? 'Requer atenção clínica prioritária.' :
    level === 'warning' ? 'Há pontos a vigiar.' :
    level === 'info' ? 'Estável, com itens a completar.' :
    'Estável.'

  // ordenar por severidade
  const ord = { critical: 0, warning: 1, info: 2, good: 3 }
  signals.sort((a, b) => ord[a.severity] - ord[b.severity])
  return { score, level, signals, summary }
}

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Crítico' },
  warning:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'A vigiar' },
  info:     { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'A completar' },
  good:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Estável' },
}
