'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'
import { runSTOPPSTART, type STOPPSTARTResult } from '@/lib/stoppStart'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import DrugReferenceButton from '@/components/DrugReferenceButton'
import { analyzeResident, SEVERITY_STYLE as ECO_SEV } from '@/lib/residentSignals'
import { printDoc, type PrintRecord } from '@/lib/print'


interface Patient {
  id: string
  name: string
  age: number | null
  sex: string | null
  weight: number | null
  height: number | null
  creatinine: number | null
  conditions: string | null
  allergies: string | null
  notes: string | null
  meds_count?: number
  alerts?: number
  last_updated?: string
  updated_at?: string
}

interface PatientMed {
  id: string
  name: string
  dose: string | null
  frequency: string | null
  indication: string | null
  started_at: string | null
  shifts?: string[] | null
}

interface Alert {
  type: 'interaction' | 'dose' | 'beers' | 'monitoring'
  severity: 'grave' | 'moderada' | 'info'
  message: string
  action: string
}

interface NHAssessment { id: string; scale: string; score: number; level?: string; date: string; evaluated_by?: string; notes?: string }
interface NHIncident { id: string; type: string; severity: string; date: string; time?: string; description: string; status: string }
interface NHContact { id: string; name: string; relationship?: string; phone?: string; email?: string; is_emergency: boolean; is_legal_guardian: boolean; can_visit: boolean; notes?: string }

