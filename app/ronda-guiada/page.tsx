'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

type Shift = 'manha' | 'tarde' | 'noite'
type StatusTag = 'estavel' | 'vigiar' | 'alerta'

interface Patient {
  id: string; name: string; room_number?: string | null; age?: number | null
  conditions?: string | null; allergies?: string | null
  risk_level?: string | null; fall_risk?: string | null; pressure_risk?: string | null
  active?: boolean
}

function getToday() { return new Date().toISOString().slice(0, 10) }
function getShift(): Shift { const h = new Date().getHours(); if (h >= 7 && h < 14) return 'manha'; if (h >= 14 && h < 21) return 'tarde'; return 'noite' }
const SHIFT_LABEL: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

const STATUS_CFG: Record<StatusTag, { label: string; color: string; bg: string; border: string }> = {
  estavel: { label: 'Estável',   color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  vigiar:  { label: 'Vigiar',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  alerta:  { label: 'Alerta',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
}

function roomKey(r?: string | null) {
  if (!r) return 999999
  const n = parseInt(String(r).replace(/[^0-9]/g, ''))
  return isNaN(n) ? 999998 : n
}

export default function RondaGuiadaPage() {
  const { user, supabase } = useAuth() as any
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [idx, setIdx] = useState(0)
  const [status, setStatus] = useState<StatusTag | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ id: string; tag: StatusTag }[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [finished, setFinished] = useState(false)

  const today = getToday()
  const shift = getShift()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('patients').select('*').eq('user_id', user.id)
    const list = (data || []).filter((p: Patient) => p.active !== false).sort((a: Patient, b: Patient) => roomKey(a.room_number) - roomKey(b.room_number) || a.name.localeCompare(b.name))
    setPatients(list)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const current = patients[idx]
  const total = patients.length

  function reset() { setStatus(null); setNote('') }

  async function saveAndNext() {
    if (!user || !current) return
    setSaving(true)
    await supabase.from('care_records').upsert({
      user_id: user.id, patient_id: current.id, date: today, shift,
      mood: { behavior: status ? STATUS_CFG[status].label : null },
      notes: note.trim() || null,
    }, { onConflict: 'patient_id,date,shift' })
    setDone(d => [...d.filter(x => x.id !== current.id), { id: current.id, tag: status || 'estavel' }])
    setSaving(false)
    advance()
  }

  function skip() {
    if (current) setSkipped(s => [...s.filter(x => x !== current.id), current.id])
    advance()
  }

  function advance() {
    reset()
    if (idx + 1 >= total) setFinished(true)
    else setIdx(i => i + 1)
  }

  function goPrev() { if (idx > 0) { reset(); setIdx(i => i - 1); setFinished(false) } }

  const isHighRisk = current && (['CRITICO', 'ALTO'].includes((current.risk_level || '').toUpperCase()) || current.fall_risk === 'high' || current.pressure_risk === 'high')

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>A preparar a ronda…</div>
  }

  if (total === 0) {
    return (
      <div style={{ minHeight: '60vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'var(--font-sans)', padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)' }}>Sem residentes para a ronda</div>
        <Link href="/patients" style={{ color: '#0d6e42', fontWeight: 600, textDecoration: 'none' }}>Adicionar residentes →</Link>
      </div>
    )
  }

  if (finished) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 640 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Ronda concluída</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>{done.length} registados · {skipped.length} saltados · Turno {SHIFT_LABEL[shift]}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {patients.map(p => {
              const d = done.find(x => x.id === p.id)
              const sk = skipped.includes(p.id)
              const cfg = d ? STATUS_CFG[d.tag] : null
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', width: 44 }}>{p.room_number ? `Q${p.room_number}` : '—'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                  {cfg ? <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 9px', borderRadius: 6 }}>{cfg.label}</span>
                    : sk ? <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Saltado</span>
                    : <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>—</span>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setIdx(0); setFinished(false); setDone([]); setSkipped([]); reset() }} style={{ flex: 1, padding: '12px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>Nova ronda</button>
            <Link href="/hoje" style={{ flex: 1, padding: '12px', background: '#0d6e42', color: 'white', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>Ver tarefas →</Link>
          </div>
        </div>
      </div>
    )
  }

  const progress = Math.round(((idx) / total) * 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 620 }}>

        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ronda · Turno {SHIFT_LABEL[shift]}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{idx + 1} de {total}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#0d6e42', borderRadius: 3, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Resident card */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', background: isHighRisk ? '#fef2f2' : 'var(--bg-2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>{current.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                  {current.room_number ? `Quarto ${current.room_number}` : 'Sem quarto'}{current.age ? ` · ${current.age} anos` : ''}
                </div>
              </div>
              {isHighRisk && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>Alto risco</span>}
            </div>
            {current.allergies && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, color: '#92400e' }}>
                <strong>Alergias:</strong> {current.allergies}
              </div>
            )}
            {current.conditions && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-3)' }}>{current.conditions}</div>
            )}
          </div>

          <div style={{ padding: 22 }}>
            {/* Status tags */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Estado no turno</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              {(Object.keys(STATUS_CFG) as StatusTag[]).map(s => {
                const cfg = STATUS_CFG[s]
                const active = status === s
                return (
                  <button key={s} onClick={() => setStatus(active ? null : s)} style={{
                    padding: '14px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    border: `2px solid ${active ? cfg.color : 'var(--border)'}`,
                    background: active ? cfg.bg : 'white',
                    color: active ? cfg.color : 'var(--ink-3)',
                    fontSize: 15, fontWeight: active ? 700 : 600,
                  }}>{cfg.label}</button>
                )
              })}
            </div>

            {/* Quick note */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Nota rápida (opcional)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Observações da ronda..."
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />

            <Link href={`/patients/${current.id}`} style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver ficha completa →</Link>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={goPrev} disabled={idx === 0} style={{ width: 52, padding: '14px 0', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={skip} style={{ flex: 1, padding: '14px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>Saltar</button>
          <button onClick={saveAndNext} disabled={saving} style={{ flex: 2, padding: '14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
            {saving ? 'A guardar…' : idx + 1 >= total ? 'Guardar e terminar' : 'Guardar e seguinte →'}
          </button>
        </div>
      </div>
    </div>
  )
}
