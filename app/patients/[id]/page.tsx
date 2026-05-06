'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'


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
}

interface Alert {
  type: 'interaction' | 'dose' | 'beers' | 'monitoring'
  severity: 'grave' | 'moderada' | 'info'
  message: string
  action: string
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [meds, setMeds] = useState<PatientMed[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'meds' | 'notes' | 'ai'>('overview')
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '', indication: '' })
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Patient>>({})
  const [patientId, setPatientId] = useState<string | null>(null)

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
    if (!patientData) { router.push('/dashboard?mode=pro'); return }
    setPatient(patientData)
    setMeds(medsData || [])
    setEditData(patientData)
    setLoading(false)
  }, [user, supabase, patientId, router])

  useEffect(() => { load() }, [load])

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
    }).select().single()
    if (error) console.error('addMed error:', error.message)
    if (data) {
      setMeds(p => [data, ...p])
      // updated_at is handled automatically by trigger
    }
    setNewMed({ name: '', dose: '', frequency: '', indication: '' })
    setSuggestions([])
    setAdding(false)
  }

  const removeMed = async (id: string) => {
    await supabase.from('patient_meds').delete().eq('id', id)
    setMeds(p => p.filter(m => m.id !== id))
  }

  const analyzeProfile = async () => {
    if (meds.length < 2 || !patientId) return
    setAnalyzing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/patients/analyze', {
        method: 'POST', headers,
        body: JSON.stringify({ patient, medications: meds })
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

  // Calc CrCl if we have age, weight, creatinine, sex
  const crCl = patient?.age && patient?.weight && patient?.creatinine && patient?.sex
    ? Math.round(((140 - patient.age) * patient.weight * (patient.sex === 'F' ? 0.85 : 1)) / (72 * patient.creatinine))
    : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />
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
      <Header />

      {/* Patient header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>

          {/* Back */}
          <Link href="/dashboard?mode=pro&tab=patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 16 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Doentes
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 6 }}>
                {patient.name}
              </h1>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {patient.age && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.age} anos</span>}
                {patient.sex && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Feminino' : patient.sex}</span>}
                {crCl && <span style={{ fontSize: 12, color: crCl < 30 ? 'var(--red)' : crCl < 60 ? 'var(--amber)' : 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>CrCl: {crCl} mL/min</span>}
                {meds.length > 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{meds.length} medicamentos</span>}
                {alerts.filter(a => a.severity === 'grave').length > 0 && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', background: 'var(--red-light)', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 3 }}>
                    {alerts.filter(a => a.severity === 'grave').length} alerta{alerts.filter(a => a.severity === 'grave').length > 1 ? 's' : ''} grave{alerts.filter(a => a.severity === 'grave').length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setEditing(!editing)}
                style={{ padding: '7px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-2)' }}>
                Editar
              </button>
              <Link href={`/ai?patient=${patient.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                Co-Piloto IA
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            {[['overview', 'Resumo'], ['meds', 'Medicação'], ['notes', 'Notas'], ['ai', 'IA']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
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

            {/* Analyze button */}
            {meds.length >= 2 && (
              <button onClick={analyzeProfile} disabled={analyzing}
                style={{ width: '100%', padding: '14px', background: analyzing ? 'var(--bg-3)' : '#1d4ed8', color: analyzing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
                {analyzing ? 'A analisar perfil...' : `Analisar ${meds.length} medicamentos — detectar alertas →`}
              </button>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8, marginTop: 12 }}>
              {[
                { href: `/ai?patient=${patient.id}`, label: 'Co-Piloto IA com contexto', accent: '#1d4ed8' },
                { href: `/interactions?prefill=${meds.map(m => m.name).join(',')}`, label: 'Verificar interações', accent: 'var(--green)' },
                { href: `/calculators?creatinine=${patient.creatinine}&age=${patient.age}&weight=${patient.weight}&sex=${patient.sex}`, label: 'Calculadoras com dados deste doente', accent: 'var(--ink-3)' },
              ].map(({ href, label, accent }) => (
                <Link key={href} href={href}
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
            {/* Add med */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12, position: 'relative' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Adicionar medicamento</div>
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
                    </div>
                    <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px' }} className="remove-btn">×</button>
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

      <style>{`
        .patient-action:hover { border-color: #1d4ed8 !important; background: var(--blue-light) !important; }
        .remove-btn:hover { color: var(--red) !important; }
      `}</style>
    </div>
  )
}