'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

interface STOPPItem {
  code: string; criterion: string; drug: string
  severity: 'alto' | 'moderado' | 'baixo'
  recommendation: string; rationale: string; alternative?: string
}
interface STARTItem {
  code: string; criterion: string; condition: string
  drug_class: string; rationale: string; note?: string
}
interface BeersItem { drug: string; concern: string; recommendation: string }
interface Summary {
  total_stopp: number; total_start: number; total_beers: number
  high_priority: string[]; overall_assessment: string
}
interface Result {
  stopp: STOPPItem[]; start: STARTItem[]
  beers: BeersItem[]; summary: Summary
}

const SEVERITY_STYLE = {
  alto:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: '🚨' },
  moderado:{ bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', icon: '⚠️' },
  baixo:   { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: 'ℹ️' },
}

const COMMON_CONDITIONS = [
  'Insuficiência cardíaca', 'Fibrilhação auricular', 'Hipertensão arterial',
  'Diabetes Mellitus tipo 2', 'Doença renal crónica', 'DPOC', 'Asma',
  'Demência / Alzheimer', 'Parkinson', 'Depressão', 'Ansiedade',
  'Osteoporose', 'Artrite reumatoide', 'Hipotiroidismo', 'Dislipidemia',
  'Úlcera péptica / DRGE', 'Insuficiência hepática', 'AVC / AIT prévio',
  'Doença arterial coronária', 'Doença arterial periférica',
  'Cancro activo', 'Epilepsia', 'Glaucoma', 'Hiperplasia prostática benigna',
]

