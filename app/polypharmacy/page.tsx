'use client'

import { useState } from 'react'

interface PolypharmacyResult {
  risk_score: number
  risk_level: 'baixo' | 'moderado' | 'alto' | 'muito_alto'
  total_meds: number
  polypharmacy: boolean
  hyperpolypharmacy: boolean
  anticholinergic_burden: { score: number; level: string; drugs_contributing: string[] }
  sedative_burden: { score: number; level: string; drugs_contributing: string[] }
  inappropriate_meds: { drug: string; criterion: string; criterion_code: string; severity: string; reason: string; recommendation: string; alternative: string }[]
  duplications: { class: string; drugs: string[]; recommendation: string }[]
  prescribing_cascades: { cause_drug: string; adverse_effect: string; consequence_drug: string; recommendation: string }[]
  missing_treatments: { condition: string; missing_drug_class: string; rationale: string; note: string }[]
  key_interactions: { drug_a: string; drug_b: string; severity: string; effect: string; management: string }[]
  priority_actions: { priority: number; action: string; drug: string; timeline: string }[]
  summary: string
}

const RISK_CONFIG = {
  baixo:      { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: 'Risco Baixo' },
  moderado:   { bg: '#fef9c3', color: '#854d0e', border: '#fde68a', label: 'Risco Moderado' },
  alto:       { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Risco Alto' },
  muito_alto: { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4', label: 'Risco Muito Alto' },
}

const SEV_CONFIG: Record<string, { bg: string; color: string }> = {
  alto:    { bg: '#fee2e2', color: '#991b1b' },
  grave:   { bg: '#fee2e2', color: '#991b1b' },
  moderado: { bg: '#fef9c3', color: '#854d0e' },
  moderada: { bg: '#fef9c3', color: '#854d0e' },
  baixo:   { bg: '#f1f5f9', color: '#475569' },
  ligeira: { bg: '#f1f5f9', color: '#475569' },
}

const TIMELINE_COLOR: Record<string, string> = {
  imediato: '#dc2626',
  'próxima visita': '#d97706',
  'próxima consulta': '#0369a1',
}

const SAMPLE_MEDS = `Omeprazol 20mg 1x/dia
Metformina 500mg 2x/dia
Metoprolol 50mg 2x/dia
Atorvastatina 20mg 1x/dia (noite)
Ramipril 5mg 1x/dia
Diazepam 5mg 1x/dia (noite)
Lorazepam 1mg SOS
Amitriptilina 25mg 1x/dia (noite)
Furosemida 40mg 1x/dia
Espironolactona 25mg 1x/dia
Alopurinol 300mg 1x/dia
Ibuprofeno 400mg 3x/dia
Metoclopramida 10mg 3x/dia
Haloperidol 1mg 1x/dia`

export default function PolypharmacyPage() {
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [weight, setWeight] = useState('')
  const [diagnoses, setDiagnoses] = useState('')
  const [labs, setLabs] = useState('')
  const [medications, setMedications] = useState('')
  const [context, setContext] = useState('lar de idosos')
  const [recentFalls, setRecentFalls] = useState('')
  const [cognitive, setCognitive] = useState('')

  const [result, setResult] = useState<PolypharmacyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'priority' | 'mpi' | 'interactions' | 'burden' | 'cascades'>('priority')

  const submit = async () => {
    if (!age) { setError('Idade obrigatória.'); return }
    if (!medications.trim()) { setError('Lista de medicamentos obrigatória.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/polypharmacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age, sex, weight, diagnoses, labs, medications, context, recent_falls: recentFalls || undefined, cognitive: cognitive || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro na auditoria.') }
    setLoading(false)
  }

  const Tab = ({ id, label, count }: { id: typeof activeTab; label: string; count?: number }) => (
    <button onClick={() => setActiveTab(id)}
      style={{ padding: '8px 14px', background: activeTab === id ? '#0f172a' : 'transparent', color: activeTab === id ? 'white' : 'var(--ink-4)', border: activeTab === id ? 'none' : '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ padding: '1px 6px', background: activeTab === id ? 'rgba(255,255,255,0.2)' : '#fee2e2', color: activeTab === id ? 'white' : '#991b1b', borderRadius: 10, fontSize: 10 }}>{count}</span>
      )}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Farmácia Clínica · Polimedicação</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', marginBottom: 6 }}>Auditoria de Polimedicação</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 560 }}>
            Revisão completa da terapêutica: MPI, cascatas de prescrição, carga anticolinérgica, duplicações, omissões. STOPP v3 · Beers 2023 · EU-PIM.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: result ? '340px 1fr' : '560px', gap: 16, margin: '0 auto' }}>

          {/* Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Dados do doente</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Idade *</label>
                  <input value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 82"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Sexo</label>
                  <select value={sex} onChange={e => setSex(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box', background: 'white' }}>
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Peso (kg)</label>
                  <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="ex: 64"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Diagnósticos</label>
                <input value={diagnoses} onChange={e => setDiagnoses(e.target.value)} placeholder="ex: HTA, DM2, FA, ICC, DRC grau 3, Demência Alzheimer"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Parâmetros laboratoriais</label>
                <input value={labs} onChange={e => setLabs(e.target.value)} placeholder="ex: Creatinina 1.8 mg/dL, K+ 3.2, Hb 11.2, Albumina 3.0"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Contexto</label>
                  <select value={context} onChange={e => setContext(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, background: 'white' }}>
                    <option value="lar de idosos">Lar de idosos</option>
                    <option value="ambulatório">Ambulatório / Clínica</option>
                    <option value="internamento hospitalar">Internamento</option>
                    <option value="urgência / alta hospitalar">Alta hospitalar</option>
                    <option value="cuidados paliativos">Cuidados paliativos</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Estado cognitivo</label>
                  <input value={cognitive} onChange={e => setCognitive(e.target.value)} placeholder="ex: MMS 18/30, demência moderada"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>Quedas recentes</label>
                <input value={recentFalls} onChange={e => setRecentFalls(e.target.value)} placeholder="ex: 2 quedas nos últimos 6 meses"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Lista de medicamentos *</div>
                <button onClick={() => setMedications(SAMPLE_MEDS)}
                  style={{ fontSize: 10, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  Usar exemplo
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 8 }}>Um medicamento por linha. Incluir dose e frequência.</div>
              <textarea value={medications} onChange={e => setMedications(e.target.value)}
                placeholder={`Omeprazol 20mg 1x/dia\nMetformina 500mg 2x/dia\nAtovastatina 20mg 1x/dia\n...`}
                rows={10}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }} />
            </div>

            {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>{error}</div>}

            <button onClick={submit} disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? '#9ca3af' : '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    A analisar polimedicação...
                  </span>
                : 'Iniciar auditoria de polimedicação'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Risk header */}
              <div style={{ background: RISK_CONFIG[result.risk_level].bg, border: `2px solid ${RISK_CONFIG[result.risk_level].border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: RISK_CONFIG[result.risk_level].color, fontFamily: 'var(--font-mono)' }}>{result.risk_score}<span style={{ fontSize: 14 }}>/100</span></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: RISK_CONFIG[result.risk_level].color }}>{RISK_CONFIG[result.risk_level].label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Medicamentos', val: result.total_meds, warn: result.hyperpolypharmacy ? '#dc2626' : result.polypharmacy ? '#d97706' : '#065f46' },
                      { label: 'MPI', val: result.inappropriate_meds.length, warn: result.inappropriate_meds.length > 0 ? '#dc2626' : '#065f46' },
                      { label: 'Interações', val: result.key_interactions.length, warn: result.key_interactions.length > 0 ? '#d97706' : '#065f46' },
                      { label: 'Prioridades', val: result.priority_actions.length, warn: '#0369a1' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '8px 14px', background: 'white', borderRadius: 8, minWidth: 60 }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: s.warn, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {(result.polypharmacy || result.hyperpolypharmacy) && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {result.hyperpolypharmacy && <span style={{ padding: '3px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Hiperpolimedicação (≥10)</span>}
                    {result.polypharmacy && !result.hyperpolypharmacy && <span style={{ padding: '3px 10px', background: '#fff7ed', color: '#c2410c', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Polimedicação (≥5)</span>}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 13, color: RISK_CONFIG[result.risk_level].color, lineHeight: 1.5, borderTop: `1px solid ${RISK_CONFIG[result.risk_level].border}`, paddingTop: 10 }}>{result.summary}</div>
              </div>

              {/* Burden badges */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Carga Anticolinérgica (ACB)', data: result.anticholinergic_burden },
                  { label: 'Carga Sedativa', data: result.sedative_burden },
                ].map(b => {
                  const lvl = b.data.level === 'alto' ? { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' } : b.data.level === 'moderado' ? { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' } : { bg: '#f0fdf4', color: '#065f46', border: '#86efac' }
                  return (
                    <div key={b.label} style={{ background: lvl.bg, border: `1px solid ${lvl.border}`, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: lvl.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{b.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: lvl.color, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{b.data.score}</div>
                      <div style={{ fontSize: 11, color: lvl.color, opacity: 0.8 }}>{b.data.drugs_contributing.slice(0, 3).join(' · ')}{b.data.drugs_contributing.length > 3 ? ` +${b.data.drugs_contributing.length - 3}` : ''}</div>
                    </div>
                  )
                })}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Tab id="priority" label="Ações prioritárias" count={result.priority_actions.length} />
                <Tab id="mpi" label="MPI" count={result.inappropriate_meds.length} />
                <Tab id="interactions" label="Interações" count={result.key_interactions.length} />
                <Tab id="burden" label="Cascatas / Dup." count={result.prescribing_cascades.length + result.duplications.length} />
                <Tab id="cascades" label="Em falta" count={result.missing_treatments.length} />
              </div>

              {/* Tab content */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>

                {activeTab === 'priority' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Ações prioritárias</div>
                    {result.priority_actions.length === 0
                      ? <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: 20 }}>Sem ações prioritárias identificadas</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.priority_actions.sort((a, b) => a.priority - b.priority).map((action, i) => (
                            <div key={i} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{action.priority}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{action.action}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{action.drug}</div>
                                <span style={{ padding: '2px 8px', background: '#f1f5f9', color: TIMELINE_COLOR[action.timeline] || '#475569', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{action.timeline}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                )}

                {activeTab === 'mpi' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Medicamentos Potencialmente Inapropriados</div>
                    {result.inappropriate_meds.length === 0
                      ? <div style={{ fontSize: 13, color: '#065f46', textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 8 }}>Nenhum MPI identificado</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {result.inappropriate_meds.map((mpi, i) => {
                            const sc = SEV_CONFIG[mpi.severity] || SEV_CONFIG.baixo
                            return (
                              <div key={i} style={{ padding: '12px 14px', background: sc.bg, borderRadius: 8, border: `1px solid ${sc.color}33` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{mpi.drug}</div>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <span style={{ padding: '2px 7px', background: sc.bg, color: sc.color, border: `1px solid ${sc.color}66`, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{mpi.severity.toUpperCase()}</span>
                                    <span style={{ padding: '2px 7px', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-4)', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)' }}>{mpi.criterion_code}</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{mpi.criterion}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, lineHeight: 1.5 }}>{mpi.reason}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: sc.color, marginBottom: mpi.alternative ? 4 : 0 }}>→ {mpi.recommendation}</div>
                                {mpi.alternative && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Alternativa: {mpi.alternative}</div>}
                              </div>
                            )
                          })}
                        </div>
                    }
                  </div>
                )}

                {activeTab === 'interactions' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Interações clinicamente significativas</div>
                    {result.key_interactions.length === 0
                      ? <div style={{ fontSize: 13, color: '#065f46', textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 8 }}>Nenhuma interação relevante identificada</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.key_interactions.map((ix, i) => {
                            const sc = SEV_CONFIG[ix.severity] || SEV_CONFIG.baixo
                            return (
                              <div key={i} style={{ padding: '12px 14px', background: sc.bg, borderRadius: 8, border: `1px solid ${sc.color}44` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{ix.drug_a} + {ix.drug_b}</div>
                                  <span style={{ padding: '2px 8px', background: sc.bg, color: sc.color, border: `1px solid ${sc.color}66`, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{ix.severity.toUpperCase()}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, lineHeight: 1.5 }}>{ix.effect}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: sc.color }}>Gestão: {ix.management}</div>
                              </div>
                            )
                          })}
                        </div>
                    }
                  </div>
                )}

                {activeTab === 'burden' && (
                  <div>
                    {result.duplications.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Duplicações terapêuticas</div>
                        {result.duplications.map((dup, i) => (
                          <div key={i} style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fdba74', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>{dup.class}</div>
                            <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{dup.drugs.join(' + ')}</div>
                            <div style={{ fontSize: 11, color: '#c2410c' }}>→ {dup.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.prescribing_cascades.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Cascatas de prescrição</div>
                        {result.prescribing_cascades.map((c, i) => (
                          <div key={i} style={{ padding: '10px 12px', background: '#faf5ff', borderRadius: 8, border: '1px solid #c4b5fd', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#5b21b6', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                              <strong>{c.cause_drug}</strong> → EA: {c.adverse_effect} → <strong>{c.consequence_drug}</strong>
                            </div>
                            <div style={{ fontSize: 11, color: '#6d28d9' }}>→ {c.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.duplications.length === 0 && result.prescribing_cascades.length === 0 && (
                      <div style={{ fontSize: 13, color: '#065f46', textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 8 }}>Sem duplicações ou cascatas identificadas</div>
                    )}
                  </div>
                )}

                {activeTab === 'cascades' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Tratamentos potencialmente em falta</div>
                    {result.missing_treatments.length === 0
                      ? <div style={{ fontSize: 13, color: '#065f46', textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 8 }}>Nenhuma omissão identificada</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.missing_treatments.map((m, i) => (
                            <div key={i} style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 3 }}>{m.condition} — {m.missing_drug_class}</div>
                              <div style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 4, lineHeight: 1.5 }}>{m.rationale}</div>
                              {m.note && <div style={{ fontSize: 11, color: '#0369a1' }}>⚠ {m.note}</div>}
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#854d0e', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                ⚠ Auditoria de suporte à decisão clínica. Qualquer alteração terapêutica deve ser validada pelo médico prescritor. Considerar contexto clínico completo, preferências do doente e prognóstico.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
