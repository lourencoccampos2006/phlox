'use client'

// /study/plano — Plano de estudo gerado por IA com schedule semana-a-semana.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface ScheduleItem { week: number; day: string; topic: string; type: string; minutes: number; completed: boolean }
interface Plan {
  id: string; name: string; goal: string|null; weeks: number; hours_per_week: number
  domains: string[]; status: string; schedule: ScheduleItem[]; current_week: number
  created_at: string
}

const DOMAINS = [
  'Farmacologia','Medicina Interna','Emergência','Cirurgia','Pediatria',
  'Gineco-Obstetrícia','Anatomia e Fisiologia','Semiologia','Enfermagem','Nutrição',
]

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  theory:     { label: 'Teoria',       color: '#1d4ed8' },
  quiz:       { label: 'Quiz',         color: '#7c3aed' },
  cases:      { label: 'Casos',        color: '#dc2626' },
  flashcards: { label: 'Flashcards',   color: '#0d6e42' },
  review:     { label: 'Revisão',      color: '#b45309' },
}

export default function PlanoEstudoPage() {
  const { supabase } = useAuth() as any
  const [plans, setPlans] = useState<Plan[]>([])
  const [active, setActive] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/plan', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
      const j = await r.json().catch(() => ({}))
      // Normaliza: garante que cada plano tem arrays válidos (rows antigos podem ter null).
      const normalized: Plan[] = (j.plans || []).map((p: any) => ({
        ...p,
        schedule: Array.isArray(p?.schedule) ? p.schedule : [],
        domains: Array.isArray(p?.domains) ? p.domains : [],
        weeks: p?.weeks ?? 0,
        hours_per_week: p?.hours_per_week ?? 0,
        current_week: p?.current_week ?? 1,
      }))
      setPlans(normalized)
      if (normalized.length > 0 && !active) setActive(normalized[0])
    } catch (e: any) {
      setErr('Não foi possível carregar os planos. ' + (e?.message || ''))
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [supabase, active])

  useEffect(() => { load() }, []) // eslint-disable-line

  async function toggleDay(it: ScheduleItem) {
    if (!active) return
    const newSched = active.schedule.map(s => s.week === it.week && s.day === it.day && s.topic === it.topic
      ? { ...s, completed: !s.completed } : s)
    const newActive = { ...active, schedule: newSched }
    setActive(newActive)
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/study/plan', { method: 'PATCH', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
    }, body: JSON.stringify({ id: active.id, schedule: newSched }) })
  }

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  if (plans.length === 0 || !active) {
    return (
      <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Plano de estudo</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 18px' }}>Pede à IA para te montar um plano personalizado de semanas, com schedule diário e repetição espaçada.</p>
        <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Criar primeiro plano</button>
        {showNew && <NewPlanModal supabase={supabase} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
      </main>
    )
  }

  const sched = Array.isArray(active.schedule) ? active.schedule : []
  const completed = sched.filter(s => s.completed).length
  const total = sched.length
  const pct = total > 0 ? Math.round(100 * completed / total) : 0

  const byWeek: Record<number, ScheduleItem[]> = {}
  for (const s of sched) (byWeek[s.week] ||= []).push(s)

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{active.name}</h1>
          {active.goal && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>🎯 {active.goal}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {plans.length > 1 && (
            <select value={active.id} onChange={e => setActive(plans.find(p => p.id === e.target.value) || null)} style={input}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowNew(true)} style={btn('ghost')}>+ Novo</button>
        </div>
      </div>

      {/* Progresso */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Progresso global</span>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 700 }}>{completed} / {total} blocos · {pct}%</span>
        </div>
        <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
          <span><b>{active.weeks}</b> semanas</span>
          <span><b>{active.hours_per_week}h</b>/semana</span>
          <span>Semana actual: <b>{active.current_week}</b></span>
        </div>
      </div>

      {/* Semanas */}
      <div style={{ display: 'grid', gap: 12 }}>
        {Object.entries(byWeek).sort(([a], [b]) => Number(a) - Number(b)).map(([w, items]) => (
          <section key={w} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Semana {w}</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map((it, i) => {
                const tm = TYPE_LABELS[it.type] || { label: it.type, color: '#6b7280' }
                return (
                  <button key={`${it.week}-${it.day}-${i}`} onClick={() => toggleDay(it)} style={{
                    display: 'grid', gridTemplateColumns: '50px 100px 1fr auto', gap: 10, alignItems: 'center',
                    padding: 8, border: '1px solid #f3f4f6', borderRadius: 8, cursor: 'pointer',
                    background: it.completed ? '#f0fdf5' : 'white', textAlign: 'left',
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: it.completed ? ACCENT : '#f3f4f6', color: it.completed ? 'white' : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                    }}>{it.completed ? '✓' : ''}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{it.day}</span>
                    <span style={{ fontSize: 13, color: '#111827', textDecoration: it.completed ? 'line-through' : 'none' }}>{it.topic}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: tm.color + '15', color: tm.color, fontSize: 10, fontWeight: 700 }}>{tm.label}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{it.minutes}min</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {showNew && <NewPlanModal supabase={supabase} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </main>
  )
}

function NewPlanModal({ supabase, onClose, onCreated }: { supabase: any; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [weeks, setWeeks] = useState<number | ''>(8)
  const [hours, setHours] = useState<number | ''>(12)
  const [domains, setDomains] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(d: string) {
    setDomains(arr => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (domains.length === 0) { setErr('Escolhe pelo menos 1 domínio.'); return }
    const w = weeks === '' ? 8 : weeks
    const h = hours === '' ? 12 : hours
    if (w < 1 || h < 1) { setErr('Semanas e horas devem ser maiores que zero.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/plan', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({ name, goal, weeks: w, hours_per_week: h, domains }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>Novo plano de estudo</h3>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 6, fontSize: 12 }}>{err}</div>}
          <Field label="Nome do plano">
            <input required value={name} onChange={e => setName(e.target.value)} style={input} placeholder="ex: Preparação para PNA" />
          </Field>
          <Field label="Objectivo (opcional)">
            <input value={goal} onChange={e => setGoal(e.target.value)} style={input} placeholder="ex: passar com >75% no PNA 2027" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Duração (semanas)"><input type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
            <Field label="Horas por semana"><input type="number" min={3} max={50} value={hours} onChange={e => setHours(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
          </div>
          <Field label="Domínios (escolhe pelo menos 1)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {DOMAINS.map(d => (
                <button key={d} type="button" onClick={() => toggle(d)} style={{
                  padding: '4px 10px', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  background: domains.includes(d) ? ACCENT : '#f3f4f6',
                  color: domains.includes(d) ? 'white' : '#374151', fontWeight: 600,
                }}>{d}</button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
            <button type="submit" disabled={busy || !name || domains.length === 0} style={btn('primary')}>{busy ? 'A gerar plano…' : 'Gerar plano IA'}</button>
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0, textAlign: 'center' }}>
            A IA pode demorar 20-40s a montar o plano completo.
          </p>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    {children}
  </label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