export default function STOPPStartPage() {
  const { user, supabase } = useAuth()
  const [form, setForm] = useState({
    age: '', sex: '', diagnoses: '', medications: '', labs: '',
  })
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'stopp'|'start'|'beers'>('stopp')
  const [patients, setPatients] = useState<{id:string;name:string;age:number|null;conditions:string|null}[]>([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('patients').select('id,name,age,conditions').eq('user_id', user.id).order('name')
      .then(({ data }) => setPatients(data || []))
  }, [user, supabase])

  const loadPatient = (id: string) => {
    setSelectedPatient(id)
    const p = patients.find(pt => pt.id === id)
    if (!p) return
    setForm(f => ({
      ...f,
      age: p.age ? String(p.age) : f.age,
      diagnoses: p.conditions || f.diagnoses,
    }))
    supabase.from('patient_meds').select('name,dose,frequency').eq('patient_id', id)
      .then(({ data }) => {
        if (data?.length) setForm(f => ({ ...f, medications: data.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`).join('\n') }))
      })
  }

  const toggleCondition = (c: string) => {
    setSelectedConditions(s => {
      const next = s.includes(c) ? s.filter(x => x !== c) : [...s, c]
      setForm(f => ({ ...f, diagnoses: next.join(', ') }))
      return next
    })
  }

  const analyze = async () => {
    if (!form.medications.trim()) { setError('Lista de medicamentos obrigatória'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/stopp-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro na análise.') }
    setLoading(false)
  }

  const copyReport = () => {
    if (!result) return
    const lines = [
      `ANÁLISE STOPP/START — ${new Date().toLocaleDateString('pt-PT')}`,
      `Doente: ${form.age ? form.age + ' anos' : '?'} · ${form.sex || '?'}`,
      form.diagnoses ? `Diagnósticos: ${form.diagnoses}` : '',
      '',
      `RESUMO: ${result.summary.total_stopp} STOPP · ${result.summary.total_start} START · ${result.summary.total_beers} Beers`,
      result.summary.overall_assessment,
      '',
      result.stopp.length ? `CRITÉRIOS STOPP (${result.stopp.length}):` : '',
      ...result.stopp.map(s => `[${s.code}] ${s.drug} — ${s.recommendation}`),
      '',
      result.start.length ? `CRITÉRIOS START (${result.start.length}):` : '',
      ...result.start.map(s => `[${s.code}] ${s.drug_class} — ${s.rationale}`),
      '',
      `Gerado pelo Phlox STOPP/START · Critérios versão 3 (2023)`,
    ].filter(l => l !== undefined).join('\n')
    navigator.clipboard.writeText(lines)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Revisão de Medicação · Idoso</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>STOPP/START v3 · Beers 2023</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 520 }}>
                Análise automatizada de medicação potencialmente inapropriada em idosos. Critérios STOPP/START versão 3 (O'Mahony 2023) + Critérios de Beers (AGS 2023).
              </div>
            </div>
            {result && (
              <button onClick={copyReport}
                style={{ padding: '9px 16px', background: copied ? '#d1fae5' : 'var(--bg-2)', color: copied ? '#065f46' : 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✓ Copiado' : '📋 Copiar relatório'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ display: 'grid', gridTemplateColumns: result ? '380px 1fr' : '1fr', gap: 16 }}>

          {/* INPUT PANEL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Dados do Doente</div>

              {/* Patient selector */}
              {user && patients.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Carregar doente registado</label>
                  <select value={selectedPatient} onChange={e => loadPatient(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)', background: 'white', cursor: 'pointer' }}>
                    <option value=''>— Selecionar —</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Idade *</label>
                  <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="Ex: 78"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Sexo</label>
                  <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)', background: 'white' }}>
                    <option value=''>—</option><option value='Masculino'>Masculino</option><option value='Feminino'>Feminino</option>
                  </select>
                </div>
              </div>

              {/* Conditions chips */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Diagnósticos (selecionar ou escrever)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {COMMON_CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggleCondition(c)}
                      style={{ padding: '3px 9px', borderRadius: 20, border: `1px solid ${selectedConditions.includes(c) ? '#1d4ed8' : 'var(--border)'}`, background: selectedConditions.includes(c) ? '#eff6ff' : 'white', color: selectedConditions.includes(c) ? '#1d4ed8' : 'var(--ink-4)', fontSize: 11, cursor: 'pointer' }}>
                      {c}
                    </button>
                  ))}
                </div>
                <textarea value={form.diagnoses} onChange={e => { setForm(f => ({ ...f, diagnoses: e.target.value })); setSelectedConditions([]) }}
                  placeholder="Ou escrever diagnósticos/condições..."
                  rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-sans)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Medicação actual * (um por linha)</label>
                <textarea value={form.medications} onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                  placeholder={'Metformina 850mg 2x/dia\nRamipril 5mg 1x/dia\nAmlodipin 5mg 1x/dia\nDiazepam 5mg à noite\n...'}
                  rows={8} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-mono)', resize: 'vertical', lineHeight: 1.8, boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Parâmetros laboratoriais (opcional)</label>
                <input value={form.labs} onChange={e => setForm(f => ({ ...f, labs: e.target.value }))}
                  placeholder="Ex: Creat 1.8 mg/dL (TFG 35), K 3.2, INR 2.4"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
              </div>

              {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 10 }}>{error}</div>}

              <button onClick={analyze} disabled={loading || !form.medications.trim()}
                style={{ width: '100%', padding: '12px', background: (!form.medications.trim() || loading) ? '#9ca3af' : '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (!form.medications.trim() || loading) ? 'default' : 'pointer' }}>
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      A analisar STOPP/START...
                    </span>
                  : '🔍 Analisar STOPP/START + Beers'
                }
              </button>
            </div>
          </div>

          {/* RESULTS PANEL */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Summary */}
              <div style={{ background: result.summary.total_stopp + result.summary.total_beers > 3 ? '#fef2f2' : result.summary.total_stopp > 0 ? '#fef9c3' : '#f0fdf4', border: `1px solid ${result.summary.total_stopp + result.summary.total_beers > 3 ? '#fca5a5' : result.summary.total_stopp > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'STOPP', count: result.summary.total_stopp, color: '#dc2626' },
                    { label: 'START', count: result.summary.total_start, color: '#059669' },
                    { label: 'Beers', count: result.summary.total_beers, color: '#d97706' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: item.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{item.count}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{result.summary.overall_assessment}</div>
                {result.summary.high_priority?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#991b1b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Prioridade máxima</div>
                    {result.summary.high_priority.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#991b1b', display: 'flex', gap: 6, marginBottom: 3 }}>
                        <span>🚨</span><span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  {([
                    { id: 'stopp', label: `STOPP (${result.stopp.length})`, color: '#dc2626' },
                    { id: 'start', label: `START (${result.start.length})`, color: '#059669' },
                    { id: 'beers', label: `Beers (${result.beers.length})`, color: '#d97706' },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? t.color : 'var(--ink-4)', borderBottom: activeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent', fontFamily: 'var(--font-mono)' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {activeTab === 'stopp' && (
                    result.stopp.length === 0
                      ? <div style={{ padding: '24px', textAlign: 'center', color: '#059669', fontSize: 14 }}>✓ Nenhum critério STOPP identificado</div>
                      : result.stopp.map((item, i) => {
                          const sev = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.baixo
                          return (
                            <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-3)', background: sev.bg }}>
                              <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12 }}>{sev.icon}</span>
                                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: sev.color, background: 'white', border: `1px solid ${sev.border}`, padding: '2px 7px', borderRadius: 3 }}>{item.code}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.drug}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-mono)', color: sev.color, textTransform: 'uppercase', fontWeight: 700 }}>{item.severity}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, lineHeight: 1.5 }}>{item.criterion}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: sev.color, marginBottom: 4 }}>→ {item.recommendation}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{item.rationale}</div>
                              {item.alternative && <div style={{ marginTop: 5, fontSize: 12, color: '#059669', fontFamily: 'var(--font-mono)' }}>Alternativa: {item.alternative}</div>}
                            </div>
                          )
                        })
                  )}

                  {activeTab === 'start' && (
                    result.start.length === 0
                      ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>Nenhum critério START identificado</div>
                      : result.start.map((item, i) => (
                          <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-3)', background: '#f0fdf4' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669', background: 'white', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: 3 }}>{item.code}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.drug_class}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 5, lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700 }}>Indicação: </span>{item.condition}
                            </div>
                            <div style={{ fontSize: 13, color: '#059669', fontWeight: 700, marginBottom: 4 }}>→ {item.criterion}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{item.rationale}</div>
                            {item.note && <div style={{ marginTop: 5, fontSize: 11, color: '#d97706', fontFamily: 'var(--font-mono)' }}>⚠ {item.note}</div>}
                          </div>
                        ))
                  )}

                  {activeTab === 'beers' && (
                    result.beers.length === 0
                      ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>Nenhum critério Beers identificado</div>
                      : result.beers.map((item, i) => (
                          <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-3)', background: '#fffbeb' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>{item.drug}</div>
                            <div style={{ fontSize: 12, color: '#92400e', marginBottom: 5, lineHeight: 1.5 }}>{item.concern}</div>
                            <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700 }}>→ {item.recommendation}</div>
                          </div>
                        ))
                  )}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                Baseado em: O'Mahony et al. STOPP/START Criteria v3, Age Ageing 2023 · AGS Beers Criteria 2023.
                Esta análise é gerada por IA — confirmação clínica obrigatória antes de qualquer alteração terapêutica.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
