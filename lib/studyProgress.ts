// lib/studyProgress.ts
// Camada PARTILHADA de progresso de estudo. Qualquer ferramenta do modo
// estudante (quiz, arena, flashcards, ECG, OSCE, tutor, estágio…) regista aqui
// a atividade do dia. Daí saem: streak, XP, meta diária, "continuar onde ficaste"
// e áreas fracas — surgidas de forma CONSISTENTE em /aprender e nos hubs.
//
// localStorage puro (privacidade + zero rede), tal como lib/saves.ts. Pronto a
// sincronizar para Supabase no futuro sem mexer nas ferramentas.

export type StudyActivityKind =
  | 'quiz' | 'flashcard' | 'case' | 'ecg' | 'osce' | 'tutor'
  | 'notes' | 'reading' | 'anatomy' | 'lab' | 'procedure' | 'exam'

export interface StudyEvent {
  kind: StudyActivityKind
  area?: string            // domínio/especialidade (ex: "Cardiologia")
  correct?: boolean        // para atividades avaliadas (quiz/flashcard/case)
  xp?: number              // XP ganho (default por kind)
  at: string               // ISO
}

export interface LastTool { href: string; label: string; at: string }

export interface StudyProgress {
  events: StudyEvent[]     // histórico recente (cap)
  lastTool?: LastTool      // para "continuar onde ficaste"
  dailyGoal: number        // meta de XP por dia
}

const LS_KEY = 'phlox-study-progress-v1'
const MAX_EVENTS = 800
export const STUDY_EVENT = 'phlox-study-changed'

const DEFAULT_XP: Record<StudyActivityKind, number> = {
  quiz: 10, flashcard: 5, case: 25, ecg: 15, osce: 30, tutor: 8,
  notes: 6, reading: 4, anatomy: 6, lab: 10, procedure: 8, exam: 20,
}

function read(): StudyProgress {
  if (typeof localStorage === 'undefined') return { events: [], dailyGoal: 50 }
  try {
    const r = localStorage.getItem(LS_KEY)
    if (!r) return { events: [], dailyGoal: 50 }
    const o = JSON.parse(r)
    return { events: Array.isArray(o.events) ? o.events : [], lastTool: o.lastTool, dailyGoal: o.dailyGoal || 50 }
  } catch { return { events: [], dailyGoal: 50 } }
}
function write(p: StudyProgress) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...p, events: p.events.slice(0, MAX_EVENTS) }))
    window.dispatchEvent(new CustomEvent(STUDY_EVENT))
    schedulePush()   // espelha na conta (best-effort, debounced) — cross-device
  } catch { /* quota */ }
}

// ─── Sincronização com a conta (Supabase) ──────────────────────────────────────
// localStorage continua a ser a fonte SÍNCRONA (summarize() instantâneo, zero
// breaking nos callers). A conta é write-through (debounced) + merge no arranque.
// Tudo best-effort: sem sessão/rede/tabela → fica local, exatamente como antes.

function authToken(): string | null {
  try {
    const raw = localStorage.getItem('phlox-auth')   // storageKey do AuthContext
    if (!raw) return null
    return JSON.parse(raw)?.access_token || null
  } catch { return null }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush() {
  if (typeof window === 'undefined') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushTimer = null; pushToAccount() }, 2500)
}

async function pushToAccount() {
  const token = authToken()
  if (!token) return
  const p = read()
  try {
    await fetch('/api/study/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: p.events.slice(0, MAX_EVENTS), daily_goal: p.dailyGoal, last_tool: p.lastTool || null }),
    })
  } catch { /* offline — fica local, tenta na próxima escrita */ }
}

// Funde dois conjuntos de eventos por `at` (dedup), mais recente primeiro.
function mergeEvents(a: StudyEvent[], b: StudyEvent[]): StudyEvent[] {
  const seen = new Set<string>()
  const out: StudyEvent[] = []
  for (const e of [...a, ...b]) {
    const k = `${e.at}|${e.kind}|${e.area || ''}`
    if (seen.has(k)) continue
    seen.add(k); out.push(e)
  }
  out.sort((x, y) => (x.at < y.at ? 1 : -1))
  return out.slice(0, MAX_EVENTS)
}

let synced = false
/**
 * Ao autenticar: lê o progresso da conta e funde-o com o local (sem perder nada),
 * depois reescreve (o que também faz push do conjunto fundido). Chamar 1x no arranque
 * autenticado (ex.: no /inicio). Idempotente por sessão.
 */
