'use client'

// ─── PHLOX MODO EXAME ─────────────────────────────────────────────────────────
// Define um exame com data + tópicos. A IA gera um plano de contagem
// decrescente (revisão espaçada, sprint final nos últimos dias) — sprint78
// já tinha toda esta infraestrutura construída (exam_goals + /api/study/
// exam-mode) mas /modo-exame era só um redirect morto para /study, sem
// nenhuma página real a usá-la. Esta é essa página.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { logStudy } from '@/lib/studyProgress'

const ACCENT = '#7c3aed'
const URGENT = '#dc2626'

interface PlanDay {
  day: number; date_offset: number; focus: string[]; tasks: string[]
  type: 'aprender' | 'praticar' | 'rever' | 'sprint'; completed?: boolean
}
interface ExamGoal {
  id: string; name: string; exam_date: string; topics: string[]
  daily_minutes: number; plan: PlanDay[]; confidence: Record<string, number>
  status: string; created_at: string; updated_at: string
}
interface WeakTopic { topic: string; attempts: number; correct: number; accuracy: number | null; minutes: number; level: string }

const TYPE_META: Record<string, { label: string; color: string }> = {
  aprender: { label: 'Aprender', color: '#1d4ed8' },
  praticar: { label: 'Praticar', color: '#7c3aed' },
  rever: { label: 'Rever', color: '#0d6e42' },
  sprint: { label: 'Sprint final', color: URGENT },
}

const dateOnly = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c }
const fmtDate = (d: Date) => d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
function dayDate(goal: ExamGoal, day: PlanDay): Date {
  const base = dateOnly(new Date(goal.created_at))
  base.setDate(base.getDate() + (day.date_offset || 0))
  return base
}
function daysUntil(examDate: string): number {
  const exam = dateOnly(new Date(examDate + 'T00:00:00'))
  const today = dateOnly(new Date())
  return Math.round((exam.getTime() - today.getTime()) / 86400000)
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'block' }

