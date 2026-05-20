'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held'

interface PatientMedRow {
  id: string
  name: string
  dose: string | null
  status: AdminStatus | null
  recordId: string | null
  recordedBy: string | null
  recordedAt: string | null
  notes: string | null
}

interface PatientCard {
  id: string
  name: string
  age: number | null
  conditions: string | null
  allergies: string | null
  weight: number | null
  creatinine: number | null
  sex: string | null
  meds: PatientMedRow[]
  riskScore: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<Shift, { label: string; time: string; color: string; bg: string; border: string; endHour: number }> = {
  manha: { label: 'Manhã', time: '07:00–14:00', color: '#d97706', bg: '#fffbeb', border: '#fde68a', endHour: 14 },
  tarde: { label: 'Tarde', time: '14:00–21:00', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', endHour: 21 },
  noite: { label: 'Noite', time: '21:00–07:00', color: '#6d28d9', bg: '#faf5ff', border: '#ddd6fe', endHour: 7 },
}

const STATUS_CONFIG: Record<AdminStatus, { label: string; short: string; color: string; bg: string; border: string }> = {
  administered: { label: 'Administrado', short: '✓', color: 'var(--green-2)',  bg: 'var(--green-light)', border: 'var(--green-mid)' },
  refused:      { label: 'Recusado',     short: 'R', color: '#dc2626',         bg: '#fee2e2',            border: '#fca5a5' },
  held:         { label: 'Suspenso',     short: 'S', color: '#92400e',         bg: '#fffbeb',            border: '#fde68a' },
}

const BZD = ['diazepam','lorazepam','alprazolam','midazolam','clonazepam','temazepam','triazolam','oxazepam','bromazepam','clobazam','nitrazepam','flurazepam']
const ANTICOAG = ['varfarina','warfarin','rivaroxabano','apixabano','dabigatrano','edoxabano','heparina','enoxaparina','dalteparina','fondaparinux','acenocumarol']
const NSAIDS = ['ibuprofeno','diclofenac','naproxeno','meloxicam','piroxicam','indometacina','celecoxib','etoricoxib','nimesulida','cetoprofeno','aceclofenac']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getCurrentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}

function calcRisk(patient: PatientCard): number {
  const names = patient.meds.map(m => m.name.toLowerCase())
  const count = patient.meds.length
  let score = Math.min(count * 5, 35)
  if (count >= 5) score += 20
  if ((patient.age || 0) >= 75) score += 15
  const hasBzd = names.some(n => BZD.some(b => n.includes(b)))
  const hasAnticoag = names.some(n => ANTICOAG.some(a => n.includes(a)))
  const hasNsaid = names.some(n => NSAIDS.some(ns => n.includes(ns)))
  if (hasBzd && (patient.age || 0) >= 65) score += 20
  if (hasNsaid && hasAnticoag) score += 25
  // Renal risk: high creatinine
  if (patient.creatinine && patient.creatinine > 1.5) score += 10
  if (patient.creatinine && patient.creatinine > 3.0) score += 15
  return Math.min(score, 100)
}

function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 60) return { label: 'Alto',  color: '#991b1b', bg: '#fee2e2' }
  if (score >= 35) return { label: 'Médio', color: '#854d0e', bg: '#fef9c3' }
  return                   { label: 'Baixo', color: '#166534', bg: '#dcfce7' }
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function calcCrCl(p: PatientCard): number | null {
  if (!p.age || !p.weight || !p.creatinine || !p.sex) return null
  return Math.round(((140 - p.age) * p.weight * (p.sex === 'F' ? 0.85 : 1)) / (72 * p.creatinine))
}

