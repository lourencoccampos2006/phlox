'use client'

// ─── PHLOX HIVE — Inteligência Colectiva dos Estudantes de Saúde ──────────────
// O que o Reddit de medicina deveria ser mas nunca foi.
// Cada sessão de estudo alimenta um mapa de dificuldade colectivo:
// quais os tópicos onde os estudantes mais erram, quais as perguntas
// com maior taxa de erro, onde está o teu ponto cego vs a turma.
// Aprende o que toda a gente erra. Torna-te o que toda a gente não é.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface HiveInsight {
  topic: string
  domain: string
  domain_icon: string
  error_rate: number          // % de erros neste tópico (agregado)
  total_attempts: number      // quantas tentativas neste tópico
  difficulty_score: number    // 0-100 — quanto mais alto, mais difícil
  my_rate?: number            // a minha taxa de erro neste tópico
  trend: 'rising' | 'stable' | 'falling'  // dificuldade a aumentar ou diminuir
  top_wrong_answer?: string   // a resposta errada mais escolhida
  community_tip?: string      // dica gerada pela comunidade
}

interface WeakSpot {
  topic: string
  domain: string
  my_attempts: number
  my_correct: number
  my_rate: number
  community_rate: number
  gap: number  // diferença entre minha taxa e a da comunidade (positivo = pior que a comunidade)
}

interface HotStreak {
  user_display: string
  streak_days: number
  correct_this_week: number
  league: string
}

const DOMAIN_META: Record<string, { label: string; icon: string; color: string }> = {
  farmacologia:       { label: 'Farmacologia',      icon: 'Rx', color: '#0d6e42' },
  medicina_interna:   { label: 'Medicina Interna',  icon: '🫀', color: '#dc2626' },
  emergencia:         { label: 'Emergência',        icon: 'Ur', color: '#b45309' },
  cirurgia:           { label: 'Cirurgia',          icon: '🔪', color: '#1d4ed8' },
  pediatria:          { label: 'Pediatria',         icon: '👶', color: '#7c3aed' },
  gineco_obstetricia: { label: 'Gineco-Obs',        icon: '🤰', color: '#be185d' },
  enfermagem:         { label: 'Enfermagem',        icon: '💉', color: '#0f766e' },
  nutricao:           { label: 'Nutrição',          icon: '🥗', color: '#65a30d' },
  anatomia_fisiologia:{ label: 'Anatomia',          icon: '🫁', color: '#0891b2' },
  semiologia:         { label: 'Semiologia',        icon: '🩺', color: '#374151' },
}

function ErrorRateBar({ rate, myRate }: { rate: number; myRate?: number }) {
  const barColor = rate >= 70 ? '#dc2626' : rate >= 50 ? '#d97706' : '#0d6e42'
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: barColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      {myRate !== undefined && (
        <div style={{ position: 'absolute', top: -2, left: `${myRate}%`, width: 3, height: 12, background: '#7c3aed', borderRadius: 1, transform: 'translateX(-50%)' }} title={`A tua taxa: ${myRate}%`} />
      )}
    </div>
  )
}

