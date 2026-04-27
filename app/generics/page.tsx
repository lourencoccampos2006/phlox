'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'

interface GenericResult {
  brand_name: string
  generic_name: string
  active_ingredient: string
  has_generic: boolean
  generics_available: {
    name: string
    manufacturer: string
    price_range: string
    bioequivalent: boolean
  }[]
  savings_estimate: string
  snf_info: string
  clinical_equivalence: string
  when_to_ask_doctor: string[]
  important_notes: string[]
}

const EXAMPLES = [
  'Xarelto', 'Lipitor', 'Nexium', 'Plavix', 'Seretide',
  'Januvia', 'Lyrica', 'Zoloft', 'Risperdal', 'Synthroid',
]

export default function GenericsPage() {
  const { supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [result, setResult] = useState<GenericResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInput = (val: string) => {
    setQuery(val)
    setSuggestions(val.length >= 2 ? suggestDrugs(val) : [])
  }

  const search = async (term?: string) => {
    const q = (term ?? query).trim()
    if (!q) return
    const resolved = resolveDrugName(q)
    setSuggestions([])
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/generics', {
        method: 'POST', headers,
        body: JSON.stringify({ brand_name: q, dci: resolved?.dci || q })
      })
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
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Poupança</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 6 }}>Verificador de Genéricos</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>O teu medicamento tem genérico mais barato? Quanto podes poupar?</p>
            </div>

            {/* Search */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Nome do medicamento
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={query} onChange={e => handleInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Ex: Xarelto, Lipitor, Nexium..."
                  style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={() => search()}
                  disabled={!query.trim() || loading}
                  style={{ background: query.trim() && !loading ? 'var(--ink)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {loading ? '...' : 'Ver'}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', zIndex: 50, overflow: 'hidden' }}>
                  {suggestions.map(s => (
                    <button key={s.dci} onClick={() => { setQuery(s.display); search(s.display) }}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{s.display}</span>
                      {s.isBrand && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>→ {s.dci}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Examples */}
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Medicamentos frequentes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setQuery(ex); search(ex) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* SNS info */}
            <div style={{ marginTop: 20, padding: '14px', background: 'var(--blue-light)', border: '1px solid #bfdbfe', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--blue)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>SNS Portugal</div>
              <div style={{ fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
                No SNS, o farmacêutico é obrigado a oferecer o genérico mais barato. Podes recusar e ficar com a marca — mas pagas a diferença.
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[60, 100, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>Há alternativa mais barata?</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Pesquisa qualquer medicamento de marca. Dizemos se tem genérico disponível em Portugal, quanto podes poupar, e se são clinicamente equivalentes.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {/* Header */}
                <div style={{ background: result.has_generic ? 'var(--green)' : 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {result.active_ingredient}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontStyle: 'italic', fontWeight: 400, marginBottom: 6 }}>
                    {result.brand_name}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    {result.has_generic ? `✓ Tem genérico disponível em Portugal` : '✗ Sem genérico disponível actualmente'}
                  </div>
                </div>

                {/* Savings */}
                {result.has_generic && result.savings_estimate && (
                  <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderTop: 'none', padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--green-2)', fontWeight: 600 }}>Poupança estimada</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--green)', fontStyle: 'italic', fontWeight: 400 }}>{result.savings_estimate}</div>
                  </div>
                )}

                {/* Generics list */}
                {result.generics_available.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                      Genéricos disponíveis
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.generics_available.map((g, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{g.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{g.manufacturer}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            {g.bioequivalent && (
                              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', border: '1px solid var(--green-mid)', background: 'var(--green-light)', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                Bioequivalente
                              </span>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{g.price_range}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical equivalence */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Equivalência clínica
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.clinical_equivalence}</p>
                </div>

                {/* SNF info */}
                {result.snf_info && (
                  <div style={{ border: '1px solid #bfdbfe', borderTop: 'none', background: 'var(--blue-light)', padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--blue)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                      No SNS português
                    </div>
                    <p style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.6, margin: 0 }}>{result.snf_info}</p>
                  </div>
                )}

                {/* When to ask doctor + notes */}
                {(result.when_to_ask_doctor.length > 0 || result.important_notes.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {result.when_to_ask_doctor.length > 0 && (
                      <div style={{ padding: '14px 18px', background: 'var(--amber-light)', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                          Pergunta ao médico
                        </div>
                        {result.when_to_ask_doctor.map((q, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#78350f', marginBottom: 4, lineHeight: 1.5 }}>· {q}</div>
                        ))}
                      </div>
                    )}
                    {result.important_notes.length > 0 && (
                      <div style={{ padding: '14px 18px', background: 'white' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                          Importante saber
                        </div>
                        {result.important_notes.map((n, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.5 }}>· {n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Confirma sempre com o farmacêutico antes de mudar para um genérico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}