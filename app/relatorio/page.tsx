'use client'

// /relatorio — Relatórios & Planos. Fundiu 4 páginas antigas em separadores reais
// (não redirects): Diário (era /brief, grátis), Relatório Semanal (o que já
// estava aqui, Pro), Médico de Bolso (era /medico-bolso, grátis), Plano de
// Cuidado (era /plano, Plus+) e Briefing de Consulta (era /briefing, Pro).
// O gate de plano deixou de ser a rota inteira (removido de PLAN_ROUTES) — cada
// separador paga gere o seu próprio gate (PlanGate aqui, isPro/canGenerate nos
// componentes extraídos), para não bloquear os separadores grátis.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import PlanGate from '@/components/PlanGate'
import DailyBrief from '@/components/relatorio/DailyBrief'
import MedicoBolso from '@/components/relatorio/MedicoBolso'
import CarePlan from '@/components/relatorio/CarePlan'
import BriefingConsulta from '@/components/relatorio/BriefingConsulta'
import { printDoc } from '@/lib/print'

interface Highlight { type: 'positive' | 'warning' | 'info'; text: string }
interface Trend { metric: string; trend: 'subiu' | 'desceu' | 'estável' | 'sem dados'; comment: string }
interface Recommendation { priority: 'urgente' | 'importante' | 'sugestão'; action: string }

interface Report {
  title: string
  period_kind?: 'week' | 'month'
  period: string
  overall_score: number
  overall_label: string
  highlights: Highlight[]
  vitals_analysis: string
  symptoms_analysis?: string
  labs_note?: string
  adherence_comment: string
  trends: Trend[]
  recommendations: Recommendation[]
  next_steps: string
  disclaimer: string
  generated_at: string
  raw_data: { adherence: number | null; total_meds: number; vitals_count: number; symptoms_count?: number; labs_count?: number }
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

// ─── Relatório Semanal (conteúdo original de /relatorio, agora um separador) ──
function WeeklyReport() {
  const { user, supabase } = useAuth()
  const [, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  const generate = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ period }),
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

  function exportPDF() {
    if (!report) return
    printDoc({
      docTitle: report.title,
      docSubtitle: report.period,
      meta: [
        { label: 'pontuação', value: `${report.overall_score}/10` },
        ...(report.raw_data.adherence != null ? [{ label: 'adesão', value: `${report.raw_data.adherence}%` }] : []),
      ],
      sections: [
        {
          heading: 'Resumo',
          records: [{ title: report.overall_label, bullets: report.highlights.map(h => h.text) }],
        },
        ...(report.trends.length ? [{
          heading: 'Tendências',
          records: report.trends.map(t => ({ title: t.metric, meta: `${t.trend}${t.comment ? ' — ' + t.comment : ''}` })),
        }] : []),
        {
          heading: 'Análise',
          records: [
            { title: 'Sinais vitais', body: report.vitals_analysis || 'Sem dados suficientes.' },
            { title: 'Adesão à medicação', body: report.adherence_comment || 'Sem dados de tomas registados.' },
            ...(report.symptoms_analysis ? [{ title: 'Sintomas', body: report.symptoms_analysis }] : []),
            ...(report.labs_note ? [{ title: 'Análises recentes', body: report.labs_note }] : []),
          ],
        },
        ...(report.recommendations.length ? [{
          heading: 'Recomendações',
          records: report.recommendations.map(r => ({ title: r.action, tags: [{ label: r.priority, color: r.priority === 'urgente' ? '#dc2626' : r.priority === 'importante' ? '#b45309' : '#1d4ed8' }] })),
        }] : []),
        {
          heading: 'Foco seguinte',
          records: [{ title: report.next_steps }],
        },
      ],
      footerNote: report.disclaimer,
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }} className="no-print">
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)' }}>O resumo da sua saúde</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ProfileSelector onChange={p => setActiveProfileState(p)} />
          {report && (
            <>
              <button onClick={exportPDF} style={{ padding: '9px 16px', background: 'white', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                📄 Exportar PDF
              </button>
              <button onClick={() => window.print()} style={{ padding: '9px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🖨️ Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {!report ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Relatório {period === 'month' ? 'Mensal' : 'Semanal'} de Saúde</div>
            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
              O Phlox analisa a sua medicação, sinais vitais, sintomas e análises {period === 'month' ? 'do último mês' : 'da última semana'} e gera um relatório personalizado com recomendações.
            </div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '20px 0', flexWrap: 'wrap' }}>
              {[
                { icon: '💊', label: 'Medicação' },
                { icon: '📈', label: 'Vitais e sintomas' },
                { icon: '🧪', label: 'Análises' },
                { icon: '💡', label: 'Recomendações' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 18, gap: 2 }}>
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  background: period === p ? '#0f172a' : 'transparent', color: period === p ? 'white' : 'var(--ink-4)',
                }}>
                  {p === 'week' ? 'Última semana' : 'Último mês'}
                </button>
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
              {loading ? `⏳ A analisar o seu ${period === 'month' ? 'mês' : 'semana'}...` : `✨ Gerar o meu relatório ${period === 'month' ? 'mensal' : 'semanal'}`}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📊 Análise de sinais vitais</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.vitals_analysis || 'Sem dados suficientes.'}</div>
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>✅ Adesão à medicação</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.adherence_comment || 'Sem dados de tomas registados.'}</div>
              </div>
              {report.symptoms_analysis && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>🩹 Sintomas da semana</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.symptoms_analysis}</div>
                </div>
              )}
              {report.labs_note && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>🧪 Análises recentes</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.labs_note}</div>
                </div>
              )}
            </div>

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

            <div style={{ background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>🎯 Foco para a próxima semana</div>
              <div style={{ fontSize: 13, color: '#047857' }}>{report.next_steps}</div>
            </div>

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

// ─── Hub ────────────────────────────────────────────────────────────────────
type Tab = 'diario' | 'semanal' | 'bolso' | 'plano' | 'consulta'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'diario', label: 'Diário', icon: '☀️' },
  { id: 'semanal', label: 'Relatório Semanal', icon: '📊' },
  { id: 'bolso', label: 'Médico de Bolso', icon: '🩺' },
  { id: 'plano', label: 'Plano de Cuidado', icon: '📋' },
  { id: 'consulta', label: 'Briefing de Consulta', icon: '⚕️' },
]

export default function RelatorioPage() {
  const { user } = useAuth() as any
  const [tab, setTab] = useState<Tab>('diario')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some(x => x.id === t)) setTab(t as Tab)
  }, [])

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Relatórios & Planos</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para ver os teus relatórios e planos de saúde.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }} className="no-print">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '9px 14px', background: 'none', border: 'none',
              borderBottom: `2.5px solid ${tab === t.id ? 'var(--green)' : 'transparent'}`,
              cursor: 'pointer', fontSize: 13.5, fontWeight: tab === t.id ? 800 : 600,
              color: tab === t.id ? 'var(--green)' : 'var(--ink-4)', marginBottom: -1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {tab === 'diario' && <DailyBrief />}
        {tab === 'semanal' && (
          <PlanGate min="pro" tool="Relatório Semanal" note="Análise por IA da tua semana de saúde — medicação, vitais, sintomas e análises.">
            <WeeklyReport />
          </PlanGate>
        )}
        {tab === 'bolso' && <MedicoBolso />}
        {tab === 'plano' && <CarePlan />}
        {tab === 'consulta' && <BriefingConsulta />}
      </div>
    </div>
  )
}