function InsightCard({ insight, isHighlighted }: { insight: HiveInsight; isHighlighted?: boolean }) {
  const d = DOMAIN_META[insight.domain] || { label: insight.domain, icon: '--', color: '#374151' }
  const diff = insight.my_rate !== undefined ? insight.my_rate - insight.error_rate : null
  const trendIcon = insight.trend === 'rising' ? '📈' : insight.trend === 'falling' ? '📉' : '➡️'

  return (
    <div style={{ background: isHighlighted ? '#fef9c3' : 'white', border: `1px solid ${isHighlighted ? '#fde68a' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{d.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, lineHeight: 1.3 }}>{insight.topic}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: d.color }}>{d.label}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>· {insight.total_attempts} tentativas</span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>{trendIcon}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: insight.error_rate >= 70 ? '#dc2626' : insight.error_rate >= 50 ? '#d97706' : '#0d6e42' }}>{insight.error_rate}%</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>taxa de erro</div>
        </div>
      </div>

      <ErrorRateBar rate={insight.error_rate} myRate={insight.my_rate} />

      {diff !== null && (
        <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: diff > 10 ? '#dc2626' : diff < -10 ? '#0d6e42' : '#d97706' }}>
          {diff > 0 ? `↑ Erras ${diff}% mais que a comunidade` : diff < 0 ? `↓ Erras ${Math.abs(diff)}% menos que a comunidade` : 'Igual à média da comunidade'}
        </div>
      )}

      {insight.community_tip && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          💡 {insight.community_tip}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <Link href={`/study?topic=${encodeURIComponent(insight.topic)}&domain=${insight.domain}`}
          style={{ flex: 1, padding: '7px', background: d.color, color: 'white', textDecoration: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, textAlign: 'center', display: 'block' }}>
          Estudar agora →
        </Link>
        <Link href="/arena"
          style={{ padding: '7px 10px', background: 'white', color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚡ Arena
        </Link>
      </div>
    </div>
  )
}

export default function HivePage() {
  const { user, supabase } = useAuth()
  const [insights, setInsights] = useState<HiveInsight[]>([])
  const [weakSpots, setWeakSpots] = useState<WeakSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'hardest' | 'myweakspots' | 'trending'>('hardest')
  const [filterDomain, setFilterDomain] = useState('all')

  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      // Load arena attempts (aggregated)
      const { data: allAttempts } = await supabase
        .from('arena_attempts')
        .select('score, challenge_id, arena_challenges(domain, title, difficulty)')
        .limit(1000)

      const { data: myAttempts } = await supabase
        .from('arena_attempts')
        .select('score, challenge_id, arena_challenges(domain, title)')
        .eq('user_id', user.id)

      // Aggregate by topic/domain
      const topicMap: Record<string, { total: number; wrong: number; domain: string; myTotal: number; myWrong: number }> = {}

      ;(allAttempts || []).forEach((a: any) => {
        const domain = (a.arena_challenges as any)?.domain || 'outro'
        const title = (a.arena_challenges as any)?.title || 'Tópico'
        const key = `${domain}:${title}`
        if (!topicMap[key]) topicMap[key] = { total: 0, wrong: 0, domain, myTotal: 0, myWrong: 0 }
        topicMap[key].total++
        if (a.score === 0) topicMap[key].wrong++
      })

      ;(myAttempts || []).forEach((a: any) => {
        const domain = (a.arena_challenges as any)?.domain || 'outro'
        const title = (a.arena_challenges as any)?.title || 'Tópico'
        const key = `${domain}:${title}`
        if (topicMap[key]) {
          topicMap[key].myTotal++
          if (a.score === 0) topicMap[key].myWrong++
        }
      })

      const tips: Record<string, string> = {
        farmacologia: 'Foca nos mecanismos de acção — as aplicações clínicas derivam deles',
        emergencia: 'Aprende os algoritmos de cor — em stress não tens tempo para pensar',
        medicina_interna: 'Cada diagnóstico diferencial precisa de critérios específicos, não instinto',
        pediatria: 'As doses pediátricas têm limites máximos — nunca extrapola directamente do adulto',
      }

      const hiveInsights: HiveInsight[] = Object.entries(topicMap)
        .filter(([, d]) => d.total >= 2)
        .map(([key, d]) => {
          const [domain, topic] = key.split(':')
          const errorRate = Math.round((d.wrong / d.total) * 100)
          const myRate = d.myTotal > 0 ? Math.round((d.myWrong / d.myTotal) * 100) : undefined
          return {
            topic, domain,
            domain_icon: DOMAIN_META[domain]?.icon || '--',
            error_rate: errorRate,
            total_attempts: d.total,
            difficulty_score: errorRate,
            my_rate: myRate,
            trend: 'stable' as const,
            community_tip: tips[domain],
          }
        })
        .sort((a, b) => b.error_rate - a.error_rate)

      setInsights(hiveInsights)

      // Weak spots — where I'm worse than the community
      const ws: WeakSpot[] = hiveInsights
        .filter(i => i.my_rate !== undefined && i.my_rate > i.error_rate + 10)
        .map(i => ({
          topic: i.topic, domain: i.domain,
          my_attempts: 0, my_correct: 0,
          my_rate: i.my_rate!, community_rate: i.error_rate,
          gap: i.my_rate! - i.error_rate,
        }))
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 10)

      setWeakSpots(ws)
    } catch {}
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const filtered = insights.filter(i => filterDomain === 'all' || i.domain === filterDomain)
  const hardest = filtered.filter(i => i.total_attempts >= 3).slice(0, 20)
  const trending = filtered.filter(i => i.trend === 'rising').slice(0, 10)

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#7c3aed' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? '#7c3aed' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>


      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              Phlox Hive · Inteligência Colectiva
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400, marginBottom: 6 }}>
              O que os estudantes de saúde mais erram
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, maxWidth: 560 }}>
              Dados agregados e anónimos de todos os utilizadores. Aprende onde toda a gente falha. Identifica os teus pontos cegos vs a comunidade. O estudo inteligente começa aqui.
            </p>
          </div>

          {/* Stats bar + acção */}
          {!loading && insights.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Tópicos analisados', value: insights.length },
                  { label: 'Tópico mais difícil', value: hardest[0]?.topic?.slice(0, 20) || '—' },
                  { label: 'Taxa de erro média', value: `${Math.round(insights.reduce((a,i) => a + i.error_rate, 0) / Math.max(1, insights.length))}%` },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc' }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const text = `📚 Phlox Hive — ${insights.length} tópicos analisados pelos estudantes de saúde. Erro médio: ${Math.round(insights.reduce((a,i) => a + i.error_rate, 0) / Math.max(1, insights.length))}%. Estudar com dados é melhor.`
                  if ((navigator as any).share) (navigator as any).share({ title: 'Phlox Hive', text, url: location.href }).catch(() => {})
                  else navigator.clipboard.writeText(`${text} ${location.href}`)
                }}
                style={{ padding: '8px 14px', background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ⇪ Partilhar
              </button>
            </div>
          )}

          <div style={{ display: 'flex', borderTop: '1px solid #1e293b', overflowX: 'auto' }}>
            {[['hardest','Mais difíceis'], ['myweakspots','Os meus pontos cegos'], ['trending','Em alta']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)}
                style={{ ...tabStyle(id), color: tab === id ? '#a78bfa' : '#475569', borderBottomColor: tab === id ? '#7c3aed' : 'transparent' }}>
                {label} {id === 'myweakspots' && weakSpots.length > 0 && <span style={{ background: '#dc2626', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 10, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>{weakSpots.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Domain filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterDomain('all')}
            style={{ padding: '5px 12px', border: `1.5px solid ${filterDomain === 'all' ? '#7c3aed' : 'var(--border)'}`, borderRadius: 20, background: filterDomain === 'all' ? '#faf5ff' : 'white', color: filterDomain === 'all' ? '#7c3aed' : 'var(--ink-3)', cursor: 'pointer', fontSize: 11, fontWeight: filterDomain === 'all' ? 700 : 400, fontFamily: 'var(--font-sans)' }}>
            Todos
          </button>
          {Object.entries(DOMAIN_META).map(([id, meta]) => (
            <button key={id} onClick={() => setFilterDomain(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', border: `1.5px solid ${filterDomain === id ? meta.color : 'var(--border)'}`, borderRadius: 20, background: filterDomain === id ? `${meta.color}10` : 'white', color: filterDomain === id ? meta.color : 'var(--ink-3)', cursor: 'pointer', fontSize: 11, fontWeight: filterDomain === id ? 700 : 400, fontFamily: 'var(--font-sans)' }}>
              <span>{meta.icon}</span>{meta.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 10 }}>
            {[0,1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 10 }} />)}
          </div>
        ) : !isStudent ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🐝</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Phlox Hive</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
              Dados de toda a comunidade Phlox. Os tópicos mais difíceis, os teus pontos cegos vs a comunidade, e as dicas que surgem dos padrões de erro. Exclusivo Plus.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Ver plano Plus →
            </Link>
          </div>
        ) : insights.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🐝</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Ainda sem dados suficientes</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px' }}>
              O Hive alimenta-se dos resultados da Arena. Quanto mais a comunidade jogar, mais rico fica o mapa de dificuldade. Começa por jogar alguns casos.
            </div>
            <Link href="/arena" style={{ display: 'inline-block', padding: '10px 22px', background: '#7c3aed', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              Ir para a Arena →
            </Link>
          </div>
        ) : (
          <>
            {tab === 'hardest' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,320px),1fr))', gap: 10 }}>
                {hardest.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--ink-4)' }}>Sem dados suficientes para este filtro.</div>
                ) : hardest.map((insight, i) => (
                  <InsightCard key={i} insight={insight} isHighlighted={i < 3} />
                ))}
              </div>
            )}

            {tab === 'myweakspots' && (
              <div>
                {weakSpots.length === 0 ? (
                  <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>Sem pontos cegos identificados!</div>
                    <div style={{ fontSize: 13, color: '#065f46', opacity: 0.8 }}>Estás a errar menos que a média da comunidade em todos os tópicos tentados. Joga mais casos na Arena para uma análise mais precisa.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '12px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#854d0e', lineHeight: 1.6 }}>
                      ⚠️ Estes são os tópicos onde erras <strong>significativamente mais</strong> que a média da comunidade. Estuda-os primeiro.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {weakSpots.map((ws, i) => {
                        const d = DOMAIN_META[ws.domain] || { label: ws.domain, icon: '--', color: '#374151' }
                        return (
                          <div key={i} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ fontSize: 24, flexShrink: 0 }}>{d.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{ws.topic}</div>
                              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{d.label}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+{ws.gap}% vs comunidade</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Tu: {ws.my_rate}% · Comunidade: {ws.community_rate}%</div>
                            </div>
                            <Link href="/arena"
                              style={{ padding: '7px 14px', background: d.color, color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              ⚡
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'trending' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,320px),1fr))', gap: 10 }}>
                {trending.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--ink-4)', fontSize: 14 }}>
                    Sem tendências identificadas ainda — são precisos mais dados da comunidade.
                  </div>
                ) : trending.map((insight, i) => <InsightCard key={i} insight={insight} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}