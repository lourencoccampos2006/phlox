'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import { suggestDrugs, resolveDrugName } from '@/lib/drugNames'

interface CompareResult {
  drug_a: string
  drug_b: string
  class: string
  comparison: {
    category: string
    drug_a: string
    drug_b: string
    winner?: 'A' | 'B' | 'igual' | 'depende'
    note?: string
  }[]
  when_to_prefer_a: string[]
  when_to_prefer_b: string[]
  clinical_pearl: string
  exam_tip: string
}

const QUICK_PAIRS = [
  { a: 'metoprolol', b: 'bisoprolol', label: 'Metoprolol vs Bisoprolol' },
  { a: 'enalapril', b: 'ramipril', label: 'Enalapril vs Ramipril' },
  { a: 'atorvastatina', b: 'rosuvastatina', label: 'Atorvastatina vs Rosuvastatina' },
  { a: 'omeprazol', b: 'pantoprazol', label: 'Omeprazol vs Pantoprazol' },
  { a: 'sertralina', b: 'escitalopram', label: 'Sertralina vs Escitalopram' },
  { a: 'diazepam', b: 'lorazepam', label: 'Diazepam vs Lorazepam' },
  { a: 'amoxicilina', b: 'amoxicilina+clavulanato', label: 'Amoxicilina vs Augmentin' },
  { a: 'morfina', b: 'tramadol', label: 'Morfina vs Tramadol' },
]

const WINNER_STYLE = {
  A:       { bg: '#eff6ff', color: '#1e40af', label: 'A melhor' },
  B:       { bg: '#f0fdf4', color: '#166534', label: 'B melhor' },
  igual:   { bg: 'var(--bg-3)', color: 'var(--ink-4)', label: 'Equivalente' },
  depende: { bg: '#fffbeb', color: '#92400e', label: 'Depende' },
}

export default function ComparePage() {
  const { supabase } = useAuth()
  const [drugA, setDrugA] = useState('')
  const [drugB, setDrugB] = useState('')
  const [sugA, setSugA] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [sugB, setSugB] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compare = async (a?: string, b?: string) => {
    const da = (a ?? drugA).trim()
    const db = (b ?? drugB).trim()
    if (!da || !db) return
    const resolvedA = resolveDrugName(da)?.dci || da
    const resolvedB = resolveDrugName(db)?.dci || db
    setLoading(true); setError(''); setResult(null); setSugA([]); setSugB([])
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/compare', { method: 'POST', headers, body: JSON.stringify({ drug_a: resolvedA, drug_b: resolvedB }) })
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
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Comparador</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, fontWeight: 400 }}>Comparar Fármacos</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Compara dois fármacos da mesma classe — mecanismo, eficácia, segurança, e quando preferir cada um.</p>
            </div>

            {/* Drug A */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>Fármaco A</label>
              <input value={drugA} onChange={e => { setDrugA(e.target.value); setSugA(e.target.value.length >= 2 ? suggestDrugs(e.target.value) : []) }}
                onKeyDown={e => e.key === 'Enter' && compare()}
                placeholder="Ex: metoprolol, brufen..."
                style={{ width: '100%', border: '1.5px solid #93c5fd', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              {sugA.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', zIndex: 50, overflow: 'hidden' }}>
                  {sugA.map(s => (
                    <button key={s.dci} onClick={() => { setDrugA(s.display); setSugA([]) }}
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

            {/* Drug B */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>Fármaco B</label>
              <input value={drugB} onChange={e => { setDrugB(e.target.value); setSugB(e.target.value.length >= 2 ? suggestDrugs(e.target.value) : []) }}
                onKeyDown={e => e.key === 'Enter' && compare()}
                placeholder="Ex: bisoprolol, naproxeno..."
                style={{ width: '100%', border: '1.5px solid #86efac', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              {sugB.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', zIndex: 50, overflow: 'hidden' }}>
                  {sugB.map(s => (
                    <button key={s.dci} onClick={() => { setDrugB(s.display); setSugB([]) }}
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

            <button onClick={() => compare()} disabled={!drugA.trim() || !drugB.trim() || loading}
              style={{ width: '100%', background: drugA.trim() && drugB.trim() && !loading ? 'var(--ink)' : 'var(--bg-3)', color: drugA.trim() && drugB.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 700, cursor: drugA.trim() && drugB.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {loading ? 'A comparar...' : 'Comparar →'}
            </button>

            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Comparações frequentes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {QUICK_PAIRS.map(pair => (
                  <button key={pair.label} onClick={() => { setDrugA(pair.a); setDrugB(pair.b); compare(pair.a, pair.b) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {pair.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[60, 200, 80, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>A vs B</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Compara dois fármacos linha a linha — mecanismo, eficácia, segurança, farmacocinética, e quando preferir cada um clinicamente.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {/* Header */}
                <div style={{ background: 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>FÁRMACO A</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>{result.drug_a}</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>VS</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>FÁRMACO B</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>{result.drug_b}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-3)', padding: '8px 22px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em' }}>Classe: </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', fontWeight: 600 }}>{result.class}</span>
                </div>

                {/* Comparison table */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', overflow: 'hidden' }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto 1fr', background: 'var(--bg-2)', borderBottom: '2px solid var(--border)' }}>
                    <div style={{ padding: '10px 14px' }} />
                    <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#1e40af', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>{result.drug_a}</div>
                    <div style={{ padding: '10px 4px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textAlign: 'center' }}>VS</div>
                    <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#166534', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', textAlign: 'right' }}>{result.drug_b}</div>
                  </div>

                  {result.comparison.map((row, i) => {
                    const winner = row.winner ? WINNER_STYLE[row.winner] : null
                    return (
                      <div key={row.category} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto 1fr', borderBottom: i < result.comparison.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'start' }}>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', minHeight: 48 }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{row.category}</div>
                          {winner && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: winner.color, background: winner.bg, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase', width: 'fit-content' }}>
                              {winner.label}
                            </span>
                          )}
                        </div>
                        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, borderRight: '1px solid var(--bg-3)' }}>
                          {row.drug_a}
                        </div>
                        <div style={{ padding: '12px 4px' }} />
                        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, textAlign: 'right' }}>
                          {row.drug_b}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* When to prefer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Prefere {result.drug_a} quando</div>
                    {result.when_to_prefer_a.map((w, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#1e3a5f', marginBottom: 4, display: 'flex', gap: 6, lineHeight: 1.5 }}>
                        <span style={{ color: '#3b82f6', flexShrink: 0 }}>→</span>{w}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#166534', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Prefere {result.drug_b} quando</div>
                    {result.when_to_prefer_b.map((w, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#14532d', marginBottom: 4, display: 'flex', gap: 6, lineHeight: 1.5 }}>
                        <span style={{ color: 'var(--green)', flexShrink: 0 }}>→</span>{w}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical pearl + exam tip */}
                <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Pearl clínica</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.clinical_pearl}</p>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '14px 18px', marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Dica de exame</div>
                  <p style={{ fontSize: 14, color: '#78350f', lineHeight: 1.7, margin: 0 }}>{result.exam_tip}</p>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Informação educacional. Decisão clínica sempre com o médico/farmacêutico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}