'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { suggestDrugs } from '@/lib/drugNames'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MedRow {
  id: string
  name: string
  dose: string
  frequency: string
}

interface PatientCtx {
  age: string
  sex: string
  weight: string
  creatinine: string
  conditions: string
  allergies: string
}

interface MonitorAlert {
  type: 'interaction' | 'renal' | 'beers' | 'duplication' | 'monitoring' | 'contraindication'
  severity: 'critical' | 'major' | 'moderate' | 'minor'
  drugs_involved: string[]
  message: string
  action: string
  evidence: string
}

interface MonitorResult {
  alerts: MonitorAlert[]
  score: number
  summary: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MonitorAlert['type'], string> = {
  interaction:      'Interacção',
  renal:            'Ajuste Renal',
  beers:            'Critérios Beers',
  duplication:      'Duplicação',
  monitoring:       'Monitorização',
  contraindication: 'Contra-indicação',
}

const TYPE_ICONS: Record<MonitorAlert['type'], string> = {
  interaction:      '⚡',
  renal:            'K',
  beers:            'B',
  duplication:      'D',
  monitoring:       'M',
  contraindication: 'C',
}

const SEV_COLOR: Record<MonitorAlert['severity'], { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#dc2626' },
  major:    { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', dot: '#f97316' },
  moderate: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#d97706' },
  minor:    { bg: 'var(--bg-2)', border: 'var(--border)', text: 'var(--ink-3)', dot: 'var(--ink-4)' },
}

const SEV_LABELS: Record<MonitorAlert['severity'], string> = {
  critical: 'Crítico',
  major:    'Major',
  moderate: 'Moderado',
  minor:    'Minor',
}

function scoreColor(score: number): { bg: string; text: string; border: string; dot: string } {
  if (score >= 80) return { bg: 'var(--green-light)', text: 'var(--green)',  border: 'var(--green-mid)', dot: 'var(--green)' }
  if (score >= 60) return { bg: '#fffbeb',            text: '#92400e',       border: '#fde68a',          dot: '#d97706' }
  if (score >= 40) return { bg: '#fff7ed',            text: '#9a3412',       border: '#fdba74',          dot: '#f97316' }
  return                   { bg: '#fef2f2',            text: '#991b1b',       border: '#fca5a5',          dot: '#dc2626' }
}

function newRow(): MedRow {
  return { id: Math.random().toString(36).slice(2), name: '', dose: '', frequency: '' }
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
      <div style={{ maxWidth: 500, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eff6ff', border: '2px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
          🔬
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Monitor de Polimedicação
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
          Analisa listas de medicamentos e detecta automaticamente interacções, ajustes renais, critérios Beers, duplicações terapêuticas e alertas de monitorização — com evidência clínica citada.
        </p>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
          {[
            { icon: '⚡', text: 'Interacções farmacodinâmicas e farmacocinéticas' },
            { icon: 'K', text: 'Ajuste de dose em insuficiência renal (KDIGO)' },
            { icon: 'B', text: 'Critérios Beers AGS 2023 para idosos' },
            { icon: 'D', text: 'Detecção de duplicação terapêutica' },
            { icon: 'M', text: 'Alertas de monitorização prioritários' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
            Desbloquear Pro →
          </Link>
          <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 20px', borderRadius: 6, fontSize: 13, border: '1px solid var(--border-2)' }}>
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
        <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
          <circle cx="44" cy="44" r={radius} fill="none" stroke={c.dot} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: c.text, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>/100</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 3 }}>
          {score >= 80 ? 'Perfil seguro' : score >= 60 ? 'Atenção necessária' : score >= 40 ? 'Risco moderado' : 'Risco elevado'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          Índice de segurança farmacológica
        </div>
      </div>
    </div>
  )
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: MonitorAlert }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEV_COLOR[alert.severity]

  return (
    <div style={{ border: `1px solid ${s.border}`, borderRadius: 8, background: s.bg, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Severity dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.text, background: s.border, padding: '2px 7px', borderRadius: 3 }}>
              {TYPE_ICONS[alert.type]} {TYPE_LABELS[alert.type]}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: s.text }}>
              {SEV_LABELS[alert.severity]}
            </span>
            {alert.drugs_involved.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                {alert.drugs_involved.join(' + ')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: s.text, margin: 0, lineHeight: 1.5 }}>{alert.message}</p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-4)', flexShrink: 0, marginTop: 2 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${s.border}`, padding: '12px 16px 14px', paddingLeft: 36 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acção recomendada</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>{alert.action}</p>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📚</span> {alert.evidence}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [patients, setPatients] = useState<Array<{id:string; name:string; age?:number; conditions?:string}>>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [meds, setMeds] = useState<MedRow[]>([newRow(), newRow()])
  const [ctx, setCtx] = useState<PatientCtx>({ age: '', sex: '', weight: '', creatinine: '', conditions: '', allergies: '' })
  const [result, setResult] = useState<MonitorResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCtx, setShowCtx] = useState(false)

  // Load patients from database
  useEffect(() => {
    if (!user || !isPro) return
    supabase.from('patients').select('id, name, age, conditions')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setPatients(data || []))
  }, [user, isPro, supabase])

