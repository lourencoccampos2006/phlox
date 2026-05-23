'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { printDoc, type PrintRecord } from '@/lib/print'

type Shift = 'manha' | 'tarde' | 'noite'
type Tab = 'tarefas' | 'ronda' | 'passagem'
type Prio = 'high' | 'med'
type StatusTag = 'estavel' | 'vigiar' | 'alerta'

interface Patient {
  id: string; name: string; room_number?: string | null; age?: number | null
  conditions?: string | null; allergies?: string | null
  risk_level?: string | null; fall_risk?: string | null; pressure_risk?: string | null; active?: boolean
}
interface CareRec { patient_id: string; shift: Shift; date: string; notes?: string | null; mood?: any }
interface MarRec { patient_id: string; shift: Shift; date: string; status: string | null }
interface Incident { id: string; patient_id: string; type: string; severity: string; status: string; date: string; description?: string }
interface Assessment { patient_id: string; scale: string; date: string }

const INC_LABELS: Record<string, string> = { fall: 'Queda', medication_error: 'Erro de medicação', pressure_ulcer: 'Úlcera de pressão', behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Ocorrência' }
const SHIFT_LABEL: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const STATUS_CFG: Record<StatusTag, { label: string; color: string; bg: string; border: string }> = {
  estavel: { label: 'Estável', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  vigiar:  { label: 'Vigiar',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  alerta:  { label: 'Alerta',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
}
const PRIO_CFG: Record<Prio, { color: string; bg: string; border: string; dot: string }> = {
  high: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  med:  { color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
}

function getToday() { return new Date().toISOString().slice(0, 10) }
function getShift(): Shift { const h = new Date().getHours(); if (h >= 7 && h < 14) return 'manha'; if (h >= 14 && h < 21) return 'tarde'; return 'noite' }
function roomKey(r?: string | null) { if (!r) return 999999; const n = parseInt(String(r).replace(/[^0-9]/g, '')); return isNaN(n) ? 999998 : n }
const isHighRisk = (p: Patient) => ['CRITICO', 'ALTO'].includes((p.risk_level || '').toUpperCase()) || p.fall_risk === 'high' || p.pressure_risk === 'high'

export default function TurnoPage() {
  const { user, supabase } = useAuth() as any
  const [tab, setTab] = useState<Tab>('tarefas')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [care, setCare] = useState<CareRec[]>([])
  const [mar, setMar] = useState<MarRec[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])

  const today = getToday()
  const shift = getShift()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
    const [p, c, m, i, a] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id),
      supabase.from('care_records').select('patient_id,shift,date,notes,mood').eq('user_id', user.id).eq('date', today),
      supabase.from('mar_records').select('patient_id,shift,date,status').eq('user_id', user.id).eq('date', today),
      supabase.from('incidents').select('id,patient_id,type,severity,status,date,description').eq('user_id', user.id).neq('status', 'closed'),
      supabase.from('assessments').select('patient_id,scale,date').eq('user_id', user.id).gte('date', since),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false).sort((a: Patient, b: Patient) => roomKey(a.room_number) - roomKey(b.room_number) || a.name.localeCompare(b.name)))
    setCare(c.data || []); setMar(m.data || []); setIncidents(i.data || []); setAssessments(a.data || [])
    setLoading(false)
  }, [user, supabase, today])

  useEffect(() => { load() }, [load])

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const roomOf = (id: string) => { const r = patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 920 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Hoje · Turno {SHIFT_LABEL[shift]}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Centro de Turno</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {([['tarefas', 'Tarefas'], ['ronda', 'Ronda guiada'], ['passagem', 'Passagem']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', borderRadius: 9, fontFamily: 'var(--font-sans)',
              border: `1.5px solid ${tab === t ? '#0d6e42' : 'var(--border)'}`,
              background: tab === t ? '#eef6f1' : 'white', color: tab === t ? '#0d6e42' : 'var(--ink-4)',
              fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}</div>
        ) : tab === 'tarefas' ? (
          <TarefasTab patients={patients} care={care} mar={mar} incidents={incidents} assessments={assessments} shift={shift} nameOf={nameOf} roomOf={roomOf} />
        ) : tab === 'ronda' ? (
          <RondaTab patients={patients} shift={shift} today={today} supabase={supabase} user={user} />
        ) : (
          <PassagemTab patients={patients} care={care} mar={mar} incidents={incidents} shift={shift} nameOf={nameOf} roomOf={roomOf} />
        )}
      </div>
    </div>
  )
}

