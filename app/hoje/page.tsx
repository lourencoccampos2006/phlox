'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

type Shift = 'manha' | 'tarde' | 'noite'
type Prio = 'high' | 'med' | 'low'

interface Patient { id: string; name: string; room_number?: string | null; active?: boolean }
interface CareRec { patient_id: string; shift: Shift; date: string }
interface MarRec { patient_id: string; shift: Shift; date: string; status: string | null }
interface Incident { id: string; patient_id: string; type: string; severity: string; status: string; date: string }
interface Assessment { patient_id: string; scale: string; date: string }

interface Task {
  id: string
  prio: Prio
  category: string
  title: string
  sub: string
  href: string
}

const PRIO_CFG: Record<Prio, { color: string; bg: string; border: string; dot: string; label: string }> = {
  high: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', label: 'Urgente' },
  med:  { color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', label: 'A fazer' },
  low:  { color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', label: 'Concluído' },
}

const INC_LABELS: Record<string, string> = {
  fall: 'Queda', medication_error: 'Erro de medicação', pressure_ulcer: 'Úlcera de pressão',
  behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Ocorrência',
}

function getToday() { return new Date().toISOString().slice(0, 10) }
function getShift(): Shift { const h = new Date().getHours(); if (h >= 7 && h < 14) return 'manha'; if (h >= 14 && h < 21) return 'tarde'; return 'noite' }
const SHIFT_LABEL: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export default function HojePage() {
  const { user, supabase } = useAuth() as any
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [care, setCare] = useState<CareRec[]>([])
  const [mar, setMar] = useState<MarRec[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const today = getToday()
  const shift = getShift()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const sixtyAgo = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
    const [p, c, m, i, a] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('care_records').select('patient_id,shift,date').eq('user_id', user.id).eq('date', today),
      supabase.from('mar_records').select('patient_id,shift,date,status').eq('user_id', user.id).eq('date', today),
      supabase.from('incidents').select('id,patient_id,type,severity,status,date').eq('user_id', user.id).neq('status', 'closed'),
      supabase.from('assessments').select('patient_id,scale,date').eq('user_id', user.id).gte('date', sixtyAgo),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    setCare(c.data || [])
    setMar(m.data || [])
    setIncidents(i.data || [])
    setAssessments(a.data || [])
    setLoading(false)
  }, [user, supabase, today])

  useEffect(() => { load() }, [load])

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const roomOf = (id: string) => { const r = patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }

  // Build tasks
  const tasks: Task[] = []

  // 1. Open incidents (high)
  incidents.forEach(inc => {
    const sev = inc.severity === 'critical' || inc.severity === 'major'
    tasks.push({
      id: `inc-${inc.id}`, prio: sev ? 'high' : 'med', category: 'Ocorrência aberta',
      title: `${INC_LABELS[inc.type] || 'Ocorrência'} · ${nameOf(inc.patient_id)}`,
      sub: `${roomOf(inc.patient_id)} · registada ${new Date(inc.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`.trim(),
      href: '/incidents',
    })
  })

  // 2. Refused / held meds today (high/med)
  mar.filter(r => r.status === 'refused' || r.status === 'held').forEach((r, idx) => {
    tasks.push({
      id: `mar-${r.patient_id}-${idx}`, prio: r.status === 'refused' ? 'high' : 'med',
      category: r.status === 'refused' ? 'Medicação recusada' : 'Medicação suspensa',
      title: `${nameOf(r.patient_id)}`, sub: `${roomOf(r.patient_id)} · turno ${SHIFT_LABEL[r.shift] || r.shift}`.trim(), href: '/mar',
    })
  })

  // 3. Residents without a care record this shift (med)
  const careThisShift = new Set(care.filter(c => c.shift === shift).map(c => c.patient_id))
  patients.filter(p => !careThisShift.has(p.id)).forEach(p => {
    tasks.push({
      id: `care-${p.id}`, prio: 'med', category: 'Registo diário em falta',
      title: p.name, sub: `${roomOf(p.id)} · sem registo no turno ${SHIFT_LABEL[shift]}`.trim(), href: '/care-log',
    })
  })

  // 4. Overdue Barthel (>90d or never) (med)
  const barthelByPt: Record<string, string> = {}
  assessments.filter(a => a.scale === 'barthel').forEach(a => {
    if (!barthelByPt[a.patient_id] || a.date > barthelByPt[a.patient_id]) barthelByPt[a.patient_id] = a.date
  })
  patients.forEach(p => {
    const last = barthelByPt[p.id]
    const overdue = !last || (Date.now() - new Date(last).getTime()) > 90 * 86400000
    if (overdue) {
      tasks.push({
        id: `barthel-${p.id}`, prio: 'med', category: 'Avaliação vencida',
        title: `Barthel · ${p.name}`, sub: `${roomOf(p.id)} · ${last ? `última há ${Math.floor((Date.now() - new Date(last).getTime()) / 86400000)}d` : 'nunca avaliado'}`.trim(), href: '/assessments',
      })
    }
  })

  const visible = tasks.filter(t => !dismissed.has(t.id))
  const order: Record<Prio, number> = { high: 0, med: 1, low: 2 }
  visible.sort((a, b) => order[a.prio] - order[b.prio])

  const highN = visible.filter(t => t.prio === 'high').length
  const medN = visible.filter(t => t.prio === 'med').length

  // Group by category
  const grouped = new Map<string, Task[]>()
  visible.forEach(t => { if (!grouped.has(t.category)) grouped.set(t.category, []); grouped.get(t.category)!.push(t) })
  const catOrder = Array.from(grouped.keys()).sort((a, b) => {
    const pa = Math.min(...grouped.get(a)!.map(t => order[t.prio]))
    const pb = Math.min(...grouped.get(b)!.map(t => order[t.prio]))
    return pa - pb
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Hoje · Turno {SHIFT_LABEL[shift]}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Tarefas do Turno</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 0' }}>O que precisa da tua atenção agora — gerado automaticamente a partir dos registos.</p>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { n: highN, label: 'Urgentes', c: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
            { n: medN, label: 'A fazer', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
            { n: patients.length, label: 'Residentes', c: '#0b1120', bg: 'white', bd: 'var(--border)' },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 120px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}</div>
        ) : visible.length === 0 ? (
          <div style={{ background: 'white', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>Turno em dia</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 360, margin: '0 auto' }}>Sem tarefas pendentes neste turno. Os registos, medicação e ocorrências estão todos tratados.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {catOrder.map(cat => {
              const items = grouped.get(cat)!
              const topPrio = items.reduce((acc, t) => order[t.prio] < order[acc] ? t.prio : acc, 'low' as Prio)
              const cfg = PRIO_CFG[topPrio]
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{cat}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{items.length}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(t => {
                      const cfg2 = PRIO_CFG[t.prio]
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: `1px solid var(--border)`, borderLeft: `3px solid ${cfg2.dot}`, borderRadius: 10, padding: '11px 14px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{t.sub}</div>
                          </div>
                          <Link href={t.href} style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 8, background: cfg2.bg, border: `1px solid ${cfg2.border}`, color: cfg2.color, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                            Resolver →
                          </Link>
                          <button onClick={() => setDismissed(s => new Set(s).add(t.id))} title="Adiar / ocultar"
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--ink-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
