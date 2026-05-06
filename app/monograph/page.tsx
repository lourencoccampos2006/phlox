'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'

const EXAMPLES = [
  'Dapagliflozina', 'Semaglutido', 'Sacubitril/Valsartan',
  'Colquicina', 'Apixabano', 'Dupilumab',
  'Buprenorfina sublingual', 'Clozapina',
]

const SECTION_ICONS: Record<string, string> = {
  'Mecanismo de Acção': '⚙',
  'Indicações': '✓',
  'Posologia': '💊',
  'Farmacocinética': '📊',
  'Efeitos Adversos': '⚠',
  'Contraindicações': '✗',
  'Interações Relevantes': '⚡',
  'Monitorização': '👁',
  'Gravidez e Aleitamento': '🤱',
  'Observações Clínicas': '📝',
}

function MonographSkeleton() {
  return (
    <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-3)', padding: '24px 24px' }}>
        <div className="skeleton" style={{ height: 10, width: 150, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 30, width: 220, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: 140 }} />
      </div>
      <div style={{ padding: '0' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 11, width: 160, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 13, width: '88%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '72%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '80%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MonographPage() {
  const { user, supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  const generate = async (q?: string) => {
    const term = (q || query).trim()
    if (!term) return
    setLoading(true); setError(''); setResult(null)
    setOpenSections(new Set())
    try {
      const res = await fetch('/api/monograph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug: term }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      // Abre as primeiras 3 secções por defeito
      if (data.sections?.length) {
        setOpenSections(new Set(data.sections.slice(0, 3).map((s: any) => s.title)))
      }
      if (user) {
        supabase.from('search_history').insert({
          user_id: user.id, type: 'drug', query: term, result_severity: null, result_source: 'ai-monograph',
        }).then(() => {})
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(title) ? next.delete(title) : next.add(title)
      return next
    })
  }

  const expandAll = () => result?.sections && setOpenSections(new Set(result.sections.map((s: any) => s.title)))
  const collapseAll = () => setOpenSections(new Set())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="two-col" style={{ alignItems: 'start' }}>

          {/* LEFT */}
          <div className="sticky-panel">
            {user && (
              <div style={{ marginBottom: 10 }}>
                <ProfileSelector onChange={() => {}} />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 07</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Monografia Clínica</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Monografia farmacológica completa em PT-PT. Ideal para fármacos não disponíveis na FDA ou recentemente aprovados.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nome do fármaco</label>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="Ex: dapagliflozina, semaglutido..."
                style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
            </div>

            <button onClick={() => generate()} disabled={!query.trim() || loading}
              style={{ width: '100%', background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A gerar monografia...' : 'Gerar Monografia'}
            </button>

            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setQuery(ex); generate(ex) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Nota sobre a ferramenta */}
            <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>DIFERENÇA DO /DRUGS</div>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
                A base de dados FDA não cobre fármacos europeus, biológicos recentes ou genéricos PT. Esta ferramenta usa IA para gerar monografias completas.
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && <MonographSkeleton />}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>📋</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Monografia farmacológica IA</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                  Introduce o nome de qualquer fármaco — incluindo os que não estão na FDA — para obter uma monografia clínica completa em português.
                </p>
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '20px 24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c53030', letterSpacing: '0.1em', marginBottom: 6 }}>ERRO</div>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && (
              <div className="fade-in">
                {/* Drug header */}
                <div style={{ background: 'var(--green)', borderRadius: '6px 6px 0 0', padding: '24px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>MONOGRAFIA CLÍNICA</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'white', margin: '0 0 8px', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>{result.name}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {result.class && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>{result.class}</span>}
                    {result.atc && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '1px 6px' }}>ATC: {result.atc}</span>}
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderTop: 'none' }}>
                  <button onClick={expandAll} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Expandir tudo</button>
                  <button onClick={collapseAll} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Colapsar tudo</button>
                </div>

                {/* Sections */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 12 }}>
                  {result.sections?.map((section: any, i: number) => {
                    const isOpen = openSections.has(section.title)
                    const icon = SECTION_ICONS[section.title] || '·'
                    return (
                      <div key={section.title} style={{ borderBottom: i < result.sections.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <button onClick={() => toggle(section.title)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: isOpen ? 'var(--green-light)' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isOpen ? 'var(--green)' : 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{section.title}</span>
                          </div>
                          <span style={{ color: isOpen ? 'var(--green)' : 'var(--ink-4)', fontSize: 16, flexShrink: 0, fontWeight: 700 }}>{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '4px 20px 18px 44px', background: 'white', borderTop: '1px solid var(--bg-3)' }}>
                            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: '14px 0 0', whiteSpace: 'pre-wrap' }}>{section.content}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                  ⚠️ Monografia gerada por IA (Llama 3.3). Confirma sempre com o SmPC oficial do INFARMED/EMA e com fontes primárias.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}