const INC_LABELS: Record<string, string> = { fall: 'Queda', medication_error: 'Erro Medicação', pressure_ulcer: 'Úlcera Pressão', behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Outro' }
const SCALE_LABELS: Record<string, { name: string; max: number; unit: string }> = {
  barthel: { name: 'Índice de Barthel', max: 100, unit: 'pts' },
  braden:  { name: 'Escala de Braden', max: 23, unit: 'pts' },
  morse:   { name: 'Escala de Morse', max: 125, unit: 'pts' },
  mmse:    { name: 'MMSE', max: 30, unit: 'pts' },
  mna:     { name: 'MNA', max: 14, unit: 'pts' },
  lawton:  { name: 'Lawton', max: 8, unit: 'pts' },
  gds:     { name: 'GDS-15', max: 15, unit: 'pts' },
  norton:  { name: 'Escala de Norton', max: 20, unit: 'pts' },
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const { institution } = useClinicPrefs()
  const isNH = institution === 'nursing_home'
  const [patient, setPatient] = useState<Patient | null>(null)
  const [meds, setMeds] = useState<PatientMed[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'meds' | 'notes' | 'ai' | 'assessments' | 'incidents' | 'contacts' | 'cronologia'>('overview')
  // Nursing home data
  const [nhAssessments, setNhAssessments] = useState<NHAssessment[]>([])
  const [nhIncidents, setNhIncidents] = useState<NHIncident[]>([])
  const [nhContacts, setNhContacts] = useState<NHContact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', is_emergency: true, is_legal_guardian: false, can_visit: true, notes: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [newMed, setNewMed] = useState<{ name: string; dose: string; frequency: string; indication: string; shifts: string[] }>({ name: '', dose: '', frequency: '', indication: '', shifts: [] })
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  // ── Leitura de prescrição por foto (IA) ──
  const [rxOpen, setRxOpen] = useState(false)
  const [rxPhoto, setRxPhoto] = useState<File | null>(null)
  const [rxAnalyzing, setRxAnalyzing] = useState(false)
  const [rxErr, setRxErr] = useState('')
  const [rxResult, setRxResult] = useState<{ meds: any[]; warnings: string[]; observations: string } | null>(null)
  const [rxSel, setRxSel] = useState<Record<number, boolean>>({})
  const [rxAdding, setRxAdding] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Patient>>({})
  const [patientId, setPatientId] = useState<string | null>(null)
  const [stoppResult, setStoppResult] = useState<STOPPSTARTResult | null>(null)

  useEffect(() => {
    params.then(p => setPatientId(p.id))
  }, [params])

  const load = useCallback(async () => {
    if (!user || !patientId) return
    setLoading(true)
    const [{ data: patientData }, { data: medsData }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).eq('user_id', user.id).single(),
      supabase.from('patient_meds').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
    ])
    if (!patientData) { router.push('/patients'); return }
    setPatient(patientData)
    setMeds(medsData || [])
    setEditData(patientData)
    if (isNH) {
      const [assessRes, incRes, contRes] = await Promise.all([
        supabase.from('assessments').select('*').eq('patient_id', patientId).eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('incidents').select('*').eq('patient_id', patientId).eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('resident_contacts').select('*').eq('patient_id', patientId).eq('user_id', user.id).order('created_at', { ascending: true }),
      ])
      setNhAssessments(assessRes.data || [])
      setNhIncidents(incRes.data || [])
      setNhContacts(contRes.data || [])
    }
    setLoading(false)
  }, [user, supabase, patientId, router, isNH])

  useEffect(() => { load() }, [load])

  // ── Ecossistema: dados transversais para o estado clínico global ──
  const [ecoWounds, setEcoWounds] = useState<{ status: string; stage?: string | null }[]>([])
  const [ecoWeights, setEcoWeights] = useState<{ date: string; weight: number }[]>([])
  const [ecoFluidToday, setEcoFluidToday] = useState<number | null>(null)
  const [ecoBowelDays, setEcoBowelDays] = useState<number | null>(null)
  const [ecoVitals, setEcoVitals] = useState<{ temp?: number; spo2?: number; bp_sys?: number; bp_dia?: number; hr?: number; at?: string } | null>(null)
  const [ecoCareToday, setEcoCareToday] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!user || !patientId || !isNH) return
    ;(async () => {
      const todayD = new Date().toISOString().slice(0, 10)
      try {
        const { data } = await supabase.from('wounds').select('status,stage').eq('patient_id', patientId).eq('user_id', user.id)
        if (data) setEcoWounds(data)
      } catch { /* tabela pode não existir */ }
      try {
        const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
        const { data } = await supabase.from('care_records').select('date,vitals,shift').eq('patient_id', patientId).eq('user_id', user.id).gte('date', since)
        if (data) {
          setEcoWeights(data.filter((c: any) => c.vitals?.weight).map((c: any) => ({ date: c.date, weight: Number(c.vitals.weight) })))
          setEcoCareToday(data.some((c: any) => c.date === todayD))
          const withVit = data.filter((c: any) => c.vitals && (c.vitals.temp != null || c.vitals.spo2 != null || c.vitals.bp_sys != null || c.vitals.hr != null))
            .sort((a: any, b: any) => b.date.localeCompare(a.date))[0]
          if (withVit && Date.now() - new Date(withVit.date).getTime() <= 3 * 86400000) setEcoVitals({ ...withVit.vitals, at: withVit.date })
        }
      } catch { /* ignore */ }
      try {
        const since = new Date(Date.now() - 14 * 86400000).toISOString()
        const { data } = await supabase.from('hydration_logs').select('at,kind,fluid_ml').eq('patient_id', patientId).eq('user_id', user.id).gte('at', since)
        if (data) {
          setEcoFluidToday(data.filter((l: any) => l.kind === 'fluid' && l.at.slice(0, 10) === todayD).reduce((s: number, l: any) => s + (l.fluid_ml || 0), 0))
          const b = data.filter((l: any) => l.kind === 'bowel').sort((a: any, c: any) => c.at.localeCompare(a.at))[0]
          setEcoBowelDays(b ? Math.floor((Date.now() - new Date(b.at).getTime()) / 86400000) : null)
        }
      } catch { /* ignore */ }
    })()
  }, [user, supabase, patientId, isNH])

  const ecoAnalysis = patient ? analyzeResident({
    age: patient.age, conditions: patient.conditions, allergies: patient.allergies,
    meds: meds.map(m => m.name),
    incidents: nhIncidents.map(i => ({ type: i.type, severity: i.severity, status: i.status })),
    assessments: nhAssessments.map(a => ({ scale: a.scale, date: a.date })),
    wounds: ecoWounds, weightSeries: ecoWeights,
    fluidToday: ecoFluidToday, lastBowelDays: ecoBowelDays, careLoggedToday: ecoCareToday,
    latestVitals: ecoVitals,
  }) : null

  // Calc CrCl if we have age, weight, creatinine, sex
  const crCl = patient?.age && patient?.weight && patient?.creatinine && patient?.sex
    ? Math.round(((140 - patient.age) * patient.weight * (patient.sex === 'F' ? 0.85 : 1)) / (72 * patient.creatinine))
    : null

  // Ficha-resumo A4 do residente (consulta médica, ambulância, handover, inspeção)
  function printChart() {
    if (!patient) return
    const p: any = patient
    const v = ecoVitals
    const idFields = [
      { label: 'Idade', value: patient.age != null ? `${patient.age} anos` : '—' },
      ...(p.room_number ? [{ label: 'Quarto', value: String(p.room_number) }] : []),
      { label: 'Sexo', value: patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : '—' },
      ...(patient.weight ? [{ label: 'Peso', value: `${patient.weight} kg` }] : []),
      ...(crCl ? [{ label: 'ClCr estimada', value: `${crCl} mL/min` }] : []),
      ...(p.emergency_contact ? [{ label: 'Contacto urgência', value: `${p.emergency_contact}${p.emergency_phone ? ' · ' + p.emergency_phone : ''}` }] : []),
    ]
    const sections: any[] = [
      { heading: 'Identificação', records: [{ title: patient.name, fields: idFields }] },
    ]
    if (patient.allergies) sections.push({ heading: 'Alergias', records: [{ title: '⚠ Alergias', body: patient.allergies }] })
    if (patient.conditions) sections.push({ heading: 'Condições / Diagnósticos', records: [{ title: 'Histórico clínico', body: patient.conditions }] })
    sections.push({
      heading: `Medicação ativa (${meds.length})`,
      records: meds.length
        ? meds.map(m => ({ title: m.name, meta: [m.dose, m.frequency].filter(Boolean).join(' · ') || undefined, ...(m.indication ? { body: `Indicação: ${m.indication}` } : {}) }))
        : [{ title: 'Sem medicação registada' }],
    })
    if (v) sections.push({
      heading: 'Últimos sinais vitais',
      records: [{ title: v.at ? `Registo de ${v.at}` : 'Recente', fields: [
        ...(v.temp != null ? [{ label: 'Temp', value: `${v.temp}°C` }] : []),
        ...(v.bp_sys != null ? [{ label: 'TA', value: `${v.bp_sys}/${v.bp_dia ?? '—'} mmHg` }] : []),
        ...(v.hr != null ? [{ label: 'FC', value: `${v.hr} bpm` }] : []),
        ...(v.spo2 != null ? [{ label: 'SpO₂', value: `${v.spo2}%` }] : []),
      ] }],
    })
    if (ecoAnalysis && ecoAnalysis.signals.length) {
      const top = ecoAnalysis.signals.filter(s => s.severity === 'critical' || s.severity === 'warning')
      if (top.length) sections.push({ heading: `Estado clínico — ${ECO_SEV[ecoAnalysis.level].label}`, records: [{ title: ecoAnalysis.summary, bullets: top.map(s => `${s.title}: ${s.detail}`) }] })
    }
    sections.push({ heading: 'Validação', records: [{ title: 'Assinaturas', fields: [{ label: 'Profissional', value: '' }, { label: 'Data', value: '' }] }] })
    printDoc({
      docTitle: 'Ficha do Residente',
      docSubtitle: `${patient.name}${p.room_number ? ' · Quarto ' + p.room_number : ''}`,
      institution: 'Lar / ERPI',
      sections,
      footerNote: 'Ficha-resumo do residente · Phlox',
    })
  }

  // Run STOPP/START when patient data is ready
  useEffect(() => {
    if (!patient || meds.length === 0) return
    const medNames = meds.map(m => m.name.toLowerCase())
    const result = runSTOPPSTART(patient.age, patient.conditions, medNames, crCl ?? undefined)
    setStoppResult(result)
  }, [patient, meds, crCl])

  const addMed = async () => {
    if (!newMed.name.trim() || !patientId) return
    setAdding(true)
    const resolved = resolveDrugName(newMed.name)
    const finalName = resolved ? resolved.dci : newMed.name.trim()
    const { data, error } = await supabase.from('patient_meds').insert({
      patient_id: patientId,
      user_id: user!.id,  // ─── CORRIGIDO: user_id era omitido, causando erro RLS ───
      name: finalName,
      dose: newMed.dose || null,
      frequency: newMed.frequency || null,
      indication: newMed.indication || null,
      shifts: newMed.shifts.length ? newMed.shifts : null,
    }).select().single()
    if (error) console.error('addMed error:', error.message)
    if (data) {
      setMeds(p => [data, ...p])
      // updated_at is handled automatically by trigger
    }
    setNewMed({ name: '', dose: '', frequency: '', indication: '', shifts: [] })
    setSuggestions([])
    setAdding(false)
  }

  // ── Prescrição por foto ──
  function rxDownscale(file: File, maxDim = 1280, quality = 0.85): Promise<{ b64: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Não foi possível processar a imagem.')); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ b64: (canvas.toDataURL('image/jpeg', quality).split(',')[1]) || '', mime: 'image/jpeg' })
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')) }
      img.src = url
    })
  }
  async function rxAnalyze() {
    if (!rxPhoto) return
    setRxAnalyzing(true); setRxErr(''); setRxResult(null); setRxSel({})
    try {
      const { b64, mime } = await rxDownscale(rxPhoto)
      const res = await fetch('/api/prescription-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setRxResult(data)
      // pré-selecionar tudo o que tem nome
      const sel: Record<number, boolean> = {}
      ;(data.meds || []).forEach((m: any, i: number) => { if (m.name?.trim()) sel[i] = true })
      setRxSel(sel)
    } catch (e: any) { setRxErr(e.message || 'Não foi possível analisar a prescrição.') }
    finally { setRxAnalyzing(false) }
  }
  async function rxAddSelected() {
    if (!rxResult || !patientId || !user) return
    const chosen = rxResult.meds.filter((_, i) => rxSel[i] && rxResult.meds[i].name?.trim())
    if (!chosen.length) return
    setRxAdding(true)
    const rows = chosen.map(m => {
      const resolved = resolveDrugName(m.name)
      return {
        patient_id: patientId, user_id: user.id,
        name: resolved ? resolved.dci : String(m.name).trim(),
        dose: m.dose || null, frequency: m.frequency || null, indication: m.indication || null,
        shifts: Array.isArray(m.shifts) && m.shifts.length ? m.shifts.filter((s: string) => ['manha', 'tarde', 'noite'].includes(s)) : null,
      }
    })
    const { data } = await supabase.from('patient_meds').insert(rows).select()
    let merged = meds
    if (data) { merged = [...data, ...meds]; setMeds(merged) }
    setRxAdding(false); setRxOpen(false); setRxPhoto(null); setRxResult(null); setRxSel({})
    // Após adicionar, corre logo a análise de interações/STOPP do perfil atualizado
    setTab('overview')
    analyzeProfile(merged)
  }

  const removeMed = async (id: string) => {
    await supabase.from('patient_meds').delete().eq('id', id)
    setMeds(p => p.filter(m => m.id !== id))
  }

  const analyzeProfile = async (medsOverride?: any[]) => {
    const medList = medsOverride || meds
    if (medList.length < 2 || !patientId) return
    setAnalyzing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/patients/analyze', {
        method: 'POST', headers,
        body: JSON.stringify({ patient, medications: medList })
      })
      const data = await res.json()
      if (res.ok && data.alerts) {
        setAlerts(data.alerts)
        const graveCount = data.alerts.filter((a: Alert) => a.severity === 'grave').length
        await supabase.from('patients').update({ alerts: graveCount }).eq('id', patientId)
      }
    } catch {}
    setAnalyzing(false)
  }

  const saveEdit = async () => {
    if (!patientId) return
    // Remove read-only fields before update
    const { meds_count: _mc, alerts: _al, last_updated: _lu, updated_at: _ua, ...updateFields } = editData as any
    await supabase.from('patients').update(updateFields).eq('id', patientId)
    setPatient(p => p ? { ...p, ...editData } : p)
    setEditing(false)
  }

  const SEVERITY_STYLE = {
    grave:    { bg: 'var(--red-light)', border: '#fecaca', dot: '#dc2626', text: '#7f1d1d', label: 'GRAVE' },
    moderada: { bg: 'var(--amber-light)', border: '#fde68a', dot: '#f59e0b', text: '#78350f', label: 'MODERADA' },
    info:     { bg: 'var(--blue-light)', border: '#bfdbfe', dot: '#3b82f6', text: '#1e3a5f', label: 'INFO' },
  }

  const tabStyle = (t: string) => ({
    padding: '10px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
    whiteSpace: 'nowrap' as const,
  })

  // Clinical risk score (conditions-based, same logic as rounds)
  const riskScore = (() => {
    if (!patient) return null
    let s = 0
    const c = (patient.conditions || '').toLowerCase()
    if (/cancro|cancer|carcinoma|tumor|neoplasia|oncol|leucemia|linfoma|mieloma|metást/.test(c)) s += 40
    if (/terminal|paliat|hospice/.test(c)) s += 50
    if (/diálise|hemodiálise|periton/.test(c)) s += 38
    if (/insuficiência renal|irc|drc g[45]/.test(c)) s += 28
    if (/insuficiência hepática|cirrose/.test(c)) s += 28
    if (/insuficiência cardíaca|ic [34]|ic avançada/.test(c)) s += 22
    if (/transplante/.test(c)) s += 22
    if (/demência|alzheimer/.test(c)) s += 15
    if (/anticoagul|varfarin|dabigatran|rivaroxaban|apixaban/.test(c)) s += 12
    if ((patient.age || 0) >= 85) s += 22
    else if ((patient.age || 0) >= 75) s += 12
    if (crCl !== null) {
      if (crCl < 15) s += 35
      else if (crCl < 30) s += 22
      else if (crCl < 60) s += 8
    }
    // polypharmacy
    if (meds.length >= 10) s += 25
    else if (meds.length >= 5) s += 12
    s += alerts.filter(a => a.severity === 'grave').length * 30
    s += alerts.filter(a => a.severity === 'moderada').length * 15
    return Math.min(100, s)
  })()
  const riskLevel = riskScore === null ? null : riskScore >= 70 ? 'critical' : riskScore >= 45 ? 'high' : riskScore >= 20 ? 'moderate' : 'low'
  const RISK_STYLE = {
    critical: { label: 'CRÍTICO',  color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
    high:     { label: 'ELEVADO',  color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
    moderate: { label: 'MODERADO', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    low:      { label: 'BAIXO',    color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  }
  const stoppCritical = stoppResult?.stopp ?? []

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[60, 200, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 10 }} />)}
        </div>
      </div>
    </div>
  )

  if (!patient) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>


      {/* Patient header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>

          {/* Back */}
          <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 16 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            {isNH ? 'Residentes' : 'Doentes'}
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 6 }}>
                {patient.name}
              </h1>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {patient.age && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.age} anos{(patient.age || 0) >= 75 ? ' ⚠' : ''}</span>}
                {patient.sex && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Feminino' : patient.sex}</span>}
                {patient.weight && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.weight} kg</span>}
                {crCl && (
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    color: crCl < 30 ? '#991b1b' : crCl < 60 ? '#b45309' : '#166534',
                    background: crCl < 30 ? '#fee2e2' : crCl < 60 ? '#fef3c7' : '#dcfce7',
                    border: `1px solid ${crCl < 30 ? '#fca5a5' : crCl < 60 ? '#fde68a' : '#86efac'}`,
                    padding: '2px 8px', borderRadius: 10,
                  }}>
                    CrCl {crCl} mL/min · IRC {crCl >= 90 ? 'G1' : crCl >= 60 ? 'G2' : crCl >= 45 ? 'G3a' : crCl >= 30 ? 'G3b' : crCl >= 15 ? 'G4' : 'G5'}
                  </span>
                )}
                {meds.length > 0 && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: meds.length >= 5 ? '#854d0e' : 'var(--ink-4)', background: meds.length >= 5 ? '#fef9c3' : 'var(--bg-2)', padding: '2px 8px', borderRadius: 10 }}>
                    {meds.length} med{meds.length !== 1 ? 's' : ''}{meds.length >= 5 ? ' · polimedicado' : ''}
                  </span>
                )}
                {alerts.filter(a => a.severity === 'grave').length > 0 && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 10 }}>
                    {alerts.filter(a => a.severity === 'grave').length} alerta{alerts.filter(a => a.severity === 'grave').length > 1 ? 's' : ''} grave{alerts.filter(a => a.severity === 'grave').length > 1 ? 's' : ''}
                  </span>
                )}
                {riskLevel && riskScore !== null && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: RISK_STYLE[riskLevel].color, background: RISK_STYLE[riskLevel].bg, border: `1px solid ${RISK_STYLE[riskLevel].border}`, padding: '2px 8px', borderRadius: 10 }}>
                    Risco {RISK_STYLE[riskLevel].label} · {riskScore}
                  </span>
                )}
                {stoppCritical.length > 0 && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 10 }}>
                    {stoppCritical.length} critério{stoppCritical.length !== 1 ? 's' : ''} STOPP
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setEditing(!editing)}
                style={{ padding: '7px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-2)' }}>
                Editar
              </button>
              <button onClick={printChart} title="Imprimir ficha-resumo"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
              <Link href="/rounds"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>
                Ronda →
              </Link>
              <Link href={`/connect?patient=${patient.id}&name=${encodeURIComponent(patient.name)}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'white', color: '#0d9488', border: '1px solid #99f6e4', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>
                Interconsulta →
              </Link>
              <Link href={`/ai?patient=${patient.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                Co-Piloto IA
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            {([
              ['overview', 'Resumo'],
              ['meds', 'Medicação'],
              ...(isNH ? [
                ['cronologia', 'Cronologia'],
                ['assessments', 'Avaliações'],
                ['incidents', 'Ocorrências'],
                ['contacts', 'Contactos'],
              ] : []),
              ['notes', 'Notas'],
              ['ai', 'IA'],
            ] as [string, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>
                {label}
                {id === 'overview' && stoppCritical.length > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 9, background: '#fde68a', color: '#92400e', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{stoppCritical.length}</span>
                )}
                {id === 'overview' && riskLevel === 'critical' && (
                  <span style={{ marginLeft: 5, fontSize: 9, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>!</span>
                )}
                {id === 'incidents' && nhIncidents.filter(i => i.status === 'open').length > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 9, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{nhIncidents.filter(i => i.status === 'open').length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Edit form */}
        {editing && (
          <div style={{ background: 'white', border: '2px solid #1d4ed8', borderRadius: 10, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Editar dados do doente</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
              {[
                { key: 'name', label: 'Nome', type: 'text' },
                { key: 'age', label: 'Idade', type: 'number' },
                { key: 'sex', label: 'Sexo (M/F)', type: 'text' },
                { key: 'weight', label: 'Peso (kg)', type: 'number' },
                { key: 'height', label: 'Altura (cm)', type: 'number' },
                { key: 'creatinine', label: 'Creatinina (mg/dL)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={(editData as any)[key] || ''}
                    onChange={e => setEditData(p => ({ ...p, [key]: type === 'number' ? parseFloat(e.target.value) || null : e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </div>
              ))}
            </div>
            {[
              { key: 'conditions', label: 'Diagnósticos activos' },
              { key: 'allergies', label: 'Alergias conhecidas' },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</label>
                <input value={(editData as any)[key] || ''}
                  onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={key === 'conditions' ? 'Ex: HTA, DM2, FA, IRC G3' : 'Ex: penicilina, AINEs'}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Guardar</button>
              <button onClick={() => setEditing(false)} style={{ background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            {/* Estado Clínico Global — integra TODOS os dados do residente */}
            {ecoAnalysis && (() => {
              const lv = ECO_SEV[ecoAnalysis.level]
              return (
                <div style={{ background: 'white', border: `1px solid var(--border)`, borderLeft: `4px solid ${lv.color}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: ecoAnalysis.signals.length ? 12 : 0, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: lv.color }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Estado clínico global</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`, padding: '2px 9px', borderRadius: 6 }}>{lv.label}</span>
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>{ecoAnalysis.summary}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ecoAnalysis.signals.map((s, idx) => {
                      const st = ECO_SEV[s.severity]
                      return (
                        <div key={idx} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 11px', background: st.bg, border: `1px solid ${st.border}`, borderRadius: 9 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, marginTop: 5, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{s.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1, lineHeight: 1.45 }}>{s.detail}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Clinical data */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12, marginBottom: 16 }}>
              {/* Diagnoses */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Diagnósticos</div>
                {patient.conditions ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {patient.conditions.split(/[,;]+/).map(c => c.trim()).filter(Boolean).map(cond => (
                      <span key={cond} style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', background: 'var(--blue-light)', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 12 }}>{cond}</span>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Nenhum registado</div>}
              </div>

              {/* Kidney function */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Função renal</div>
                {crCl ? (
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: crCl < 30 ? 'var(--red)' : crCl < 60 ? 'var(--amber)' : 'var(--green)', fontStyle: 'italic', fontWeight: 400, lineHeight: 1, marginBottom: 4 }}>
                      {crCl}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>mL/min · Cockroft-Gault</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: crCl < 30 ? 'var(--red)' : crCl < 60 ? 'var(--amber)' : 'var(--green)' }}>
                      {crCl < 15 ? 'DRC G5 — Diálise' : crCl < 30 ? 'DRC G4 — Severa' : crCl < 45 ? 'DRC G3b — Moderada-Severa' : crCl < 60 ? 'DRC G3a — Moderada' : crCl < 90 ? 'DRC G2 — Ligeira' : 'Normal'}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                    Adiciona idade, peso, sexo e creatinina para calcular automaticamente.
                  </div>
                )}
              </div>

              {/* Allergies */}
              {patient.allergies && (
                <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>⚠ Alergias</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#7f1d1d' }}>{patient.allergies}</div>
                </div>
              )}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Alertas clínicos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.map((alert, i) => {
                    const s = SEVERITY_STYLE[alert.severity]
                    return (
                      <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.text, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</span>
                          <span style={{ fontSize: 10, color: s.text, opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{alert.type}</span>
                        </div>
                        <div style={{ fontSize: 13, color: s.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>{alert.message}</div>
                        <div style={{ fontSize: 12, color: s.text, opacity: 0.8, lineHeight: 1.5 }}>→ {alert.action}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STOPP/START criteria */}
            {stoppCritical.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
                  Critérios STOPP detectados ({stoppCritical.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stoppCritical.map((r, i) => (
                    <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>{r.criterion}</div>
                      <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>{r.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analyze button */}
            {meds.length >= 2 && (
              <button onClick={() => analyzeProfile()} disabled={analyzing}
                style={{ width: '100%', padding: '14px', background: analyzing ? 'var(--bg-3)' : '#1d4ed8', color: analyzing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
                {analyzing ? 'A analisar perfil...' : `Analisar ${meds.length} medicamentos — detectar alertas →`}
              </button>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8, marginTop: 12 }}>
              {[
                { href: `/ai?patient=${patient.id}`, label: 'Co-Piloto IA com contexto', accent: '#1d4ed8' },
                { href: `/interactions?prefill=${meds.map(m => m.name).join(',')}`, label: 'Verificar interações', accent: 'var(--green)' },
                { href: `/calculos?creatinine=${patient.creatinine || ''}&age=${patient.age || ''}&weight=${patient.weight || ''}&sex=${patient.sex || ''}`, label: 'Calculadoras com dados do doente', accent: '#7c3aed' },
                { href: `/reconciliacao?patient=${patient.id}`, label: 'Reconciliação terapêutica', accent: '#0d9488' },
                { href: `/connect?patient=${patient.id}&name=${encodeURIComponent(patient.name)}`, label: 'Pedir interconsulta', accent: '#0d9488' },
              ].map(({ href, label, accent }) => (
                <Link key={label} href={href}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', gap: 8 }}
                  className="patient-action">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* MEDS */}
        {tab === 'meds' && (
          <div style={{ maxWidth: 700 }}>
            {/* Allergy warning banner */}
            {patient.allergies && meds.some(m => {
              const allWords = patient.allergies!.toLowerCase().split(/[\s,;\/]+/).filter(w => w.length > 3)
              return allWords.some(w => m.name.toLowerCase().includes(w))
            }) && (
              <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>Verificar alergia potencial</div>
                  <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
                    Um ou mais medicamentos pode estar relacionado com as alergias registadas ({patient.allergies}). Confirme com o clínico prescritor.
                  </div>
                </div>
              </div>
            )}
            {/* Add med */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Adicionar medicamento</div>
                <button type="button" onClick={() => { setRxOpen(true); setRxPhoto(null); setRxResult(null); setRxErr('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  Ler prescrição (IA)
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 120px auto', gap: 8, marginBottom: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input value={newMed.name}
                    onChange={e => { setNewMed(p => ({ ...p, name: e.target.value })); setSuggestions(e.target.value.length >= 2 ? suggestDrugs(e.target.value) : []) }}
                    onKeyDown={e => e.key === 'Enter' && addMed()}
                    placeholder="Nome (marca ou DCI) *"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  {suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 7px 7px', zIndex: 50, overflow: 'hidden' }}>
                      {suggestions.slice(0, 5).map(s => (
                        <button key={s.dci} onClick={() => { setNewMed(p => ({ ...p, name: s.display })); setSuggestions([]) }}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', gap: 8 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{s.display}</span>
                          {s.isBrand && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>→ {s.dci}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                  placeholder="Dose" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
                  placeholder="Frequência" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.indication} onChange={e => setNewMed(p => ({ ...p, indication: e.target.value }))}
                  placeholder="Indicação" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={addMed} disabled={!newMed.name.trim() || adding}
                  style={{ background: newMed.name.trim() && !adding ? '#1d4ed8' : 'var(--bg-3)', color: newMed.name.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: newMed.name.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {adding ? '...' : 'Add'}
                </button>
              </div>
              {/* Horário de toma (turnos) — alimenta o MAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>Tomar no turno:</span>
                {([['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']] as [string, string][]).map(([s, l]) => {
                  const on = newMed.shifts.includes(s)
                  return (
                    <button key={s} type="button" onClick={() => setNewMed(p => ({ ...p, shifts: on ? p.shifts.filter(x => x !== s) : [...p.shifts, s] }))}
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: `1.5px solid ${on ? '#1d4ed8' : 'var(--border)'}`, background: on ? '#eff6ff' : 'white', color: on ? '#1d4ed8' : 'var(--ink-4)' }}>
                      {l}
                    </button>
                  )
                })}
                <span style={{ fontSize: 10.5, color: 'var(--ink-5)' }}>{newMed.shifts.length === 0 ? 'Sem seleção = todos os turnos' : ''}</span>
              </div>
            </div>

            {/* Med list */}
            {meds.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                Nenhum medicamento ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {meds.map(med => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '13px 16px', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{med.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                        {[med.dose, med.frequency, med.indication ? `(${med.indication})` : null].filter(Boolean).join(' · ')}
                      </div>
                      {med.shifts && med.shifts.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                          {med.shifts.map(s => (
                            <span key={s} style={{ fontSize: 9.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{s === 'manha' ? 'Manhã' : s === 'tarde' ? 'Tarde' : 'Noite'}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <DrugReferenceButton drug={med.name} />
                      <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px' }} className="remove-btn">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {meds.length >= 2 && (
              <button onClick={() => { setTab('overview'); analyzeProfile() }}
                style={{ width: '100%', marginTop: 10, padding: '12px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Analisar perfil farmacológico →
              </button>
            )}
          </div>
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Notas clínicas</div>
              <textarea
                value={editData.notes || ''}
                onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                onBlur={async () => { await supabase.from('patients').update({ notes: editData.notes }).eq('id', patientId!) }}
                rows={12}
                placeholder="Notas de consulta, observações clínicas, decisões tomadas..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', lineHeight: 1.65 }} />
              <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>Guardado automaticamente ao sair do campo.</div>
            </div>
          </div>
        )}

        {/* AI TAB */}
        {tab === 'ai' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: '#1d4ed8', borderRadius: 10, padding: '20px 22px', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Co-Piloto IA · Contexto deste doente</div>
              <p style={{ fontSize: 14, color: 'white', lineHeight: 1.7, margin: '0 0 16px' }}>
                O AI tem acesso ao perfil completo de {patient.name} — diagnósticos, medicação, função renal e alergias. Não precisas de repetir nada.
              </p>
              <Link href={`/ai?patient=${patient.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: 'white', color: '#1d4ed8', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Abrir Co-Piloto com {patient.name} →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                `Há interações significativas na medicação actual de ${patient.name}?`,
                `${patient.conditions ? `Dado que tem ${patient.conditions}, ` : ''}qual o ajuste de dose adequado${crCl ? ` para um CrCl de ${crCl} mL/min` : ''}?`,
                `Que análises laboratoriais devo pedir na próxima consulta de ${patient.name}?`,
              ].map(q => (
                <Link key={q} href={`/ai?patient=${patient.id}&q=${encodeURIComponent(q)}`}
                  style={{ padding: '13px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}
                  className="patient-action">
                  &ldquo;{q}&rdquo;
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

        {/* NH: Assessments */}
        {tab === 'assessments' && isNH && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {nhAssessments.length} avaliações registadas
              </div>
              <Link href={`/assessments?patient=${patient.id}`}
                style={{ padding: '8px 16px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>
                + Nova Avaliação
              </Link>
            </div>
            {nhAssessments.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Sem avaliações registadas</div>
                <Link href={`/assessments?patient=${patient.id}`} style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>Realizar primeira avaliação →</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nhAssessments.map(a => {
                  const sc = SCALE_LABELS[a.scale]
                  const pct = sc ? Math.round((a.score / sc.max) * 100) : 0
                  return (
                    <div key={a.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{sc?.name || a.scale}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>{a.date}{a.evaluated_by ? ` · ${a.evaluated_by}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>{a.score}<span style={{ fontSize: 11, color: 'var(--ink-5)', marginLeft: 3 }}>/{sc?.max}</span></div>
                        {a.level && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>{a.level}</div>}
                      </div>
                      <div style={{ width: 80 }}>
                        <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 2 }}>{pct}%</div>
                      </div>
                      {a.notes && <div style={{ width: '100%', fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>{a.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* NH: Incidents */}
        {tab === 'incidents' && isNH && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {nhIncidents.filter(i => i.status === 'open').length} em aberto · {nhIncidents.length} total
              </div>
              <Link href={`/incidents`}
                style={{ padding: '8px 16px', background: '#dc2626', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>
                + Registar Ocorrência
              </Link>
            </div>
            {nhIncidents.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>Sem ocorrências registadas</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nhIncidents.map(inc => {
                  const sevColor = inc.severity === 'critical' ? '#dc2626' : inc.severity === 'major' ? '#c2410c' : inc.severity === 'moderate' ? '#d97706' : '#6b7280'
                  return (
                    <div key={inc.id} style={{ background: 'white', border: `1px solid var(--border)`, borderLeft: `3px solid ${sevColor}`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{INC_LABELS[inc.type] || inc.type}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sevColor, background: `${sevColor}18`, border: `1px solid ${sevColor}40`, padding: '1px 7px', borderRadius: 3, textTransform: 'uppercase' }}>{inc.severity}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: inc.status === 'open' ? '#dc2626' : inc.status === 'closed' ? '#16a34a' : '#d97706', background: inc.status === 'open' ? '#fee2e2' : inc.status === 'closed' ? '#f0fdf4' : '#fffbeb', padding: '1px 7px', borderRadius: 3, textTransform: 'uppercase' }}>{inc.status === 'open' ? 'Aberto' : inc.status === 'closed' ? 'Fechado' : 'Em revisão'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginLeft: 'auto' }}>{inc.date}{inc.time ? ` ${inc.time}` : ''}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>{inc.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* NH: Contacts */}
        {tab === 'contacts' && isNH && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{nhContacts.length} contactos</div>
              <button onClick={() => setShowAddContact(true)}
                style={{ padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                + Novo Contacto
              </button>
            </div>

            {showAddContact && (
              <div style={{ background: 'white', border: '2px solid #0d9488', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Novo Contacto</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[
                    { key: 'name', label: 'Nome *', placeholder: 'Maria da Silva' },
                    { key: 'relationship', label: 'Parentesco', placeholder: 'Filha, Cônjuge...' },
                    { key: 'phone', label: 'Telefone', placeholder: '+351 9xx xxx xxx' },
                    { key: 'email', label: 'Email', placeholder: 'email@exemplo.pt' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.label}</div>
                      <input value={(contactForm as any)[f.key]} onChange={e => setContactForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { key: 'is_emergency', label: 'Contacto de emergência' },
                    { key: 'is_legal_guardian', label: 'Representante legal' },
                    { key: 'can_visit', label: 'Autorizado a visitar' },
                  ].map(f => (
                    <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)' }}>
                      <input type="checkbox" checked={(contactForm as any)[f.key]} onChange={e => setContactForm(p => ({ ...p, [f.key]: e.target.checked }))}
                        style={{ width: 14, height: 14, accentColor: '#0d9488' }} />
                      {f.label}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={savingContact || !contactForm.name.trim()} onClick={async () => {
                    if (!user || !patientId) return
                    setSavingContact(true)
                    const { data } = await supabase.from('resident_contacts').insert({ ...contactForm, patient_id: patientId, user_id: user.id }).select().single()
                    if (data) { setNhContacts(p => [...p, data]); setShowAddContact(false); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency: true, is_legal_guardian: false, can_visit: true, notes: '' }) }
                    setSavingContact(false)
                  }} style={{ padding: '8px 16px', background: savingContact ? 'var(--bg-3)' : '#0d9488', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: savingContact ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {savingContact ? 'A guardar...' : 'Guardar'}
                  </button>
                  <button onClick={() => setShowAddContact(false)} style={{ padding: '8px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>Cancelar</button>
                </div>
              </div>
            )}

            {nhContacts.length === 0 && !showAddContact ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>👨‍👩‍👧</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Sem contactos registados</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>Adiciona a família e contactos de emergência.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nhContacts.map(c => (
                  <div key={c.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{c.relationship || 'Parentesco não especificado'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {c.is_emergency && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Emergência</span>}
                        {c.is_legal_guardian && <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Rep. Legal</span>}
                        {c.can_visit && <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4 }}>Visita autorizada</span>}
                      </div>
                    </div>
                    {(c.phone || c.email) && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 13, color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>📞 {c.phone}</a>}
                        {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none' }}>✉ {c.email}</a>}
                      </div>
                    )}
                    {c.notes && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'cronologia' && isNH && (() => {
          type Ev = { date: string; kind: string; color: string; bg: string; title: string; sub?: string }
          const evs: Ev[] = []
          nhIncidents.forEach(i => evs.push({
            date: i.date, kind: 'Ocorrência', color: i.severity === 'critical' || i.severity === 'major' ? '#dc2626' : '#d97706', bg: '#fef2f2',
            title: INC_LABELS[i.type] || i.type, sub: i.description || undefined,
          }))
          nhAssessments.forEach(a => {
            const sc = SCALE_LABELS[a.scale]
            evs.push({ date: a.date, kind: 'Avaliação', color: '#2563eb', bg: '#eff6ff', title: `${sc?.name || a.scale}: ${a.score}${sc?.unit ? ' ' + sc.unit : ''}`, sub: a.level || a.notes || undefined })
          })
          meds.filter(m => m.started_at).forEach(m => evs.push({
            date: (m.started_at || '').slice(0, 10), kind: 'Medicação', color: '#0d6e42', bg: '#f0fdf5',
            title: `Início · ${m.name}`, sub: [m.dose, m.frequency].filter(Boolean).join(' · ') || undefined,
          }))
          evs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          return (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Cronologia 360 · {evs.length} eventos
              </div>
              {evs.length === 0 ? (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                  Sem eventos registados. Avaliações, ocorrências e início de medicação aparecem aqui automaticamente.
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 22 }}>
                  <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
                  {evs.map((e, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
                      <div style={{ position: 'absolute', left: -22, top: 4, width: 14, height: 14, borderRadius: '50%', background: 'white', border: `3px solid ${e.color}` }} />
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: e.color, background: e.bg, padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{e.kind}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)' }}>
                            {e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.title}</div>
                        {e.sub && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{e.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

      {/* ── Modal: Ler prescrição por foto (IA) ── */}
      {rxOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }} onClick={() => !rxAnalyzing && !rxAdding && setRxOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Ler prescrição por foto</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>A IA extrai a medicação. Confirma sempre antes de adicionar.</div>
              </div>
              <button onClick={() => !rxAnalyzing && !rxAdding && setRxOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-5)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Captura/upload */}
              <label style={{ display: 'block', border: `1.5px dashed ${rxPhoto ? '#4338ca' : 'var(--border)'}`, borderRadius: 12, padding: rxPhoto ? 10 : '28px 16px', textAlign: 'center', cursor: 'pointer', background: rxPhoto ? '#f5f3ff' : 'var(--bg-2)' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setRxPhoto(f); setRxResult(null); setRxErr('') } }} />
                {rxPhoto ? (
                  <div style={{ fontSize: 13, color: '#4338ca', fontWeight: 600 }}>📄 {rxPhoto.name} · toca para trocar</div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-3)' }}>Tirar foto ou escolher imagem</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>Receita, prescrição ou caixa/rótulo</div>
                  </div>
                )}
              </label>

              {rxPhoto && !rxResult && (
                <button onClick={rxAnalyze} disabled={rxAnalyzing}
                  style={{ width: '100%', marginTop: 12, padding: 12, background: rxAnalyzing ? 'var(--bg-3)' : '#4338ca', color: rxAnalyzing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: rxAnalyzing ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {rxAnalyzing ? 'A analisar…' : 'Analisar prescrição →'}
                </button>
              )}

              {rxErr && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12.5, color: '#991b1b' }}>{rxErr}</div>}

              {/* Resultado */}
              {rxResult && (
                <div style={{ marginTop: 16 }}>
                  {rxResult.warnings?.length > 0 && (
                    <div style={{ marginBottom: 12, padding: '9px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                      {rxResult.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}
                  {rxResult.meds.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Não foi possível extrair medicação. Tenta uma foto mais nítida.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Medicação detetada — confirma e seleciona</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {rxResult.meds.map((m, i) => {
                          const on = !!rxSel[i]
                          const conf = m.confidence === 'alta' ? { c: '#16a34a', l: 'alta' } : m.confidence === 'baixa' ? { c: '#dc2626', l: 'baixa' } : { c: '#d97706', l: 'média' }
                          const allergyHit = patient?.allergies && String(m.name || '').toLowerCase() && patient.allergies.toLowerCase().split(/[,;/\s]+/).some(t => t.length >= 4 && String(m.name).toLowerCase().includes(t))
                          return (
                            <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1.5px solid ${on ? '#c7d2fe' : 'var(--border)'}`, background: on ? '#f5f3ff' : 'white', borderRadius: 10, cursor: 'pointer' }}>
                              <input type="checkbox" checked={on} onChange={() => setRxSel(s => ({ ...s, [i]: !s[i] }))} style={{ marginTop: 3, accentColor: '#4338ca' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{m.name || '(sem nome)'}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: conf.c }}>{conf.l}</span>
                                  {allergyHit && <span style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: 4 }}>⚠ alergia?</span>}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                                  {[m.dose, m.frequency, m.indication ? `(${m.indication})` : null].filter(Boolean).join(' · ') || '—'}
                                </div>
                                {Array.isArray(m.shifts) && m.shifts.length > 0 && (
                                  <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                                    {m.shifts.map((s: string) => <span key={s} style={{ fontSize: 9.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 4 }}>{s === 'manha' ? 'Manhã' : s === 'tarde' ? 'Tarde' : 'Noite'}</span>)}
                                  </div>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                      <button onClick={rxAddSelected} disabled={rxAdding || Object.values(rxSel).every(v => !v)}
                        style={{ width: '100%', marginTop: 14, padding: 12, background: rxAdding || Object.values(rxSel).every(v => !v) ? 'var(--bg-3)' : '#1d4ed8', color: rxAdding || Object.values(rxSel).every(v => !v) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: rxAdding ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                        {rxAdding ? 'A adicionar…' : `Adicionar ${Object.values(rxSel).filter(Boolean).length} à medicação`}
                      </button>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-5)', marginTop: 8, textAlign: 'center' }}>Extração de apoio por IA — confirma com a prescrição original.</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .patient-action:hover { border-color: #1d4ed8 !important; background: var(--blue-light) !important; }
        .remove-btn:hover { color: var(--red) !important; }
      `}</style>
    </div>
  )
}