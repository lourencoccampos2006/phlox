'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
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
}

interface PatientCard {
  id: string
  name: string
  age: number | null
  conditions: string | null
  allergies: string | null
  meds: PatientMedRow[]
  riskScore: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<Shift, { label: string; time: string; color: string; bg: string; border: string }> = {
  manha: { label: 'Manhã', time: '07:00–14:00', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  tarde: { label: 'Tarde', time: '14:00–21:00', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  noite: { label: 'Noite', time: '21:00–07:00', color: '#6d28d9', bg: '#faf5ff', border: '#ddd6fe' },
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
  return Math.min(score, 100)
}

function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 60) return { label: 'Alto',  color: '#991b1b', bg: '#fee2e2' }
  if (score >= 35) return { label: 'Médio', color: '#854d0e', bg: '#fef9c3' }
  return                   { label: 'Baixo', color: '#166534', bg: '#dcfce7' }
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

  const load = useCallback(async () => {
    if (!user || !isPro) return
    setLoading(true)
    try {
      const { data: rawPatients } = await supabase
        .from('patients')
        .select('id, name, age, conditions, allergies')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      const pIds = (rawPatients || []).map((p: any) => p.id)
      if (pIds.length === 0) { setPatients([]); return }

      const [{ data: rawMeds }, { data: rawRecords }] = await Promise.all([
        supabase.from('patient_meds').select('id, patient_id, name, dose').eq('active', true).in('patient_id', pIds),
        supabase.from('mar_records').select('id, patient_id, med_id, status').eq('date', date).eq('shift', shift).in('patient_id', pIds),
      ])

      const cards: PatientCard[] = (rawPatients || []).map((p: any) => {
        const meds: PatientMedRow[] = (rawMeds || [])
          .filter((m: any) => m.patient_id === p.id)
          .map((m: any) => {
            const rec = (rawRecords || []).find((r: any) => r.med_id === m.id && r.patient_id === p.id)
            return { id: m.id, name: m.name, dose: m.dose, status: rec?.status ?? null, recordId: rec?.id ?? null }
          })
        const card: PatientCard = { id: p.id, name: p.name, age: p.age, conditions: p.conditions, allergies: p.allergies, meds, riskScore: 0 }
        card.riskScore = calcRisk(card)
        return card
      })

      setPatients(cards)
    } finally {
      setLoading(false)
    }
  }, [user, isPro, supabase, date, shift])

  useEffect(() => { load() }, [load])

  // Auto-expand patients with missing doses (up to 5)
  useEffect(() => {
    const urgent = patients.filter(p => p.meds.some(m => !m.status)).map(p => p.id).slice(0, 5)
    setExpanded(new Set(urgent))
  }, [patients])

  const handleRecord = async (patient: PatientCard, med: PatientMedRow, status: AdminStatus | null) => {
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
    }
    if (status === null && med.recordId) {
      await supabase.from('mar_records').delete().eq('id', med.recordId)
    } else if (med.recordId) {
      await supabase.from('mar_records').update({ status, recorded_at: base.recorded_at }).eq('id', med.recordId)
    } else if (status) {
      const { data } = await supabase.from('mar_records').insert({ ...base, status, notes: '' }).select('id').single()
      med = { ...med, recordId: data?.id ?? null }
    }
    setPatients(prev => prev.map(p => p.id !== patient.id ? p : {
      ...p, meds: p.meds.map(m => m.id !== med.id ? m : { ...m, status, recordId: med.recordId }),
    }))
    setSaving(null)
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
      ...p, meds: p.meds.map(m => m.status ? m : { ...m, status: 'administered' as AdminStatus, recordId: idMap[m.id] ?? null }),
    }))
    setSaving(null)
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const sorted = [...patients].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    const aMiss = a.meds.filter(m => !m.status).length
    const bMiss = b.meds.filter(m => !m.status).length
    if (bMiss !== aMiss) return bMiss - aMiss
    return b.riskScore - a.riskScore
  })

  const totalMeds = patients.reduce((s, p) => s + p.meds.length, 0)
  const totalDone = patients.reduce((s, p) => s + p.meds.filter(m => !!m.status).length, 0)
  const pct = totalMeds > 0 ? Math.round((totalDone / totalMeds) * 100) : 0
  const sl = SHIFT_LABELS[shift]

  // ─── Upsell ─────────────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
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
      <Header />

      {/* Sticky top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '14px 0', position: 'sticky', top: 0, zIndex: 40 }}>
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

              return (
                <div key={patient.id}
                  style={{ background: 'white', border: `1.5px solid ${complete ? 'var(--green-mid)' : missing > 0 ? 'var(--border)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>

                  {/* Card header — click to expand */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: complete ? '#f0fdf4' : 'white', userSelect: 'none' }}
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(patient.id) ? n.delete(patient.id) : n.add(patient.id); return n })}>

                    {/* Circle indicator */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: complete ? 'var(--green-2)' : missing > 2 ? '#dc2626' : sl.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: complete ? 18 : 14 }}>
                      {complete ? '✓' : missing}
                    </div>

                    {/* Patient info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{patient.name}</span>
                        {patient.age != null && (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.age}a</span>
                        )}
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: risk.color, background: risk.bg, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.04em' }}>
                          Risco {risk.label}
                        </span>
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

                    {/* Right side: progress + actions */}
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

                              {/* Med info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>
                                  {med.name}
                                </div>
                                {med.dose && (
                                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.dose}</div>
                                )}
                              </div>

                              {/* Action buttons */}
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
                                  (Object.keys(STATUS_CONFIG) as AdminStatus[]).map(st => {
                                    const c = STATUS_CONFIG[st]
                                    return (
                                      <button key={st} onClick={() => handleRecord(patient, med, st)}
                                        title={c.label}
                                        style={{ width: 30, height: 30, border: `1px solid ${c.border}`, borderRadius: 6, background: c.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: c.color }}>
                                        {c.short}
                                      </button>
                                    )
                                  })
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
    </div>
  )
}
