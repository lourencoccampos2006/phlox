'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Strategy {
  id: string
  name: string
  tagline: string
  drugs: {
    name: string
    dose: string
    role: string
    timing?: string
  }[]
  expected_outcome: string
  time_to_effect: string
  monitoring: string[]
  advantages: string[]
  disadvantages: string[]
  evidence_level: 'A' | 'B' | 'C'
  guidelines: string[]
  contraindications_present: string[]   // contraindications that apply to THIS patient
  suitability_score: number             // 0-100 for this specific patient
  suitability_reason: string
}

interface SimResult {
  goal_summary: string
  patient_profile: string
  strategies: Strategy[]
  recommended: string     // id of best strategy
  recommendation_reason: string
  shared_monitoring: string[]
  key_trade_offs: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVIDENCE_STYLE = {
  A: { bg: '#f0fdf4', border: '#86efac', color: '#14532d', label: 'Evidência A — RCTs robustos' },
  B: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a5f', label: 'Evidência B — estudos observacionais' },
  C: { bg: '#f8f8f7', border: '#e5e5e2', color: '#4a4a4a', label: 'Evidência C — consenso de peritos' },
}

const EXAMPLES = [
  {
    label: 'HbA1c 8.5% em doente com IC e DRC G3',
    goal: 'Reduzir HbA1c de 8.5% para < 7.5% com segurança cardiovascular e renal',
    patient: 'Homem 67 anos, DM2, IC com FEVE 40%, DRC G3 (TFG 38), sem DCV establecida, TA 138/82, metformina 1g 2x/dia actual',
  },
  {
    label: 'HTA resistente com hipopotassemia',
    goal: 'Controlar TA < 130/80 sem piorar hipopotassemia (K 3.1)',
    patient: 'Mulher 55 anos, HTA resistente, K 3.1, IECA + amlodipina + tiazida a doses máximas, sem DM, TFG 72',
  },
  {
    label: 'Prevenção secundária pós-EAM em doente alérgico',
    goal: 'Optimizar terapêutica de prevenção secundária pós-EAM com alergia a aspirina',
    patient: 'Homem 58 anos, EAM há 3 meses, FEVE 45%, alergia documentada a aspirina (urticária), DM2 controlada, sem DRC',
  },
  {
    label: 'Depressão resistente com ganho de peso',
    goal: 'Remissão da depressão major sem ganho de peso adicional em doente obeso',
    patient: 'Mulher 42 anos, depressão major recorrente, falhou sertralina e venlafaxina, IMC 34, sem DM, sem história cardiovascular',
  },
]

function UpgradeGate() {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        Simulador de Estratégia Terapêutica
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
        Define um objectivo clínico e o perfil do doente. O simulador gera 3–5 estratégias terapêuticas alternativas, com evidência, trade-offs e a recomendação óptima para <em>este doente específico</em>.
      </p>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
        {[
          '🎯 Define o objectivo — não o diagnóstico',
          '⚖️ Compara estratégias com evidência A/B/C',
          '🧬 Adapta ao perfil real do doente',
          '📊 Score de adequação por estratégia',
          '⚠️ Identifica contraindicações específicas',
          '📋 Exporta para incluir no processo clínico',
        ].map(item => (
          <div key={item} style={{ fontSize: 14, color: 'var(--ink-2)', padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            {item}
          </div>
        ))}
      </div>
      <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 32px', borderRadius: 8, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Upgrade para Pro — 12,99€/mês →
      </Link>
      <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12, fontFamily: 'var(--font-mono)' }}>Cancela quando quiseres.</p>
    </div>
  )
}

