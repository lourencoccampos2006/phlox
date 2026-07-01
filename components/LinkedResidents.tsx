'use client'

// LinkedResidents — mostra, dentro do /familia, os utentes que estão num LAR/CENTRO
// e a que a família se ligou pelo Portal Família (código + verificação por telefone).
// Lê as ligações de localStorage (mesma chave do /portal-familia) e busca os dados ao
// vivo via /api/family-portal (code+verify). Cada utente é um cartão com: medicação do
// lar, resumo dos últimos dias, conversa com a equipa (FamilyChat) e pedir visita.
// Substitui a experiência que antes vivia só no /portal-familia.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import FamilyChat, { type ChatMessage } from '@/components/FamilyChat'
import { usePhloxContext } from '@/lib/copilotContext'

const ACCESSES_KEY = 'phlox-familia-accesses'
const NAME_KEY = 'phlox-familia-name'
const ACCENT = '#1d4ed8'

interface Access { code: string; verify: string; name: string; room?: string }
interface DaySummary { date: string; lines: string[]; mood?: number; attention: boolean }
interface HomeMed { id: string; name: string; dose?: string; frequency?: string; take_location?: string }

interface Loaded {
  acc: Access
  patientName: string
  room?: string
  messages: ChatMessage[]
  days: DaySummary[]
  meds: HomeMed[]
}

export default function LinkedResidents() {
  const [accesses, setAccesses] = useState<Access[]>([])
  const [data, setData] = useState<Record<string, Loaded>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [myName, setMyName] = useState('')
  const [visitFor, setVisitFor] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCESSES_KEY)
      const list: Access[] = raw ? JSON.parse(raw) : []
      setAccesses(list)
      setMyName(localStorage.getItem(NAME_KEY) || '')
    } catch { /* ignore */ }
  }, [])

  const fetchOne = useCallback(async (acc: Access) => {
    try {
      const qs = `code=${encodeURIComponent(acc.code)}${acc.verify ? `&verify=${encodeURIComponent(acc.verify)}` : ''}`
      const res = await fetch(`/api/family-portal?${qs}`)
      const d = await res.json()
      if (!res.ok || d.needsVerify) return
      setData(prev => ({ ...prev, [acc.code]: {
        acc, patientName: d.patient?.name || acc.name, room: d.patient?.room_number || acc.room,
        messages: d.messages || [], days: d.dailySummaries || [], meds: d.homeMeds || [],
      } }))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { accesses.forEach(fetchOne) }, [accesses, fetchOne])

  // Tempo real leve: re-busca o utente aberto a cada 12s.
  useEffect(() => {
    if (!open) return
    const acc = accesses.find(a => a.code === open)
    if (!acc) return
    const t = setInterval(() => fetchOne(acc), 12000)
    return () => clearInterval(t)
  }, [open, accesses, fetchOne])

  // Dá contexto ao Copilot sobre o familiar institucional aberto.
  const openData = open ? data[open] : null
  usePhloxContext(
    openData ? `Familiar no lar: ${openData.patientName}` : '',
    openData ? { utente: openData.patientName, lar: true, medicacao: openData.meds.map(m => m.name), ultimos_dias: openData.days.slice(0, 2).map(d => d.lines.join('; ')) } : null as any
  )

  async function sendMessage(code: string, text: string, imageBase64?: string): Promise<boolean> {
    const acc = accesses.find(a => a.code === code)
    if (!acc) return false
    try {
      if (myName) localStorage.setItem(NAME_KEY, myName)
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', code: acc.code, verify: acc.verify, name: myName || 'Família', content: text, imageBase64 }),
      })
      const d = await res.json()
      if (!res.ok || !d.message) return false
      setData(prev => ({ ...prev, [code]: { ...prev[code], messages: [...(prev[code]?.messages || []), d.message] } }))
      return true
    } catch { return false }
  }

  async function requestVisit(code: string, date: string, time: string, notes: string): Promise<{ ok: boolean; error?: string }> {
    const acc = accesses.find(a => a.code === code)
    if (!acc) return { ok: false, error: 'Ligação não encontrada.' }
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_visit', code: acc.code, verify: acc.verify, name: myName || 'Família', date, time, notes }),
      })
      const d = await res.json().catch(() => ({}))
      return res.ok ? { ok: true } : { ok: false, error: d.error || 'Não foi possível pedir a visita.' }
    } catch { return { ok: false, error: 'Erro de ligação. Tente novamente.' } }
  }

  if (accesses.length === 0) return null

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>No lar / centro de dia</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {accesses.map(acc => {
          const d = data[acc.code]
          const name = d?.patientName || acc.name
          const room = d?.room || acc.room
          const isOpen = open === acc.code
          const attentionDays = d?.days.filter(x => x.attention).length || 0
          return (
            <div key={acc.code} style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: 16, overflow: 'hidden' }}>
              <button onClick={() => setOpen(isOpen ? null : acc.code)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: '#eff6ff', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>🏡</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: '#0b1120' }}>{name}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#3b5bdb' }}>No lar / centro{room ? ` · ${room}` : ''}{attentionDays > 0 ? ' · há registos a ver' : ''}</span>
                </span>
                <span style={{ fontSize: 18, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
              </button>

              {isOpen && d && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                  {/* Resumo dos últimos dias */}
                  {d.days.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Como tem corrido</div>
                      {d.days.slice(0, 3).map((day, i) => (
                        <div key={i} style={{ background: day.attention ? '#fffbeb' : '#f8fafc', border: `1px solid ${day.attention ? '#fde68a' : '#e2e8f0'}`, borderRadius: 10, padding: '9px 12px', marginBottom: 6 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{new Date(day.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                          {day.lines.map((l, j) => <div key={j} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{l}</div>)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Medicação no lar */}
                  {d.meds.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Medicação</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {d.meds.map(m => <span key={m.id} style={{ fontSize: 12.5, fontWeight: 600, color: '#0d6e42', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '4px 10px' }}>💊 {m.name}{m.dose ? ` ${m.dose}` : ''}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Conversa com a equipa */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mensagens com a equipa</div>
                    {!myName && (
                      <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="O seu nome (aparece nas mensagens)" style={{ width: '100%', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                    )}
                    <FamilyChat
                      messages={d.messages}
                      mySide="family"
                      otherLabel="a equipa do lar"
                      accent={ACCENT}
                      height={300}
                      onSend={(t, img) => sendMessage(acc.code, t, img)}
                    />
                  </div>

                  {/* Pedir visita */}
                  <div style={{ marginTop: 12 }}>
                    {visitFor === acc.code ? (
                      <VisitForm onCancel={() => setVisitFor(null)} onSubmit={async (date, time, notes) => { const r = await requestVisit(acc.code, date, time, notes); if (r.ok) setVisitFor(null); return r }} />
                    ) : (
                      <button onClick={() => setVisitFor(acc.code)} style={{ padding: '10px 16px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📅 Pedir uma visita</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Link href="/portal-familia" style={{ display: 'block', marginTop: 8, fontSize: 12.5, color: '#3b5bdb', fontWeight: 600, textDecoration: 'none' }}>+ Ligar a outro familiar que esteja num lar / centro</Link>
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
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
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