// ─── TAREFAS ────────────────────────────────────────────────────────────────

function TarefasTab({ patients, care, mar, incidents, assessments, shift, nameOf, roomOf }: any) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  interface Task { id: string; prio: Prio; category: string; title: string; sub: string; href: string }
  const tasks: Task[] = []

  incidents.forEach((inc: Incident) => {
    const sev = inc.severity === 'critical' || inc.severity === 'major'
    tasks.push({ id: `inc-${inc.id}`, prio: sev ? 'high' : 'med', category: 'Ocorrência aberta', title: `${INC_LABELS[inc.type] || 'Ocorrência'} · ${nameOf(inc.patient_id)}`, sub: `${roomOf(inc.patient_id)}`.trim(), href: '/incidents' })
  })
  mar.filter((r: MarRec) => r.status === 'refused' || r.status === 'held').forEach((r: MarRec, idx: number) => {
    tasks.push({ id: `mar-${r.patient_id}-${idx}`, prio: r.status === 'refused' ? 'high' : 'med', category: r.status === 'refused' ? 'Medicação recusada' : 'Medicação suspensa', title: nameOf(r.patient_id), sub: `${roomOf(r.patient_id)} · ${SHIFT_LABEL[r.shift] || r.shift}`.trim(), href: '/mar' })
  })
  const careThisShift = new Set(care.filter((c: CareRec) => c.shift === shift).map((c: CareRec) => c.patient_id))
  patients.filter((p: Patient) => !careThisShift.has(p.id)).forEach((p: Patient) => {
    tasks.push({ id: `care-${p.id}`, prio: 'med', category: 'Registo diário em falta', title: p.name, sub: `${roomOf(p.id)}`.trim(), href: '/care-log' })
  })
  const barthel: Record<string, string> = {}
  assessments.filter((a: Assessment) => a.scale === 'barthel').forEach((a: Assessment) => { if (!barthel[a.patient_id] || a.date > barthel[a.patient_id]) barthel[a.patient_id] = a.date })
  patients.forEach((p: Patient) => {
    const last = barthel[p.id]
    if (!last || (Date.now() - new Date(last).getTime()) > 90 * 86400000) tasks.push({ id: `bar-${p.id}`, prio: 'med', category: 'Avaliação vencida', title: `Barthel · ${p.name}`, sub: `${roomOf(p.id)} · ${last ? `há ${Math.floor((Date.now() - new Date(last).getTime()) / 86400000)}d` : 'nunca'}`.trim(), href: '/assessments' })
  })

  const visible = tasks.filter(t => !dismissed.has(t.id))
  const order: Record<Prio, number> = { high: 0, med: 1 }
  visible.sort((a, b) => order[a.prio] - order[b.prio])
  const grouped = new Map<string, Task[]>()
  visible.forEach(t => { if (!grouped.has(t.category)) grouped.set(t.category, []); grouped.get(t.category)!.push(t) })
  const cats = Array.from(grouped.keys()).sort((a, b) => Math.min(...grouped.get(a)!.map(t => order[t.prio])) - Math.min(...grouped.get(b)!.map(t => order[t.prio])))
  const highN = visible.filter(t => t.prio === 'high').length

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {[{ n: highN, l: 'Urgentes', c: '#dc2626', bg: '#fef2f2', bd: '#fecaca' }, { n: visible.length - highN, l: 'A fazer', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' }, { n: patients.length, l: 'Residentes', c: '#0b1120', bg: 'white', bd: 'var(--border)' }].map(s => (
          <div key={s.l} style={{ flex: '1 1 110px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{s.n}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      {visible.length === 0 ? (
        <div style={{ background: 'white', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '44px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>Turno em dia</div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem tarefas pendentes neste turno.</div>
        </div>
      ) : cats.map(cat => {
        const items = grouped.get(cat)!
        const cfg = PRIO_CFG[items.reduce((acc, t) => order[t.prio] < order[acc] ? t.prio : acc, 'med' as Prio)]
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{cat}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{items.length}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(t => {
                const c2 = PRIO_CFG[t.prio]
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${c2.dot}`, borderRadius: 10, padding: '11px 14px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                      {t.sub && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{t.sub}</div>}
                    </div>
                    <Link href={t.href} style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 8, background: c2.bg, border: `1px solid ${c2.border}`, color: c2.color, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Resolver →</Link>
                    <button onClick={() => setDismissed(s => new Set(s).add(t.id))} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--ink-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  )
}

// ─── RONDA ──────────────────────────────────────────────────────────────────

function RondaTab({ patients, shift, today, supabase, user }: any) {
  const [idx, setIdx] = useState(0)
  const [status, setStatus] = useState<StatusTag | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<Record<string, StatusTag>>({})
  const [finished, setFinished] = useState(false)

  const total = patients.length
  const current = patients[idx]
  function reset() { setStatus(null); setNote('') }
  function advance() { reset(); if (idx + 1 >= total) setFinished(true); else setIdx(i => i + 1) }

  async function saveNext() {
    if (!user || !current) return
    setSaving(true)
    await supabase.from('care_records').upsert({ user_id: user.id, patient_id: current.id, date: today, shift, mood: { behavior: status ? STATUS_CFG[status].label : null }, notes: note.trim() || null }, { onConflict: 'patient_id,date,shift' })
    setDone(d => ({ ...d, [current.id]: status || 'estavel' }))
    setSaving(false); advance()
  }

  if (total === 0) return <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>Sem residentes. <Link href="/patients" style={{ color: '#0d6e42' }}>Adicionar →</Link></div>

  if (finished) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>Ronda concluída</div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 4 }}>{Object.keys(done).length} de {total} registados</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {patients.map((p: Patient) => {
            const d = done[p.id]; const cfg = d ? STATUS_CFG[d] : null
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', width: 44 }}>{p.room_number ? `Q${p.room_number}` : '—'}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                {cfg ? <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 9px', borderRadius: 6 }}>{cfg.label}</span> : <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>—</span>}
              </div>
            )
          })}
        </div>
        <button onClick={() => { setIdx(0); setFinished(false); setDone({}); reset() }} style={{ width: '100%', padding: '12px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>Nova ronda</button>
      </div>
    )
  }

  const hr = current && isHighRisk(current)
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ronda</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{idx + 1} de {total}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((idx / total) * 100)}%`, background: '#0d6e42', borderRadius: 3, transition: 'width 0.3s' }} /></div>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: hr ? '#fef2f2' : 'var(--bg-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>{current.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{current.room_number ? `Quarto ${current.room_number}` : 'Sem quarto'}{current.age ? ` · ${current.age} anos` : ''}</div>
            </div>
            {hr && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: 20 }}>Alto risco</span>}
          </div>
          {current.allergies && <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, color: '#92400e' }}><strong>Alergias:</strong> {current.allergies}</div>}
          {current.conditions && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-3)' }}>{current.conditions}</div>}
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Estado no turno</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {(Object.keys(STATUS_CFG) as StatusTag[]).map(s => {
              const cfg = STATUS_CFG[s]; const active = status === s
              return <button key={s} onClick={() => setStatus(active ? null : s)} style={{ padding: '13px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: `2px solid ${active ? cfg.color : 'var(--border)'}`, background: active ? cfg.bg : 'white', color: active ? cfg.color : 'var(--ink-3)', fontSize: 14, fontWeight: active ? 700 : 600 }}>{cfg.label}</button>
            })}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Nota rápida (opcional)..." style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={() => { if (idx > 0) { reset(); setIdx(i => i - 1) } }} disabled={idx === 0} style={{ width: 52, padding: '14px 0', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button onClick={advance} style={{ flex: 1, padding: '14px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>Saltar</button>
        <button onClick={saveNext} disabled={saving} style={{ flex: 2, padding: '14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : idx + 1 >= total ? 'Guardar e terminar' : 'Guardar e seguinte →'}</button>
      </div>
    </div>
  )
}

// ─── PASSAGEM ───────────────────────────────────────────────────────────────

function PassagemTab({ patients, care, mar, incidents, shift, nameOf, roomOf }: any) {
  const [signedBy, setSignedBy] = useState('')

  const careByPt: Record<string, CareRec> = {}
  care.filter((c: CareRec) => c.shift === shift).forEach((c: CareRec) => { careByPt[c.patient_id] = c })
  const incByPt: Record<string, Incident[]> = {}
  incidents.forEach((i: Incident) => { (incByPt[i.patient_id] = incByPt[i.patient_id] || []).push(i) })
  const refusedByPt = new Set(mar.filter((m: MarRec) => m.status === 'refused').map((m: MarRec) => m.patient_id))

  // priority score for ordering
  const scored = patients.map((p: Patient) => {
    let s = 0
    if (incByPt[p.id]?.some(i => i.severity === 'critical' || i.severity === 'major')) s += 100
    if (refusedByPt.has(p.id)) s += 50
    if (isHighRisk(p)) s += 30
    if (!careByPt[p.id]) s += 10
    return { p, s }
  }).sort((a: any, b: any) => b.s - a.s)

  function statusOf(p: Patient): { label: string; color: string } {
    if (incByPt[p.id]?.some(i => i.severity === 'critical' || i.severity === 'major')) return { label: 'Alerta', color: '#dc2626' }
    if (refusedByPt.has(p.id) || isHighRisk(p)) return { label: 'Vigiar', color: '#d97706' }
    return { label: 'Estável', color: '#16a34a' }
  }

  function doPrint() {
    const records: PrintRecord[] = scored.map(({ p }: any) => {
      const st = statusOf(p)
      const cr = careByPt[p.id]
      const incs = incByPt[p.id] || []
      const fields = [
        { label: 'Quarto', value: p.room_number ? `Q${p.room_number}` : '—' },
        { label: 'Idade', value: p.age ? `${p.age} anos` : '—' },
      ]
      const bullets: string[] = []
      if (p.allergies) bullets.push(`Alergias: ${p.allergies}`)
      if (refusedByPt.has(p.id)) bullets.push('Medicação recusada neste turno')
      incs.forEach(i => bullets.push(`Ocorrência: ${INC_LABELS[i.type] || i.type}${i.description ? ' — ' + i.description : ''}`))
      if (!cr) bullets.push('Sem registo diário neste turno')
      return {
        title: p.name,
        meta: p.conditions || undefined,
        tags: [{ label: st.label, color: st.color }],
        fields,
        bullets: bullets.length ? bullets : undefined,
        body: cr?.notes || undefined,
      }
    })
    const inst = (typeof window !== 'undefined' && localStorage.getItem('phlox-clinic-institution')) ? 'Lar / ERPI' : undefined
    printDoc({
      docTitle: `Passagem de Turno · ${SHIFT_LABEL[shift as Shift]}`,
      docSubtitle: `${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      institution: inst,
      author: signedBy || undefined,
      meta: [
        { label: 'residentes', value: String(patients.length) },
        { label: 'alertas', value: String(scored.filter((x: any) => statusOf(x.p).label === 'Alerta').length) },
        { label: 'a vigiar', value: String(scored.filter((x: any) => statusOf(x.p).label === 'Vigiar').length) },
      ],
      sections: [{ heading: `Residentes — turno ${SHIFT_LABEL[shift as Shift]}`, records }],
      footerNote: 'Passagem de turno · Phlox',
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Resumo automático por residente, ordenado por prioridade.</div>
        <button onClick={doPrint} style={{ padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir passagem
        </button>
      </div>

      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input value={signedBy} onChange={e => setSignedBy(e.target.value)} placeholder="Assinado por (nome do profissional)" style={{ flex: '1 1 240px', padding: '9px 13px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scored.map(({ p }: any) => {
          const st = statusOf(p); const cr = careByPt[p.id]; const incs = incByPt[p.id] || []
          return (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${st.color}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 8 }}>{roomOf(p.id)}{p.age ? ` · ${p.age}a` : ''}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + '12', border: `1px solid ${st.color}33`, padding: '2px 9px', borderRadius: 6 }}>{st.label}</span>
              </div>
              {(p.allergies || incs.length > 0 || refusedByPt.has(p.id) || !cr) && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-3)' }}>
                  {p.allergies && <li style={{ color: '#92400e' }}>Alergias: {p.allergies}</li>}
                  {refusedByPt.has(p.id) && <li style={{ color: '#dc2626' }}>Medicação recusada neste turno</li>}
                  {incs.map((i: Incident) => <li key={i.id} style={{ color: '#b45309' }}>Ocorrência: {INC_LABELS[i.type] || i.type}{i.description ? ` — ${i.description}` : ''}</li>)}
                  {!cr && <li style={{ color: '#94a3b8' }}>Sem registo diário neste turno</li>}
                </ul>
              )}
              {cr?.notes && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>{cr.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
