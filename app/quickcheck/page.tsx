'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile } from '@/lib/profileContext'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// Ferramenta para TODOS: cola a lista de medicamentos, recebe análise em PT simples
// Sem conta, sem fricção. O hook para converter pessoas normais e médicos ocupados.

const EXAMPLES = [
  {
    label: 'Doente crónico típico',
    meds: 'Metformina 1000mg 2x/dia\nAtovastatina 20mg à noite\nRamipril 5mg manhã\nOmeprazol 20mg manhã\nAspirin 100mg manhã',
  },
  {
    label: 'Doente cardíaco',
    meds: 'Bisoprolol 5mg\nFurosemida 40mg\nEspironolactona 25mg\nAtovastatina 40mg\nWarfarina 5mg\nAmiodarona 200mg',
  },
  {
    label: 'Idoso polimedicado',
    meds: 'Diazepam 5mg à noite\nOmeprazol 40mg\nIbuprofeno 400mg 3x/dia\nRamipril 10mg\nMetformina 500mg\nLevotiroxina 50mcg',
  },
]

type Mode = 'simple' | 'technical'

export default function QuickCheckPage() {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('simple')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activeProfile, setActiveProfileState] = useState<any>(null)

  // ─── Carregar meds do perfil activo ───
  const { supabase } = useAuth()
  const handleProfileChange = async (p: any) => {
    setActiveProfileState(p)
    if (!supabase) return
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const { data } = await supabase.from(table).select('name, dose, frequency').eq(col, p.id === 'self' ? user?.id : p.id)
    if (data?.length) {
      setInput(data.map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n'))
    }
  }

  const analyse = async (text?: string) => {
    const meds = (text ?? input).trim()
    if (!meds) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/quickcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications: meds, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const TRAFFIC_LIGHT: Record<string, { bg: string; border: string; color: string; dot: string }> = {
    green:  { bg: '#f0fff4', border: '#9ae6b4', color: '#1a4731', dot: '#10b981' },
    yellow: { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b' },
    red:    { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>
              Análise Rápida de Medicação
            </h1>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 20px' }}>
              Cola ou escreve a lista de medicamentos. Recebe uma análise completa — interações, problemas, e o que fazer — em segundos. Sem conta necessária.
            </p>

            {/* Mode toggle */}
            <div style={{ display: 'inline-flex', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 4, gap: 4 }}>
              {([
                { id: 'simple', label: '🧑 Linguagem simples', desc: 'Para doentes e familiares' },
                { id: 'technical', label: '⚕️ Técnico', desc: 'Para profissionais de saúde' },
              ] as const).map(({ id, label, desc }) => (
                <button key={id} onClick={() => setMode(id)}
                  style={{ background: mode === id ? 'var(--green)' : 'transparent', color: mode === id ? 'white' : 'var(--ink-3)', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span>{label}</span>
                  <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Lista de medicamentos (um por linha, com ou sem doses)
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'Brufen 400mg 2x/dia (ou ibuprofeno)\nZocor 20mg (ou sinvastatina)\nRamipril 5mg\nOmeprazol 20mg\n\nPodes usar nomes de caixas ou nomes científicos.'}
              rows={6}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 6, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, color: 'var(--ink)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>Exemplos:</span>
                {EXAMPLES.map(ex => (
                  <button key={ex.label} onClick={() => { setInput(ex.meds); setResult(null) }}
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    {ex.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => analyse()}
                disabled={!input.trim() || loading}
                style={{ background: input.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: input.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                {loading ? 'A analisar...' : 'Analisar →'}
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '24px' }}>
              <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 20 }} />
              {[0,1,2].map(i => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div className="skeleton" style={{ height: 12, width: 120 }} />
                    <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 20 }} />
                  </div>
                  <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 12, width: '65%' }} />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="fade-in">

              {/* Overall traffic light */}
              {result.overall && (() => {
                const tl = TRAFFIC_LIGHT[result.overall.level] || TRAFFIC_LIGHT.yellow
                return (
                  <div style={{ background: tl.bg, border: `2px solid ${tl.border}`, borderRadius: 8, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: tl.dot, flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: tl.color, fontWeight: 700, marginBottom: 6 }}>{result.overall.title}</div>
                      <p style={{ fontSize: 14, color: tl.color, lineHeight: 1.7, margin: 0 }}>{result.overall.summary}</p>
                    </div>
                  </div>
                )
              })()}

              {/* Findings */}
              {result.findings?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {result.findings.map((finding: any, i: number) => {
                    const tl = TRAFFIC_LIGHT[finding.level] || TRAFFIC_LIGHT.yellow
                    return (
                      <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `4px solid ${tl.dot}`, borderRadius: '0 8px 8px 0', padding: '16px 18px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{finding.title}</div>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: tl.bg, color: tl.color, border: `1px solid ${tl.border}`, borderRadius: 4, padding: '2px 8px', flexShrink: 0, letterSpacing: '0.06em' }}>
                            {finding.level === 'red' ? '⚠ ATENÇÃO' : finding.level === 'yellow' ? '! PRECAUÇÃO' : '✓ OK'}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{finding.explanation}</p>
                        {finding.action && (
                          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 4, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            <strong>O que fazer:</strong> {finding.action}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Good things */}
              {result.positives?.length > 0 && (
                <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1a4731', letterSpacing: '0.1em', marginBottom: 8 }}>✓ PONTOS POSITIVOS</div>
                  {result.positives.map((p: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: '#1a4731', lineHeight: 1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Upsell for logged in users */}
              {!user && (
                <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '20px 24px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Guarda esta análise e volta a verificar</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Cria uma conta para guardar os teus medicamentos e receber alertas automáticos de interações.</div>
                  </div>
                  <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Criar conta grátis →
                  </Link>
                </div>
              )}

              {user && user.plan === 'free' && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    💬 <strong>Faz perguntas</strong> sobre esta medicação com o Phlox AI — o teu farmacologista clínico pessoal.
                  </div>
                  <Link href="/ai" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '8px 16px', borderRadius: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Phlox AI — Student →
                  </Link>
                </div>
              )}

              <div style={{ padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                ⚕️ Análise gerada por IA com base em dados RxNorm/NIH. Informação educacional — confirma sempre com o teu médico ou farmacêutico.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}