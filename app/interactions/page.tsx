'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

const SEVERITY: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  GRAVE: { label: 'GRAVE', color: '#7f1d1d', bg: '#fff5f5', border: '#feb2b2', barColor: '#c53030' },
  MODERADA: { label: 'MODERADA', color: '#7c2d12', bg: '#fffaf0', border: '#fbd38d', barColor: '#dd6b20' },
  LIGEIRA: { label: 'LIGEIRA', color: '#5f370e', bg: '#fffff0', border: '#faf089', barColor: '#d69e2e' },
  SEM_INTERACAO: { label: 'SEM INTERAÇÃO CONHECIDA', color: '#1a4731', bg: '#f0fff4', border: '#9ae6b4', barColor: '#276749' },
}

const EXAMPLES = [
  { drugs: ['ibuprofeno', 'varfarina'], note: 'Risco de hemorragia' },
  { drugs: ['metformina', 'álcool'], note: 'Risco de acidose' },
  { drugs: ['hipericão', 'sertralina'], note: 'Síndrome serotoninérgica' },
  { drugs: ['aspirina', 'heparina'], note: 'Anticoagulação excessiva' },
  { drugs: ['atorvastatina', 'claritromicina'], note: 'Toxicidade muscular' },
  { drugs: ['digoxina', 'amiodarona'], note: 'Toxicidade digitálica' },
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
    if (t && !drugs.map(d => d.toLowerCase()).includes(t.toLowerCase())) {
      setDrugs(prev => [...prev, t])
      setInput('')
      setResult(null)
    }
  }

  const removeDrug = (d: string) => { setDrugs(prev => prev.filter(x => x !== d)); setResult(null) }

  const saveToHistory = async (data: any, drugList: string[]) => {
    if (!user) return
    try {
      await supabase.from('search_history').insert({
        user_id: user.id,
        type: 'interaction',
        query: drugList.join(' + '),
        result_severity: data.severity || null,
        result_source: data.source || null,
      })
    } catch (e) {
      console.error('History save error:', e)
    }
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
      saveToHistory(data, drugs)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const sev = result ? (SEVERITY[result.severity] ?? SEVERITY['SEM_INTERACAO']) : null

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 40, alignItems: 'start' }}>

          {/* LEFT */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Ferramenta 01</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Verificador de Interações</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6 }}>Medicamentos, suplementos e plantas medicinais. Dados RxNorm / NIH.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: 20, marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Adicionar substância</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: drugs.length > 0 ? 16 : 0 }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDrug()} placeholder="Nome do medicamento..."
                  style={{ flex: 1, border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={addDrug} disabled={!input.trim()}
                  style={{ background: input.trim() ? 'var(--green)' : 'var(--bg-3)', color: input.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>+</button>
              </div>
              {drugs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drugs.map((d, i) => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 4, padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', minWidth: 14 }}>{i + 1}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{d}</span>
                      </div>
                      <button onClick={() => removeDrug(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={check} disabled={drugs.length < 2 || loading}
              style={{ width: '100%', background: drugs.length >= 2 && !loading ? 'var(--green)' : 'var(--bg-3)', color: drugs.length >= 2 && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: drugs.length >= 2 && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 24 }}>
              {loading ? 'A consultar...' : drugs.length < 2 ? 'Adiciona 2 ou mais substâncias' : `Analisar ${drugs.length} substâncias`}
            </button>

            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Exemplos clínicos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EXAMPLES.map(({ drugs: ex, note }) => (
                  <button key={ex.join('+')} onClick={() => { setDrugs(ex); setResult(null) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{ex.join(' + ')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{note}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--green)', padding: '14px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.15em' }}>A CONSULTAR BASES DE DADOS</div>
                </div>
                <div style={{ padding: '24px' }}>
                  {['RxNorm / NIH — base de dados oficial', 'OpenFDA — farmacovigilância', 'IA clínica — análise complementar'].map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--border-2)' }} />
                      <span style={{ fontSize: 13, color: i === 0 ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-3)', marginBottom: 12 }}>Aguarda análise</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>Adiciona as substâncias no painel esquerdo e clica em Analisar.</p>
              </div>
            )}

            {error && (
              <div style={{ background: 'white', border: '1px solid #feb2b2', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: '#c53030', padding: '14px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'white', letterSpacing: '0.15em' }}>ERRO</div>
                </div>
                <div style={{ padding: '20px 24px', fontSize: 14, color: '#742a2a' }}>{error}</div>
              </div>
            )}

            {result && sev && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: sev.barColor, padding: '16px 28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.2em', marginBottom: 4 }}>GRAVIDADE DA INTERAÇÃO</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', fontWeight: 700 }}>{sev.label}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}>
                        {result.source === 'rxnorm' ? 'FONTE: RXNORM / NIH' : 'FONTE: ANÁLISE IA'}
                        {result.cached && ' · CACHE'}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '28px' }}>
                  <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.barColor}`, borderRadius: 4, padding: '16px 20px', marginBottom: 28 }}>
                    <p style={{ fontSize: 15, color: sev.color, lineHeight: 1.7, fontWeight: 500, margin: 0 }}>{result.summary}</p>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
                    {[
                      { label: 'Mecanismo Farmacológico', value: result.mechanism },
                      { label: 'Consequências Clínicas', value: result.consequences },
                      { label: 'Recomendação', value: result.recommendation },
                      result.onset && { label: 'Início da Interação', value: result.onset },
                    ].filter(Boolean).map(({ label, value }: any, i, arr) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                        </div>
                        <div style={{ padding: '14px 18px' }}>
                          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0 }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {result.monitor?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Parâmetros a Monitorizar</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.monitor.map((m: string) => (
                          <span key={m} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-2)', borderRadius: 3, padding: '4px 10px', color: 'var(--ink-2)', background: 'var(--bg-2)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    Informação educacional — não substitui aconselhamento médico ou farmacêutico
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