// ─── O que está por fechar, por residente ────────────────────────────────────
// Junta num só sítio o que a equipa registou e ainda não fechou. Função pura,
// usada pelo radar, pelo guardião, pelo cockpit e pela gestão, para todos
// dizerem o mesmo. NÃO avalia o estado de ninguém — ver a nota em baixo.

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
  latestVitals?: { temp?: number; spo2?: number; bp_sys?: number; hr?: number; at?: string } | null
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE ESTE FICHEIRO DEIXOU DE FAZER (2026-10-23)
   ══════════════════════════════════════════════════════════════════════════
   Era um sistema de alerta precoce clínico. Lia a medicação, os sinais vitais,
   o peso, a hidratação e a eliminação de cada residente, aplicava limiares
   escritos à mão (febre a partir de 38 graus, saturação abaixo de 92 por cento,
   sistólica a partir de 180, frequência a partir de 110, perda de peso de 5 por
   cento, 3 dias sem dejeção), dava uma pontuação de 0 a 100 e dizia o que
   fazer: «sinal de desnutrição — referenciar nutrição», «avaliar foco
   infecioso», «investigar causa», «avaliar desprescrição», «requer atenção
   clínica prioritária».

   Isso é exactamente o que a Regra 11 do Regulamento (UE) 2017/745 descreve:
   software que dá informação usada para decisões de diagnóstico e terapêutica
   sobre uma pessoa identificada. As escalas de alerta precoce deste tipo são
   comercializadas como dispositivos médicos certificados.

   ── O QUE FICA ─────────────────────────────────────────────────────────────
   O que a EQUIPA registou e que está por fechar. Nenhum limiar clínico, nenhum
   juízo sobre o estado de ninguém, nenhuma indicação de atuação clínica:

     • ocorrências em aberto — e «grave» só quando foi a equipa a marcá-la assim;
     • feridas que estão a ser acompanhadas;
     • avaliação funcional em falta há mais de 90 dias (é a Portaria que pede
       a avaliação periódica — isto é um lembrete de processo, não clínico);
     • turno sem registo diário;
     • alergias documentadas, que é informação a ter à vista.

   A pontuação continua a existir porque metade da aplicação ordena por ela —
   mas passou a ser uma CONTAGEM do que está por fechar, não um nível de risco.
   Um residente com três ocorrências em aberto aparece primeiro porque há três
   coisas por fazer, não porque o Phlox acha que ele está pior. */

export function analyzeResident(i: ResidentInput): { score: number; level: Severity; signals: Signal[]; summary: string } {
  const signals: Signal[] = []

  // ── Ocorrências — a gravidade é a que a equipa escolheu ao registar ──
  const openInc = (i.incidents || []).filter(x => x.status !== 'closed')
  const graveInc = openInc.filter(x => x.severity === 'critical' || x.severity === 'major')
  if (graveInc.length) signals.push({ kind: 'incident', severity: 'critical', title: `${graveInc.length} ocorrência(s) marcada(s) como grave(s), em aberto`, detail: 'Registadas como graves pela equipa e ainda sem seguimento fechado.' })
  else if (openInc.length) signals.push({ kind: 'incident', severity: 'warning', title: `${openInc.length} ocorrência(s) em aberto`, detail: 'Por fechar o seguimento no registo.' })

  // ── Feridas em acompanhamento — conta-se, não se classifica ──
  const activeW = (i.wounds || []).filter(w => w.status !== 'healed')
  if (activeW.length) signals.push({ kind: 'wound', severity: 'info', title: `${activeW.length} ferida(s) em acompanhamento`, detail: 'Ver a evolução registada.' })

  // ── Avaliação funcional periódica — lembrete de processo ──
  const barthel = (i.assessments || []).filter(a => a.scale === 'barthel').sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!barthel || (Date.now() - new Date(barthel.date).getTime()) > 90 * 86400000) signals.push({ kind: 'assess', severity: 'info', title: 'Avaliação funcional em falta', detail: barthel ? 'A última tem mais de 90 dias.' : 'Ainda não há nenhuma registada.' })

  // ── Registo do turno ──
  if (i.careLoggedToday === false) signals.push({ kind: 'care', severity: 'info', title: 'Sem registo diário hoje', detail: 'O turno ainda não registou os cuidados.' })

  // ── Alergias — informação a ter à vista, não um alerta ──
  if (i.allergies) signals.push({ kind: 'allergy', severity: 'info', title: 'Alergias documentadas', detail: i.allergies })

  // ── Contagem do que está por fechar (NÃO é um nível de risco) ──
  const w = { critical: 3, warning: 2, info: 1, good: 0 } as Record<Severity, number>
  const contaveis = signals.filter(sg => sg.kind !== 'allergy')
  const score = contaveis.reduce((t, sg) => t + w[sg.severity], 0)
  const hasCrit = signals.some(sg => sg.severity === 'critical')
  const hasWarn = signals.some(sg => sg.severity === 'warning')
  const level: Severity = hasCrit ? 'critical' : hasWarn ? 'warning' : contaveis.length ? 'info' : 'good'

  if (level === 'good') signals.push({ kind: 'ok', severity: 'good', title: 'Nada por fechar', detail: 'Os registos desta pessoa estão em dia.' })

  const summary =
    level === 'critical' ? 'Há ocorrências graves por fechar.' :
    level === 'warning' ? 'Há ocorrências por fechar.' :
    level === 'info' ? 'Há registos por completar.' :
    'Registos em dia.'

  const ord = { critical: 0, warning: 1, info: 2, good: 3 }
  signals.sort((a, b) => ord[a.severity] - ord[b.severity])
  return { score, level, signals, summary }
}

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'var(--red)', bg: 'var(--red-light)', border: 'var(--badge-red-border)', label: 'Grave em aberto' },
  warning:  { color: 'var(--amber)', bg: 'var(--amber-light)', border: 'var(--badge-amber-border)', label: 'Em aberto' },
  info:     { color: 'var(--blue)', bg: 'var(--blue-light)', border: 'var(--blue-light)', label: 'A completar' },
  good:     { color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)', label: 'Em dia' },
}
