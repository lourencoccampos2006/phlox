'use client'

import { useState } from 'react'
import Header from '@/components/Header'

const EXAMPLES = [
  { drugs: ['furosemida', 'morfina'], solution: 'NaCl 0.9%' },
  { drugs: ['vancomicina', 'heparina'], solution: 'G5%' },
  { drugs: ['midazolam', 'fentanil'], solution: 'NaCl 0.9%' },
  { drugs: ['amiodarona', 'dopamina'], solution: 'G5%' },
  { drugs: ['meropenem', 'metronidazol'], solution: 'NaCl 0.9%' },
]

const SOLUTIONS = ['NaCl 0.9%', 'G5%', 'G10%', 'Lactato de Ringer', 'Água para injectáveis']

const COMPAT_COLORS: Record<string, { bg: string; border: string; color: string; barColor: string }> = {
  COMPATIVEL:    { bg: '#f0fff4', border: '#9ae6b4', color: '#1a4731', barColor: '#276749' },
  INCOMPATIVEL:  { bg: '#fff5f5', border: '#feb2b2', color: '#7f1d1d', barColor: '#c53030' },
  CONDICIONAL:   { bg: '#fffaf0', border: '#fbd38d', color: '#7c2d12', barColor: '#dd6b20' },
  DESCONHECIDO:  { bg: '#f7f7f7', border: 'var(--border-2)', color: 'var(--ink-3)', barColor: 'var(--ink-4)' },
}

export default function CompatibilityPage() {
  const [drug1, setDrug1] = useState('')
  const [drug2, setDrug2] = useState('')
  const [solution, setSolution] = useState('NaCl 0.9%')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const check = async (d1?: string, d2?: string, sol?: string) => {
    const a = (d1 ?? drug1).trim()
    const b = (d2 ?? drug2).trim()
    const s = sol ?? solution
    if (!a || !b) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug1: a, drug2: b, solution: s }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao verificar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (ex: typeof EXAMPLES[0]) => {
    setDrug1(ex.drugs[0])
    setDrug2(ex.drugs[1])
    setSolution(ex.solution)
    setResult(null)
    check(ex.drugs[0], ex.drugs[1], ex.solution)
  }

  const compat = result ? (COMPAT_COLORS[result.status] ?? COMPAT_COLORS['DESCONHECIDO']) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 06</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Compatibilidade IV</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Verifica compatibilidade de fármacos em linha IV, Y-site ou mistura em soro.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
              {[
                { label: 'Fármaco A', value: drug1, set: setDrug1, placeholder: 'Ex: furosemida' },
                { label: 'Fármaco B', value: drug2, set: setDrug2, placeholder: 'Ex: morfina' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
                  <input type="text" value={value} onChange={e => { set(e.target.value); setResult(null) }}
                    onKeyDown={e => e.key === 'Enter' && check()}
                    placeholder={placeholder}
                    style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Solução / Veículo</label>
                <select value={solution} onChange={e => setSolution(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
                  {SOLUTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <button onClick={() => check()} disabled={!drug1.trim() || !drug2.trim() || loading}
              style={{ width: '100%', background: drug1.trim() && drug2.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: drug1.trim() && drug2.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: drug1.trim() && drug2.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A verificar...' : 'Verificar Compatibilidade'}
            </button>

            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => loadExample(ex)}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{ex.drugs.join(' + ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>em {ex.solution}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }} className="fade-in">
                <div style={{ background: 'var(--bg-3)', padding: '16px 20px' }}>
                  <div className="skeleton" style={{ height: 10, width: 140, marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 22, width: 200 }} />
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 14, width: i === 0 ? '90%' : '70%' }} />)}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🧪</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Verificação de compatibilidade IV</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                  Introduz dois fármacos e a solução para verificar compatibilidade em Y-site ou mistura.
                </p>
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '20px 24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c53030', letterSpacing: '0.1em', marginBottom: 6 }}>ERRO</div>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && compat && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Status bar */}
                <div style={{ background: compat.barColor, padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.15em', marginBottom: 4 }}>COMPATIBILIDADE IV</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', fontWeight: 700 }}>
                    {result.status === 'COMPATIVEL' ? '✓ Compatível' : result.status === 'INCOMPATIVEL' ? '✗ Incompatível' : result.status === 'CONDICIONAL' ? '⚠ Compatível com condições' : '? Dados insuficientes'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
                    {drug1} + {drug2} · {solution}
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Summary */}
                  <div style={{ background: compat.bg, border: `1px solid ${compat.border}`, borderLeft: `4px solid ${compat.barColor}`, borderRadius: 4, padding: '14px 16px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: compat.color, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{result.summary}</p>
                  </div>

                  {/* Details */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                    {[
                      result.mechanism ? { label: 'Mecanismo', value: result.mechanism } : null,
                      result.conditions ? { label: 'Condições', value: result.conditions } : null,
                      result.concentration_limits ? { label: 'Concentrações', value: result.concentration_limits } : null,
                      result.time_limit ? { label: 'Estabilidade', value: result.time_limit } : null,
                      result.alternative ? { label: 'Alternativa', value: result.alternative } : null,
                    ].filter(Boolean).map(({ label, value }: any, i, arr) => (
                      <div key={label} className="info-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '11px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                        </div>
                        <div style={{ padding: '11px 16px' }}>
                          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Source */}
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    Fonte: {result.source || 'Análise IA baseada em Trissel\'s, King Guide e literatura publicada'} · Confirma sempre com farmacêutico hospitalar
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