export default function ModoExamePage() {
  const { user, supabase } = useAuth() as any
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const [goals, setGoals] = useState<ExamGoal[]>([])
  const [selected, setSelected] = useState<ExamGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await auth()
      const r = await fetch('/api/study/exam-mode', { headers })
      const j = await r.json().catch(() => ({}))
      const list: ExamGoal[] = Array.isArray(j.goals) ? j.goals : []
      setGoals(list)
      setSelected(prev => prev ? list.find(g => g.id === prev.id) || null : null)
    } finally { setLoading(false) }
  }, [auth])

  useEffect(() => { if (isStudent && user) load() }, [isStudent, user, load])

  async function archiveGoal(id: string) {
    const headers = await auth()
    await fetch(`/api/study/exam-mode?id=${id}`, { method: 'DELETE', headers })
    setSelected(null)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function toggleDay(goal: ExamGoal, day: PlanDay) {
    const headers = await auth()
    // Otimista
    const optimistic = { ...goal, plan: goal.plan.map(d => d.day === day.day ? { ...d, completed: !d.completed } : d) }
    setSelected(optimistic)
    setGoals(prev => prev.map(g => g.id === goal.id ? optimistic : g))
    try {
      const r = await fetch('/api/study/exam-mode', { method: 'POST', headers, body: JSON.stringify({ action: 'toggle-day', id: goal.id, day: day.day }) })
      const j = await r.json().catch(() => ({}))
      if (j.goal) { setSelected(j.goal); setGoals(prev => prev.map(g => g.id === goal.id ? j.goal : g)) }
      if (!day.completed) logStudy({ kind: 'exam', area: day.focus?.[0] })
    } catch { /* fica otimista */ }
  }

  async function setConfidence(goal: ExamGoal, topic: string, value: number) {
    const headers = await auth()
    const optimistic = { ...goal, confidence: { ...goal.confidence, [topic]: value } }
    setSelected(optimistic)
    setGoals(prev => prev.map(g => g.id === goal.id ? optimistic : g))
    try {
      const r = await fetch('/api/study/exam-mode', { method: 'POST', headers, body: JSON.stringify({ action: 'confidence', id: goal.id, topic, value }) })
      const j = await r.json().catch(() => ({}))
      if (j.goal) { setSelected(j.goal); setGoals(prev => prev.map(g => g.id === goal.id ? j.goal : g)) }
    } catch { /* fica otimista */ }
  }

  if (!isStudent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Modo Exame</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Define a data do exame e os tópicos. A IA monta um plano de contagem decrescente com revisão espaçada e sprint final nos últimos dias. Exclusivo Plus.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: ACCENT, color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver plano Plus →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 780 }}>

        {!selected && !creating && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: ACCENT, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 2, background: ACCENT, borderRadius: 1 }} />Modo Exame · Plus
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 8 }}>
                  Contagem decrescente até ao exame
                </h1>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 520 }}>
                  Define a data e os tópicos. O plano distribui-os com revisão espaçada e vira sprint (só revisão, sem matéria nova) nos últimos dias.
                </p>
              </div>
              <button onClick={() => setCreating(true)} style={{ padding: '11px 20px', background: ACCENT, color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Novo objetivo
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
              </div>
            ) : goals.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 10 }}>Ainda sem exame a contar</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px' }}>
                  Cria o primeiro objetivo — data do exame e os tópicos que entram. O resto do plano é gerado por ti.
                </p>
                <button onClick={() => setCreating(true)} style={{ padding: '11px 24px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Criar primeiro objetivo →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {goals.map(g => <GoalCard key={g.id} goal={g} onOpen={() => setSelected(g)} />)}
              </div>
            )}
          </>
        )}

        {creating && (
          <CreateForm
            auth={auth}
            onCancel={() => setCreating(false)}
            onCreated={(g) => { setGoals(prev => [g, ...prev]); setSelected(g); setCreating(false) }}
          />
        )}

        {selected && !creating && (
          <GoalDetail
            goal={selected}
            onBack={() => setSelected(null)}
            onArchive={() => archiveGoal(selected.id)}
            onToggleDay={(d) => toggleDay(selected, d)}
            onSetConfidence={(topic, v) => setConfidence(selected, topic, v)}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
function GoalCard({ goal, onOpen }: { goal: ExamGoal; onOpen: () => void }) {
  const days = daysUntil(goal.exam_date)
  const urgent = days <= 3
  const total = goal.plan?.length || 1
  const done = goal.plan?.filter(d => d.completed).length || 0
  const pct = Math.round((done / total) * 100)

  return (
    <button onClick={onOpen} className="exam-goal-card" style={{ display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', width: '100%' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: urgent ? '#fee2e2' : '#ede9fe', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: urgent ? URGENT : ACCENT, lineHeight: 1 }}>{days >= 0 ? days : 0}</span>
        <span style={{ fontSize: 8, color: urgent ? URGENT : ACCENT, fontWeight: 700 }}>DIAS</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 3 }}>{goal.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
          {days < 0 ? 'Exame já passou' : `Exame a ${new Date(goal.exam_date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })}`} · {done}/{total} dias feitos
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {goal.topics.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 10.5, color: '#581c87', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '2px 8px', borderRadius: 20 }}>{t}</span>
          ))}
          {goal.topics.length > 4 && <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>+{goal.topics.length - 4}</span>}
        </div>
      </div>
      <div style={{ width: 60, flexShrink: 0 }}>
        <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: ACCENT }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'right', marginTop: 3 }}>{pct}%</div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