function getGFRStage(crCl: number | null): { stage: string; color: string; bg: string } | null {
  if (crCl === null) return null
  if (crCl >= 90) return { stage: 'G1', color: '#166534', bg: '#dcfce7' }
  if (crCl >= 60) return { stage: 'G2', color: '#0d6e42', bg: '#d1fae5' }
  if (crCl >= 45) return { stage: 'G3a', color: '#d97706', bg: '#fffbeb' }
  if (crCl >= 30) return { stage: 'G3b', color: '#b45309', bg: '#fef3c7' }
  if (crCl >= 15) return { stage: 'G4', color: '#dc2626', bg: '#fee2e2' }
  return { stage: 'G5', color: '#991b1b', bg: '#fecaca' }
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useShiftCountdown(shift: Shift): string {
  const [text, setText] = useState('')
  useEffect(() => {
    function update() {
      const now = new Date()
      const endHour = SHIFT_LABELS[shift].endHour
      const end = new Date(now)
      end.setHours(endHour, 0, 0, 0)
      if (end <= now) end.setDate(end.getDate() + 1)
      const diffMs = end.getTime() - now.getTime()
      const h = Math.floor(diffMs / 3_600_000)
      const m = Math.floor((diffMs % 3_600_000) / 60_000)
      setText(`${h}h ${m.toString().padStart(2, '0')}m`)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [shift])
  return text
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TurnoPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [shift, setShift] = useState<Shift>(getCurrentShift())
  const [date, setDate] = useState(getToday())
  const [patients, setPatients] = useState<PatientCard[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'urgency' | 'name'>('urgency')
  const [search, setSearch] = useState('')
  // notes modal
  const [notesModal, setNotesModal] = useState<{ patientId: string; medId: string; status: AdminStatus; medName: string } | null>(null)
  const [notesInput, setNotesInput] = useState('')

  const countdown = useShiftCountdown(shift)
  const sl = SHIFT_LABELS[shift]

  const load = useCallback(async () => {
    if (!user || !isPro) return
    setLoading(true)
    try {
      const { data: rawPatients } = await supabase
        .from('patients')
        .select('id, name, age, sex, weight, creatinine, conditions, allergies')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      const pIds = (rawPatients || []).map((p: any) => p.id)
      if (pIds.length === 0) { setPatients([]); return }

      const [{ data: rawMeds }, { data: rawRecords }] = await Promise.all([
        supabase.from('patient_meds').select('id, patient_id, name, dose').eq('active', true).in('patient_id', pIds),
        supabase.from('mar_records').select('id, patient_id, med_id, status, notes, recorded_by, recorded_at').eq('date', date).eq('shift', shift).in('patient_id', pIds),
      ])

      const cards: PatientCard[] = (rawPatients || []).map((p: any) => {
        const meds: PatientMedRow[] = (rawMeds || [])
          .filter((m: any) => m.patient_id === p.id)
          .map((m: any) => {
            const rec = (rawRecords || []).find((r: any) => r.med_id === m.id && r.patient_id === p.id)
            return {
              id: m.id, name: m.name, dose: m.dose,
              status: rec?.status ?? null, recordId: rec?.id ?? null,
              recordedBy: rec?.recorded_by ?? null, recordedAt: rec?.recorded_at ?? null,
              notes: rec?.notes ?? null,
            }
          })
        const card: PatientCard = { id: p.id, name: p.name, age: p.age, sex: p.sex, weight: p.weight, creatinine: p.creatinine, conditions: p.conditions, allergies: p.allergies, meds, riskScore: 0 }
        card.riskScore = calcRisk(card)
        return card
      })

      setPatients(cards)
    } finally {
      setLoading(false)
    }
  }, [user, isPro, supabase, date, shift])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const urgent = patients.filter(p => p.meds.some(m => !m.status)).map(p => p.id).slice(0, 5)
    setExpanded(new Set(urgent))
  }, [patients])

  const handleRecord = async (patient: PatientCard, med: PatientMedRow, status: AdminStatus | null, notes?: string) => {
    if (!user) return
    setSaving(`${patient.id}-${med.id}`)
    const base = {
      patient_id: patient.id,
      user_id: user.id,
      med_id: med.id,
      shift,
      date,
      recorded_by: (user as any).name || user.email,
      recorded_at: new Date().toISOString(),
      notes: notes ?? '',
    }
    let newRecordId = med.recordId
    if (status === null && med.recordId) {
      await supabase.from('mar_records').delete().eq('id', med.recordId)
      newRecordId = null
    } else if (med.recordId) {
      await supabase.from('mar_records').update({ status, recorded_at: base.recorded_at, notes: notes ?? med.notes ?? '' }).eq('id', med.recordId)
    } else if (status) {
      const { data } = await supabase.from('mar_records').insert({ ...base, status }).select('id').single()
      newRecordId = data?.id ?? null
    }
    setPatients(prev => prev.map(p => p.id !== patient.id ? p : {
      ...p, meds: p.meds.map(m => m.id !== med.id ? m : {
        ...m, status, recordId: newRecordId,
        recordedBy: base.recorded_by, recordedAt: base.recorded_at, notes: notes ?? m.notes,
      }),
    }))
    setSaving(null)
    setNotesModal(null)
    setNotesInput('')
  }

  const administerAll = async (patient: PatientCard) => {
    if (!user) return
    const pending = patient.meds.filter(m => !m.status)
    if (!pending.length) return
    setSaving(`all-${patient.id}`)
    const now = new Date().toISOString()
    const inserts = pending.map(m => ({
      patient_id: patient.id, user_id: user.id, med_id: m.id, shift, date,
      status: 'administered', notes: '',
      recorded_by: (user as any).name || user.email,
      recorded_at: now,
    }))
    const { data: inserted } = await supabase.from('mar_records').insert(inserts).select('id, med_id')
    const idMap = Object.fromEntries((inserted || []).map((r: any) => [r.med_id, r.id]))
    setPatients(prev => prev.map(p => p.id !== patient.id ? p : {
      ...p, meds: p.meds.map(m => m.status ? m : {
        ...m, status: 'administered' as AdminStatus, recordId: idMap[m.id] ?? null,
        recordedBy: (user as any).name || user.email, recordedAt: now, notes: '',
      }),
    }))
    setSaving(null)
  }

  const printShift = () => window.print()

  // ─── Derived ────────────────────────────────────────────────────────────────

  const filtered = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.conditions || '').toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    const aMiss = a.meds.filter(m => !m.status).length
    const bMiss = b.meds.filter(m => !m.status).length
    if (bMiss !== aMiss) return bMiss - aMiss
    return b.riskScore - a.riskScore
  })

  const totalMeds = patients.reduce((s, p) => s + p.meds.length, 0)
  const totalDone = patients.reduce((s, p) => s + p.meds.filter(m => !!m.status).length, 0)
  const pct = totalMeds > 0 ? Math.round((totalDone / totalMeds) * 100) : 0

  // ─── Upsell ─────────────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14 }}>Gestão de Turno</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
            Todos os doentes do turno num relance — doses em falta, score de risco, registo com um toque. Exclusivo para planos Pro e Clinic.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Ver planos →
          </Link>
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>

      {/* Sticky top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '14px 0', position: 'sticky', top: 0, zIndex: 40 }} className="no-print">
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>
                  Gestão de Turno
                </h1>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: sl.color, background: sl.bg, border: `1px solid ${sl.border}`, padding: '2px 9px', borderRadius: 3, letterSpacing: '0.08em' }}>
                  {sl.label.toUpperCase()} · {sl.time}
                </span>
                {countdown && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 3 }}>
                    ⏱ {countdown} para fim
                  </span>
                )}
              </div>
              {!loading && totalMeds > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 120, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green-2)' : sl.color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: pct === 100 ? 'var(--green-2)' : 'var(--ink-3)' }}>
                    {totalDone}/{totalMeds} · {pct}%
                  </span>
                  {pct === 100 && (
                    <span style={{ fontSize: 11, color: 'var(--green-2)', fontWeight: 700 }}>✓ Turno completo</span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar doente..."
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 11px 7px 30px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', width: 170 }} />
              </div>

              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />

              {/* Shift selector */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {(Object.keys(SHIFT_LABELS) as Shift[]).map(s => {
                  const sli = SHIFT_LABELS[s]
                  return (
                    <button key={s} onClick={() => setShift(s)}
                      style={{ padding: '7px 13px', background: shift === s ? sli.color : 'white', color: shift === s ? 'white' : 'var(--ink-4)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                      {sli.label}
                    </button>
                  )
                })}
              </div>

              {/* Sort */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {(['urgency', 'name'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)}
                    style={{ padding: '7px 13px', background: sortBy === s ? 'var(--ink)' : 'white', color: sortBy === s ? 'white' : 'var(--ink-4)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                    {s === 'urgency' ? 'Urgência' : 'A→Z'}
                  </button>
                ))}
              </div>

              {/* Print */}
              <button onClick={printShift}
                style={{ padding: '7px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>

              {/* Handover */}
              <Link href="/handover"
                style={{ padding: '7px 12px', background: sl.bg, border: `1px solid ${sl.border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', color: sl.color, fontFamily: 'var(--font-sans)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                Passagem de turno →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            A carregar turno...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 12 }}>
              Sem doentes registados
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24 }}>
              Adiciona doentes em{' '}
              <Link href="/patients" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>Doentes / Utentes</Link>{' '}
              para começar a gerir turnos.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>Nenhum doente corresponde a "{search}"</div>
            <button onClick={() => setSearch('')} style={{ marginTop: 10, fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>Limpar pesquisa</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map(patient => {
              const recorded = patient.meds.filter(m => !!m.status).length
              const total = patient.meds.length
              const missing = total - recorded
              const complete = total > 0 && missing === 0
              const risk = riskLevel(patient.riskScore)
              const isExpanded = expanded.has(patient.id)
              const isSavingAll = saving === `all-${patient.id}`
              const crCl = calcCrCl(patient)
              const gfr = getGFRStage(crCl)

              return (
                <div key={patient.id}
                  style={{ background: 'white', border: `1.5px solid ${complete ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>

                  {/* Card header */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: complete ? '#f0fdf4' : 'white', userSelect: 'none' }}
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(patient.id) ? n.delete(patient.id) : n.add(patient.id); return n })}>

                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: complete ? 'var(--green-2)' : missing > 2 ? '#dc2626' : sl.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: complete ? 18 : 14 }}>
                      {complete ? '✓' : missing}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{patient.name}</span>
                        {patient.age != null && (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.age}a</span>
                        )}
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: risk.color, background: risk.bg, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.04em' }}>
                          Risco {risk.label}
                        </span>
                        {gfr && crCl && (
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: gfr.color, background: gfr.bg, padding: '2px 8px', borderRadius: 10 }}
                            title={`CrCl ${crCl} mL/min`}>
                            IRC {gfr.stage}
                          </span>
                        )}
                        {patient.allergies && (
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 10 }}>
                            ⚠ ALERGIAS
                          </span>
                        )}
                      </div>
                      {patient.conditions && (
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                          {patient.conditions}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: complete ? 'var(--green-2)' : 'var(--ink-3)' }}>
                          {recorded}/{total}
                        </div>
                        <div style={{ width: 80, height: 4, background: 'var(--bg-3)', borderRadius: 2, marginTop: 4 }}>
                          <div style={{ width: `${total > 0 ? (recorded / total) * 100 : 0}%`, height: '100%', background: complete ? 'var(--green-2)' : sl.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>

                      {!complete && total > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); administerAll(patient) }}
                          disabled={isSavingAll}
                          style={{ padding: '7px 14px', background: sl.color, color: 'white', border: 'none', borderRadius: 7, cursor: isSavingAll ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', opacity: isSavingAll ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                          {isSavingAll ? '...' : `✓ Todos (${missing})`}
                        </button>
                      )}

                      <Link href="/mar" onClick={e => e.stopPropagation()}
                        style={{ padding: '7px 12px', background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        MAR →
                      </Link>

                      <span style={{ color: 'var(--ink-4)', fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>
                  </div>

                  {/* Expanded: per-med rows */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--bg-3)' }}>
                      {patient.meds.length === 0 ? (
                        <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                          Sem medicamentos ativos.{' '}
                          <Link href={`/patients/${patient.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>Adicionar →</Link>
                        </div>
                      ) : (
                        patient.meds.map((med, i) => {
                          const isLast = i === patient.meds.length - 1
                          const isSavingMed = saving === `${patient.id}-${med.id}`
                          const done = !!med.status
                          const cfg = med.status ? STATUS_CONFIG[med.status] : null
                          return (
                            <div key={med.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 72px', borderBottom: isLast ? 'none' : '1px solid var(--bg-3)', background: done ? '#f9fafb' : 'white', opacity: isSavingMed ? 0.6 : 1, transition: 'all 0.15s' }}>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>
                                  {med.name}
                                </div>
                                {med.dose && (
                                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.dose}</div>
                                )}
                                {/* Timestamp + recorded by */}
                                {done && med.recordedAt && (
                                  <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                                    {formatTime(med.recordedAt)}{med.recordedBy ? ` · ${med.recordedBy}` : ''}{med.notes ? ` · "${med.notes}"` : ''}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                                {done && cfg ? (
                                  <>
                                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 10, border: `1px solid ${cfg.border}` }}>
                                      {cfg.label}
                                    </span>
                                    <button onClick={() => handleRecord(patient, med, null)}
                                      title="Remover registo"
                                      style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: 10, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      ✕
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {(Object.keys(STATUS_CONFIG) as AdminStatus[]).map(st => {
                                      const c = STATUS_CONFIG[st]
                                      return (
                                        <button key={st}
                                          onClick={() => {
                                            if (st === 'administered') {
                                              setNotesModal({ patientId: patient.id, medId: med.id, status: st, medName: med.name })
                                              setNotesInput('')
                                            } else {
                                              handleRecord(patient, med, st)
                                            }
                                          }}
                                          title={c.label}
                                          style={{ width: 30, height: 30, border: `1px solid ${c.border}`, borderRadius: 6, background: c.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: c.color }}>
                                          {c.short}
                                        </button>
                                      )
                                    })}
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Notes modal on administering */}
      {notesModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '22px', width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Administrar: {notesModal.medName}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Observação opcional (via, hora real, intercorrências)</div>
            <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={3}
              placeholder="Ex: Via SC, doente recusou inicialmente..."
              autoFocus
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const patient = patients.find(p => p.id === notesModal.patientId)
                  const med = patient?.meds.find(m => m.id === notesModal.medId)
                  if (patient && med) handleRecord(patient, med, notesModal.status, notesInput)
                }}
                style={{ flex: 1, background: 'var(--green-2)', color: 'white', border: 'none', borderRadius: 7, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ✓ Confirmar
              </button>
              <button onClick={() => setNotesModal(null)}
                style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
