// lib/careSignals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Camada "O Phlox não deixa escapar nada" — ORGANIZACIONAL, não clínica.
//
// O que faz: reúne, para cada utente, TUDO o que a EQUIPA registou (medicação,
// registos do dia, sinais vitais, peso, ingestão, dejeções, ocorrências, feridas,
// avaliações) e DESTACA o que saiu do padrão habitual ou ficou por fazer — para a
// equipa não deixar escapar nada. Junta-se ao motor existente lib/residentSignals
// (analyzeResident), que já cruza estes dados.
//
// ENQUADRAMENTO REGULATÓRIO (importante): isto NÃO é um dispositivo médico. NÃO
// prevê, NÃO diagnostica, NÃO estratifica risco clínico nem recomenda tratamento.
// Apenas organiza e mostra o que a equipa registou, cruzando-o com limiares
// definidos, para apoiar a ORGANIZAÇÃO do trabalho. A avaliação e a decisão são
// SEMPRE do profissional de saúde. A linguagem reflete isto: "saiu do padrão
// habitual", "pode merecer revisão da equipa" — nunca "risco/prognóstico".
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeResident, type Severity, type Signal } from './residentSignals'

export const CARE_DISCLAIMER =
  'Esta vista apoia a organização do trabalho da equipa: reúne o que foi registado e ' +
  'destaca o que saiu do padrão habitual. Não é um diagnóstico nem uma avaliação clínica — ' +
  'a avaliação e a decisão são sempre do profissional de saúde.'

export interface CareRecordRow { patient_id: string; date: string; shift?: string; mood?: any; nutrition?: any; notes?: string; vitals?: any }
export interface MarRow { patient_id: string; date: string; shift?: string; status: string }
export interface IncidentRow { patient_id: string; type: string; severity: string; status: string }
export interface WoundRow { patient_id: string; status: string; stage?: string | null }
export interface AssessmentRow { patient_id: string; scale: string; date: string }
export interface WeightRow { patient_id: string; date: string; weight: number }
export interface HydrationRow { patient_id: string; at: string; fluid_ml?: number | null }
export interface ResidentRequestRow { patient_id: string; kind: string; content: string; status: string; created_at: string }
export interface AttendanceRow { date: string; status: string }
/** Registo do dia dos últimos dias, só os campos que ninguém lia. */
export interface DailyDetailRow { date: string; appetite?: string | null; urinary?: string | null; bowel?: string | null; skin?: string | null }
export interface TransportDue { label: string; time: string | null; done: boolean }

export interface PatientLite { id: string; name: string; age?: number | null; conditions?: string | null; allergies?: string | null; room_number?: string | null }

export interface CareSignalsInput {
  patient: PatientLite
  meds: string[]
  careToday: CareRecordRow[]          // registos de hoje deste utente
  careHistory: CareRecordRow[]        // registos com vitais/peso (longitudinal)
  mar: MarRow[]                       // tomas de hoje deste utente
  marExpectedToday?: number          // nº de tomas esperadas hoje (se conhecido)
  incidents: IncidentRow[]
  wounds: WoundRow[]
  assessments: AssessmentRow[]
  weights: WeightRow[]
  hydrationToday: HydrationRow[]
  /** pedidos/observações/queixas do utente EM ABERTO (sprint98) — o que a equipa não deve deixar escapar. */
  residentRequests: ResidentRequestRow[]

  // ── As três fontes que se marcavam e ninguém lia (2026-09-02) ────────────
  // Presenças, preparação da medicação e transportes recorrentes eram escrita
  // para o vazio: gravavam numa tabela que nada voltava a ler. Passam a entrar
  // aqui, no mesmo motor que já decide a quem ir ver primeiro.
  /** presenças marcadas dos últimos ~14 dias, da mais antiga para a mais recente */
  attendanceRecent?: AttendanceRow[]
  /** pastilheiro desta semana por preparar — só quando a casa usa a ferramenta */
  prepPendingThisWeek?: boolean
  /** transportes recorrentes de hoje desta pessoa (com estado) */
  transportsToday?: TransportDue[]
  /** últimos ~7 registos do dia: apetite, continência e pele */
  dailyDetail?: DailyDetailRow[]
  /** já existe ferida em acompanhamento? (cruza com o que a pele diz) */
  hasOpenWound?: boolean
}

export interface CareItem { kind: string; severity: Severity; title: string; detail: string }

