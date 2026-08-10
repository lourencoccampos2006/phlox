'use client'

// LinkedResidentPanel — conteúdo institucional embutido no cartão do familiar
// em /familia (diário, medicação de casa, conversa, visitas). Substitui
// components/LinkedResidents.tsx (2026-08-09): antes era uma lista PARALELA
// à dos perfis de família, lida de localStorage — agora vive DENTRO do
// próprio cartão do family_profiles ligado, lido do servidor
// (family_institution_links via /api/family-link), sem sessão por
// dispositivo. Mesma lógica de leitura/escrita (/api/family-portal),
// só a proveniência da ligação mudou.

import { useEffect, useState, useCallback } from 'react'
import FamilyChat, { type ChatMessage } from '@/components/FamilyChat'
import { usePhloxContext } from '@/lib/copilotContext'

const ACCENT = '#1d4ed8'

interface DaySummary { date: string; lines: string[]; mood?: number; attention: boolean; photoUrl?: string | null }
interface HomeMed { id: string; name: string; dose?: string; frequency?: string; take_location?: string }
const VISIT_STATUS: Record<string, { label: string; c: string; bg: string; bd: string }> = {
  pending:   { label: 'Pendente',  c: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  approved:  { label: 'Aprovada',  c: '#0d6e42', bg: '#f0fdf4', bd: '#bbf7d0' },
  declined:  { label: 'Recusada',  c: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  completed: { label: 'Realizada', c: '#64748b', bg: '#f8fafc', bd: '#e2e8f0' },
}
interface VisitReq { id: string; requested_date: string; requested_time?: string | null; status: string; notes?: string | null }
interface TodayDose { med_id: string; status: string; source?: string; shift?: string }

export interface FamilyLink { code: string; verify_digits: string; patient_name: string }

export default function LinkedResidentPanel({ link, myName, onNameChange, onUnlink }: {
  link: FamilyLink
  myName: string
  onNameChange: (n: string) => void
  onUnlink: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [days, setDays] = useState<DaySummary[]>([])
  const [meds, setMeds] = useState<HomeMed[]>([])
  const [visits, setVisits] = useState<VisitReq[]>([])
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([])
  const [room, setRoom] = useState<string | undefined>()
  const [dosing, setDosing] = useState('')
  const [visitOpen, setVisitOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const qs = `code=${encodeURIComponent(link.code)}${link.verify_digits ? `&verify=${encodeURIComponent(link.verify_digits)}` : ''}`
      const res = await fetch(`/api/family-portal?${qs}`)
      const d = await res.json()
      if (!res.ok || d.needsVerify) { setLoading(false); return }
      setRoom(d.patient?.room_number)
      setMessages(d.messages || []); setDays(d.dailySummaries || []); setMeds(d.homeMeds || [])
      setVisits(d.visitRequests || []); setTodayDoses(d.todayDoses || [])
    } catch { /* offline */ }
    setLoading(false)
  }, [link.code, link.verify_digits])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const t = setInterval(fetchData, 15000); return () => clearInterval(t) }, [fetchData])

  usePhloxContext(
    `Familiar no lar: ${link.patient_name}`,
    { utente: link.patient_name, lar: true, medicacao: meds.map(m => m.name), ultimos_dias: days.slice(0, 2).map(d => d.lines.join('; ')) } as any
  )

  async function sendMessage(text: string, imageBase64?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', code: link.code, verify: link.verify_digits, name: myName || 'Família', content: text, imageBase64 }),
      })
      const d = await res.json()
      if (!res.ok || !d.message) return false
      setMessages(prev => [...prev, d.message])
      return true
    } catch { return false }
  }

  async function markDose(medId: string) {
    setDosing(medId)
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_dose', code: link.code, verify: link.verify_digits, name: myName || 'Família', medId }),
      })
      const d = await res.json()
      if (res.ok && (d.toggled === 'on' || d.toggled === 'off')) {
        const shift = (() => { const h = new Date().getHours(); return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite' })()
        setTodayDoses(prev => d.toggled === 'on'
          ? [...prev, { med_id: medId, status: 'administered', source: 'home', shift }]
          : prev.filter(x => !(x.med_id === medId && x.source === 'home')))
      }
    } catch { /* offline */ }
    setDosing('')
  }

  async function requestVisit(date: string, time: string, notes: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_visit', code: link.code, verify: link.verify_digits, name: myName || 'Família', date, time, notes }),
      })
      const d = await res.json().catch(() => ({}))
      return res.ok ? { ok: true } : { ok: false, error: d.error || 'Não foi possível pedir a visita.' }
    } catch { return { ok: false, error: 'Erro de ligação. Tente novamente.' } }
  }

  if (loading) return <div style={{ padding: '14px 0', fontSize: 12.5, color: '#94a3b8' }}>A carregar o dia de {link.patient_name.split(' ')[0]}…</div>

  return (
    <div>
      <div style={{ fontSize: 12, color: '#3b5bdb', marginBottom: 12 }}>No lar / centro de dia{room ? ` · quarto ${room}` : ''}</div>

      {days.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Como tem corrido</div>
          {days.slice(0, 3).map((day, i) => (
            <div key={i} style={{ background: day.attention ? '#fffbeb' : '#f8fafc', border: `1px solid ${day.attention ? '#fde68a' : '#e2e8f0'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 6 }}>
              {day.photoUrl && <img src={day.photoUrl} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: '9px 12px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{new Date(day.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {day.lines.map((l, j) => <div key={j} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{l}</div>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {meds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Medicação para dar em casa</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meds.map(m => {
              const taken = todayDoses.some(x => x.med_id === m.id && x.source === 'home')
              const givenByTeam = todayDoses.some(x => x.med_id === m.id && x.source !== 'home' && (x.status === 'administered' || x.status === 'given' || x.status === 'taken'))
              const busy = dosing === m.id
              const subtitle = busy ? 'A guardar…'
                : taken ? 'Dado em casa hoje — toque para desmarcar'
                : givenByTeam ? 'Já dado pela equipa hoje'
                : (m.frequency || 'Toque quando der esta medicação em casa')
              return (
                <button key={m.id} onClick={() => markDose(m.id)} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', padding: '10px 12px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
                    border: `1.5px solid ${taken ? '#bbf7d0' : givenByTeam ? '#bfdbfe' : '#e5e7eb'}`, background: taken ? '#f0fdf4' : givenByTeam ? '#eff6ff' : 'white', fontFamily: 'inherit' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                    border: `2px solid ${taken ? '#16a34a' : givenByTeam ? '#3b82f6' : '#cbd5e1'}`, background: taken ? '#16a34a' : givenByTeam ? '#3b82f6' : 'white', color: 'white' }}>{taken || givenByTeam ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>💊 {m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: taken ? '#16a34a' : givenByTeam ? '#2563eb' : '#94a3b8' }}>{subtitle}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mensagens com a equipa</div>
        {!myName && (
          <input value={myName} onChange={e => onNameChange(e.target.value)} placeholder="O seu nome (aparece nas mensagens)" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
        )}
        <FamilyChat messages={messages} mySide="family" otherLabel="a equipa" accent={ACCENT} height={260} onSend={sendMessage} />
      </div>

      {visits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>As minhas visitas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visits.map(v => {
              const st = VISIT_STATUS[v.status] || VISIT_STATUS.pending
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: st.bg, border: `1px solid ${st.bd}`, borderRadius: 9, padding: '8px 11px' }}>
                  <span style={{ fontSize: 13 }}>📅</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: '#0b1120' }}>
                    {new Date(v.requested_date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long' })}
                    {v.requested_time ? ` · ${v.requested_time}` : ''}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.c }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {visitOpen ? (
          <VisitForm onCancel={() => setVisitOpen(false)} onSubmit={async (date, time, notes) => { const r = await requestVisit(date, time, notes); if (r.ok) { setVisitOpen(false); fetchData() } return r }} />
        ) : (
          <button onClick={() => setVisitOpen(true)} style={{ padding: '9px 14px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>📅 Pedir uma visita</button>
        )}
        <button onClick={onUnlink} style={{ padding: '9px 14px', background: 'none', color: '#94a3b8', border: '1px solid #e5e7eb', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Desligar</button>
      </div>
    </div>
  )
}

function VisitForm({ onSubmit, onCancel }: { onSubmit: (date: string, time: string, notes: string) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  if (done) return <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>✓ Pedido de visita enviado. A equipa vai confirmar.</div>
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, width: '100%' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', marginBottom: 10 }}>Pedir uma visita</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: '1 1 150px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none' }} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: '0 1 120px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none' }} />
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota (opcional)" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
      {error && <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={async () => { if (!date) return; setBusy(true); setError(''); const r = await onSubmit(date, time, notes); setBusy(false); if (r.ok) setDone(true); else setError(r.error || 'Não foi possível pedir a visita.') }} disabled={busy || !date} style={{ padding: '9px 16px', background: busy || !date ? '#e2e8f0' : ACCENT, color: busy || !date ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: busy || !date ? 'default' : 'pointer' }}>{busy ? 'A enviar…' : 'Pedir visita'}</button>
        <button onClick={onCancel} style={{ padding: '9px 14px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  )
}