  // Load meds when a patient is selected
  const loadPatientMeds = useCallback(async (patId: string) => {
    const { data } = await supabase.from('patient_meds')
      .select('id, name, dose, frequency')
      .eq('patient_id', patId)
      .eq('active', true)
    if (data && data.length > 0) {
      setMeds(data.map(m => ({ id: m.id, name: m.name, dose: m.dose || '', frequency: m.frequency || '' })))
      const pat = patients.find(p => p.id === patId)
      if (pat) {
        setCtx(prev => ({ ...prev, age: String(pat.age || ''), conditions: pat.conditions || '' }))
      }
    }
  }, [supabase, patients])

  const handlePatientSelect = (patId: string) => {
    setSelectedPatient(patId)
    if (patId) loadPatientMeds(patId)
    else setMeds([newRow(), newRow()])
  }

  const updateMed = (id: string, field: keyof MedRow, value: string) =>
    setMeds(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))

  const addMed = () => setMeds(prev => [...prev, newRow()])
  const removeMed = (id: string) => setMeds(prev => prev.length > 1 ? prev.filter(m => m.id !== id) : prev)

  const filledMeds = meds.filter(m => m.name.trim())

  const handleAnalyse = async () => {
    if (filledMeds.length === 0) { setError('Adiciona pelo menos um medicamento.'); return }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }

      const patient_context = {
        age: ctx.age ? parseInt(ctx.age) : undefined,
        sex: ctx.sex || undefined,
        weight: ctx.weight ? parseFloat(ctx.weight) : undefined,
        creatinine: ctx.creatinine ? parseFloat(ctx.creatinine) : undefined,
        conditions: ctx.conditions || undefined,
        allergies: ctx.allergies || undefined,
      }

      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          medications: filledMeds.map(m => ({ name: m.name, dose: m.dose || undefined, frequency: m.frequency || undefined })),
          patient_context,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na análise.')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const criticalCount = result?.alerts.filter(a => a.severity === 'critical').length || 0
  const majorCount    = result?.alerts.filter(a => a.severity === 'major').length || 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {!user ? (
        <UpgradeGate />
      ) : !isPro ? (
        <UpgradeGate />
      ) : (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>🔬</span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>
                Monitor de Polimedicação
              </h1>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#eff6ff', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                PRO
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0 }}>
              Análise clínica de interacções, critérios Beers, ajuste renal e duplicação terapêutica com evidência citada.
            </p>
          </div>

          {/* Patient quick-load */}
          {patients.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>Carregar doente:</div>
              <select value={selectedPatient} onChange={e => handlePatientSelect(e.target.value)}
                style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
                <option value="">Introdução manual</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age} anos)` : ''}</option>
                ))}
              </select>
              {selectedPatient && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  Medicação carregada ✓
                </span>
              )}
            </div>
          )}

          <div className="two-col" style={{ gap: 24, alignItems: 'flex-start' }}>

            {/* ── Left: inputs ── */}
            <div>
              {/* Medication list */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Medicamentos</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{filledMeds.length} introduzido{filledMeds.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={addMed}
                    style={{ background: 'var(--green-light)', color: 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 5, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    + Adicionar
                  </button>
                </div>

                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 28px', gap: 8, padding: '8px 12px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Medicamento (DCI)', 'Dose', 'Frequência', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>

                {meds.map((med, i) => (
                  <div key={med.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 28px', gap: 8, padding: '8px 12px', borderBottom: i < meds.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center' }}>
                    <input
                      value={med.name}
                      onChange={e => updateMed(med.id, 'name', e.target.value)}
                      placeholder="ex: metformina"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <input
                      value={med.dose}
                      onChange={e => updateMed(med.id, 'dose', e.target.value)}
                      placeholder="500mg"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <input
                      value={med.frequency}
                      onChange={e => updateMed(med.id, 'frequency', e.target.value)}
                      placeholder="2x/dia"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => removeMed(med.id)}
                      style={{ width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 4, background: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Patient context (collapsible) */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <button onClick={() => setShowCtx(!showCtx)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Contexto do doente</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                      {showCtx ? 'Clica para fechar' : 'Opcional — melhora a precisão da análise'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{showCtx ? '▲' : '▼'}</span>
                </button>
                {showCtx && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {[
                        { label: 'Idade (anos)', key: 'age', placeholder: 'ex: 72', type: 'number' },
                        { label: 'Peso (kg)', key: 'weight', placeholder: 'ex: 68', type: 'number' },
                        { label: 'Creatinina (µmol/L)', key: 'creatinine', placeholder: 'ex: 120', type: 'number' },
                      ].map(f => (
                        <div key={f.key}>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4 }}>{f.label}</div>
                          <input
                            type={f.type}
                            value={ctx[f.key as keyof PatientCtx]}
                            onChange={e => setCtx(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4 }}>Sexo</div>
                        <select value={ctx.sex} onChange={e => setCtx(prev => ({ ...prev, sex: e.target.value }))}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">—</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4 }}>Alergias</div>
                        <input
                          value={ctx.allergies}
                          onChange={e => setCtx(prev => ({ ...prev, allergies: e.target.value }))}
                          placeholder="ex: penicilina"
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4 }}>Comorbilidades</div>
                      <textarea
                        value={ctx.conditions}
                        onChange={e => setCtx(prev => ({ ...prev, conditions: e.target.value }))}
                        placeholder="ex: DM tipo 2, HTA, IRC moderada, FA"
                        rows={2}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <button onClick={handleAnalyse} disabled={loading || filledMeds.length === 0}
                style={{ width: '100%', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: loading || filledMeds.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid var(--ink-4)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    A analisar medicação…
                  </>
                ) : '🔬 Analisar Polimedicação'}
              </button>
            </div>

            {/* ── Right: results ── */}
            <div>
              {!result && !loading && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: 'var(--ink-4)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔬</div>
                  <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)' }}>Introduz os medicamentos<br/>e clica em analisar</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 8, color: 'var(--ink-5)' }}>até 20 medicamentos · análise em segundos</div>
                </div>
              )}

              {loading && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid var(--bg-3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--font-serif)' }}>A verificar interacções…</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>critérios Beers · ajuste renal · duplicações</div>
                </div>
              )}

              {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Score + summary */}
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px' }}>
                    <ScoreRing score={result.score} />
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bg-3)' }}>
                      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
                    </div>
                    {(criticalCount > 0 || majorCount > 0) && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        {criticalCount > 0 && (
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                            {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {majorCount > 0 && (
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                            {majorCount} major
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Alerts */}
                  {result.alerts.length === 0 ? (
                    <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 10, padding: '20px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: 14, color: 'var(--green-2)', fontWeight: 600 }}>Nenhum alerta identificado</div>
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>Perfil farmacológico sem problemas detectáveis com a informação fornecida</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {result.alerts.length} alerta{result.alerts.length !== 1 ? 's' : ''} — clica para ver acção
                      </div>
                      {/* Sort: critical first */}
                      {[...result.alerts]
                        .sort((a, b) => {
                          const order = { critical: 0, major: 1, moderate: 2, minor: 3 }
                          return order[a.severity] - order[b.severity]
                        })
                        .map((alert, i) => (
                          <AlertCard key={i} alert={alert} />
                        ))}
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
                    Análise educacional — não substitui avaliação clínica individualizada.<br/>
                    Confirma sempre com a ficha técnica e o contexto clínico.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus { border-color: var(--green) !important; box-shadow: 0 0 0 2px var(--green-glow); }
      `}</style>
    </div>
  )
}