function GoalDetail({ goal, onBack, onArchive, onToggleDay, onSetConfidence }: {
  goal: ExamGoal; onBack: () => void; onArchive: () => void
  onToggleDay: (d: PlanDay) => void; onSetConfidence: (topic: string, value: number) => void
}) {
  const days = daysUntil(goal.exam_date)
  const urgent = days <= 3
  const plan = Array.isArray(goal.plan) ? [...goal.plan].sort((a, b) => a.day - b.day) : []
  const today = dateOnly(new Date())

  // Dia de hoje: o primeiro cuja data ainda não passou (ou o último, se o plano já acabou).
  const todayDay = plan.find(d => dayDate(goal, d).getTime() >= today.getTime()) || plan[plan.length - 1]

  const weeks: Record<number, PlanDay[]> = {}
  plan.forEach(d => { const w = Math.floor((d.day - 1) / 7); (weeks[w] ||= []).push(d) })

  const lowConfidenceTopics = new Set(Object.entries(goal.confidence || {}).filter(([, v]) => v < 0.5).map(([t]) => t))

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>← Os meus objetivos</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>{goal.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            Exame a {new Date(goal.exam_date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} · {goal.daily_minutes} min/dia
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: urgent ? URGENT : ACCENT, lineHeight: 1 }}>{days >= 0 ? days : 0}</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{days >= 0 ? 'dias faltam' : 'já passou'}</div>
          </div>
          <button onClick={onArchive} style={{ padding: '8px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer' }}>Arquivar</button>
        </div>
      </div>

      {/* Hoje */}
      {todayDay && (
        <div style={{ ...card, marginBottom: 16, borderColor: todayDay.type === 'sprint' ? '#fca5a5' : '#e9d5ff', background: todayDay.type === 'sprint' ? '#fef2f2' : '#faf5ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TYPE_META[todayDay.type]?.color || ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {todayDay.type === 'sprint' ? '🏁 Hoje · Sprint final' : `Hoje · Dia ${todayDay.day}`}
            </div>
            <button onClick={() => onToggleDay(todayDay)} style={{ padding: '6px 12px', background: todayDay.completed ? ACCENT : 'white', color: todayDay.completed ? 'white' : ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              {todayDay.completed ? '✓ Feito' : 'Marcar como feito'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {todayDay.focus.map(f => <span key={f} style={{ fontSize: 12, fontWeight: 700, color: '#581c87', background: 'white', border: '1px solid #e9d5ff', padding: '3px 10px', borderRadius: 20 }}>{f}</span>)}
          </div>
          {todayDay.type === 'sprint' && (
            <div style={{ fontSize: 12.5, color: '#991b1b', marginBottom: 8, fontStyle: 'italic' }}>Sem matéria nova — só revisão geral e simulacro de exame.</div>
          )}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            {todayDay.tasks.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {/* Confiança por tópico */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Confiança por tópico</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goal.topics.map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1, minWidth: 140 }}>{t}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['Baixa', 0.25, '#dc2626'], ['Média', 0.6, '#d97706'], ['Alta', 0.9, '#0d6e42']] as [string, number, string][]).map(([lbl, v, c]) => {
                  const cur = goal.confidence?.[t]
                  const active = cur != null && Math.abs(cur - v) < 0.2
                  return (
                    <button key={lbl} onClick={() => onSetConfidence(t, v)} style={{ padding: '5px 10px', borderRadius: 6, border: `1.5px solid ${active ? c : 'var(--border)'}`, background: active ? c : 'white', color: active ? 'white' : 'var(--ink-4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plano completo */}
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Plano completo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(weeks).map(([w, days2]) => (
          <div key={w} style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 }}>Semana {Number(w) + 1}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {days2.map(d => {
                const tm = TYPE_META[d.type] || { label: d.type, color: 'var(--ink-4)' }
                const priority = d.focus.some(f => lowConfidenceTopics.has(f))
                return (
                  <div key={d.day} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: priority ? '#fef2f2' : 'var(--bg-2)' }}>
                    <button onClick={() => onToggleDay(d)} style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', flexShrink: 0, marginTop: 1, background: d.completed ? ACCENT : 'white', color: d.completed ? 'white' : 'var(--ink-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 0 1.5px var(--border) inset' }}>
                      {d.completed ? '✓' : ''}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{fmtDate(dayDate(goal, d))}</span>
                        <span style={{ padding: '1px 8px', borderRadius: 999, background: tm.color + '18', color: tm.color, fontSize: 10, fontWeight: 700 }}>{tm.label}</span>
                        {priority && <span style={{ fontSize: 10, color: URGENT, fontWeight: 700 }}>⚑ prioridade</span>}
                      </div>
                      <div style={{ fontSize: 13, color: d.completed ? 'var(--ink-5)' : 'var(--ink)', textDecoration: d.completed ? 'line-through' : 'none' }}>{d.focus.join(' · ')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
function CreateForm({ auth, onCancel, onCreated }: { auth: () => Promise<any>; onCancel: () => void; onCreated: (g: ExamGoal) => void }) {
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(60)
  const [topics, setTopics] = useState<string[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [weak, setWeak] = useState<{ focus: WeakTopic[]; blindspots: WeakTopic[]; guidance: string } | null>(null)
  const [weakLoading, setWeakLoading] = useState(false)

  function addTopic(t: string) {
    const cp = t.trim()
    if (!cp || topics.includes(cp)) return
    setTopics(prev => [...prev, cp])
  }

  async function suggestFromPerformance() {
    setWeakLoading(true)
    try {
      const headers = await auth()
      const r = await fetch('/api/study/weakspots', { method: 'POST', headers })
      const j = await r.json().catch(() => ({}))
      if (r.ok) setWeak({ focus: j.focus || [], blindspots: j.blindspots || [], guidance: j.guidance || '' })
    } finally { setWeakLoading(false) }
  }

  const minDate = new Date().toISOString().slice(0, 10)
  const canSubmit = name.trim() && examDate && topics.length > 0 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true); setErr('')
    try {
      const headers = await auth()
      const r = await fetch('/api/study/exam-mode', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'create', name: name.trim(), exam_date: examDate, topics, daily_minutes: dailyMinutes }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não foi possível criar o plano.')
      onCreated(j.goal)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...card, maxWidth: 600 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>Novo objetivo de exame</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Nome do exame *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Frequência de Farmacologia" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Data do exame *</label>
            <input type="date" value={examDate} min={minDate} onChange={e => setExamDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Minutos por dia</label>
            <input type="number" min={15} max={240} step={5} value={dailyMinutes} onChange={e => setDailyMinutes(Number(e.target.value) || 60)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tópicos que entram *</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && topicInput.trim()) { e.preventDefault(); addTopic(topicInput); setTopicInput('') } }}
              placeholder="Escreve um tópico e Enter…" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => { if (topicInput.trim()) { addTopic(topicInput); setTopicInput('') } }} style={{ padding: '0 16px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', cursor: 'pointer' }}>+</button>
          </div>
          {topics.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {topics.map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#581c87', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '4px 6px 4px 10px', borderRadius: 20 }}>
                  {t}
                  <button onClick={() => setTopics(prev => prev.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <button onClick={suggestFromPerformance} disabled={weakLoading} style={{ padding: '8px 14px', background: 'white', border: '1.5px dashed #e9d5ff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
            {weakLoading ? 'A analisar o teu desempenho…' : '💡 Sugerir a partir do meu desempenho'}
          </button>
          {weak && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
              {weak.guidance && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8, fontStyle: 'italic' }}>{weak.guidance}</div>}
              {[...weak.focus, ...weak.blindspots].length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Ainda sem histórico suficiente para sugerir — usa quizzes/flashcards primeiro.</div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...weak.focus, ...weak.blindspots].map(w => (
                    <button key={w.topic} onClick={() => addTopic(w.topic)} disabled={topics.includes(w.topic)}
                      style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 20, border: `1px solid ${w.level === 'fraco' ? '#fca5a5' : 'var(--border)'}`, background: topics.includes(w.topic) ? 'var(--bg-3)' : 'white', color: w.level === 'fraco' ? URGENT : 'var(--ink-3)', cursor: topics.includes(w.topic) ? 'default' : 'pointer' }}>
                      {w.topic}{w.accuracy != null ? ` · ${w.accuracy}%` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {err && <div style={{ padding: '9px 11px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12.5, color: '#991b1b' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={!canSubmit} style={{ flex: 1, padding: 12, background: canSubmit ? ACCENT : 'var(--bg-3)', color: canSubmit ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 9, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 800 }}>
            {busy ? 'A gerar o plano…' : 'Criar plano →'}
          </button>
          <button onClick={onCancel} style={{ padding: '12px 18px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
