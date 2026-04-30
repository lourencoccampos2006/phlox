'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  name: string
  age: number | null
  conditions: string | null
}

interface PatientMed {
  id: string
  name: string
  dose: string | null
  frequency: string | null
  indication: string | null
}

type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held' | null

interface AdminRecord {
  patient_id: string
  med_id: string
  shift: Shift
  date: string
  status: AdminStatus
  notes: string
  recorded_by: string
  recorded_at: string
}

const SHIFT_LABELS: Record<Shift, { label: string; time: string; color: string; bg: string }> = {
  manha: { label: 'Manhã', time: '07:00–14:00', color: '#d97706', bg: '#fffbeb' },
  tarde:  { label: 'Tarde',  time: '14:00–21:00', color: '#1d4ed8', bg: '#eff6ff' },
  noite:  { label: 'Noite',  time: '21:00–07:00', color: '#6d28d9', bg: '#faf5ff' },
}

const STATUS_LABELS: Record<NonNullable<AdminStatus>, { label: string; color: string; bg: string; border: string }> = {
  administered: { label: 'Administrado',  color: 'var(--green-2)',  bg: 'var(--green-light)', border: 'var(--green-mid)' },
  refused:      { label: 'Recusado',      color: '#dc2626',         bg: 'var(--red-light)',   border: '#fca5a5' },
  held:         { label: 'Suspenso',      color: '#92400e',         bg: 'var(--amber-light)', border: '#fde68a' },
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getCurrentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}

// ─── Admin Cell ───────────────────────────────────────────────────────────────

