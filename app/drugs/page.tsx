'use client'

import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

const EXAMPLES = [
  { name: 'ibuprofen', pt: 'Ibuprofeno' }, { name: 'metformin', pt: 'Metformina' },
  { name: 'amoxicillin', pt: 'Amoxicilina' }, { name: 'atorvastatin', pt: 'Atorvastatina' },
  { name: 'omeprazole', pt: 'Omeprazol' }, { name: 'lisinopril', pt: 'Lisinopril' },
  { name: 'warfarin', pt: 'Varfarina' }, { name: 'sertraline', pt: 'Sertralina' },
]

const SECTIONS = [
  { key: 'indications', label: 'Indicações Terapêuticas' },
  { key: 'dosage', label: 'Posologia e Administração' },
  { key: 'contraindications', label: 'Contraindicações' },
  { key: 'warnings', label: 'Advertências e Precauções' },
  { key: 'adverse_reactions', label: 'Reações Adversas' },
]

function truncate(text: string, len: number) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len).trim() + '…' : text
}

function DrugSkeleton() {
  return (
    <div className="drug-layout fade-in" style={{ alignItems: 'start' }}>
      {/* Main column */}
      <div>
        {/* Drug header skeleton */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-3)', padding: '20px 24px' }}>
            <div className="skeleton" style={{ height: 10, width: 200, marginBottom: 12, background: 'rgba(0,0,0,0.08)' }} />
            <div className="skeleton" style={{ height: 28, width: 180, background: 'rgba(0,0,0,0.1)' }} />
          </div>
          <div className="drug-meta">
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: '12px 16px', borderRight: i < 2 ? '1px solid var(--border)' : 'none', borderTop: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 9, width: 60, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: 90 }} />
              </div>
            ))}
          </div>
        </div>
        {/* Sections skeleton */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => (
            <div key={s.key} style={{ padding: '16px 20px', borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="skeleton" style={{ height: 9, width: 140, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 13, width: '88%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 13, width: '72%' }} />
            </div>
          ))}
        </div>
      </div>
      {/* Sidebar skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
          <div className="skeleton" style={{ height: 9, width: 100, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 36, width: '100%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 11, width: '80%', margin: '0 auto' }} />
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
          <div className="skeleton" style={{ height: 9, width: 160, marginBottom: 14 }} />
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--bg-3)' : 'none' }}>
              <div className="skeleton" style={{ height: 11, width: 110 }} />
              <div className="skeleton" style={{ height: 11, width: 30 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DrugsPage() {
  const { user, supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const saveToHistory = async (term: string) => {
    if (!user) return
    try {
      await supabase.from('search_history').insert({
        user_id: user.id,
        type: 'drug',
        query: term,
        result_severity: null,
        result_source: 'openfda',
      })
    } catch (e) {
      console.error('History save error:', e)
    }
  }

  const handleInput = (val: string) => {
    setQuery(val)
    setSuggestions(val.length >= 2 ? suggestDrugs(val) : [])
  }

  const handleSearch = (term: string) => {
    const resolved = resolveDrugName(term)
    const finalTerm = resolved ? resolved.dci : term
    setSuggestions([])
    search(finalTerm)
  }

  const search = async (q?: string) => {
    const term = (q || query).trim()
    if (!term) return
    setLoading(true); setError(''); setResult(null); setExpanded(new Set())
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      saveToHistory(term)
    } catch {
      setError('Medicamento não encontrado. Tenta o nome em inglês (DCI).')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Search header */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '24px 20px', marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 02</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>Base de Dados de Fármacos</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5, margin: 0 }}>Dados clínicos da FDA. Pesquisa pelo nome da caixa ou pelo nome científico.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              type="text"
              value={query}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              placeholder="Ex: brufen, voltaren, metformina, ibuprofeno..."
              style={{ flex: 1, border: '1px solid var(--border-2)', borderRadius: 4, padding: '10px 14px', fontSize: 15, color: 'var(--ink)', fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }}
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={!query.trim() || loading}
              style={{ background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {loading ? 'A pesquisar...' : 'Pesquisar'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              {suggestions.map(s => (
                <button key={s.dci} onClick={() => { setQuery(s.display); setSuggestions([]); handleSearch(s.dci) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'white', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{s.display}</span>
                  {s.isBrand && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>→ {s.dci}</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', marginRight: 4 }}>EXEMPLOS:</span>
            {EXAMPLES.map(({ name, pt }) => (
              <button key={name} onClick={() => { setQuery(name); search(name) }}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {name}<span style={{ color: 'var(--ink-4)', fontSize: 10 }}>({pt})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Skeleton */}
        {loading && <DrugSkeleton />}

        {/* Error */}
        {error && (
          <div style={{ background: 'white', border: '1px solid #feb2b2', borderLeft: '4px solid #c53030', borderRadius: 4, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c53030', letterSpacing: '0.1em', marginBottom: 4 }}>ERRO</div>
            <p style={{ fontSize: 14, color: '#742a2a', margin: '0 0 10px' }}>{error}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--font-mono)' }}>
              Tenta o nome em inglês: ibuprofen, metformin, amoxicillin, warfarin...
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="drug-layout fade-in" style={{ alignItems: 'start' }}>
            <div>
              {/* Drug header */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: 'var(--green)', padding: '20px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 6 }}>DENOMINAÇÃO COMUM INTERNACIONAL</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'white', fontWeight: 700, textTransform: 'capitalize', letterSpacing: '-0.01em', margin: 0 }}>{result.generic_name}</h2>
                  {result.brand_names?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>NOMES COMERCIAIS:</span>
                      {result.brand_names.slice(0, 5).map((b: string) => (
                        <span key={b} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="drug-meta">
                  {[
                    { label: 'Fabricante', value: result.manufacturer || '—' },
                    { label: 'Fonte', value: 'OpenFDA (FDA / EUA)' },
                    { label: 'Actualizado', value: new Date().toLocaleDateString('pt-PT') },
                  ].map(({ label, value }, i) => (
                    <div key={label} style={{ padding: '12px 16px', borderRight: i < 2 ? '1px solid var(--border)' : 'none', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sections accordion */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {SECTIONS.map(({ key, label }, i) => {
                  const value = result[key]
                  if (!value) return null
                  const isOpen = expanded.has(key)
                  return (
                    <div key={key} style={{ borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <button onClick={() => toggle(key)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                          {!isOpen && <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncate(value, 120)}</div>}
                        </div>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: isOpen ? 'var(--green)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOpen ? 'white' : 'var(--ink-4)', fontSize: 14, flexShrink: 0, fontWeight: 700 }}>
                          {isOpen ? '−' : '+'}
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--bg-3)' }}>
                          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: '16px 0 0' }}>{value}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Acções Rápidas</div>
                <Link href="/interactions" style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>Verificar Interações →</Link>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Verifica se este medicamento interage com outros que tomas</p>
              </div>

              {result.top_adverse_events?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Efeitos Adversos Reportados</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginBottom: 12, lineHeight: 1.5 }}>Dados FDA. Por frequência de reporte.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.top_adverse_events.slice(0, 10).map((e: any, i: number) => (
                      <div key={e.term} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 9 ? '1px solid var(--bg-3)' : 'none' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{e.term?.toLowerCase()}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-3)', borderRadius: 3, padding: '2px 6px' }}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>AVISO LEGAL</div>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>Informação educacional baseada em dados OpenFDA. Não substitui aconselhamento profissional.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}