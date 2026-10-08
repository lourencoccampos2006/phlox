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
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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
const TREND_COLOR: Record<string, string> = { subiu: 'var(--red)', desceu: 'var(--ink-2)', estável: 'var(--green)', 'sem dados': 'var(--ink-5)' }
const PRIORITY_STYLE = {
  urgente:    { bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', color: 'var(--red)', icon: 'alert' },
  importante: { bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', color: 'var(--amber)', icon: '⚠️' },
  sugestão:   { bg: 'var(--bg-2)', border: 'var(--border)', color: 'var(--ink-2)', icon: 'spark' },
}
const HIGHLIGHT_STYLE = {
  positive: { icon: 'check', color: 'var(--green)', bg: 'var(--badge-green-bg)' },
  warning:  { icon: '⚠️', color: 'var(--amber)', bg: 'var(--amber-light)' },
  info:     { icon: 'ℹ️', color: 'var(--ink-2)', bg: 'var(--bg-2)' },
}

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10
  const r = 38, cx = 48, cy = 48
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = score >= 7 ? 'var(--green)' : score >= 5 ? 'var(--amber)' : 'var(--red)'
  return (
    <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0px, -96px)`, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, fill: color, fontFamily: 'monospace' }}>
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
  const [shareNudgeDismissed, setShareNudgeDismissed] = useState(false)

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
          records: report.recommendations.map(r => ({ title: r.action, tags: [{ label: r.priority, color: r.priority === 'urgente' ? 'var(--red)' : r.priority === 'importante' ? 'var(--amber)' : 'var(--ink-2)' }] })),
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
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)' }}>O resumo da sua saúde</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ProfileSelector onChange={p => setActiveProfileState(p)} />
          {report && (
            <>
              <button onClick={exportPDF} style={{ padding: '9px 16px', background: 'white', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>
                📄 Exportar PDF
              </button>
              <button onClick={() => window.print()} style={{ padding: '9px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>
                🖨️ Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {!report ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Relatório {period === 'month' ? 'Mensal' : 'Semanal'} de Saúde</div>
            <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
              O Phlox analisa a sua medicação, sinais vitais, sintomas e análises {period === 'month' ? 'do último mês' : 'da última semana'} e gera um relatório personalizado com recomendações.
            </div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '20px 0', flexWrap: 'wrap' }}>
              {[
                { icon: 'pill', label: 'Medicação' },
                { icon: 'chart', label: 'Vitais e sintomas' },
                { icon: 'flask', label: 'Análises' },
                { icon: 'spark', label: 'Recomendações' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--t-numero)', marginBottom: 4 }}><Icon name={item.icon} size={16} /></div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 3, marginBottom: 18, gap: 2 }}>
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '7px 16px', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer',
                  background: period === p ? 'var(--ink)' : 'transparent', color: period === p ? 'white' : 'var(--ink-4)',
                }}>
                  {p === 'week' ? 'Última semana' : 'Último mês'}
                </button>
              ))}
            </div>
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)', marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}
            <button onClick={generate} disabled={loading} style={{
              padding: '14px 32px', background: loading ? 'var(--ink-5)' : 'var(--ink)', color: 'white',
              border: 'none', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, cursor: loading ? 'wait' : 'pointer',
            }}>
              {loading ? `⏳ A analisar o seu ${period === 'month' ? 'mês' : 'semana'}...` : `Gerar o meu relatório ${period === 'month' ? 'mensal' : 'semanal'}`}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ background: 'var(--ink)', borderRadius: 'var(--r-xl)', padding: '24px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ScoreRing score={report.overall_score} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--t-meta)', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{report.period}</div>
                <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'white', marginBottom: 4 }}>{report.overall_label}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {report.raw_data.total_meds > 0 && <span style={{ fontSize: 'var(--t-meta)', color: 'rgba(255,255,255,0.6)' }}>{report.raw_data.total_meds} medicamentos</span>}
                  {report.raw_data.vitals_count > 0 && <span style={{ fontSize: 'var(--t-meta)', color: 'rgba(255,255,255,0.6)' }}>{report.raw_data.vitals_count} registos vitais</span>}
                  {report.raw_data.adherence != null && <span style={{ fontSize: 'var(--t-meta)', color: report.raw_data.adherence >= 80 ? 'var(--green-mid)' : 'var(--badge-amber-border)' }}>✓ {report.raw_data.adherence}% adesão</span>}
                </div>
              </div>
            </div>

            {report.highlights.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.highlights.map((h, i) => {
                  const s = HIGHLIGHT_STYLE[h.type]
                  return (
                    <div key={i} style={{ background: s.bg, borderRadius: 'var(--r-lg)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Icon name={s.icon} size={16} />
                      <span style={{ fontSize: 'var(--t-dado)', color: s.color }}>{h.text}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {report.trends.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>Tendências da semana</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {report.trends.map((t, i) => (
                    <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 4 }}>{t.metric}</div>
                      <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: TREND_COLOR[t.trend], fontFamily: 'var(--font-mono)' }}>
                        {TREND_ICON[t.trend]} <span style={{ fontSize: 'var(--t-meta)' }}>{t.trend}</span>
                      </div>
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>{t.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Análise de sinais vitais</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.vitals_analysis || 'Sem dados suficientes.'}</div>
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Adesão à medicação</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.adherence_comment || 'Sem dados de tomas registados.'}</div>
              </div>
              {report.symptoms_analysis && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Sintomas da semana</div>
                  <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.symptoms_analysis}</div>
                </div>
              )}
              {report.labs_note && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Análises recentes</div>
                  <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{report.labs_note}</div>
                </div>
              )}
            </div>

            {report.recommendations.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>Recomendações personalizadas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {report.recommendations.map((r, i) => {
                    const s = PRIORITY_STYLE[r.priority]
                    return (
                      <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.color}`, borderRadius: 'var(--r-md)', padding: '10px 14px', display: 'flex', gap: 8 }}>
                        <Icon name={s.icon} size={16} />
                        <div>
                          <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{r.priority}</div>
                          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>{r.action}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ background: 'var(--badge-green-bg)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-xl)', padding: 16 }}>
              <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', marginBottom: 6 }}>Foco para a próxima {period === 'month' ? 'mês' : 'semana'}</div>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--green)' }}>{report.next_steps}</div>
            </div>

            {/* Nudge de partilha (item C14) — só depois de um momento de satisfação
                GENUÍNA (pontuação alta, calculada pela IA a partir dos dados reais),
                nunca por defeito nem repetidamente. Dispensável por sessão. */}
            {report.overall_score >= 8 && !shareNudgeDismissed && (
              <div className="no-print" style={{ background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-xl)', padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--t-destaque)' }}>🌱</span>
                <div style={{ flex: 1, minWidth: 200, fontSize: 'var(--t-meta)', color: 'var(--roxo-escuro)' }}>Boa {period === 'month' ? 'mês' : 'semana'}! Se o Phlox te tem ajudado, conheces mais alguém a quem isto podia servir?</div>
                <a href="/reach" style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'white', background: 'var(--roxo)', padding: '7px 14px', borderRadius: 'var(--r-md)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Convidar →</a>
                <button onClick={() => setShareNudgeDismissed(true)} style={{ fontSize: 'var(--t-meta)', color: 'var(--roxo-meio)', background: 'none', border: 'none', cursor: 'pointer' }}>Agora não</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', fontStyle: 'italic', flex: 1 }}>{report.disclaimer}</div>
              <button onClick={() => { setReport(null); }} className="no-print" style={{ padding: '8px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', cursor: 'pointer', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
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
  { id: 'diario', label: 'Diário', icon: 'clock' },
  { id: 'semanal', label: 'Relatório Semanal', icon: 'chart' },
  { id: 'bolso', label: 'Médico de Bolso', icon: 'stethoscope' },
  { id: 'plano', label: 'Plano de Cuidado', icon: 'clipboard' },
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
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Relatório</span>
        </BarraDeTrabalho>
      }
    >
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginTop: 12 }}>Relatórios & Planos</div>
        <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para ver os teus relatórios e planos de saúde.</div>
      </div>
    </Mesa>
  )

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Relatório</span>
        </BarraDeTrabalho>
      }
    >
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }} className="no-print">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '9px 14px', background: 'none', border: 'none',
              borderBottom: `2.5px solid ${tab === t.id ? 'var(--green)' : 'transparent'}`,
              cursor: 'pointer', fontSize: 'var(--t-dado)', fontWeight: tab === t.id ? 800 : 600,
              color: tab === t.id ? 'var(--green)' : 'var(--ink-4)', marginBottom: -1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span><Icon name={t.icon} size={16} /></span>{t.label}
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
    </Mesa>
  )
}
