'use client'

// /hospital/bloco — Bloco Operatório
// Agenda do dia por sala + transições do circuito + checklist OMS de cirurgia segura.
// Requer surgery.read; mutações exigem surgery.write.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import Link from 'next/link'

interface Surgery {
  id: string
  procedure_code: string|null
  procedure_name: string
  specialty: string|null
  operating_room: string|null
  anaesthesia_kind: string|null
  asa_score: number|null
  asa_emergent: boolean
  status: 'scheduled'|'arrived'|'induction'|'in_progress'|'closing'|'recovery'|'completed'|'cancelled'
  scheduled_start: string|null
  scheduled_duration: number|null
  arrived_at: string|null
  induction_at: string|null
  incision_at: string|null
  closure_at: string|null
  recovery_at: string|null
  completed_at: string|null
  outcome: string|null
  complication_notes: string|null
  signin_done: boolean
  timeout_done: boolean
  signout_done: boolean
  patient_id: string
  episode_id: string|null
  patient: { id: string; name: string } | null
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: 'Agendada',     color: '#374151', bg: '#f3f4f6' },
  arrived:     { label: 'Chegou',       color: '#1e40af', bg: '#dbeafe' },
  induction:   { label: 'Indução',      color: '#6d28d9', bg: '#ede9fe' },
  in_progress: { label: 'Em curso',     color: '#92400e', bg: '#fef3c7' },
  closing:     { label: 'A encerrar',   color: '#9a3412', bg: '#fed7aa' },
  recovery:    { label: 'Recobro',      color: '#0e7490', bg: '#cffafe' },
  completed:   { label: 'Concluída',    color: '#065f46', bg: '#d1fae5' },
  cancelled:   { label: 'Cancelada',    color: '#991b1b', bg: '#fee2e2' },
}

const ACCENT = '#0d6e42'

