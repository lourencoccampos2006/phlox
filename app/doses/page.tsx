'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile } from '@/lib/profileContext'
import { useAuth } from '@/components/AuthContext'

const EXAMPLES = [
  { label: 'Pneumonia comunitária', query: 'pneumonia adquirida na comunidade adulto' },
  { label: 'ITU não complicada', query: 'infecção urinária não complicada mulher' },
  { label: 'Faringite estreptocócica', query: 'faringite por streptococcus adulto' },
  { label: 'Celulite bacteriana', query: 'celulite bacteriana não complicada' },
  { label: 'HTA — 1ª linha', query: 'hipertensão arterial primeira linha' },
  { label: 'DM2 — início', query: 'diabetes mellitus tipo 2 início de tratamento' },
  { label: 'Depressão major', query: 'depressão major primeira linha' },
  { label: 'DRGE / refluxo', query: 'doença de refluxo gastroesofágico' },
]

function ResultSkeleton() {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }} className="fade-in">
      <div style={{ background: 'var(--bg-3)', padding: '16px 20px' }}>
        <div className="skeleton" style={{ height: 10, width: 160, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 20, width: 280 }} />
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '16px' }}>
            <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 12, width: '65%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DosesPage() {
  const { user, supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (q?: string) => {
    const term = (q || query).trim()
    if (!term) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indication: term }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      if (user) {
        supabase.from('search_history').insert({
          user_id: user.id, type: 'drug', query: term, result_severity: null, result_source: 'ai-doses',
        }).then(() => {})
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao pesquisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            {/* ─── NOVO: ProfileSelector ─── */}
            {user && (
              <div style={{ marginBottom: 10 }}>
                <ProfileSelector onChange={p => {
                  // pré-preenche contexto com dados do perfil activo
                }} />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 05</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Posologia por Indicação</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Escreve uma indicação clínica e obtém fármacos de 1ª linha com doses, duração e alternativas.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Indicação clínica</label>
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), search())}
                placeholder="Ex: pneumonia comunitária adulto, ITU não complicada, HTA 1ª linha..."
                rows={3}
                style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
              />
            </div>

            <button onClick={() => search()} disabled={!query.trim() || loading}
              style={{ width: '100%', background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A consultar guidelines...' : 'Obter posologia'}
            </button>

            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EXAMPLES.map(({ label, query: q }) => (
                  <button key={q} onClick={() => { setQuery(q); search(q) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && <ResultSkeleton />}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>💊</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Posologia baseada em guidelines</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                  Introduz uma indicação clínica para obteres fármacos de 1ª linha com doses e duração recomendada.
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
                {/* Header */}
                <div style={{ background: 'var(--green)', borderRadius: '6px 6px 0 0', padding: '16px 20px', marginBottom: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>POSOLOGIA RECOMENDADA</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'white', lineHeight: 1.3 }}>{result.indication}</div>
                  {result.context && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{result.context}</div>}
                </div>

                {/* Drug options */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 16 }}>
                  {result.options?.map((opt: any, i: number) => (
                    <div key={i} style={{ padding: '18px 20px', borderBottom: i < result.options.length - 1 ? '1px solid var(--border)' : 'none', background: i === 0 ? 'var(--green-light)' : 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: i === 0 ? 'var(--green)' : 'var(--bg-3)', color: i === 0 ? 'white' : 'var(--ink-4)', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.1em' }}>
                            {i === 0 ? '1ª LINHA' : i === 1 ? '2ª LINHA' : 'ALTERNATIVA'}
                          </span>
                          {opt.allergy_note && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#fefce8', color: '#713f12', padding: '2px 8px', borderRadius: 20 }}>Alergia a penicilinas</span>}
                        </div>
                        {opt.duration && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{opt.duration}</span>}
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>{opt.drug}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green-2)', fontWeight: 600, marginBottom: opt.notes ? 8 : 0 }}>{opt.dose}</div>
                      {opt.notes && <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>{opt.notes}</p>}
                    </div>
                  ))}
                </div>

                {/* Monitoring / special notes */}
                {result.monitoring && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 20px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Monitorização</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.7 }}>{result.monitoring}</p>
                  </div>
                )}

                <div style={{ padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                  ⚠️ Baseado em guidelines clínicas (DGS, IDSA, NICE). Adapta sempre ao contexto clínico, alergias e resistências locais.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}