function AdminCell({
  record,
  onChange,
}: {
  record: AdminRecord | null
  onChange: (status: AdminStatus, notes: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(record?.notes || '')

  if (record?.status) {
    const s = STATUS_LABELS[record.status]
    return (
      <div
        style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', minWidth: 90 }}
        onClick={() => setOpen(true)}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, letterSpacing: '0.06em' }}>{s.label}</div>
        {record.notes && <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{record.notes}</div>}
        {open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
            onClick={e => { e.stopPropagation(); setOpen(false) }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '20px', width: 280, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Alterar registo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(Object.keys(STATUS_LABELS) as NonNullable<AdminStatus>[]).map(st => {
                  const sl = STATUS_LABELS[st]
                  return (
                    <button key={st} onClick={() => { onChange(st, notes); setOpen(false) }}
                      style={{ padding: '8px 12px', background: sl.bg, border: `1px solid ${sl.border}`, borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: sl.color }}>
                      {sl.label}
                    </button>
                  )
                })}
                <button onClick={() => { onChange(null, ''); setOpen(false) }}
                  style={{ padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-4)' }}>
                  Limpar registo
                </button>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Observação (opcional)"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px', fontSize: 12, fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(Object.keys(STATUS_LABELS) as NonNullable<AdminStatus>[]).map(st => {
          const sl = STATUS_LABELS[st]
          const shortLabel = st === 'administered' ? '✓' : st === 'refused' ? 'R' : 'S'
          return (
            <button key={st} onClick={() => onChange(st, '')}
              title={sl.label}
              style={{ width: 28, height: 28, border: `1px solid ${sl.border}`, borderRadius: 5, background: sl.bg, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: sl.color }}>
              {shortLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MARPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [meds, setMeds] = useState<PatientMed[]>([])
  const [date, setDate] = useState(getToday())
  const [shift, setShift] = useState<Shift>(getCurrentShift())
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  // Load patients
  useEffect(() => {
    if (!user || !isPro) return
    supabase.from('patients').select('id, name, age, conditions')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .then(({ data }) => setPatients(data || []))
  }, [user, isPro, supabase])

  // Load meds when patient changes
  useEffect(() => {
    if (!selectedPatient) { setMeds([]); return }
    supabase.from('patient_meds')
      .select('id, name, dose, frequency, indication')
      .eq('patient_id', selectedPatient)
      .eq('active', true)
      .then(({ data }) => setMeds(data || []))
  }, [selectedPatient, supabase])

  // Load admin records for this patient/date/shift
  useEffect(() => {
    if (!selectedPatient || !date) return
    supabase.from('mar_records')
      .select('*')
      .eq('patient_id', selectedPatient)
      .eq('date', date)
      .eq('shift', shift)
      .then(({ data }) => setRecords(data || []))
  }, [selectedPatient, date, shift, supabase])

  const getRecord = (medId: string) =>
    records.find(r => r.med_id === medId && r.shift === shift) || null

  const handleAdmin = async (medId: string, status: AdminStatus, notes: string) => {
    if (!user || !selectedPatient) return
    setSaving(medId)
    const existing = getRecord(medId)
    const record = {
      patient_id: selectedPatient,
      med_id: medId,
      shift,
      date,
      status,
      notes,
      recorded_by: user.name || user.email,
      recorded_at: new Date().toISOString(),
    }

    if (status === null && existing) {
      await supabase.from('mar_records').delete().eq('id', (existing as any).id)
      setRecords(prev => prev.filter(r => r.med_id !== medId || r.shift !== shift))
    } else if (existing) {
      const { data } = await supabase.from('mar_records').update({ status, notes, recorded_at: record.recorded_at })
        .eq('id', (existing as any).id).select().single()
      if (data) setRecords(prev => prev.map(r => r.med_id === medId && r.shift === shift ? data : r))
    } else if (status) {
      const { data } = await supabase.from('mar_records').insert(record).select().single()
      if (data) setRecords(prev => [...prev, data])
    }
    setSaving(null)
  }

  const administered = records.filter(r => r.shift === shift && r.status === 'administered').length
  const total = meds.length

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14 }}>Registo de Administração de Medicação</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
            O MAR (Medication Administration Record) é a ferramenta obrigatória em lares e hospitais para registar cada administração de medicação — quem administrou, quando, e o que aconteceu.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Activar Plano Pro →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* MAR Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>
                  Registo de Administração
                </h1>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 3, letterSpacing: '0.08em' }}>MAR</span>
              </div>
              {selectedPatient && total > 0 && (
                <div style={{ fontSize: 12, color: administered === total ? 'var(--green)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {administered}/{total} administrados neste turno
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Patient selector */}
              <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', minWidth: 180 }}>
                <option value="">Seleccionar doente...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>
                ))}
              </select>

              {/* Date */}
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />

              {/* Shift selector */}
              <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {(Object.keys(SHIFT_LABELS) as Shift[]).map(s => {
                  const sl = SHIFT_LABELS[s]
                  return (
                    <button key={s} onClick={() => setShift(s)}
                      style={{ padding: '8px 14px', background: shift === s ? sl.color : 'white', color: shift === s ? 'white' : 'var(--ink-4)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                      {sl.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {!selectedPatient ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-3)', fontWeight: 400, fontStyle: 'italic', marginBottom: 10 }}>
              Selecciona um doente para começar
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6 }}>
              O MAR regista cada administração de medicação por turno. Cada registo fica assinado com o teu nome e hora.
            </p>
            {patients.length === 0 && (
              <div style={{ marginTop: 20 }}>
                <Link href="/dashboard?mode=pro" style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  Criar doentes no Dashboard →
                </Link>
              </div>
            )}
          </div>
        ) : meds.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 16 }}>
              Sem medicamentos registados para este doente.
            </div>
            <Link href={`/patients/${selectedPatient}`} style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              Adicionar medicamentos ao perfil →
            </Link>
          </div>
        ) : (
          <div>
            {/* Shift info bar */}
            <div style={{ background: SHIFT_LABELS[shift].bg, border: `1px solid ${SHIFT_LABELS[shift].color}30`, borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: SHIFT_LABELS[shift].color }}>
                Turno da {SHIFT_LABELS[shift].label} · {SHIFT_LABELS[shift].time}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                {new Date(date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {/* MAR table */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 140px', gap: 0, background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
                {['Medicamento', 'Dose', 'Frequência', 'Registo'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {meds.map((med, i) => {
                const rec = getRecord(med.id)
                const isSaving = saving === med.id
                return (
                  <div key={med.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 140px', gap: 0, padding: '12px 16px', borderBottom: i < meds.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center', opacity: isSaving ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                      {med.indication && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.indication}</div>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{med.dose || '—'}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{med.frequency || '—'}</div>
                    <AdminCell record={rec} onChange={(status, notes) => handleAdmin(med.id, status, notes)} />
                  </div>
                )
              })}
            </div>

            {/* Summary footer */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                {(Object.keys(STATUS_LABELS) as NonNullable<AdminStatus>[]).map(st => {
                  const count = records.filter(r => r.shift === shift && r.status === st).length
                  const sl = STATUS_LABELS[st]
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sl.color }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{sl.label}: <strong>{count}</strong></span>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                Registado por: {user?.name || user?.email}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}