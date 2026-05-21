'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held'

interface PatientMedRow { id: string; name: string; dose: string | null; status: AdminStatus | null }
interface PatientCard { id: string; name: string; age: number | null; conditions: string | null; allergies: string | null; meds: PatientMedRow[] }

interface CareRecord {
  id: string; patient_id: string; shift: string; date: string
  vitals: { bp_sys?: number; bp_dia?: number; hr?: number; temp?: number; spo2?: number; glucose?: number } | null
  nutrition: { appetite?: string } | null
  skin: { integrity?: string; description?: string } | null
  mood: { level?: number; behavior?: string } | null
  notes?: string
}

interface ClinicalAlert {
  patient_id: string; patient_name: string; level: 'critical' | 'warning' | 'info'; icon: string; message: string
}

const SHIFT_LABELS: Record<Shift, { label: string; time: string; color: string; bg: string; border: string }> = {
  manha: { label: 'Manhã', time: '07:00–14:00', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  tarde: { label: 'Tarde', time: '14:00–21:00', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  noite: { label: 'Noite', time: '21:00–07:00', color: '#6d28d9', bg: '#faf5ff', border: '#ddd6fe' },
}

function getToday() { return new Date().toISOString().split('T')[0] }
function getCurrentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}

export default function HandoverPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [shift, setShift] = useState<Shift>(getCurrentShift())
  const [date, setDate] = useState(getToday())
  const [patients, setPatients] = useState<PatientCard[]>([])
  const [careRecords, setCareRecords] = useState<CareRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [handoverText, setHandoverText] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const sl = SHIFT_LABELS[shift]

  const loadData = useCallback(async () => {
    if (!user || !isPro) return
    setLoading(true)
    const { data: rawPatients } = await supabase.from('patients').select('id, name, age, conditions, allergies').eq('user_id', user.id).order('name')
    const pIds = (rawPatients || []).map((p: any) => p.id)
    if (!pIds.length) { setPatients([]); setLoading(false); return }

    const [{ data: rawMeds }, { data: rawRecords }, { data: rawCare }] = await Promise.all([
      supabase.from('patient_meds').select('id, patient_id, name, dose').eq('active', true).in('patient_id', pIds),
      supabase.from('mar_records').select('id, patient_id, med_id, status').eq('date', date).eq('shift', shift).in('patient_id', pIds),
      supabase.from('care_records').select('id, patient_id, shift, date, vitals, nutrition, skin, mood, notes').eq('date', date).eq('shift', shift).in('patient_id', pIds),
    ])
    setCareRecords(rawCare ?? [])

    const cards: PatientCard[] = (rawPatients || []).map((p: any) => ({
      id: p.id, name: p.name, age: p.age, conditions: p.conditions, allergies: p.allergies,
      meds: (rawMeds || []).filter((m: any) => m.patient_id === p.id).map((m: any) => {
        const rec = (rawRecords || []).find((r: any) => r.med_id === m.id)
        return { id: m.id, name: m.name, dose: m.dose, status: rec?.status ?? null }
      }),
    }))
    setPatients(cards)
    setLoading(false)
  }, [user, isPro, supabase, date, shift])

  useEffect(() => { loadData() }, [loadData])

  const totalMeds = patients.reduce((s, p) => s + p.meds.length, 0)
  const totalDone = patients.reduce((s, p) => s + p.meds.filter(m => m.status === 'administered').length, 0)
  const totalPending = totalMeds - totalDone
  const patientsWithPending = patients.filter(p => p.meds.some(m => !m.status))
  const patientsWithRefusals = patients.filter(p => p.meds.some(m => m.status === 'refused'))
  const patientsWithAllergies = patients.filter(p => p.allergies)

  const patientNameMap = new Map(patients.map(p => [p.id, p.name]))
  const clinicalAlerts: ClinicalAlert[] = careRecords.flatMap(rec => {
    const name = patientNameMap.get(rec.patient_id) ?? 'Residente'
    const als: ClinicalAlert[] = []
    const v = rec.vitals
    if (v) {
      if (v.temp && v.temp >= 38.5) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '🌡️', message: `Febre alta: ${v.temp}°C` })
      else if (v.temp && v.temp >= 37.8) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'warning', icon: '🌡️', message: `Temperatura elevada: ${v.temp}°C` })
      if (v.spo2 && v.spo2 < 90) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '💨', message: `SpO₂ crítica: ${v.spo2}%` })
      else if (v.spo2 && v.spo2 < 94) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'warning', icon: '💨', message: `SpO₂ baixa: ${v.spo2}%` })
      if (v.bp_sys && v.bp_sys >= 180) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '💓', message: `TA muito elevada: ${v.bp_sys}/${v.bp_dia} mmHg` })
      else if (v.bp_sys && v.bp_sys >= 160) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'warning', icon: '💓', message: `TA elevada: ${v.bp_sys}/${v.bp_dia} mmHg` })
      if (v.bp_sys && v.bp_sys < 90) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '💓', message: `Hipotensão: ${v.bp_sys}/${v.bp_dia} mmHg` })
      if (v.glucose && v.glucose > 300) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '🩸', message: `Glicemia muito alta: ${v.glucose} mg/dL` })
      else if (v.glucose && v.glucose < 60) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'critical', icon: '🩸', message: `Hipoglicemia: ${v.glucose} mg/dL` })
    }
    if (rec.skin?.integrity === 'ulcera') als.push({ patient_id: rec.patient_id, patient_name: name, level: 'warning', icon: '🩹', message: `Úlcera de pressão${rec.skin.description ? ` — ${rec.skin.description}` : ''}` })
    else if (rec.skin?.integrity === 'ferida') als.push({ patient_id: rec.patient_id, patient_name: name, level: 'info', icon: '🩹', message: `Ferida registada${rec.skin.description ? ` — ${rec.skin.description}` : ''}` })
    if (rec.nutrition?.appetite === 'recusou') als.push({ patient_id: rec.patient_id, patient_name: name, level: 'warning', icon: '🍽️', message: 'Recusou alimentação neste turno' })
    if (rec.mood?.level && rec.mood.level <= 2) als.push({ patient_id: rec.patient_id, patient_name: name, level: 'info', icon: '😟', message: `Humor muito baixo (${rec.mood.level}/5)${rec.mood.behavior ? ` — ${rec.mood.behavior}` : ''}` })
    return als
  })
  const criticalClinical = clinicalAlerts.filter(a => a.level === 'critical').length

  const generate = async () => {
    setGenerating(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/handover', {
        method: 'POST', headers,
        body: JSON.stringify({ shift, date, patients }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro.'); setGenerating(false); return }
      let text = data.text
      if (extraNotes.trim()) text += `\n\nNotas adicionais: ${extraNotes}`
      setHandoverText(text)
    } catch { setError('Erro de rede.') }
    setGenerating(false)
  }

  const copy = () => {
    navigator.clipboard.writeText(handoverText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14 }}>Passagem de Turno</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>Gera uma passagem de turno estruturada com resumo da medicação administrada, doses em falta e alertas.</p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Ver planos →</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: '#d97706', borderRadius: 1 }} />
                Clínico · Turno
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400 }}>Passagem de Turno</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ border: '1px solid #334155', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: '#1e293b', color: '#f1f5f9' }} />
              <div style={{ display: 'flex', border: '1px solid #334155', borderRadius: 7, overflow: 'hidden' }}>
                {(Object.keys(SHIFT_LABELS) as Shift[]).map(s => (
                  <button key={s} onClick={() => setShift(s)}
                    style={{ padding: '8px 14px', background: shift === s ? SHIFT_LABELS[s].color : '#1e293b', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    {SHIFT_LABELS[s].label}
                  </button>
                ))}
              </div>
              <Link href="/turno" style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid #334155', borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                ← Turno
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>A carregar dados do turno...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: handoverText ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>

            {/* Stats + input panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Shift summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Doentes', value: patients.length, color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'Administradas', value: totalDone, color: '#059669', bg: '#f0fdf4' },
                  { label: 'Em falta', value: totalPending, color: totalPending > 0 ? '#dc2626' : '#059669', bg: totalPending > 0 ? '#fee2e2' : '#f0fdf4' },
                  { label: 'Recusadas', value: patients.reduce((s, p) => s + p.meds.filter(m => m.status === 'refused').length, 0), color: '#854d0e', bg: '#fef9c3' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.color, fontWeight: 400 }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Clinical alerts from care records */}
              {clinicalAlerts.length > 0 && (
                <div style={{ background: criticalClinical > 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${criticalClinical > 0 ? '#fecaca' : '#fde68a'}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: criticalClinical > 0 ? '#dc2626' : '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {criticalClinical > 0 ? '🚨' : '⚠️'} Alertas clínicos deste turno
                    {criticalClinical > 0 && <span style={{ fontSize: 10, background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{criticalClinical} CRÍTICO{criticalClinical !== 1 ? 'S' : ''}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {clinicalAlerts.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', background: a.level === 'critical' ? '#fee2e2' : a.level === 'warning' ? '#fff7ed' : '#f8fafc', border: `1px solid ${a.level === 'critical' ? '#fca5a5' : a.level === 'warning' ? '#fed7aa' : '#e2e8f0'}`, borderRadius: 7 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: a.level === 'critical' ? '#dc2626' : a.level === 'warning' ? '#92400e' : '#374151' }}>{a.patient_name}</span>
                          <span style={{ fontSize: 12, color: '#374151' }}> — {a.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MAR alerts section */}
              {(patientsWithPending.length > 0 || patientsWithRefusals.length > 0 || patientsWithAllergies.length > 0) && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Alertas MAR — próximo turno</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {patientsWithPending.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 7 }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#9a3412' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#c2410c', fontFamily: 'var(--font-mono)' }}>
                            Em falta: {p.meds.filter(m => !m.status).map(m => m.name).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {patientsWithRefusals.map(p => (
                      <div key={`ref-${p.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7 }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🚫</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>{p.name} — Recusou</div>
                          <div style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-mono)' }}>
                            {p.meds.filter(m => m.status === 'refused').map(m => m.name).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {patientsWithAllergies.map(p => (
                      <div key={`al-${p.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 7 }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💊</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b21a8' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>Alergias: {p.allergies}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra notes */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Notas adicionais (opcional)</div>
                <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} rows={3}
                  placeholder="Intercorrências do turno, instruções específicas, contactos urgentes..."
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none' }} />
              </div>

              {error && <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}

              <button onClick={generate} disabled={generating || patients.length === 0}
                style={{ padding: '14px', background: generating || patients.length === 0 ? 'var(--ink-5)' : sl.color, color: 'white', border: 'none', borderRadius: 10, cursor: generating || patients.length === 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                {generating ? 'A gerar passagem...' : 'Gerar Passagem de Turno IA →'}
              </button>
            </div>

            {/* Generated handover */}
            {handoverText && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 80 }}>
                <div style={{ background: sl.color, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>
                    PASSAGEM · {sl.label.toUpperCase()} · {new Date(date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={copy}
                      style={{ padding: '6px 14px', background: copied ? '#059669' : 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                      {copied ? '✓' : 'Copiar'}
                    </button>
                    <button onClick={() => window.print()}
                      style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                      Imprimir
                    </button>
                  </div>
                </div>
                <div style={{ padding: '20px' }}>
                  <textarea value={handoverText} onChange={e => setHandoverText(e.target.value)} rows={20}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', lineHeight: 1.7, color: 'var(--ink-2)', background: '#fafafa' }} />
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                    Podes editar o texto antes de copiar ou imprimir.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
