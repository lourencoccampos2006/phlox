'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile } from '@/lib/profileContext'

const EXAMPLES = [
  'Lorazepam', 'Sertralina', 'Metformina', 'Tramadol',
  'Prednisolona', 'Metilfenidato', 'Cetirizina', 'Amiodarona',
]

const RISK_LEVELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SEGURO:      { label: 'Seguro',           color: '#1a4731', bg: '#f0fff4', border: '#9ae6b4' },
  PRECAUCAO:   { label: 'Precaução',        color: '#7c2d12', bg: '#fffaf0', border: '#fbd38d' },
  RISCO:       { label: 'Risco',            color: '#7f1d1d', bg: '#fff5f5', border: '#feb2b2' },
  CONTRA:      { label: 'Contraindicado',   color: '#450a0a', bg: '#fef2f2', border: '#fca5a5' },
  DESCONHECIDO:{ label: 'Dados limitados',  color: 'var(--ink-3)', bg: 'var(--bg-2)', border: 'var(--border-2)' },
}

function RiskBadge({ level }: { level: string }) {
  const r = RISK_LEVELS[level] ?? RISK_LEVELS['DESCONHECIDO']
  return (
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, background: r.bg, color: r.color, border: `1px solid ${r.border}`, borderRadius: 4, padding: '3px 9px', letterSpacing: '0.06em' }}>
      {r.label.toUpperCase()}
    </span>
  )
}

function ResultSkeleton() {
  return (
    <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-3)', padding: '20px 24px' }}>
        <div className="skeleton" style={{ height: 10, width: 100, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 26, width: 200 }} />
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="skeleton" style={{ height: 13, width: 120 }} />
              <div className="skeleton" style={{ height: 20, width: 90, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 12, width: '65%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SafetyPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const check = async (q?: string) => {
    const term = (q ?? query).trim()
    if (!term) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug: term }),
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

  const DIMENSIONS = [
    { key: 'driving',   icon: '🚗', label: 'Condução',    desc: 'Aptidão para conduzir veículos' },
    { key: 'sport',     icon: '🏃', label: 'Desporto',    desc: 'Doping e performance' },
    { key: 'pregnancy', icon: '🤱', label: 'Gravidez',    desc: 'Categoria FDA / EMA' },
    { key: 'alcohol',   icon: '🍷', label: 'Álcool',      desc: 'Interação com bebidas alcoólicas' },
    { key: 'elderly',   icon: '👴', label: 'Idosos',      desc: 'Critérios Beers / STOPP' },
  ]

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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Ferramenta 08</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Segurança do Medicamento</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Condução, desporto, gravidez, álcool e uso em idosos — tudo num só lugar.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Medicamento</label>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Ex: lorazepam, tramadol, sertralina..."
                style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
            </div>

            <button onClick={() => check()} disabled={!query.trim() || loading}
              style={{ width: '100%', background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A verificar...' : 'Verificar Segurança'}
            </button>

            {/* Dimensões que cobre */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>O QUE ANALISAMOS</div>
              {DIMENSIONS.map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setQuery(ex); check(ex) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                    {ex}
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
                <div style={{ fontSize: 36, marginBottom: 16 }}>🛡️</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Verificação de segurança</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                  Introduz o nome de um medicamento para ver se é seguro conduzir, fazer desporto, usar na gravidez e mais.
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
                <div style={{ background: 'var(--green)', borderRadius: '6px 6px 0 0', padding: '18px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>PERFIL DE SEGURANÇA</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', margin: '0 0 4px', textTransform: 'capitalize' }}>{result.drug}</h2>
                  {result.drug_class && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-mono)' }}>{result.drug_class}</div>}
                </div>

                {/* Dimension cards */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 12 }}>
                  {DIMENSIONS.map(({ key, icon, label }, i) => {
                    const dim = result[key]
                    if (!dim) return null
                    const r = RISK_LEVELS[dim.level] ?? RISK_LEVELS['DESCONHECIDO']
                    return (
                      <div key={key} style={{ padding: '16px 20px', borderBottom: i < DIMENSIONS.length - 1 ? '1px solid var(--border)' : 'none', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: dim.detail ? 10 : 0, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                          </div>
                          <RiskBadge level={dim.level} />
                        </div>
                        {dim.detail && (
                          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 0 26px', lineHeight: 1.7 }}>{dim.detail}</p>
                        )}
                        {dim.legal_note && (
                          <div style={{ marginTop: 8, marginLeft: 26, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                            ⚖️ {dim.legal_note}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {result.summary_note && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>NOTA CLÍNICA</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.summary_note}</p>
                  </div>
                )}

                <div style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                  ⚠️ Baseado em SmPC, IMAO, WADA e literatura clínica. Confirma sempre com o teu médico ou farmacêutico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}