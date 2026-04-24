'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface DrugForDisease {
  disease: string
  icd_category: string
  first_line: {
    drug: string
    class: string
    rationale: string
    dose_adult: string
    key_monitoring: string[]
    contraindications: string[]
  }[]
  second_line: {
    drug: string
    when: string
    why_not_first: string
  }[]
  avoid: {
    drug: string
    reason: string
  }[]
  guideline_source: string
  study_mnemonic?: string
  exam_pearls: string[]
}

const DISEASE_EXAMPLES = [
  'Hipertensão arterial', 'Insuficiência cardíaca com FE reduzida',
  'Diabetes mellitus tipo 2', 'Fibrilhação auricular',
  'Depressão major', 'Ansiedade generalizada',
  'Epilepsia focal', 'Doença de Parkinson',
  'Asma persistente moderada', 'DPOC',
  'Artrite reumatoide', 'Gota aguda',
  'Úlcera péptica por H. pylori', 'Doença de Crohn',
  'Pneumonia adquirida na comunidade', 'ITU não complicada',
  'Dislipidemia', 'Hipotiroidismo',
  'Osteoporose', 'Dor neuropática',
]

export default function DiseaseToolPage() {
  const { supabase } = useAuth()
  const [disease, setDisease] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<DrugForDisease | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (d?: string) => {
    const q = (d ?? disease).trim()
    if (!q) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/disease', { method: 'POST', headers, body: JSON.stringify({ disease: q, context: context.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Farmacologia por patologia</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, fontWeight: 400 }}>Fármacos por Doença</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Pesquisa por diagnóstico. Recebe 1ª e 2ª linha com racional, doses e dicas de exame.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Patologia / Diagnóstico</label>
              <input value={disease} onChange={e => setDisease(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Ex: insuficiência cardíaca, epilepsia..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Contexto específico (opcional)</label>
              <input value={context} onChange={e => setContext(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Ex: doente com DRC, grávida, idoso >75 anos..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <button onClick={() => search()} disabled={!disease.trim() || loading}
              style={{ width: '100%', background: disease.trim() && !loading ? 'var(--ink)' : 'var(--bg-3)', color: disease.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 700, cursor: disease.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {loading ? 'A pesquisar...' : 'Ver tratamento →'}
            </button>

            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Patologias frequentes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {DISEASE_EXAMPLES.map(d => (
                  <button key={d} onClick={() => { setDisease(d); search(d) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 120, 80, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>Patologia → Fármacos</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
                  Pesquisa por diagnóstico e recebe o tratamento farmacológico completo — 1ª linha com racional, 2ª linha com indicações, fármacos a evitar e dicas de exame.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {/* Header */}
                <div style={{ background: 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4, textTransform: 'uppercase' }}>
                    {result.icd_category}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontStyle: 'italic', fontWeight: 400, marginBottom: 4 }}>{result.disease}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>{result.guideline_source}</div>
                </div>

                {/* First line */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                    1ª Linha
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.first_line.map((drug, i) => (
                      <div key={drug.drug} style={{ border: `1px solid ${i === 0 ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, padding: '14px 16px', background: i === 0 ? 'var(--green-light)' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{drug.drug}</div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{drug.class}</div>
                          </div>
                          {i === 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', border: '1px solid var(--green)', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>PREFERIDO</span>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Dose adulto</span>
                            {drug.dose_adult}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Racional</span>
                            {drug.rationale}
                          </div>
                        </div>
                        {drug.key_monitoring.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monitorizar: </span>
                            {drug.key_monitoring.join(' · ')}
                          </div>
                        )}
                        {drug.contraindications.length > 0 && (
                          <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--red-light)', borderRadius: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Contraindicado em: </span>
                            <span style={{ fontSize: 11, color: '#7f1d1d' }}>{drug.contraindications.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Second line */}
                {result.second_line.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                      2ª Linha / Alternativas
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.second_line.map(drug => (
                        <div key={drug.drug} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-3)', alignItems: 'start' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{drug.drug}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>QUANDO</span>
                            {drug.when}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', display: 'block', marginBottom: 2 }}>PORQUÊ NÃO 1ª</span>
                            {drug.why_not_first}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avoid */}
                {result.avoid.length > 0 && (
                  <div style={{ border: '1px solid #fecaca', borderTop: 'none', background: 'var(--red-light)', padding: '16px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Fármacos a Evitar nesta Patologia
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.avoid.map(({ drug, reason }) => (
                        <div key={drug} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d', minWidth: 120 }}>{drug}</span>
                          <span style={{ fontSize: 13, color: '#742a2a', lineHeight: 1.5 }}>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exam pearls */}
                {result.exam_pearls.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Dicas de Exame
                    </div>
                    {result.exam_pearls.map((p, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#78350f', marginBottom: 6, display: 'flex', gap: 8, lineHeight: 1.6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>{p}
                      </div>
                    ))}
                  </div>
                )}

                {result.study_mnemonic && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginTop: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Mnemónica</div>
                    <div style={{ fontSize: 14, color: '#1e3a5f', fontWeight: 600 }}>{result.study_mnemonic}</div>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Baseado em guidelines internacionais. Confirma com as guidelines DGS actuais.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}