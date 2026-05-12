'use client'

// components/HealthInsights.tsx
// Painel de insights de saúde integrados — aparece no registo de saúde
// e na dashboard pessoal/cuidador.
// Analisa automaticamente medicação + análises + vitais em conjunto.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Insight {
  type: 'trend' | 'connection' | 'alert' | 'improvement' | 'monitoring'
  priority: 'ALTA' | 'MEDIA' | 'BAIXA'
  title: string
  finding: string
  explanation: string
  action: string
}

interface LabTrend {
  parameter: string
  trend: 'stable' | 'improving' | 'worsening' | 'new'
  change: string
  significance: string
}

interface NextAction {
  action: string
  urgency: 'IMEDIATA' | 'PROXIMA_CONSULTA' | 'PROXIMAS_ANALISES'
  reason: string
}

interface HealthContext {
  summary: string
  overall_status: 'BOM' | 'ATENÇÃO' | 'CONSULTA_RECOMENDADA' | 'CONSULTA_URGENTE'
  insights: Insight[]
  connections: string[]
  lab_trends: LabTrend[]
  medication_lab_connections: string[]
  next_actions: NextAction[]
  missing_monitoring: string[]
}

interface Props {
  profileId?: string | null
  trigger?: string
  onNewData?: (data: any) => void
  compact?: boolean
}

const STATUS_STYLE = {
  BOM:                   { color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0', label: 'Estado geral bom' },
  ATENÇÃO:               { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Atenção recomendada' },
  CONSULTA_RECOMENDADA:  { color: '#d97706', bg: '#fff7ed', border: '#fed7aa', label: 'Consulta recomendada' },
  CONSULTA_URGENTE:      { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', label: 'Consulta urgente' },
}

const PRIORITY_DOT = {
  ALTA:  '#dc2626',
  MEDIA: '#d97706',
  BAIXA: '#64748b',
}

const TREND_ICON = {
  improving: { icon: '↑', color: '#0d6e42' },
  worsening: { icon: '↓', color: '#dc2626' },
  stable:    { icon: '→', color: '#64748b' },
  new:       { icon: '·', color: '#1d4ed8' },
}

const URGENCY_STYLE = {
  IMEDIATA:         { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  PROXIMA_CONSULTA: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PROXIMAS_ANALISES:{ color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
}

export default function HealthInsights({ profileId = null, trigger = 'manual', compact = false }: Props) {
  const { supabase } = useAuth()
  const [context, setContext] = useState<HealthContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'insights' | 'trends' | 'actions'>('insights')

  const analyse = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/health-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile_id: profileId, trigger }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContext(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar.')
    } finally {
      setLoading(false)
    }
  }, [supabase, profileId, trigger])

  // Auto-analyse on mount only if not compact mode
  useEffect(() => {
    if (!compact) return
    analyse()
  }, [profileId, compact, analyse])

  const statusStyle = context ? STATUS_STYLE[context.overall_status] || STATUS_STYLE.BOM : null

  if (compact && !context && !loading) return (
    <button onClick={analyse}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s', fontFamily: 'var(--font-sans)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Análise integrada de saúde</div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Conecta medicação + análises + sinais vitais</div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>Analisar →</div>
    </button>
  )

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Análise Integrada de Saúde</span>
          </div>
          {context && statusStyle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusStyle.color }} />
              <span style={{ fontSize: 12, color: statusStyle.color, fontWeight: 600 }}>{statusStyle.label}</span>
            </div>
          )}
        </div>
        <button onClick={analyse} disabled={loading}
          style={{ padding: '7px 14px', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? (
            <>
              <div style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              A analisar...
            </>
          ) : context ? '↻ Reanalisar' : 'Analisar'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fee2e2', borderBottom: '1px solid #fca5a5', fontSize: 13, color: '#991b1b' }}>{error}</div>
      )}

      {loading && !context && (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>A conectar medicação + análises + sinais vitais...</div>
        </div>
      )}

      {context && (
        <>
          {/* Summary */}
          <div style={{ padding: '14px 18px', background: statusStyle?.bg, borderBottom: `1px solid ${statusStyle?.border}` }}>
            <p style={{ fontSize: 14, color: statusStyle?.color, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{context.summary}</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            {[
              { id: 'insights', label: `Insights${context.insights?.length ? ` (${context.insights.length})` : ''}` },
              { id: 'trends', label: `Tendências${context.lab_trends?.length ? ` (${context.lab_trends.length})` : ''}` },
              { id: 'actions', label: `Acções${context.next_actions?.length ? ` (${context.next_actions.length})` : ''}` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--green)' : 'transparent'}`, cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? 'var(--green)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: '16px 18px' }}>

            {tab === 'insights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {context.insights?.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0' }}>Sem insights adicionais. Adiciona mais dados para uma análise mais completa.</div>
                )}
                {context.insights?.map((ins, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${PRIORITY_DOT[ins.priority]}`, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[ins.priority], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{ins.title}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: PRIORITY_DOT[ins.priority], textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ins.priority}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 6px' }}>{ins.finding}</p>
                    {ins.explanation && <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, margin: '0 0 6px' }}>{ins.explanation}</p>}
                    {ins.action && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>→</span>{ins.action}
                      </div>
                    )}
                  </div>
                ))}

                {/* Connections */}
                {context.connections?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Conexões encontradas</div>
                    {context.connections.map((c, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 12, color: '#5b21b6', lineHeight: 1.6, marginBottom: 5 }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}

                {/* Medication-lab connections */}
                {context.medication_lab_connections?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Medicação ↔ Análises</div>
                    {context.medication_lab_connections.map((c, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, color: '#1e40af', lineHeight: 1.6, marginBottom: 5 }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'trends' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {context.lab_trends?.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0' }}>Sem análises em múltiplas datas para comparar tendências.</div>
                )}
                {context.lab_trends?.map((t, i) => {
                  const ti = TREND_ICON[t.trend] || TREND_ICON.stable
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, alignItems: 'flex-start' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${ti.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: ti.color, fontWeight: 700, flexShrink: 0 }}>
                        {ti.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t.parameter}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: ti.color, fontWeight: 700 }}>{t.change}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{t.significance}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {context.next_actions?.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0' }}>Sem acções urgentes identificadas.</div>
                )}
                {context.next_actions?.map((a, i) => {
                  const us = URGENCY_STYLE[a.urgency] || URGENCY_STYLE.PROXIMA_CONSULTA
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: us.bg, border: `1px solid ${us.border}`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: us.color, background: `${us.color}15`, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, marginTop: 1 }}>
                          {a.urgency === 'IMEDIATA' ? 'Urgente' : a.urgency === 'PROXIMA_CONSULTA' ? 'Próx. consulta' : 'Próx. análises'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: us.color }}>{a.action}</span>
                      </div>
                      <div style={{ fontSize: 12, color: us.color, opacity: 0.8, lineHeight: 1.5 }}>{a.reason}</div>
                    </div>
                  )
                })}

                {/* Missing monitoring */}
                {context.missing_monitoring?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Monitorização em falta</div>
                    {context.missing_monitoring.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 5 }}>
                        <span style={{ color: '#d97706', flexShrink: 0 }}>?</span>{m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}