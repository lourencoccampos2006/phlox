'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

// A passagem de turno é agora a aba "Passagem" do Centro de Turno (/turno), que
// já gera o relatório do turno a partir dos registos do dia. Redirect p/ não
// partir links antigos.
export default function HandoverRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/turno?tab=passagem') }, [r])
  return null
}
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { printDoc, type PrintRecord } from '@/lib/print'

type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held'
type AlertLevel = 'critical' | 'warning' | 'info'

interface PatientMed { id: string; name: string; dose: string | null; status: AdminStatus | null }
interface CareRec {
  id: string; patient_id: string
  vitals: { bp_sys?: number; bp_dia?: number; hr?: number; temp?: number; spo2?: number; glucose?: number } | null
  nutrition: { breakfast?: number; lunch?: number; dinner?: number; appetite?: string } | null
  skin: { integrity?: string; description?: string } | null
  mood: { level?: number; behavior?: string } | null
  notes?: string
}
interface PatientCard {
  id: string; name: string; room_number: string | null; age: number | null
  conditions: string | null; allergies: string | null
  meds: PatientMed[]; care: CareRec | null
  extraNote: string; flagged: boolean; _score: number
}
interface ClinicalAlert { patient_id: string; patient_name: string; level: AlertLevel; icon: string; message: string }

const SHIFT_META: Record<Shift, { label: string; time: string; color: string; bg: string; border: string }> = {
  manha: { label: 'Manhã', time: '07:00–14:00', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  tarde: { label: 'Tarde', time: '14:00–21:00', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  noite: { label: 'Noite', time: '21:00–07:00', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
}

function getToday() { return new Date().toISOString().split('T')[0] }
function getCurrentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}

function buildVitalsAlerts(v: CareRec['vitals'], name: string, pid: string): ClinicalAlert[] {
  if (!v) return []
  const a: ClinicalAlert[] = []
  if (v.temp && v.temp >= 38.5)        a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '🌡', message: `Febre ${v.temp}°C` })
  else if (v.temp && v.temp >= 37.8)   a.push({ patient_id: pid, patient_name: name, level: 'warning',  icon: '🌡', message: `T. elevada ${v.temp}°C` })
  if (v.spo2 && v.spo2 < 90)          a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '💨', message: `SpO₂ ${v.spo2}%` })
  else if (v.spo2 && v.spo2 < 94)     a.push({ patient_id: pid, patient_name: name, level: 'warning',  icon: '💨', message: `SpO₂ ${v.spo2}%` })
  if (v.bp_sys && v.bp_sys >= 180)    a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '💓', message: `TA ${v.bp_sys}/${v.bp_dia} mmHg` })
  else if (v.bp_sys && v.bp_sys >= 160) a.push({ patient_id: pid, patient_name: name, level: 'warning', icon: '💓', message: `TA ${v.bp_sys}/${v.bp_dia} mmHg` })
  if (v.bp_sys && v.bp_sys < 90)      a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '💓', message: `Hipot. ${v.bp_sys}/${v.bp_dia}` })
  if (v.glucose && v.glucose > 300)   a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '🩸', message: `Glicemia ${v.glucose} mg/dL` })
  else if (v.glucose && v.glucose < 60) a.push({ patient_id: pid, patient_name: name, level: 'critical', icon: '🩸', message: `Hipoglicemia ${v.glucose} mg/dL` })
  return a
}

