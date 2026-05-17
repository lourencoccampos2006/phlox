'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'

interface Highlight { type: 'positive' | 'warning' | 'info'; text: string }
interface Trend { metric: string; trend: 'subiu' | 'desceu' | 'estável' | 'sem dados'; comment: string }
interface Recommendation { priority: 'urgente' | 'importante' | 'sugestão'; action: string }

interface Report {
  title: string
  period: string
  overall_score: number
  overall_label: string
  highlights: Highlight[]
  vitals_analysis: string
  adherence_comment: string
  trends: Trend[]
  recommendations: Recommendation[]
  next_steps: string
  disclaimer: string
  generated_at: string
  raw_data: { adherence: number | null; total_meds: number; vitals_count: number }
}

const TREND_ICON: Record<string, string> = { subiu: '↑', desceu: '↓', estável: '→', 'sem dados': '—' }
const TREND_COLOR: Record<string, string> = { subiu: '#dc2626', desceu: '#2563eb', estável: '#059669', 'sem dados': '#9ca3af' }
const PRIORITY_STYLE = {
  urgente:    { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', icon: '🚨' },
  importante: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠️' },
  sugestão:   { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: '💡' },
}
const HIGHLIGHT_STYLE = {
  positive: { icon: '✅', color: '#065f46', bg: '#d1fae5' },
  warning:  { icon: '⚠️', color: '#92400e', bg: '#fef9c3' },
  info:     { icon: 'ℹ️', color: '#1d4ed8', bg: '#eff6ff' },
}

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10
  const r = 38, cx = 48, cy = 48
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0px, -96px)`, fontSize: 22, fontWeight: 700, fill: color, fontFamily: 'monospace' }}>
        {score}
      </text>
    </svg>
  )
}

export default function RelatorioPage() {
  const { user, supabase } = useAuth()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao gerar relatório'); return }
      setReport(data)
    } catch (e: any) {
      setError(e.message || 'Erro de ligação')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Relatório Semanal</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para ver o teu relatório de saúde personalizado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="no-print"><Header /></div>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }} className="no-print">
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Relatório Semanal</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>O resumo da tua semana de saúde</div>
            </div>
            {report && (
              <button onClick={() => window.print()} style={{ padding: '9px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🖨️ Imprimir
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {!report ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Relatório Semanal de Saúde</div>
            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
              A AI analisa os teus medicamentos, sinais vitais e adesão da última semana e gera um relatório personalizado com recomendações.
            </div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '20px 0', flexWrap: 'wrap' }}>
              {[
                { icon: '💊', label: 'Medicação analisada' },
                { icon: '📈', label: 'Tendências de vitais' },
                { icon: '✅', label: 'Score de adesão' },
                { icon: '💡', label: 'Recomendações IA' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{item.label}</div>
                </div>
              ))}
            </div>
            {error && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}
            <button onClick={generate} disabled={loading} style={{
              padding: '14px 32px', background: loading ? '#9ca3af' : '#0f172a', color: 'white',
              border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            }}>
              {loading ? '⏳ A analisar a tua semana...' : '✨ Gerar o Meu Relatório'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header card */}
            <div style={{ background: '#0f172a', borderRadius: 16, padding: '24px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ScoreRing score={report.overall_score} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{report.period}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>{report.overall_label}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {report.raw_data.total_meds > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>💊 {report.raw_data.total_meds} medicamentos</span>}
                  {report.raw_data.vitals_count > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>📊 {report.raw_data.vitals_count} registos vitais</span>}
                  {report.raw_data.adherence != null && <span style={{ fontSize: 12, color: report.raw_data.adherence >= 80 ? '#6ee7b7' : '#fcd34d' }}>✓ {report.raw_data.adherence}% adesão</span>}
                </div>
              </div>
            </div>

            {/* Highlights */}
            {report.highlights.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.highlights.map((h, i) => {
                  const s = HIGHLIGHT_STYLE[h.type]
                  return (
                    <div key={i} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                      <span style={{ fontSize: 13, color: s.color }}>{h.text}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Trends */}
            {report.trends.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>📈 Tendências da semana</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {report.trends.map((t, i) => (
                    <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>{t.metric}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: TREND_COLOR[t.trend], fontFamily: 'var(--font-mono)' }}>
                        {TREND_ICON[t.trend]} <span style={{ fontSize: 12 }}>{t.trend}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{t.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vitals & Adherence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📊 Análise de sinais vitais</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.vitals_analysis || 'Sem dados suficientes.'}</div>
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>✅ Adesão à medicação</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.adherence_comment || 'Sem dados de tomas registados.'}</div>
              </div>
            </div>

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>💡 Recomendações personalizadas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {report.recommendations.map((r, i) => {
                    const s = PRIORITY_STYLE[r.priority]
                    return (
                      <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{r.priority}</div>
                          <div style={{ fontSize: 13, color: 'var(--ink)' }}>{r.action}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Next steps */}
            <div style={{ background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>🎯 Foco para a próxima semana</div>
              <div style={{ fontSize: 13, color: '#047857' }}>{report.next_steps}</div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', fontStyle: 'italic', flex: 1 }}>{report.disclaimer}</div>
              <button onClick={() => { setReport(null); }} className="no-print" style={{ padding: '8px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                ↩ Novo relatório
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@media print { .no-print { display: none !important } body { background: white !important } }`}</style>
    </div>
  )
}