export async function syncStudyProgress(): Promise<void> {
  if (synced || typeof window === 'undefined') return
  const token = authToken()
  if (!token) return
  synced = true
  try {
    const res = await fetch('/api/study/progress', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const remote = await res.json()
    if (remote?.needs_migration) return   // sprint96 não corrido → fica local
    const local = read()
    const merged: StudyProgress = {
      events: mergeEvents(local.events, Array.isArray(remote.events) ? remote.events : []),
      // mantém a meta/última-ferramenta mais recentes
      dailyGoal: remote.daily_goal || local.dailyGoal || 50,
      lastTool: pickNewerTool(local.lastTool, remote.last_tool),
    }
    write(merged)   // grava local + agenda push do conjunto fundido
  } catch { /* fica local */ }
}

function pickNewerTool(a?: LastTool, b?: LastTool | null): LastTool | undefined {
  if (!a) return b || undefined
  if (!b) return a
  return new Date(a.at) >= new Date(b.at) ? a : b
}

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10)

// ─── API pública ──────────────────────────────────────────────────────────────

export function logStudy(ev: Omit<StudyEvent, 'at' | 'xp'> & { xp?: number }): void {
  const p = read()
  const full: StudyEvent = { ...ev, xp: ev.xp ?? DEFAULT_XP[ev.kind] ?? 5, at: new Date().toISOString() }
  p.events = [full, ...p.events]
  write(p)
}

/** Regista a última ferramenta aberta (para "continuar onde ficaste"). */
export function setLastTool(href: string, label: string): void {
  const p = read()
  p.lastTool = { href, label, at: new Date().toISOString() }
  write(p)
}

export function setDailyGoal(xp: number): void {
  const p = read(); p.dailyGoal = Math.max(10, Math.min(500, Math.round(xp))); write(p)
}

export function getProgress(): StudyProgress { return read() }

export interface StudySummary {
  streak: number           // dias consecutivos com atividade (até hoje/ontem)
  xpToday: number
  xpTotal: number
  dailyGoal: number
  goalPct: number          // 0..100
  level: number
  reviewedToday: number    // nº de atividades avaliadas hoje
  accuracy7d: number | null// % acerto últimos 7 dias (quiz/flashcard/case)
  lastTool?: LastTool
  weakAreas: { area: string; accuracy: number; n: number }[]
  activeDays: Set<string>
}

export function summarize(now = new Date()): StudySummary {
  const p = read()
  const todayK = dayKey(now)
  const days = new Set<string>()
  let xpToday = 0, xpTotal = 0, reviewedToday = 0
  const areaAgg: Record<string, { ok: number; n: number }> = {}
  const cut7 = now.getTime() - 7 * 86400_000
  let ok7 = 0, n7 = 0

  for (const e of p.events) {
    const k = dayKey(e.at)
    days.add(k)
    xpTotal += e.xp || 0
    if (k === todayK) {
      xpToday += e.xp || 0
      if (typeof e.correct === 'boolean') reviewedToday++
    }
    if (typeof e.correct === 'boolean') {
      const t = new Date(e.at).getTime()
      if (t >= cut7) { n7++; if (e.correct) ok7++ }
      if (e.area) {
        const a = (areaAgg[e.area] ||= { ok: 0, n: 0 })
        a.n++; if (e.correct) a.ok++
      }
    }
  }

  // streak: conta dias consecutivos com atividade, terminando hoje ou ontem
  let streak = 0
  for (let k = 0; k < 365; k++) {
    const d = new Date(now); d.setDate(d.getDate() - k)
    if (days.has(dayKey(d))) streak++
    else if (k > 0) break  // hoje pode ainda não ter atividade — não quebra
  }

  const weakAreas = Object.entries(areaAgg)
    .filter(([, v]) => v.n >= 3)
    .map(([area, v]) => ({ area, accuracy: Math.round((v.ok / v.n) * 100), n: v.n }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)

  const goal = p.dailyGoal || 50
  return {
    streak, xpToday, xpTotal, dailyGoal: goal,
    goalPct: Math.min(100, Math.round((xpToday / goal) * 100)),
    level: Math.floor(xpTotal / 500) + 1,
    reviewedToday,
    accuracy7d: n7 ? Math.round((ok7 / n7) * 100) : null,
    lastTool: p.lastTool,
    weakAreas,
    activeDays: days,
  }
}
