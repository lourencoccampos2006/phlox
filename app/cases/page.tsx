'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const CASE_EXAMPLES = [
  { label: 'Doente com FA + Risco Hemorrágico', prompt: 'Homem 72 anos, FA permanente, HTA, DRC G3 (TFG 38), INR lábil, história de úlcera. Qual a estratégia de anticoagulação?' },
  { label: 'Antibioterapia em Alérgico a Penicilinas', prompt: 'Mulher 34 anos, alérgica a penicilinas (rash), pneumonia comunitária moderada, sem critérios de internamento. Que antibioterapia empírica?' },
  { label: 'Diabetes + IC + DRC', prompt: 'Homem 65 anos, DM2, IC com FE reduzida (FEVE 35%), DRC G3b. Metformina está indicada? Que antidiabético escolher?' },
  { label: 'Dor crónica em Idoso', prompt: 'Mulher 80 anos, osteoartrose bilateral, dor moderada-intensa, insuficiência renal ligeira, anticoagulada com varfarina. Opções analgésicas?' },
  { label: 'HTA Resistente', prompt: 'Homem 58 anos, HTA resistente sob 3 fármacos (IECA + amlodipina + tiazida a doses máximas), K 3.2. Próximo passo terapêutico?' },
]

function UpgradeGate({ plan }: { plan: string }) {
  if (plan === 'student' || plan === 'pro' || plan === 'clinic') return null
  return (
    <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '40px 32px', textAlign: 'center', marginTop: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🎓</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
        Funcionalidade Student
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
        Os casos clínicos interactivos estão disponíveis no plano Student. 3,99€/mês — menos que um livro de farmacologia.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '11px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          Ver planos →
        </Link>
        <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '11px 28px', borderRadius: 6, fontSize: 14, border: '1px solid var(--border-2)' }}>
          Já tenho conta
        </Link>
      </div>
    </div>
  )
}

type Stage = 'presentation' | 'differential' | 'decision' | 'outcome'

