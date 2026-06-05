'use client'

// /modo-exame — Modo Exame (Plus). Define um exame com data + tópicos.
// O Phlox gera um plano de contagem decrescente com revisão espaçada e sprint
// final. Marcas a tua confiança em cada tópico para o foco se ajustar.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface PlanDay { day: number; date_offset: number; focus: string[]; tasks: string[]; type: string }
interface Goal {
  id: string; name: string; exam_date: string; topics: string[]; daily_minutes: number
  plan: PlanDay[]; confidence: Record<string, number>
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  aprender: { label: 'Aprender', color: '#1d4ed8' },
  praticar: { label: 'Praticar', color: '#7c3aed' },
  rever: { label: 'Rever', color: '#0d6e42' },
  sprint: { label: 'Sprint', color: '#dc2626' },
}

function daysUntil(date: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((new Date(date + 'T00:00:00').getTime() - today.getTime()) / 86400000))
}

export default function ModoExamePage() {
  const { supabase } = useAuth() as any
  const [goals, setGoals] = useState<Goal[]>([])
  const [active, setActive] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const headers = await auth()
    const r = await fetch('/api/study/exam-mode', { headers })
    const j = await r.json().catch(() => ({}))
    setGoals(j.goals || [])
    if (j.goals?.length && !active) setActive(j.goals[0])
    setLoading(false)
  }, [auth, active])
  useEffect(() => { load() }, []) // eslint-disable-line

  async function setConfidence(topic: string, value: number) {
    if (!active) return
    const headers = await auth()
    const r = await fetch('/api/study/exam-mode', { method: 'POST', headers, body: JSON.stringify({ action: 'confidence', id: active.id, topic, value }) })
    const j = await r.json(); if (j.goal) { setActive(j.goal); setGoals(gs => gs.map(g => g.id === j.goal.id ? j.goal : g)) }
  }

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  if (!active && !showNew) {
    return (
      <main style={{ padding: '40px clamp(16px,4vw,32px)', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99', marginBottom: 6 }}>Modo Exame</div>
        <h1 style={{ fontSize: 'clamp(24px,5vw,34px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500, margin: '0 0 12px' }}>Tens um exame. Nós tratamos do plano.</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          Diz-nos a data e os tópicos. O Phlox cria um plano de contagem decrescente com revisão espaçada e sprint final — e ajusta o foco à tua confiança.
        </p>
        <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Criar plano de exame</button>
        {goals.length > 0 && (
          <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
            {goals.map(g => (
              <button key={g.id} onClick={() => setActive(g)} style={{ ...btn('ghost'), justifyContent: 'space-between', display: 'flex', width: '100%' }}>
                <span>{g.name}</span><span style={{ color: ACCENT, fontWeight: 700 }}>{daysUntil(g.exam_date)} dias</span>
              </button>
            ))}
          </div>
        )}
      </main>
    )
  }

  if (showNew) return <NewExam auth={auth} onClose={() => setShowNew(false)} onCreated={(g) => { setShowNew(false); setActive(g); load() }} />

  const g = active!
  const left = daysUntil(g.exam_date)
  const todayPlan = g.plan?.find(p => p.date_offset === 0) || g.plan?.[0]

  return (
    <main style={{ padding: '18px clamp(14px,4vw,32px)', maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => setActive(null)} style={{ ...btn('ghost'), marginBottom: 12 }}>← Os meus exames</button>

      {/* Countdown hero */}
      <div style={{ background: left <= 3 ? '#fef2f2' : '#f8fafc', border: `1px solid ${left <= 3 ? '#fecaca' : '#e7e8ea'}`, borderRadius: 14, padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px,4vw,26px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 600 }}>{g.name}</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{new Date(g.exam_date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} · {g.daily_minutes} min/dia</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'clamp(32px,7vw,48px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 700, lineHeight: 1, color: left <= 3 ? '#dc2626' : ACCENT }}>{left}</div>
            <div style={{ fontSize: 11, color: '#8b8f99', textTransform: 'uppercase', letterSpacing: 1 }}>{left === 1 ? 'dia' : 'dias'}</div>
          </div>
        </div>
        {left <= 3 && <div style={{ marginTop: 10, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>🔥 Modo sprint — revisão geral, sem matéria nova.</div>}
      </div>

      {/* Hoje */}
      {todayPlan && (
        <section style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Hoje</span>
            <Chip type={todayPlan.type} />
          </div>
          {todayPlan.focus?.length > 0 && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Foco: {todayPlan.focus.join(' · ')}</div>}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
            {(todayPlan.tasks || []).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}

      {/* Confiança por tópico */}
      <section style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>A tua confiança</div>
        <p style={{ fontSize: 12.5, color: '#8b8f99', margin: '0 0 12px' }}>Marca como te sentes em cada tópico — o plano dá mais foco ao que está fraco.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {g.topics.map(t => {
            const c = g.confidence?.[t] ?? 0.5
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, flex: 1, minWidth: 120 }}>{t}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['Fraco', 0.2, '#dc2626'], ['Médio', 0.5, '#d97706'], ['Bom', 0.85, '#0d6e42']].map(([label, v, color]) => (
                    <button key={label as string} onClick={() => setConfidence(t, v as number)} style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${color}`, background: Math.abs(c - (v as number)) < 0.1 ? color as string : 'white',
                      color: Math.abs(c - (v as number)) < 0.1 ? 'white' : color as string,
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Plano completo */}
      <section>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Plano completo ({g.plan?.length || 0} dias)</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {(g.plan || []).map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: d.date_offset === 0 ? '#f0fdf5' : 'white', border: '1px solid #e7e8ea', borderRadius: 10 }}>
              <div style={{ textAlign: 'center', minWidth: 42 }}>
                <div style={{ fontSize: 11, color: '#8b8f99' }}>Dia</div>
                <div style={{ fontFamily: 'var(--font-serif,serif)', fontSize: 18, fontWeight: 700 }}>{d.day}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <Chip type={d.type} />
                  {d.focus?.length > 0 && <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>{d.focus.join(' · ')}</span>}
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: '#6b7280', lineHeight: 1.6 }}>
                  {(d.tasks || []).map((t, j) => <li key={j}>{t}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Chip({ type }: { type: string }) {
  const m = TYPE_META[type] || { label: type, color: '#6b7280' }
  return <span style={{ padding: '2px 9px', borderRadius: 999, background: m.color + '18', color: m.color, fontSize: 10.5, fontWeight: 700 }}>{m.label}</span>
}

function NewExam({ auth, onClose, onCreated }: { auth: () => Promise<any>; onClose: () => void; onCreated: (g: Goal) => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [topicsText, setTopicsText] = useState('')
  const [daily, setDaily] = useState(60)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const topics = topicsText.split(/[\n,]/).map(t => t.trim()).filter(Boolean)
    if (!name.trim() || !date || topics.length === 0) { setErr('Preenche nome, data e pelo menos um tópico.'); return }
    setBusy(true); setErr('')
    try {
      const headers = await auth()
      const r = await fetch('/api/study/exam-mode', { method: 'POST', headers, body: JSON.stringify({ action: 'create', name: name.trim(), exam_date: date, topics, daily_minutes: daily }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated(j.goal)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <main style={{ padding: '24px clamp(16px,4vw,32px)', maxWidth: 560, margin: '0 auto' }}>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 14 }}>← Voltar</button>
      <h1 style={{ fontSize: 24, fontFamily: 'var(--font-serif,serif)', fontWeight: 600, margin: '0 0 16px' }}>Novo plano de exame</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <Field label="Nome do exame"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Exame de Farmacologia" style={inp} /></Field>
        <Field label="Data do exame"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
        <Field label="Tópicos (um por linha ou separados por vírgula)">
          <textarea value={topicsText} onChange={e => setTopicsText(e.target.value)} rows={5} placeholder={'Beta-bloqueadores\nIECA / ARA-II\nAnticoagulantes\nInsuficiência cardíaca'} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
        <Field label={`Minutos por dia: ${daily}`}>
          <input type="range" min={20} max={240} step={10} value={daily} onChange={e => setDaily(Number(e.target.value))} style={{ width: '100%' }} />
        </Field>
        {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 10, borderRadius: 8, fontSize: 13 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...btn('primary'), opacity: busy ? 0.6 : 1 }}>{busy ? 'A gerar plano…' : 'Gerar plano de exame'}</button>
      </form>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</div>{children}</label>
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '11px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 700, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