// Mantido como named export (não-default) — a aba Passagem do /turno é a versão
// usada; este código fica disponível caso se queira a versão standalone.
function HandoverPageLegacy() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [shift, setShift] = useState<Shift>(getCurrentShift())
  const [date, setDate] = useState(getToday())
  const [patients, setPatients] = useState<PatientCard[]>([])
  const [loading, setLoading] = useState(false)
  const [signedBy, setSignedBy] = useState('')
  const [signed, setSigned] = useState(false)
  const [signedTime, setSignedTime] = useState('')
  const [globalNote, setGlobalNote] = useState('')

  const sl = SHIFT_META[shift]

  const loadData = useCallback(async () => {
    if (!user || !isPro) return
    setLoading(true)
    setSigned(false)

    const { data: rawP } = await supabase
      .from('patients').select('id, name, room_number, age, conditions, allergies')
      .eq('user_id', user.id).order('name')

    if (!rawP?.length) { setPatients([]); setLoading(false); return }

    const pIds = rawP.map((p: any) => p.id)
    const [{ data: meds }, { data: marRecs }, { data: care }] = await Promise.all([
      supabase.from('patient_meds').select('id, patient_id, name, dose').eq('active', true).in('patient_id', pIds),
      supabase.from('mar_records').select('id, patient_id, med_id, status').eq('date', date).eq('shift', shift).in('patient_id', pIds),
      supabase.from('care_records').select('id, patient_id, vitals, nutrition, skin, mood, notes').eq('date', date).eq('shift', shift).in('patient_id', pIds),
    ])

    const cards: PatientCard[] = (rawP as any[]).map(p => {
      const pMeds = (meds || []).filter((m: any) => m.patient_id === p.id).map((m: any) => {
        const rec = (marRecs || []).find((r: any) => r.med_id === m.id)
        return { id: m.id, name: m.name, dose: m.dose, status: rec?.status ?? null }
      })
      const pCare = (care || []).find((c: any) => c.patient_id === p.id) ?? null
      const alerts = buildVitalsAlerts(pCare?.vitals ?? null, p.name, p.id)
      const hasCritical = alerts.some(a => a.level === 'critical')
      const hasWarning = alerts.some(a => a.level === 'warning')
      const hasRefused = pMeds.some((m: PatientMed) => m.status === 'refused')
      const hasPending = pMeds.some((m: PatientMed) => !m.status)
      const score = (hasCritical ? 100 : 0) + (hasRefused ? 50 : 0) + (hasWarning ? 25 : 0) + (hasPending ? 10 : 0)
      return { ...p, meds: pMeds, care: pCare, extraNote: '', flagged: false, _score: score }
    }).sort((a: PatientCard, b: PatientCard) => b._score - a._score || a.name.localeCompare(b.name))

    setPatients(cards)
    setLoading(false)
  }, [user, isPro, supabase, date, shift])

  useEffect(() => { loadData() }, [loadData])

  const updateNote = (id: string, note: string) =>
    setPatients(p => p.map(x => x.id === id ? { ...x, extraNote: note } : x))

  const toggleFlag = (id: string) =>
    setPatients(p => p.map(x => x.id === id ? { ...x, flagged: !x.flagged } : x))

  const handleSign = () => {
    if (!signedBy.trim()) return
    const t = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    setSignedTime(t)
    setSigned(true)
  }

  const totalMeds   = patients.reduce((s, p) => s + p.meds.length, 0)
  const administered = patients.reduce((s, p) => s + p.meds.filter(m => m.status === 'administered').length, 0)
  const pending      = totalMeds - administered
  const refused      = patients.reduce((s, p) => s + p.meds.filter(m => m.status === 'refused').length, 0)
  const withCare     = patients.filter(p => p.care).length
  const allAlerts    = patients.flatMap(p => [
    ...buildVitalsAlerts(p.care?.vitals ?? null, p.name, p.id),
    ...(p.care?.skin?.integrity === 'ulcera'      ? [{ patient_id: p.id, patient_name: p.name, level: 'warning' as AlertLevel, icon: '🩹', message: 'Úlcera de pressão' }] : []),
    ...(p.care?.nutrition?.appetite === 'recusou' ? [{ patient_id: p.id, patient_name: p.name, level: 'warning' as AlertLevel, icon: '🍽', message: 'Recusou alimentação' }] : []),
  ])
  const criticalCount = allAlerts.filter(a => a.level === 'critical').length

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 460, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Passagem de Turno</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
            Passagem de turno estruturada com resumo automático de cada residente, alertas clínicos e assinatura digital.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#2563eb', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Ver planos →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>

      {/* Sticky top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 54, zIndex: 40 }}>
        <div className="page-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Passagem de Turno</span>
              <div style={{ height: 18, width: 1, background: '#e2e8f0' }} />
              <span style={{
                fontSize: 11, color: sl.color, fontWeight: 700,
                background: sl.bg, padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${sl.border}`,
              }}>
                {sl.label} · {sl.time}
              </span>
              {signed && (
                <span style={{ fontSize: 11, color: '#059669', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0', fontWeight: 700 }}>
                  ✓ Assinado — {signedBy}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={date}
                onChange={e => { setDate(e.target.value); setSigned(false) }}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', color: '#374151' }} />
              <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                {(['manha', 'tarde', 'noite'] as Shift[]).map(s => (
                  <button key={s} onClick={() => { setShift(s); setSigned(false) }}
                    style={{ padding: '5px 11px', background: shift === s ? SHIFT_META[s].color : 'transparent', color: shift === s ? 'white' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    {SHIFT_META[s].label}
                  </button>
                ))}
              </div>
              {!loading && patients.length > 0 && (
                <button onClick={() => {
                  const records: PrintRecord[] = patients.map(p => {
                    const v = p.care?.vitals
                    const fields: { label: string; value: string }[] = [
                      { label: 'Quarto', value: p.room_number ? `Q${p.room_number}` : '—' },
                      { label: 'Idade', value: p.age ? `${p.age} anos` : '—' },
                    ]
                    if (v?.bp_sys && v?.bp_dia) fields.push({ label: 'TA', value: `${v.bp_sys}/${v.bp_dia}` })
                    if (v?.hr) fields.push({ label: 'FC', value: `${v.hr} bpm` })
                    if (v?.temp) fields.push({ label: 'Temp.', value: `${v.temp}°C` })
                    if (v?.spo2) fields.push({ label: 'SpO₂', value: `${v.spo2}%` })
                    const bullets: string[] = []
                    if (p.allergies) bullets.push(`Alergias: ${p.allergies}`)
                    const refused = p.meds.filter(m => m.status === 'refused').map(m => m.name)
                    if (refused.length) bullets.push(`Recusou: ${refused.join(', ')}`)
                    const pending = p.meds.filter(m => !m.status).length
                    if (pending) bullets.push(`${pending} medicação(ões) por administrar`)
                    if (p.extraNote) bullets.push(p.extraNote)
                    return {
                      title: p.name,
                      meta: p.conditions || undefined,
                      tags: p.flagged ? [{ label: 'Sinalizado', color: '#2563eb' }] : undefined,
                      fields,
                      bullets: bullets.length ? bullets : undefined,
                      body: p.care?.notes || undefined,
                    }
                  })
                  printDoc({
                    docTitle: `Passagem de Turno · ${SHIFT_META[shift].label}`,
                    docSubtitle: new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                    institution: 'Lar / ERPI',
                    meta: [{ label: 'residentes', value: String(patients.length) }, { label: 'sinalizados', value: String(patients.filter(p => p.flagged).length) }],
                    sections: [{ heading: `Residentes — turno ${SHIFT_META[shift].label}`, records }],
                    footerNote: 'Passagem de turno · Phlox',
                  })
                }}
                  style={{ padding: '5px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#374151', fontWeight: 600 }}>
                  Imprimir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8', fontSize: 13 }}>
            A carregar dados do turno...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sem residentes registados</div>
            <Link href="/patients" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>Adicionar residentes →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {[
                { label: 'Residentes',     value: patients.length,                       color: '#1e40af', alert: false },
                { label: 'Com registo',    value: `${withCare}/${patients.length}`,       color: withCare < patients.length ? '#d97706' : '#059669', alert: false },
                { label: 'Medicação OK',   value: `${administered}/${totalMeds}`,         color: pending > 0 ? '#dc2626' : '#059669', alert: false },
                { label: 'Recusadas',      value: refused,                                color: refused > 0 ? '#9a3412' : '#6b7280', alert: refused > 0 },
                { label: 'Alertas críticos', value: criticalCount,                        color: criticalCount > 0 ? '#dc2626' : '#059669', alert: criticalCount > 0 },
              ].map(k => (
                <div key={k.label} style={{
                  background: k.alert ? (k.label === 'Alertas críticos' ? '#fee2e2' : '#fff7ed') : 'white',
                  border: `1px solid ${k.alert ? (k.label === 'Alertas críticos' ? '#fca5a5' : '#fed7aa') : '#e2e8f0'}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {k.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Critical alerts banner */}
            {criticalCount > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 10 }}>
                  🚨 {criticalCount} alerta{criticalCount !== 1 ? 's' : ''} crítico{criticalCount !== 1 ? 's' : ''} neste turno — comunicar ao próximo turno
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allAlerts.filter(a => a.level === 'critical').map((a, i) => (
                    <div key={i} style={{ fontSize: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', color: '#991b1b', fontWeight: 600 }}>
                      {a.icon} {a.patient_name} — {a.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resident cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patients.map(p => {
                const alerts      = buildVitalsAlerts(p.care?.vitals ?? null, p.name, p.id)
                const hasCritical = alerts.some(a => a.level === 'critical')
                const hasWarning  = alerts.some(a => a.level === 'warning')
                  || p.care?.skin?.integrity === 'ulcera'
                  || p.care?.nutrition?.appetite === 'recusou'
                  || p.meds.some(m => m.status === 'refused')
                const pendingMeds = p.meds.filter(m => !m.status)
                const refusedMeds = p.meds.filter(m => m.status === 'refused')
                const medsOk      = p.meds.length > 0 && pendingMeds.length === 0 && refusedMeds.length === 0
                const v           = p.care?.vitals

                const borderColor = hasCritical ? '#ef4444' : hasWarning ? '#f97316' : p.flagged ? '#3b82f6' : '#e2e8f0'
                const borderLight = hasCritical ? '#fca5a5' : hasWarning ? '#fed7aa' : p.flagged ? '#bfdbfe' : '#e2e8f0'

                return (
                  <div key={p.id} style={{
                    background: 'white',
                    border: `1px solid ${borderLight}`,
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: 10,
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${borderLight}` }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: hasCritical ? '#fee2e2' : hasWarning ? '#fff7ed' : '#f0f9ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: hasCritical ? '#dc2626' : hasWarning ? '#ea580c' : '#0369a1',
                      }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                          {p.room_number && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
                              Qt. {p.room_number}
                            </span>
                          )}
                          {p.age && <span style={{ fontSize: 10, color: '#94a3b8' }}>{p.age} anos</span>}
                          {hasCritical && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: 4 }}>
                              ⚠ CRÍTICO
                            </span>
                          )}
                          {p.flagged && !hasCritical && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '1px 7px', borderRadius: 4 }}>
                              Sinalizado
                            </span>
                          )}
                        </div>
                        {p.conditions && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.conditions}
                          </div>
                        )}
                      </div>
                      {/* Status icons */}
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {p.meds.length > 0 && (
                          <div title={medsOk ? 'Medicação administrada' : `${pendingMeds.length} dose(s) em falta`}
                            style={{ width: 28, height: 28, borderRadius: 6, background: medsOk ? '#f0fdf4' : '#fee2e2', border: `1px solid ${medsOk ? '#bbf7d0' : '#fca5a5'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: medsOk ? '#166534' : '#dc2626' }}>
                            {medsOk ? '✓' : pendingMeds.length}
                          </div>
                        )}
                        <div title={p.care ? 'Registo diário feito' : 'Sem registo diário este turno'}
                          style={{ width: 28, height: 28, borderRadius: 6, background: p.care ? '#f0fdf4' : '#f8fafc', border: `1px solid ${p.care ? '#bbf7d0' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                          {p.care ? '📝' : '—'}
                        </div>
                        <button onClick={() => toggleFlag(p.id)} title={p.flagged ? 'Remover sinalização' : 'Sinalizar para próximo turno'}
                          style={{ width: 28, height: 28, borderRadius: 6, background: p.flagged ? '#dbeafe' : '#f8fafc', border: `1px solid ${p.flagged ? '#93c5fd' : '#e2e8f0'}`, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          🚩
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '11px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>

                      {/* Vitals chips */}
                      {v && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {v.bp_sys != null && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: (v.bp_sys >= 160 || v.bp_sys < 90) ? '#fee2e2' : '#f8fafc', border: `1px solid ${(v.bp_sys >= 160 || v.bp_sys < 90) ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 5, color: (v.bp_sys >= 160 || v.bp_sys < 90) ? '#dc2626' : '#374151', fontWeight: 600 }}>
                              TA {v.bp_sys}/{v.bp_dia}
                            </span>
                          )}
                          {v.hr != null && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, color: '#374151' }}>
                              FC {v.hr}
                            </span>
                          )}
                          {v.temp != null && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: v.temp >= 37.8 ? '#fff7ed' : '#f8fafc', border: `1px solid ${v.temp >= 37.8 ? '#fed7aa' : '#e2e8f0'}`, borderRadius: 5, color: v.temp >= 37.8 ? '#ea580c' : '#374151', fontWeight: v.temp >= 37.8 ? 700 : 400 }}>
                              {v.temp}°C
                            </span>
                          )}
                          {v.spo2 != null && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: v.spo2 < 94 ? '#fee2e2' : '#f8fafc', border: `1px solid ${v.spo2 < 94 ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 5, color: v.spo2 < 94 ? '#dc2626' : '#374151', fontWeight: v.spo2 < 94 ? 700 : 400 }}>
                              SpO₂ {v.spo2}%
                            </span>
                          )}
                          {v.glucose != null && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: (v.glucose > 250 || v.glucose < 70) ? '#fee2e2' : '#f8fafc', border: `1px solid ${(v.glucose > 250 || v.glucose < 70) ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 5, color: (v.glucose > 250 || v.glucose < 70) ? '#dc2626' : '#374151' }}>
                              Glicemia {v.glucose}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meds chips */}
                      {p.meds.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {p.meds.map(m => (
                            <span key={m.id} style={{
                              fontSize: 11, padding: '3px 7px', borderRadius: 5, border: '1px solid',
                              background:   m.status === 'administered' ? '#f0fdf4' : m.status === 'refused' ? '#fee2e2' : m.status === 'held' ? '#fff7ed' : '#fafafa',
                              borderColor:  m.status === 'administered' ? '#bbf7d0' : m.status === 'refused' ? '#fca5a5' : m.status === 'held' ? '#fed7aa' : '#e2e8f0',
                              color:        m.status === 'administered' ? '#166534' : m.status === 'refused' ? '#991b1b' : m.status === 'held' ? '#92400e' : '#6b7280',
                              fontWeight:   m.status !== 'administered' ? 600 : 400,
                            }}>
                              {m.status === 'administered' ? '✓' : m.status === 'refused' ? '✗' : m.status === 'held' ? '⏸' : '○'}{' '}
                              {m.name}{m.dose ? ` ${m.dose}` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clinical flags */}
                      {(p.care?.skin?.integrity === 'ulcera' || p.care?.skin?.integrity === 'ferida'
                        || p.care?.nutrition?.appetite === 'recusou'
                        || (p.care?.mood?.level != null && p.care.mood.level <= 2)) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {p.care?.skin?.integrity === 'ulcera' && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 5, color: '#92400e', fontWeight: 700 }}>
                              🩹 Úlcera{p.care.skin.description ? ` — ${p.care.skin.description}` : ''}
                            </span>
                          )}
                          {p.care?.skin?.integrity === 'ferida' && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 5, color: '#92400e' }}>
                              🩹 Ferida{p.care.skin.description ? ` — ${p.care.skin.description}` : ''}
                            </span>
                          )}
                          {p.care?.nutrition?.appetite === 'recusou' && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 5, color: '#713f12', fontWeight: 700 }}>
                              🍽 Recusou alimentação
                            </span>
                          )}
                          {p.care?.mood?.level != null && p.care.mood.level <= 2 && (
                            <span style={{ fontSize: 11, padding: '3px 7px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 5, color: '#5b21b6' }}>
                              😟 Humor {p.care.mood.level}/5{p.care.mood.behavior ? ` — ${p.care.mood.behavior}` : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Allergies */}
                      {p.allergies && (
                        <div style={{ fontSize: 11, color: '#7c3aed', background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 5, padding: '4px 9px', fontWeight: 600 }}>
                          ⚠ Alergias: {p.allergies}
                        </div>
                      )}

                      {/* Notes from care record */}
                      {p.care?.notes && (
                        <div style={{ fontSize: 12, color: '#374151', background: '#f8fafc', borderRadius: 6, padding: '7px 10px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notas · </span>
                          {p.care.notes}
                        </div>
                      )}

                      {/* Handover note (editable) */}
                      <textarea
                        value={p.extraNote}
                        onChange={e => updateNote(p.id, e.target.value)}
                        placeholder="Nota de passagem para o próximo turno..."
                        rows={p.extraNote ? 3 : 2}
                        style={{
                          width: '100%', border: `1.5px solid ${p.extraNote ? '#93c5fd' : '#e2e8f0'}`,
                          borderRadius: 6, padding: '7px 10px', fontSize: 12,
                          fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none',
                          color: '#374151', background: p.extraNote ? '#f0f9ff' : '#fafafa',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Global notes + sign-off */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Notas gerais do turno
              </div>
              <textarea value={globalNote} onChange={e => setGlobalNote(e.target.value)} rows={3}
                placeholder="Intercorrências gerais, equipamentos, situações a vigiar, comunicados para o próximo turno..."
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', color: '#374151' }} />

              <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Enfermeiro/a que passa o turno
                  </div>
                  <input
                    type="text"
                    value={signedBy}
                    onChange={e => { setSignedBy(e.target.value); setSigned(false) }}
                    placeholder="Nome completo"
                    style={{
                      width: '100%', border: `1.5px solid ${signed ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: 7, padding: '9px 12px', fontSize: 13,
                      fontFamily: 'var(--font-sans)', outline: 'none', color: '#374151',
                      background: signed ? '#f0fdf4' : 'white',
                    }}
                  />
                </div>
                {!signed ? (
                  <button
                    onClick={handleSign}
                    disabled={!signedBy.trim()}
                    style={{
                      padding: '10px 24px', background: signedBy.trim() ? '#059669' : '#e2e8f0',
                      color: signedBy.trim() ? 'white' : '#94a3b8',
                      border: 'none', borderRadius: 8,
                      cursor: signedBy.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                    }}>
                    Assinar Passagem
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Turno assinado</div>
                      <div style={{ fontSize: 10, color: '#16a34a' }}>{signedBy} · {sl.label} · {signedTime}</div>
                    </div>
                    <button onClick={() => setSigned(false)}
                      style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