export interface CareResult {
  patientId: string
  name: string
  room?: string | null
  score: number
  level: Severity
  /** sinais que saíram do padrão habitual (organizacional) */
  outOfPattern: CareItem[]
  /** itens por fazer/registar (organizacional) */
  openItems: CareItem[]
  /** frase curta e neutra */
  note: string
}

/** "ter 2" / "qua 3" — dia curto para uma frase, em hora de Portugal. */
function diaCurto(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })
}

const num = (v: any): number | undefined => (v == null || v === '' || isNaN(Number(v)) ? undefined : Number(v))

// Lê vitais do registo mais recente que os tenha (care_records.vitals é jsonb).
function latestVitals(history: CareRecordRow[]): { temp?: number; spo2?: number; bp_sys?: number; hr?: number; at?: string } | null {
  const withV = history
    .filter(r => r.vitals && typeof r.vitals === 'object')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  for (const r of withV) {
    const v = r.vitals
    const out = { temp: num(v.temp ?? v.temperature), spo2: num(v.spo2), bp_sys: num(v.bp_sys ?? v.systolic), hr: num(v.hr ?? v.pulse), at: r.date }
    if (out.temp != null || out.spo2 != null || out.bp_sys != null || out.hr != null) return out
  }
  return null
}

// Última recusa alimentar registada hoje (organizacional, do care_records.mood/nutrition).
function refusedMealToday(careToday: CareRecordRow[]): boolean {
  return careToday.some(r => {
    const n = (typeof r.nutrition === 'string' ? r.nutrition : r.nutrition?.appetite || r.mood?.appetite || '') as string
    return /recus/i.test(String(n))
  })
}

/**
 * Resumo organizacional por utente. Reúne tudo o que a equipa registou e destaca
 * o que saiu do padrão + o que ficou por fazer. Determinístico e transparente.
 */
