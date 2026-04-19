'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const EXAMPLES = [
  { label: 'HTA + DM2 + DRC G3', prompt: 'Homem 60 anos, HTA, DM2, DRC G3 (TFG 42), sem DCV estabelecida. Objectivo TA < 130/80.' },
  { label: 'IC com FE Reduzida', prompt: 'Mulher 68 anos, IC com FEVE 32%, TA 115/70, FC 78, sem edemas. Sem comorbilidades significativas.' },
  { label: 'Depressão Major + Ansiedade', prompt: 'Homem 35 anos, primeiro episódio depressão major moderada com componente ansiosa. Sem antecedentes psiquiátricos.' },
  { label: 'Dislipidemia de Alto Risco', prompt: 'Mulher 55 anos, DM2, LDL 3.8 mmol/L, sem DCV estabelecida. Risco SCORE2 12%.' },
]

function UpgradeGate() {
  return (
    <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Funcionalidade Pro</h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
        Os protocolos terapêuticos são exclusivos do plano Pro. Gerados com base em guidelines ESC, ADA, NICE e DGS para o contexto clínico do teu doente.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '11px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          Upgrade para Pro — 12,99€/mês →
        </Link>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 16, fontFamily: 'var(--font-mono)' }}>Cancela quando quiseres. Sem compromisso.</p>
    </div>
  )
}

export default function ProtocolPage() {
  const { user } = useAuth()
  const plan = user?.plan || 'free'
  const isPro = plan === 'pro' || plan === 'clinic'

  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (q?: string) => {
    const term = (q ?? prompt).trim()
    if (!term) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: term }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.upgrade_required) { setError('upgrade'); return }
        throw new Error(data.error)
      }
      setResult(data)
    } catch (e: any) {
      if (e.message !== 'upgrade') setError(e.message || 'Erro. Tenta novamente.')
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
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 10px', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1e40af', letterSpacing: '0.08em', fontWeight: 700 }}>PRO</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Protocolo Terapêutico</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Descreve o contexto do doente e recebe um protocolo terapêutico completo baseado em guidelines actuais.</p>
            </div>

            {isPro && (
              <>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Contexto do doente
                  </label>
                  <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="Ex: Homem 65 anos, IC com FE reduzida 35%, TA 110/70, creatinina 1.4, K 4.2..."
                    rows={5}
                    style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
                </div>
                <button onClick={() => generate()} disabled={!prompt.trim() || loading}
                  style={{ width: '100%', background: prompt.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: prompt.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: prompt.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
                  {loading ? 'A gerar protocolo...' : 'Gerar Protocolo'}
                </button>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Exemplos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {EXAMPLES.map(ex => (
                      <button key={ex.label} onClick={() => { setPrompt(ex.prompt); generate(ex.prompt) }}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2 }}>{ex.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{ex.prompt.slice(0, 60)}...</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT */}
          <div>
            {!isPro && <UpgradeGate />}

            {isPro && !result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Protocolo baseado em guidelines</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                  Descreve o contexto clínico do doente para receber um protocolo terapêutico completo com fármacos, doses, alvos e follow-up.
                </p>
              </div>
            )}

            {loading && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-3)', padding: '20px 24px' }}>
                  <div className="skeleton" style={{ height: 10, width: 160, marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 22, width: '75%' }} />
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '14px' }}>
                      <div className="skeleton" style={{ height: 11, width: 120, marginBottom: 10 }} />
                      <div className="skeleton" style={{ height: 13, width: '88%', marginBottom: 6 }} />
                      <div className="skeleton" style={{ height: 13, width: '70%' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && error !== 'upgrade' && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '20px' }}>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && (
              <div className="fade-in">
                <div style={{ background: 'var(--green)', borderRadius: '6px 6px 0 0', padding: '18px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>PROTOCOLO TERAPÊUTICO</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', margin: '0 0 4px' }}>{result.title}</h2>
                  {result.guideline && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>Baseado em: {result.guideline}</div>}
                </div>

                <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 12 }}>
                  {result.steps?.map((step: any, i: number) => (
                    <div key={i} style={{ padding: '18px 20px', borderBottom: i < result.steps.length - 1 ? '1px solid var(--border)' : 'none', background: i === 0 ? 'var(--green-light)' : 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? 'white' : 'var(--ink-4)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{i + 1}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: i === 0 ? 'var(--green-2)' : 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{step.phase}</div>
                      </div>

                      {step.drugs?.map((drug: any, j: number) => (
                        <div key={j} style={{ padding: '10px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{drug.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)', fontWeight: 600 }}>{drug.dose}</span>
                          </div>
                          {drug.notes && <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, lineHeight: 1.5 }}>{drug.notes}</p>}
                        </div>
                      ))}

                      {step.targets && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 4 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>ALVOS: </span>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{step.targets}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {result.monitoring && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 20px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>MONITORIZAÇÃO E FOLLOW-UP</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.monitoring}</p>
                  </div>
                )}

                {result.warnings?.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '14px 18px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.1em', marginBottom: 8 }}>ATENÇÃO</div>
                    {result.warnings.map((w: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#d97706', flexShrink: 0 }}>⚠</span>
                        <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, padding: '12px 0' }}>
                  ⚠️ Protocolo gerado por IA com base em guidelines. Adapta sempre ao contexto clínico individual. Não substitui o julgamento clínico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}