export default function BlocoOperatorioPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [list, setList] = useState<Surgery[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [detail, setDetail] = useState<Surgery | null>(null)

  const canWrite = caps.includes('surgery.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const from = `${day}T00:00:00`
      const to   = `${day}T23:59:59`
      const r = await fetch(`/api/hospital/surgeries?org_id=${org.id}&from=${from}&to=${to}`, { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro a carregar bloco')
      setList(j.surgeries || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, day, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  const rooms = useMemo(() => {
    const set = new Set<string>()
    for (const s of list) set.add(s.operating_room || 'Sem sala')
    return Array.from(set).sort()
  }, [list])

  // ─── Render ───────────────────────────────────────────────────────────────
  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Bloco Operatório</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('surgery.read')) return <main style={{ padding: 24 }}><h1>Bloco Operatório</h1><p>Sem permissão para ver o bloco.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1600, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Bloco Operatório</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name} · {list.length} intervenções no dia</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={day} onChange={e => setDay(e.target.value)} style={input} />
          {canWrite && <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Agendar</button>}
        </div>
      </div>

      {/* Resumo por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, marginBottom: 20 }}>
        {Object.entries(STATUS_META).map(([k, m]) => {
          const c = list.filter(s => s.status === k).length
          if (k === 'cancelled' && c === 0) return null
          return (
            <div key={k} style={{ padding: 10, background: m.bg, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 22, color: m.color, fontWeight: 800 }}>{c}</div>
              <div style={{ fontSize: 10, color: m.color, fontWeight: 700, letterSpacing: 0.5, marginTop: 2 }}>{m.label.toUpperCase()}</div>
            </div>
          )
        })}
      </div>

      {/* Lista por sala */}
      {list.length === 0 ? (
        <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem intervenções agendadas para este dia.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {rooms.map(room => (
            <section key={room}>
              <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#374151' }}>{room}</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {list.filter(s => (s.operating_room || 'Sem sala') === room).map(s => {
                  const m = STATUS_META[s.status] || STATUS_META.scheduled
                  const checklist = (s.signin_done ? 1 : 0) + (s.timeout_done ? 1 : 0) + (s.signout_done ? 1 : 0)
                  return (
                    <div key={s.id} onClick={() => setDetail(s)} style={{
                      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                      cursor: 'pointer', display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 14, alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                          {s.scheduled_start ? new Date(s.scheduled_start).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                        {s.scheduled_duration && <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.scheduled_duration} min</div>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                          {s.procedure_name}
                          {s.asa_emergent && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', background: '#dc2626', color: 'white', borderRadius: 4, fontWeight: 800 }}>EMERG.</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {s.patient?.name || 'Doente sem registo'}
                          {s.specialty && ` · ${s.specialty}`}
                          {s.asa_score && ` · ASA ${s.asa_score}${s.asa_emergent ? 'E' : ''}`}
                          {s.anaesthesia_kind && ` · ${s.anaesthesia_kind}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.color, fontSize: 11, fontWeight: 700 }}>
                          {m.label.toUpperCase()}
                        </span>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                          checklist {checklist}/3
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {showNew && <NewSurgeryModal orgId={org.id} day={day} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} authHeader={authHeader} />}
      {detail && <SurgeryDetailModal surgery={detail} canWrite={canWrite} onClose={() => setDetail(null)} onUpdated={() => { setDetail(null); load() }} authHeader={authHeader} />}
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function NewSurgeryModal({ orgId, day, onClose, onCreated, authHeader }: {
  orgId: string; day: string; onClose: () => void; onCreated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [procedure, setProcedure] = useState('')
  const [code, setCode] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [room, setRoom] = useState('Sala 1')
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [anaesthesia, setAnaesthesia] = useState('geral')
  const [asa, setAsa] = useState<number>(2)
  const [emergent, setEmergent] = useState(false)
  const [prophylaxis, setProphylaxis] = useState('')
  const [patientId, setPatientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const body = {
        org_id: orgId,
        patient_id: patientId,
        procedure_name: procedure,
        procedure_code: code || null,
        specialty: specialty || null,
        operating_room: room,
        scheduled_start: `${day}T${time}:00`,
        scheduled_duration: duration,
        anaesthesia_kind: anaesthesia,
        asa_score: asa,
        asa_emergent: emergent,
        prophylaxis_abx: prophylaxis || null,
      }
      const r = await fetch('/api/hospital/surgeries', { method: 'POST', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Agendar intervenção" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="ID do doente">
          <input required value={patientId} onChange={e => setPatientId(e.target.value)} style={input} placeholder="UUID do doente" />
          <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>Cria/escolhe primeiro o doente em <Link href="/patients" style={{ color: ACCENT }}>doentes</Link>.</p>
        </Field>
        <Field label="Nome do procedimento"><input required value={procedure} onChange={e => setProcedure(e.target.value)} style={input} placeholder="ex: Colecistectomia laparoscópica" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Código (opcional)"><input value={code} onChange={e => setCode(e.target.value)} style={input} placeholder="CID-9-MC" /></Field>
          <Field label="Especialidade"><input value={specialty} onChange={e => setSpecialty(e.target.value)} style={input} placeholder="ex: Cirurgia Geral" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Sala"><input required value={room} onChange={e => setRoom(e.target.value)} style={input} /></Field>
          <Field label="Hora"><input required type="time" value={time} onChange={e => setTime(e.target.value)} style={input} /></Field>
          <Field label="Duração (min)"><input required type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 60)} style={input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Anestesia">
            <select value={anaesthesia} onChange={e => setAnaesthesia(e.target.value)} style={input}>
              <option value="geral">Geral</option>
              <option value="regional">Regional</option>
              <option value="locorregional">Loco-regional</option>
              <option value="local">Local</option>
              <option value="sedacao">Sedação</option>
              <option value="nenhuma">Nenhuma</option>
            </select>
          </Field>
          <Field label="ASA">
            <select value={asa} onChange={e => setAsa(parseInt(e.target.value))} style={input}>
              <option value={1}>I — saudável</option>
              <option value={2}>II — doença sistémica ligeira</option>
              <option value={3}>III — doença sistémica grave</option>
              <option value={4}>IV — risco constante de vida</option>
              <option value={5}>V — moribundo</option>
              <option value={6}>VI — morte cerebral</option>
            </select>
          </Field>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={emergent} onChange={e => setEmergent(e.target.checked)} /> Emergente (sufixo E)
        </label>
        <Field label="Profilaxia antibiótica (opcional)"><input value={prophylaxis} onChange={e => setProphylaxis(e.target.value)} style={input} placeholder="ex: Cefazolina 2 g IV 30 min pré-incisão" /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !procedure || !patientId} style={btn('primary')}>{busy ? 'A agendar…' : 'Agendar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function SurgeryDetailModal({ surgery, canWrite, onClose, onUpdated, authHeader }: {
  surgery: Surgery; canWrite: boolean; onClose: () => void; onUpdated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function action(body: any) {
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/hospital/surgeries/${surgery.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onUpdated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const m = STATUS_META[surgery.status] || STATUS_META.scheduled
  const totalTime = surgery.incision_at && surgery.closure_at
    ? Math.round((new Date(surgery.closure_at).getTime() - new Date(surgery.incision_at).getTime()) / 60000)
    : null

  return (
    <Modal title={surgery.procedure_name} onClose={onClose}>
      {err && <div style={errBox}>{err}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.color, fontSize: 12, fontWeight: 700 }}>{m.label.toUpperCase()}</span>
        {surgery.asa_score && <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>ASA {surgery.asa_score}{surgery.asa_emergent ? 'E' : ''}</span>}
        {surgery.anaesthesia_kind && <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>{surgery.anaesthesia_kind}</span>}
        {surgery.operating_room && <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>{surgery.operating_room}</span>}
      </div>

      {surgery.patient && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Doente</div>
          <Link href={`/patients/${surgery.patient.id}`} style={{ fontSize: 15, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}>
            {surgery.patient.name}
          </Link>
        </div>
      )}

      {/* Linha do tempo */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Linha do tempo</div>
        <Timeline events={[
          { label: 'Agendamento', when: surgery.scheduled_start },
          { label: 'Chegada', when: surgery.arrived_at },
          { label: 'Indução', when: surgery.induction_at },
          { label: 'Incisão', when: surgery.incision_at },
          { label: 'Encerramento', when: surgery.closure_at },
          { label: 'Recobro', when: surgery.recovery_at },
          { label: 'Conclusão', when: surgery.completed_at },
        ]} />
        {totalTime != null && (
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Tempo de incisão→encerramento: <b>{totalTime} min</b></p>
        )}
      </div>

      {/* Checklist OMS */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Checklist OMS de cirurgia segura</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <ChecklistBtn label="Sign-in (antes anestesia)" done={surgery.signin_done} onClick={() => action({ action: 'signin' })} disabled={!canWrite || busy} />
          <ChecklistBtn label="Time-out (antes incisão)" done={surgery.timeout_done} onClick={() => action({ action: 'timeout' })} disabled={!canWrite || busy} />
          <ChecklistBtn label="Sign-out (antes saída)" done={surgery.signout_done} onClick={() => action({ action: 'signout' })} disabled={!canWrite || busy} />
        </div>
      </div>

      {/* Acções de transição */}
      {canWrite && surgery.status !== 'completed' && surgery.status !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          {surgery.status === 'scheduled' && <button onClick={() => action({ action: 'arrive' })} disabled={busy} style={btn('primary')}>Chegada</button>}
          {surgery.status === 'arrived' && <button onClick={() => action({ action: 'induction' })} disabled={busy} style={btn('primary')}>Iniciar indução</button>}
          {surgery.status === 'induction' && <button onClick={() => action({ action: 'incision' })} disabled={busy} style={btn('primary')}>Incisão</button>}
          {surgery.status === 'in_progress' && <button onClick={() => action({ action: 'closure' })} disabled={busy} style={btn('primary')}>Encerrar</button>}
          {surgery.status === 'closing' && <button onClick={() => action({ action: 'recovery' })} disabled={busy} style={btn('primary')}>Recobro</button>}
          {surgery.status === 'recovery' && <button onClick={() => action({ action: 'complete', outcome: 'success' })} disabled={busy} style={btn('primary')}>Concluir (sucesso)</button>}
          <button onClick={() => { if (confirm('Cancelar esta intervenção?')) action({ action: 'cancel' }) }} disabled={busy} style={btn('ghost')}>Cancelar</button>
        </div>
      )}
    </Modal>
  )
}

function Timeline({ events }: { events: { label: string; when: string | null }[] }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {events.map(e => (
        <div key={e.label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: e.when ? '#111827' : '#9ca3af', fontWeight: e.when ? 600 : 400 }}>{e.label}</span>
          <span style={{ color: e.when ? '#374151' : '#9ca3af' }}>
            {e.when ? new Date(e.when).toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChecklistBtn({ label, done, onClick, disabled }: { label: string; done: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled || done} style={{
      padding: 10, border: 'none', borderRadius: 8, cursor: disabled || done ? 'default' : 'pointer',
      background: done ? '#dcfce7' : '#f3f4f6', color: done ? '#065f46' : '#374151',
      fontSize: 11, fontWeight: 700, textAlign: 'left', opacity: disabled && !done ? 0.6 : 1,
    }}>
      <div style={{ fontSize: 13, marginBottom: 2 }}>{done ? '✓' : '○'}</div>
      {label}
    </button>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 640, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}
const errBox: React.CSSProperties = {
  background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8,
}
const emptyCard: React.CSSProperties = {
  background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center',
}

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') {
    return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
      background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
    background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