export default function CasesPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string

  const [customCase, setCustomCase] = useState('')
  const [caseData, setCaseData] = useState<any>(null)
  const [stage, setStage] = useState<Stage>('presentation')
  const [selectedDx, setSelectedDx] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)

  const startCase = async (prompt?: string) => {
    const q = (prompt ?? customCase).trim()
    if (!q) return
    setLoading(true); setError(''); setCaseData(null)
    setStage('presentation'); setSelectedDx(null); setSelectedTx(null); setRevealed(false)
    try {
      // Get Supabase session token for plan verification
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: q }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.upgrade_required) { setError('upgrade'); return }
        throw new Error(data.error)
      }
      setCaseData(data)
    } catch (e: any) {
      if (e.message !== 'upgrade') setError(e.message || 'Erro ao gerar caso. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="two-col" style={{ alignItems: 'start' }}>

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 20, padding: '3px 10px', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', letterSpacing: '0.08em', fontWeight: 700 }}>STUDENT</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Casos Clínicos</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Cenário real → raciocínio diferencial → decisão terapêutica → feedback detalhado.</p>
            </div>

            {isStudent ? (
              <>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Descreve o caso ou escolhe um exemplo
                  </label>
                  <textarea value={customCase} onChange={e => setCustomCase(e.target.value)}
                    placeholder="Ex: Mulher 45 anos com dispepsia e necessidade de anti-inflamatório para artrose..."
                    rows={4}
                    style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
                </div>

                <button onClick={() => startCase()} disabled={!customCase.trim() || loading}
                  style={{ width: '100%', background: customCase.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: customCase.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: customCase.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
                  {loading ? 'A gerar caso...' : 'Iniciar caso clínico'}
                </button>

                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Casos sugeridos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {CASE_EXAMPLES.map(ex => (
                      <button key={ex.label} onClick={() => { setCustomCase(ex.prompt); startCase(ex.prompt) }}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 3 }}>{ex.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{ex.prompt.slice(0, 70)}...</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
                  Faz login ou faz upgrade para o plano Student para aceder aos casos clínicos.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div>
            {!isStudent && <UpgradeGate plan={plan} />}

            {isStudent && !caseData && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🏥</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 8 }}>Raciocínio clínico guiado</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                  Escolhe um caso à esquerda ou descreve o teu próprio. Vais passar pelo processo de diagnóstico diferencial e decisão terapêutica com feedback imediato.
                </p>
              </div>
            )}

            {loading && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-3)', padding: '20px 24px' }}>
                  <div className="skeleton" style={{ height: 10, width: 120, marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 20, width: '80%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%' }} />
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 13, width: `${85 - i*8}%` }} />)}
                </div>
              </div>
            )}

            {error && error !== 'upgrade' && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '20px 24px' }}>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {caseData && (
              <div className="fade-in">
                {/* Case presentation */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ background: 'var(--green)', padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>CASO CLÍNICO</div>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', margin: 0 }}>{caseData.title}</h2>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: 0 }}>{caseData.presentation}</p>
                  </div>
                </div>

                {/* Step 1: Differential */}
                {(stage === 'differential' || stage === 'decision' || stage === 'outcome') && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Qual o diagnóstico/contexto mais relevante?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {caseData.differential_options?.map((opt: string) => (
                        <button key={opt} onClick={() => { setSelectedDx(opt); setStage('decision') }}
                          style={{ background: selectedDx === opt ? (opt === caseData.correct_dx ? '#f0fff4' : '#fff5f5') : 'var(--bg-2)', border: `1px solid ${selectedDx === opt ? (opt === caseData.correct_dx ? '#9ae6b4' : '#feb2b2') : 'var(--border)'}`, borderRadius: 4, padding: '11px 14px', cursor: stage === 'differential' ? 'pointer' : 'default', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                          {selectedDx === opt && <span style={{ marginRight: 8 }}>{opt === caseData.correct_dx ? '✓' : '✗'}</span>}
                          {opt}
                        </button>
                      ))}
                    </div>
                    {selectedDx && selectedDx !== caseData.correct_dx && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 4, fontSize: 13, color: '#7c2d12' }}>
                        {caseData.dx_hint}
                      </div>
                    )}
                  </div>
                )}

                {stage === 'presentation' && (
                  <button onClick={() => setStage('differential')}
                    style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
                    Avançar para diagnóstico diferencial →
                  </button>
                )}

                {/* Step 2: Therapeutic decision */}
                {(stage === 'decision' || stage === 'outcome') && selectedDx === caseData.correct_dx && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Qual a tua decisão terapêutica?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {caseData.therapy_options?.map((opt: any) => (
                        <button key={opt.option} onClick={() => { setSelectedTx(opt.option); setStage('outcome'); setRevealed(true) }}
                          style={{ background: selectedTx === opt.option ? (opt.correct ? '#f0fff4' : '#fff5f5') : 'var(--bg-2)', border: `1px solid ${selectedTx === opt.option ? (opt.correct ? '#9ae6b4' : '#feb2b2') : 'var(--border)'}`, borderRadius: 4, padding: '11px 14px', cursor: stage === 'decision' ? 'pointer' : 'default', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                          {selectedTx === opt.option && <span style={{ marginRight: 8 }}>{opt.correct ? '✓' : '✗'}</span>}
                          {opt.option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outcome / Explanation */}
                {revealed && caseData && (
                  <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderLeft: '4px solid var(--green)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Explicação clínica
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{caseData.explanation}</p>

                    {caseData.key_learning?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', marginBottom: 8 }}>PONTOS-CHAVE</div>
                        {caseData.key_learning.map((point: string, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>→</span>
                            <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{point}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={() => { setCaseData(null); setCustomCase('') }}
                      style={{ marginTop: 16, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Próximo caso →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}