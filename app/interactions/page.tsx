'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

const SEVERITY: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  GRAVE:         { label: 'GRAVE',                  color: '#7f1d1d', bg: '#fff5f5', border: '#feb2b2', barColor: '#c53030' },
  MODERADA:      { label: 'MODERADA',               color: '#7c2d12', bg: '#fffaf0', border: '#fbd38d', barColor: '#dd6b20' },
  LIGEIRA:       { label: 'LIGEIRA',                color: '#5f370e', bg: '#fffff0', border: '#faf089', barColor: '#d69e2e' },
  SEM_INTERACAO: { label: 'SEM INTERAÇÃO CONHECIDA', color: '#1a4731', bg: '#f0fff4', border: '#9ae6b4', barColor: '#276749' },
}

const EXAMPLES = [
  { drugs: ['ibuprofeno', 'varfarina'],        note: 'Hemorragia' },
  { drugs: ['metformina', 'álcool'],           note: 'Acidose' },
  { drugs: ['hipericão', 'sertralina'],        note: 'Serotonina' },
  { drugs: ['aspirina', 'heparina'],           note: 'Anticoag.' },
  { drugs: ['atorvastatina', 'claritromicina'], note: 'Miotoxicidade' },
  { drugs: ['digoxina', 'amiodarona'],         note: 'Toxicidade' },
]

export default function InteractionsPage() {
  const { user, supabase } = useAuth()
  const [input, setInput] = useState('')
  const [drugs, setDrugs] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addDrug = () => {
    const t = input.trim()
    if (t && !drugs.map(d => d.toLowerCase()).includes(t.toLowerCase()) && drugs.length < 10) {
      setDrugs(prev => [...prev, t])
      setInput('')
      setResult(null)
    }
  }

  const removeDrug = (d: string) => {
    setDrugs(prev => prev.filter(x => x !== d))
    setResult(null)
  }

  const saveHistory = async (data: any, drugList: string[]) => {
    if (!user) return
    try {
      await supabase.from('search_history').insert({
        user_id: user.id,
        type: 'interaction',
        query: drugList.join(' + '),
        result_severity: data.severity || null,
        result_source: data.source || null,
      })
    } catch { }
  }

  const check = async () => {
    if (drugs.length < 2) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      saveHistory(data, drugs)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const sev = result ? (SEVERITY[result.severity] ?? SEVERITY['SEM_INTERACAO']) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT PANEL */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 01</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Verificador de Interações</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Medicamentos, suplementos e plantas. Dados RxNorm/NIH.</p>
            </div>

            {/* Input */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>
                Adicionar substância
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: drugs.length > 0 ? 12 : 0 }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDrug()}
                  placeholder="Ex: ibuprofeno, varfarina..."
                  style={{ flex: 1, border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }}
                />
                <button onClick={addDrug} disabled={!input.trim()}
                  style={{ background: input.trim() ? 'var(--green)' : 'var(--bg-3)', color: input.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '9px 14px', fontSize: 18, cursor: input.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                  +
                </button>
              </div>

              {drugs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {drugs.map((d, i) => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                      </div>
                      <button onClick={() => removeDrug(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={check} disabled={drugs.length < 2 || loading}
              style={{ width: '100%', background: drugs.length >= 2 && !loading ? 'var(--green)' : 'var(--bg-3)', color: drugs.length >= 2 && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: drugs.length >= 2 && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A consultar...' : drugs.length < 2 ? 'Adiciona 2+ substâncias' : `Analisar ${drugs.length} substâncias`}
            </button>

            {/* Examples */}
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {EXAMPLES.map(({ drugs: ex, note }) => (
                  <button key={ex.join('+')} onClick={() => { setDrugs(ex); setResult(null) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '7px 10px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.join(' + ')}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{note}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div>
            {loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--green)', padding: '14px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}>A CONSULTAR BASES DE DADOS</div>
                </div>
                <div style={{ padding: '20px' }}>
                  {['RxNorm / NIH', 'OpenFDA', 'IA clínica (fallback)'].map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--border-2)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: i === 0 ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-3)', marginBottom: 10 }}>Aguarda análise</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                  Adiciona as substâncias e clica em Analisar.
                </p>
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c53030', letterSpacing: '0.1em', marginBottom: 4 }}>ERRO</div>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && sev && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Severity bar */}
                <div style={{ background: sev.barColor, padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.15em', marginBottom: 4 }}>GRAVIDADE DA INTERAÇÃO</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontWeight: 700 }}>{sev.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
                      {result.source === 'rxnorm' ? 'RXNORM / NIH' : 'ANÁLISE IA'}
                      {result.cached && ' · CACHE'}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Summary */}
                  <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.barColor}`, borderRadius: 4, padding: '14px 16px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: sev.color, lineHeight: 1.7, fontWeight: 500, margin: 0 }}>{result.summary}</p>
                  </div>

                  {/* Clinical details */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                    {[
                      { label: 'Mecanismo', value: result.mechanism },
                      { label: 'Consequências', value: result.consequences },
                      { label: 'Recomendação', value: result.recommendation },
                      result.onset ? { label: 'Início', value: result.onset } : null,
                    ].filter(Boolean).map(({ label, value }: any, i, arr) => (
                      <div key={label} className="info-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.monitor?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Parâmetros a monitorizar</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.monitor.map((m: string) => (
                          <span key={m} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-2)', borderRadius: 3, padding: '3px 8px', color: 'var(--ink-2)', background: 'var(--bg-2)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    Informação educacional — não substitui aconselhamento profissional
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}