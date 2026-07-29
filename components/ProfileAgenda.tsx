'use client'

// ProfileAgenda — agenda partilhada de um perfil de família: consultas/
// compromissos e turnos de cobertura ("quem fica responsável de quinta a
// domingo?"). Construído sobre a mesma infraestrutura de acesso partilhado de
// family_profile_shares (sprint112) e o mesmo padrão de reclamar/largar do
// quadro "Preciso de ajuda" — mas para EVENTOS COM DATA, não tarefas soltas.
// Componente autónomo para ser usado tanto em /perfil/[id] (dono) como em
// /partilhado-comigo (acesso partilhado).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

interface EventItem {
  id: string; kind: 'appointment' | 'coverage'; title: string; location?: string | null; notes?: string | null
  starts_at: string; ends_at?: string | null; assigned_to?: string | null; assigned_to_name?: string | null
  created_by: string; created_by_name: string
}

const inputStyle: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const KIND_META = {
  appointment: { label: 'Consulta / compromisso', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  coverage: { label: 'Cobertura', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
}

function fmtDay(iso: string) { return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }

export default function ProfileAgenda({ profileId }: { profileId: string }) {
  const { user, supabase } = useAuth() as any
  const [events, setEvents] = useState<EventItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newEvent, setNewEvent] = useState({ kind: 'appointment' as 'appointment' | 'coverage', title: '', date: '', time: '', endDate: '', location: '', notes: '', assignSelf: false })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [showPast, setShowPast] = useState(false)

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const res = await fetch(`/api/family-events?profile_id=${profileId}`, { headers: await authHeader() })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setEvents(j.items || [])
    setLoaded(true)
  }, [profileId, authHeader])

  useEffect(() => { load() }, [load])

  const canSubmit = newEvent.title.trim() && newEvent.date && (newEvent.kind === 'coverage' || newEvent.time)

  async function addEvent() {
    if (!canSubmit) return
    setAdding(true); setErr('')
    try {
      const startsAt = new Date(`${newEvent.date}T${newEvent.kind === 'coverage' ? '00:00' : newEvent.time}`)
      if (Number.isNaN(startsAt.getTime())) throw new Error('Data inválida.')
      const endsAt = newEvent.kind === 'coverage' && newEvent.endDate ? new Date(`${newEvent.endDate}T23:59`) : null
      const res = await fetch('/api/family-events', {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({
          profile_id: profileId, kind: newEvent.kind, title: newEvent.title.trim(),
          location: newEvent.location.trim() || undefined, notes: newEvent.notes.trim() || undefined,
          starts_at: startsAt.toISOString(), ends_at: endsAt ? endsAt.toISOString() : undefined,
          assign_self: newEvent.assignSelf || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setNewEvent({ kind: newEvent.kind, title: '', date: '', time: '', endDate: '', location: '', notes: '', assignSelf: false })
      await load()
    } catch (e: any) { setErr(e.message || 'Não foi possível criar o evento.') }
    setAdding(false)
  }

  async function action(id: string, act: 'claim' | 'unclaim') {
    await fetch('/api/family-events', { method: 'PATCH', headers: await authHeader(), body: JSON.stringify({ id, action: act }) })
    await load()
  }

  async function remove(id: string) {
    await fetch(`/api/family-events?id=${id}`, { method: 'DELETE', headers: await authHeader() })
    await load()
  }

  const nowIso = new Date().toISOString()
  const upcoming = events.filter(e => (e.ends_at || e.starts_at) >= nowIso)
  const past = events.filter(e => (e.ends_at || e.starts_at) < nowIso).slice().reverse()

  function Card({ e }: { e: EventItem }) {
    const meta = KIND_META[e.kind]
    return (
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{e.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
              {e.kind === 'coverage'
                ? (e.ends_at ? `${fmtDay(e.starts_at)} – ${fmtDay(e.ends_at)}` : fmtDay(e.starts_at))
                : `${fmtDay(e.starts_at)} · ${fmtTime(e.starts_at)}`}
              {e.location ? ` · ${e.location}` : ''}
            </div>
            {e.notes && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 5 }}>{e.notes}</div>}
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
              criado por {e.created_by_name}
              {e.kind === 'coverage' && (e.assigned_to_name ? ` · responsável: ${e.assigned_to_name}` : ' · por atribuir')}
            </div>
          </div>
          <button aria-label="Eliminar" onClick={() => remove(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px', flexShrink: 0 }}>×</button>
        </div>
        {e.kind === 'coverage' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {!e.assigned_to && <button onClick={() => action(e.id, 'claim')} style={{ padding: '6px 12px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fico responsável</button>}
            {e.assigned_to === user?.id && <button onClick={() => action(e.id, 'unclaim')} style={{ padding: '6px 12px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Largar</button>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Adicionar à agenda</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['appointment', 'coverage'] as const).map(k => (
            <button key={k} onClick={() => setNewEvent(f => ({ ...f, kind: k }))}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${newEvent.kind === k ? KIND_META[k].color : 'var(--border)'}`,
                background: newEvent.kind === k ? KIND_META[k].bg : 'white',
                color: newEvent.kind === k ? KIND_META[k].color : 'var(--ink-4)',
              }}>{KIND_META[k].label}</button>
          ))}
        </div>

        <input value={newEvent.title} onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))}
          placeholder={newEvent.kind === 'coverage' ? 'Ex: Cobertura de fim de semana' : 'Ex: Consulta de cardiologia'}
          style={{ ...inputStyle, marginBottom: 8 }} />

        {newEvent.kind === 'appointment' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="date" value={newEvent.date} onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            <input type="time" value={newEvent.time} onChange={e => setNewEvent(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="date" value={newEvent.date} onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} placeholder="Início" style={inputStyle} />
            <input type="date" value={newEvent.endDate} onChange={e => setNewEvent(f => ({ ...f, endDate: e.target.value }))} placeholder="Fim (opcional)" style={inputStyle} />
          </div>
        )}

        {newEvent.kind === 'appointment' && (
          <input value={newEvent.location} onChange={e => setNewEvent(f => ({ ...f, location: e.target.value }))}
            placeholder="Local (opcional)" style={{ ...inputStyle, marginBottom: 8 }} />
        )}
        <input value={newEvent.notes} onChange={e => setNewEvent(f => ({ ...f, notes: e.target.value }))}
          placeholder="Notas (opcional)" style={{ ...inputStyle, marginBottom: 8 }} />

        {newEvent.kind === 'coverage' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={newEvent.assignSelf} onChange={e => setNewEvent(f => ({ ...f, assignSelf: e.target.checked }))} />
            Fico já responsável por este turno
          </label>
        )}

        {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
        <button onClick={addEvent} disabled={!canSubmit || adding}
          style={{ width: '100%', padding: '10px 18px', background: canSubmit && !adding ? 'var(--ink)' : 'var(--bg-3)', color: canSubmit && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: canSubmit && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {adding ? '...' : 'Adicionar'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loaded && upcoming.length === 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
            Sem nada agendado. Quem tiver acesso partilhado a este perfil também pode marcar consultas e turnos de cobertura.
          </div>
        )}
        {upcoming.map(e => <Card key={e.id} e={e} />)}
      </div>

      {past.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowPast(s => !s)} style={{ fontSize: 11, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}>
            {showPast ? 'Ocultar anteriores' : `Ver ${past.length} anterior${past.length === 1 ? '' : 'es'}`}
          </button>
          {showPast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, opacity: 0.7 }}>
              {past.map(e => <Card key={e.id} e={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