function StrategyCard({ s, isRecommended }: { s: Strategy; isRecommended: boolean }) {
  const [open, setOpen] = useState(isRecommended)
  const ev = EVIDENCE_STYLE[s.evidence_level]
  const scoreColor = s.suitability_score >= 75 ? 'var(--green)' : s.suitability_score >= 50 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ border: `${isRecommended ? '2px' : '1px'} solid ${isRecommended ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: 'white' }}>

      {/* Card header */}
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: isRecommended ? 'var(--green-light)' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {/* Score circle */}
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{s.suitability_score}</span>
          <span style={{ fontSize: 8, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>/ 100</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.name}</span>
            {isRecommended && (
              <span style={{ fontSize: 10, background: 'var(--green)', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>RECOMENDADO</span>
            )}
            <span style={{ fontSize: 10, background: ev.bg, color: ev.color, border: `1px solid ${ev.border}`, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{ev.label}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>{s.tagline}</div>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
          {/* Suitability */}
          <div style={{ padding: '12px 0', borderBottom: '1px solid var(--bg-3)', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Adequação para este doente</div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${s.suitability_score}%`, background: scoreColor, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{s.suitability_reason}</p>
          </div>

          {/* Drugs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Fármacos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.drugs.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', minWidth: 160, letterSpacing: '-0.01em' }}>{d.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)', fontWeight: 600 }}>{d.dose}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', flex: 1 }}>{d.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expected outcome + time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Resultado esperado</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{s.expected_outcome}</p>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Tempo até efeito</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{s.time_to_effect}</p>
            </div>
          </div>

          {/* Pros / Cons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#14532d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Vantagens</div>
              {s.advantages.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>+</span>{a}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Desvantagens</div>
              {s.disadvantages.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--red)', fontWeight: 700, flexShrink: 0 }}>–</span>{d}
                </div>
              ))}
            </div>
          </div>

          {/* Contraindications present */}
          {s.contraindications_present.length > 0 && (
            <div style={{ padding: '10px 12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Alertas neste doente</div>
              {s.contraindications_present.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: '#742a2a', marginBottom: 3 }}>· {c}</div>
              ))}
            </div>
          )}

          {/* Monitoring + guidelines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Monitorizar</div>
              {s.monitoring.map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 3 }}>→ {m}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Guidelines</div>
              {s.guidelines.map((g, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 3 }}>· {g}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StrategyPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [goal, setGoal] = useState('')
  const [patient, setPatient] = useState('')
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const simulate = async (g?: string, p?: string) => {
    const tGoal = (g ?? goal).trim()
    const tPatient = (p ?? patient).trim()
    if (!tGoal) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/strategy', { method: 'POST', headers, body: JSON.stringify({ goal: tGoal, patient: tPatient }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao simular. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {!isPro && <UpgradeGate />}

      {isPro && (
        <div className="page-container page-body">
          <div className="interactions-layout">

            {/* LEFT */}
            <div className="sticky-panel">
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.02em' }}>Simulador de Estratégia Terapêutica</h1>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55 }}>Define um objectivo clínico. Recebe estratégias alternativas com evidência, trade-offs e adequação para este doente.</p>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Objectivo terapêutico
                </label>
                <textarea value={goal} onChange={e => setGoal(e.target.value)}
                  placeholder="Ex: Reduzir HbA1c de 8.5% para < 7.5% com segurança cardiovascular"
                  rows={3}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.55, letterSpacing: '-0.01em' }} />
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Perfil do doente (comorbilidades, medicação actual, analíticas)
                </label>
                <textarea value={patient} onChange={e => setPatient(e.target.value)}
                  placeholder="Ex: Homem 67 anos, DM2, IC com FEVE 40%, DRC G3 (TFG 38), K 4.8, metformina 1g 2x/dia"
                  rows={5}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.55, letterSpacing: '-0.01em' }} />
              </div>

              <button onClick={() => simulate()} disabled={!goal.trim() || loading}
                style={{ width: '100%', background: goal.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: goal.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 600, cursor: goal.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '-0.01em' }}>
                {loading ? 'A simular estratégias...' : 'Simular estratégias →'}
              </button>

              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Exemplos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {EXAMPLES.map(ex => (
                    <button key={ex.label}
                      onClick={() => { setGoal(ex.goal); setPatient(ex.patient); simulate(ex.goal, ex.patient) }}
                      style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2, letterSpacing: '-0.01em' }}>{ex.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{ex.goal.slice(0, 70)}...</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              {loading && (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 6 }} />
                          <div className="skeleton" style={{ height: 11, width: '35%' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p></div>}

              {!result && !loading && !error && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '-0.01em' }}>Comparação de estratégias terapêuticas</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                    Define o objectivo clínico e o perfil do doente. O simulador gera estratégias alternativas com evidência e adequação personalizada.
                  </p>
                </div>
              )}

              {result && !loading && (
                <div className="fade-in">
                  {/* Summary */}
                  <div style={{ background: 'var(--green)', borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>SIMULAÇÃO TERAPÊUTICA</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>{result.goal_summary}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{result.patient_profile}</div>
                  </div>

                  {/* Recommendation reason */}
                  <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Por que esta estratégia</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.recommendation_reason}</p>
                  </div>

                  {/* Strategies */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {result.strategies
                      .sort((a, b) => b.suitability_score - a.suitability_score)
                      .map(s => (
                        <StrategyCard key={s.id} s={s} isRecommended={s.id === result.recommended} />
                      ))
                    }
                  </div>

                  {/* Key trade-offs */}
                  {result.key_trade_offs && (
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Trade-offs principais</div>
                      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.key_trade_offs}</p>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
                    ⚕️ Baseado em guidelines actuais. Adapta sempre ao contexto clínico individual. Confirma com o médico assistente.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}