export function summariseResident(input: CareSignalsInput): CareResult {
  const { patient: p } = input

  // Série de peso (do mais antigo para o mais recente é tratada no motor).
  const weightSeries = input.weights
    .filter(w => w.weight != null && w.date)
    .map(w => ({ date: w.date, weight: Number(w.weight) }))

  // Ingestão hídrica de hoje (soma).
  const fluidToday = input.hydrationToday.length
    ? input.hydrationToday.reduce((s, h) => s + (Number(h.fluid_ml) || 0), 0)
    : null

  // Motor existente (analyzeResident) — cruza tudo num estado com sinais explicados.
  const a = analyzeResident({
    age: p.age, conditions: p.conditions, allergies: p.allergies,
    meds: input.meds,
    weightSeries,
    incidents: input.incidents.map(i => ({ type: i.type, severity: i.severity, status: i.status })),
    wounds: input.wounds.map(w => ({ status: w.status, stage: w.stage })),
    assessments: input.assessments.map(x => ({ scale: x.scale, date: x.date })),
    fluidToday,
    lastBowelDays: null,
    careLoggedToday: input.careToday.length > 0,
    latestVitals: latestVitals(input.careHistory),
  })

  // Sinais extra de natureza ORGANIZACIONAL (não clínica): doses por registar,
  // recusa alimentar repetida — coisas que a equipa não deve deixar escapar.
  const extra: Signal[] = []

  // Doses do dia ainda por registar no MAR (organizacional: "falta registar").
  if (input.marExpectedToday && input.marExpectedToday > 0) {
    const given = input.mar.filter(m => m.status === 'taken' || m.status === 'given').length
    const missing = input.marExpectedToday - given
    if (missing > 0) extra.push({ kind: 'mar_open', severity: 'warning', title: `${missing} toma(s) por registar hoje`, detail: 'Há tomas previstas que ainda não foram marcadas como dadas. Confirmar e registar.' })
  }

  // Recusa alimentar hoje (organizacional — a equipa registou; destacar para seguir).
  if (refusedMealToday(input.careToday)) {
    extra.push({ kind: 'meal_refused', severity: 'info', title: 'Recusa alimentar registada hoje', detail: 'A equipa registou recusa de refeição. Pode merecer atenção e seguimento.' })
  }

  // ── Faltas ───────────────────────────────────────────────────────────────
  // Num centro de dia, faltar é o primeiro sinal de que algo mudou em casa —
  // e é a única coisa que a equipa marca todos os dias sem que ninguém volte a
  // olhar para ela. NÃO é uma dívida de registo: a frase pergunta, não acusa
  // (ver a nota do Fernando: um centro de dia não é um ambiente clínico diário
  // e nada aqui pode soar a "em atraso").
  const presencas = (input.attendanceRecent || []).filter(a => a.status === 'present' || a.status === 'absent' || a.status === 'left')
  if (presencas.length >= 3) {
    const ultimas = presencas.slice(-2)
    const faltas10 = presencas.slice(-10).filter(a => a.status === 'absent').length
    if (ultimas.length === 2 && ultimas.every(a => a.status === 'absent')) {
      extra.push({
        kind: 'attendance_gap', severity: 'warning',
        title: 'Faltou os dois últimos dias',
        detail: `${diaCurto(ultimas[0].date)} e ${diaCurto(ultimas[1].date)}. Vale a pena saber da família?`,
      })
    } else if (faltas10 >= 3) {
      extra.push({
        kind: 'attendance_gap', severity: 'info',
        title: `${faltas10} faltas nos últimos dias marcados`,
        detail: 'Vinha regularmente e passou a faltar. Pode não ser nada — ou pode ser.',
      })
    }
  }

  // ── Pastilheiro por preparar ──────────────────────────────────────────────
  // Só entra quando a casa usa mesmo a ferramenta (quem nunca a abriu não leva
  // um aviso por pessoa por causa de uma página que não conhece).
  if (input.prepPendingThisWeek) {
    extra.push({
      kind: 'prep_open', severity: 'info',
      title: 'Pastilheiro desta semana por preparar',
      detail: 'Tem medicação com horário e ainda não há nenhuma marca de preparação nesta semana.',
    })
  }

  // ── Transporte recorrente sem marca ───────────────────────────────────────
  // Um transporte que se repete toda a semana e que hoje ninguém marcou uma
  // hora depois da hora combinada. Auto-limitado: só existe se alguém criou o
  // horário, por isso não há ruído em casas que não usam transportes.
  for (const t of input.transportsToday || []) {
    if (t.done) continue
    extra.push({
      kind: 'transport_open', severity: 'warning',
      title: `Transporte por marcar${t.time ? ` — ${t.time.slice(0, 5)}` : ''}`,
      detail: `${t.label}: passou mais de uma hora da hora combinada e ninguém marcou como feito.`,
    })
  }

  // ── Apetite, continência e pele ──────────────────────────────────────────
  // Estes quatro campos eram preenchidos por toda a equipa todos os dias e
  // nunca mais lidos por ninguém — o formulário guardava-os e acabava aí. São
  // clinicamente relevantes; o que faltava era alguém a olhar. Cada regra usa
  // vários dias, porque um dia mau não é sinal — o padrão é.
  const dias = [...(input.dailyDetail || [])].sort((a, b) => a.date.localeCompare(b.date))
  const ultimos = dias.slice(-5)

  // Pele: escara ou ferida registada e nenhuma ferida em acompanhamento. É a
  // falha que interessa mesmo — duas ferramentas que sabem coisas diferentes
  // sobre a mesma pessoa e nunca se falaram.
  const peleUltima = dias.length ? dias[dias.length - 1].skin : null
  if ((peleUltima === 'Escara' || peleUltima === 'Ferida') && !input.hasOpenWound) {
    extra.push({
      kind: 'skin_gap', severity: 'critical',
      title: `Pele registada como "${peleUltima.toLowerCase()}" sem acompanhamento aberto`,
      detail: 'O registo do dia assinala lesão de pele mas não há ferida em seguimento. Abrir em Feridas para passar a ter penso e evolução.',
    })
  } else if (peleUltima === 'Rubor') {
    const rubores = ultimos.filter(d => d.skin === 'Rubor').length
    if (rubores >= 2) extra.push({
      kind: 'skin_watch', severity: 'warning',
      title: `Rubor na pele em ${rubores} dos últimos registos`,
      detail: 'Rubor repetido no mesmo sítio costuma vir antes da escara. Vale a pena ver e aliviar a pressão.',
    })
  }

  // Trânsito intestinal: obstipação seguida é desconforto real e evitável.
  const obstipados = ultimos.slice(-3).filter(d => d.bowel === 'Obstipação')
  if (obstipados.length >= 3) {
    extra.push({
      kind: 'bowel_watch', severity: 'warning',
      title: 'Obstipação nos três últimos registos',
      detail: 'Três registos seguidos de obstipação. Rever hidratação, fibra e o que a medicação possa estar a provocar.',
    })
  }

  // Retenção urinária é para hoje, não para a semana.
  if (dias.length && dias[dias.length - 1].urinary === 'Retenção') {
    extra.push({
      kind: 'urinary_watch', severity: 'warning',
      title: 'Retenção urinária no último registo',
      detail: 'Retenção assinalada no registo do dia. Confirmar se foi resolvida.',
    })
  }

  // Apetite em baixa de forma repetida — antecede a perda de peso, que o motor
  // já vigia, mas só quando ela já aconteceu.
  const semApetite = ultimos.filter(d => d.appetite === 'Fraco' || d.appetite === 'Recusou').length
  if (ultimos.length >= 4 && semApetite >= 3) {
    extra.push({
      kind: 'appetite_watch', severity: 'warning',
      title: `Apetite fraco em ${semApetite} dos últimos ${ultimos.length} registos`,
      detail: 'O apetite vem em baixa há vários dias. Costuma aparecer antes da perda de peso.',
    })
  }

  // Pedidos/observações/queixas do utente em aberto (o que o utente pediu ou disse,
  // para toda a equipa ficar a saber e poder intervir — sprint98_resident_requests).
  const RR_LABEL: Record<string, string> = { pedido: 'Pedido do utente', observacao: 'Observação registada', queixa: 'Queixa do utente' }
  for (const rr of input.residentRequests) {
    extra.push({
      kind: 'resident_request',
      severity: rr.kind === 'queixa' ? 'warning' : 'info',
      title: RR_LABEL[rr.kind] || 'Pedido/observação do utente',
      detail: String(rr.content || '').slice(0, 200),
    })
  }

  // Junta os sinais do motor + os organizacionais; separa "fora do padrão" de "por fazer".
  const all = [...a.signals, ...extra]
  // 'prep_open' e 'transport_open' são tarefas por fazer; 'attendance_gap' é
  // sobre a pessoa, não sobre a equipa — por isso vai para "fora do padrão".
  const openKinds = new Set(['care', 'assess', 'mar_open', 'resident_request', 'prep_open', 'transport_open'])
  const outOfPattern: CareItem[] = []
  const openItems: CareItem[] = []
  for (const s of all) {
    if (s.severity === 'good') continue
    const item: CareItem = { kind: s.kind, severity: s.severity, title: s.title, detail: s.detail }
    if (openKinds.has(s.kind)) openItems.push(item)
    else outOfPattern.push(item)
  }

  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  outOfPattern.sort((x, y) => ord[x.severity] - ord[y.severity])
  openItems.sort((x, y) => ord[x.severity] - ord[y.severity])

  const note = outOfPattern.length === 0 && openItems.length === 0
    ? 'Sem nada fora do padrão com o que foi registado.'
    : outOfPattern.some(i => i.severity === 'critical')
      ? 'Há registos fora do padrão que podem merecer revisão da equipa.'
      : 'Alguns pontos a confirmar ou completar.'

  // ── O nível tem de contar com os sinais organizacionais ──────────────────
  // Vinha só de analyzeResident (o motor clínico). Consequência: alguém cujo
  // ÚNICO problema fosse um sinal daqui — "pele registada como escara e sem
  // ferida aberta", por exemplo — ficava com nível 'good' e nunca subia no
  // /guardiao, que filtra por nível. Aparecia no /radar (esse olha para a
  // lista de itens) e desaparecia exatamente no turno em que há menos gente.
  // O nível passa a ser o pior dos dois; a pontuação leva um peso pequeno por
  // sinal, só para desempatar dentro do mesmo nível.
  // Só os sinais SOBRE A PESSOA sobem o nível — os "por fazer" não. A
  // distinção já existe e é a mesma que separa as duas listas: "doses por
  // registar" é verdade para toda a gente às oito da manhã e poria a casa
  // inteira em aviso; "pele registada como escara" é sobre uma pessoa.
  const PESO: Record<Severity, number> = { critical: 6, warning: 3, info: 1, good: 0 }
  let level = a.level
  let score = a.score
  for (const sig of extra) {
    if (sig.severity === 'good' || openKinds.has(sig.kind)) continue
    if (ord[sig.severity] < ord[level]) level = sig.severity
    score += PESO[sig.severity]
  }

  return {
    patientId: p.id, name: p.name, room: p.room_number,
    score, level,
    outOfPattern, openItems, note,
  }
}

/** Ordena um conjunto de utentes pelo nº/severidade de sinais (organizacional). */
export function rankByAttention(results: CareResult[]): CareResult[] {
  const ord = { critical: 0, warning: 1, info: 2, good: 3 } as Record<Severity, number>
  return [...results].sort((a, b) =>
    ord[a.level] - ord[b.level] ||
    (b.outOfPattern.length + b.openItems.length) - (a.outOfPattern.length + a.openItems.length) ||
    b.score - a.score
  )
}
