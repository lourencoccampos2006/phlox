'use client'

// /telemedicina — Agenda e gestão de consultas remotas

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import Link from 'next/link'

interface Session {
  id: string; status: string; scheduled_at: string; duration_min: number
  started_at: string|null; ended_at: string|null
  room_token: string; provider: string; recording_consent: boolean
  motive: string|null; fee_eur: number|null; paid: boolean
  patient_id: string|null; clinician_id: string|null
  patient: { id: string; name: string } | null
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: 'Agendada',   color: '#374151', bg: '#f3f4f6' },
  waiting:     { label: 'À espera',   color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'Em curso',   color: '#065f46', bg: '#d1fae5' },
  completed:   { label: 'Concluída',  color: '#065f46', bg: '#dcfce7' },
  cancelled:   { label: 'Cancelada',  color: '#991b1b', bg: '#fee2e2' },
  no_show:     { label: 'Faltou',     color: '#991b1b', bg: '#fee2e2' },
}
const ACCENT = '#0d6e42'

export default function TelemedPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()
  const [sessions, setSessions] = useState<Session[]>([])
  const [statusFilter, setStatusFilter] = useState('scheduled')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const canWrite = caps.includes('telemed.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const url = new URL('/api/telemed/sessions', window.location.origin)
      url.searchParams.set('org_id', org.id)
      if (statusFilter) url.searchParams.set('status', statusFilter)
      const r = await fetch(url.toString(), { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setSessions(j.sessions || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, statusFilter, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  async function action(id: string, body: any) {
    const headers = await authHeader()
    await fetch(`/api/telemed/sessions/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    load()
  }

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Telemedicina</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('telemed.read')) return <main style={{ padding: 24 }}><h1>Telemedicina</h1><p>Sem permissão.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Telemedicina</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name}</p>
        </div>
        {canWrite && <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Agendar consulta</button>}
      </div>

      {/* Tabs de estado */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: 'scheduled', label: 'Agendadas' },
          { v: 'in_progress', label: 'Em curso' },
          { v: 'completed', label: 'Concluídas' },
          { v: 'cancelled', label: 'Canceladas' },
          { v: '', label: 'Todas' },
        ].map(s => (
          <button key={s.v} onClick={() => setStatusFilter(s.v)} style={{
            padding: '5px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: statusFilter === s.v ? ACCENT : '#f3f4f6',
            color: statusFilter === s.v ? 'white' : '#374151',
          }}>{s.label}</button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem consultas.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sessions.map(s => {
            const m = STATUS_META[s.status] || STATUS_META.scheduled
            const link = `/telemed/sala/${s.room_token}`
            return (
              <div key={s.id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 14, alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                    {new Date(s.scheduled_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{s.duration_min} min</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                    {s.patient?.name || 'Sem doente associado'}
                  </div>
                  {s.motive && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.motive}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.color, fontSize: 11, fontWeight: 700 }}>
                    {m.label.toUpperCase()}
                  </span>
                  {canWrite && s.status === 'scheduled' && (
                    <button onClick={() => action(s.id, { action: 'start' })} style={{ ...btn('primary'), fontSize: 12, padding: '5px 10px' }}>Iniciar</button>
                  )}
                  {s.status === 'in_progress' && (
                    <>
                      <Link href={link} target="_blank" style={{ ...btn('primary'), fontSize: 12, padding: '5px 10px', textDecoration: 'none' }}>Entrar</Link>
                      {canWrite && <button onClick={() => action(s.id, { action: 'end' })} style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px' }}>Terminar</button>}
                    </>
                  )}
                  {canWrite && s.status === 'scheduled' && (
                    <button onClick={() => action(s.id, { action: 'cancel' })} style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px', color: '#dc2626' }}>Cancelar</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && org && <NewSessionModal orgId={org.id} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} authHeader={authHeader} />}
    </main>
  )
}

function NewSessionModal({ orgId, onClose, onSaved, authHeader }: {
  orgId: string; onClose: () => void; onSaved: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('14:00')
  const [duration, setDuration] = useState(20)
  const [motive, setMotive] = useState('')
  const [patientId, setPatientId] = useState('')
  const [fee, setFee] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/telemed/sessions', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId,
        patient_id: patientId || null,
        scheduled_at: `${date}T${time}:00`,
        duration_min: duration,
        motive: motive || null,
        fee_eur: fee === '' ? null : fee,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} title="Agendar consulta">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Data"><input required type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
          <Field label="Hora"><input required type="time" value={time} onChange={e => setTime(e.target.value)} style={input} /></Field>
          <Field label="Duração (min)"><input required type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 20)} style={input} /></Field>
        </div>
        <Field label="ID do doente (opcional)">
          <input value={patientId} onChange={e => setPatientId(e.target.value)} style={input} placeholder="UUID — copia de /patients" />
        </Field>
        <Field label="Motivo da consulta">
          <textarea rows={2} value={motive} onChange={e => setMotive(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="ex: seguimento de hipertensão" />
        </Field>
        <Field label="Honorários (€)">
          <input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value === '' ? '' : parseFloat(e.target.value))} style={input} />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy} style={btn('primary')}>{busy ? 'A agendar…' : 'Agendar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 520, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const errBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8 }
const emptyCard: React.CSSProperties = { background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
