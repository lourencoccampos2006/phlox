'use client'

// /tendencias — Painel de tendências. Complementa o /radar (o que saiu do
// padrão HOJE) com uma leitura de 2-3 semanas: humor, alimentação, adesão à
// medicação, ocorrências e avaliações, por pessoa. O objetivo é apanhar a
// quebra lenta e silenciosa — sem nenhum dia mau isolado que o /radar já
// assinalaria. Ver lib/trendSignals.ts para o motor e a lógica dos limiares.
// Pesquisa competitiva (Nourish Care), 2026-07-28.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc } from '@/lib/print'
import { usePhloxContext } from '@/lib/copilotContext'
import {
  buildResidentTrend, rankByTrendAttention, TREND_DISCLAIMER,
  TREND_WINDOW_DAYS, INCIDENT_WINDOW_DAYS, ASSESSMENT_WINDOW_DAYS,
  type ResidentTrend, type MetricTrend, type SparkPoint, type TrendActivityRow,
} from '@/lib/trendSignals'

const ACCENT = '#0f766e'
const ACCENT_BG = '#f0fdfa'

const daysAgoISO = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

interface PatientLite { id: string; name: string; room_number?: string | null }

const LEVEL_STYLE: Record<ResidentTrend['level'], { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'A vigiar' },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'A vigiar' },
  info: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'A completar' },
  good: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Estável' },
}

export default function TendenciasPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<ResidentTrend[]>([])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'attention' | 'all'>('attention')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const safe = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }

    const [p, care, mar, inc, assess, acts] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      safe(scope.filter(supabase.from('care_records').select('patient_id,date,mood,nutrition')).gte('date', daysAgoISO(TREND_WINDOW_DAYS - 1))),
      safe(scope.filter(supabase.from('mar_records').select('patient_id,date,status')).gte('date', daysAgoISO(TREND_WINDOW_DAYS - 1))),
      safe(scope.filter(supabase.from('incidents').select('patient_id,date,severity')).gte('date', daysAgoISO(INCIDENT_WINDOW_DAYS - 1))),
      safe(scope.filter(supabase.from('assessments').select('patient_id,scale,date,score')).gte('date', daysAgoISO(ASSESSMENT_WINDOW_DAYS - 1))),
      safe(scope.filter(supabase.from('activities').select('id,date')).gte('date', daysAgoISO(TREND_WINDOW_DAYS - 1))),
    ])
    if (p.error) { setErr('Não foi possível carregar. Verifica a ligação.'); setLoading(false); return }

    const patients: PatientLite[] = p.data || []
    const by = <T,>(rows: T[], key: (r: T) => string): Record<string, T[]> => {
      const m: Record<string, T[]> = {}; rows.forEach(r => { (m[key(r)] ||= []).push(r) }); return m
    }
    const careBy = by(care.data || [], (r: any) => r.patient_id)
    const marBy = by(mar.data || [], (r: any) => r.patient_id)
    const incBy = by(inc.data || [], (r: any) => r.patient_id)
    const assessBy = by(assess.data || [], (r: any) => r.patient_id)

    // Participação em atividades — activity_participations não tem `date`
    // própria (vive em `activities`); busca-se as atividades da janela e
    // depois quem participou nelas, e junta-se pelo activity_id.
    const actIds = (acts.data || []).map((a: any) => a.id)
    const actDateById: Record<string, string> = {}
    ;(acts.data || []).forEach((a: any) => { actDateById[a.id] = a.date })
    const partsRes = actIds.length
      ? await safe(supabase.from('activity_participations').select('patient_id,activity_id,attended').in('activity_id', actIds).eq('attended', true))
      : { data: [] }
    const activityBy: Record<string, TrendActivityRow[]> = {}
    ;(partsRes.data || []).forEach((r: any) => {
      const date = actDateById[r.activity_id]
      if (!date) return
      ;(activityBy[r.patient_id] ||= []).push({ patient_id: r.patient_id, date })
    })

    const out = patients.map(pt => buildResidentTrend({
      patient: pt,
      care: careBy[pt.id] || [],
      mar: marBy[pt.id] || [],
      incidents: incBy[pt.id] || [],
      assessments: assessBy[pt.id] || [],
      activities: activityBy[pt.id] || [],
    }))
    setResults(rankByTrendAttention(out))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({
    supabase, userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load,
    table: ['patients', 'care_records', 'mar_records', 'incidents', 'assessments', 'activity_participations'],
  })

  const needAttention = useMemo(() => results.filter(r => r.level === 'critical' || r.level === 'warning'), [results])
  const stable = useMemo(() => results.filter(r => r.level !== 'critical' && r.level !== 'warning' && r.hasEnoughData), [results])
  const noData = useMemo(() => results.filter(r => !r.hasEnoughData), [results])
  const effectiveFilter: 'attention' | 'all' = filter === 'attention' && needAttention.length === 0 ? 'all' : filter
  const shown = effectiveFilter === 'attention' ? needAttention : results

  usePhloxContext(
    results.length ? 'Tendências de 2-3 semanas' : '',
    results.length ? { a_vigiar: needAttention.slice(0, 8).map(r => `${r.name}: ${r.flags.map(f => f.title).join(', ')}`) } : null as any
  )

  function toggle(id: string) { setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  function printBriefing() {
    const records = needAttention.map(r => ({
      title: `${r.name}${cfg.hasBeds && r.room ? ` · ${cfg.roomLabel} ${r.room}` : ''}`,
      meta: `Pontos: ${r.flags.length}`,
      bullets: r.flags.map(f => `${f.title} — ${f.detail}`),
    }))
    printDoc({
      docTitle: `Tendências de 2-3 semanas — ${cfg.unitNoun}`,
      docSubtitle: new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      sections: [{ heading: `${cfg.personNounPlural} com tendência a vigiar`, records: records.length ? records : [{ title: 'Sem tendências a vigiar de momento' }] }],
      footerNote: TREND_DISCLAIMER,
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 70px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>
          {cfg.unitNoun} · Tendências
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Tendências ao longo de 2-3 semanas
        </h1>
        <p style={{ fontSize: 14.5, color: '#475569', margin: '0 0 14px', lineHeight: 1.55 }}>
          Humor, alimentação, adesão à medicação, ocorrências e avaliações — por {cfg.personNoun.toLowerCase()}, ao longo do tempo. Uma quebra gradual de várias semanas raramente aparece num único dia.
        </p>

        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 18 }}>
          ⓘ {TREND_DISCLAIMER}
        </div>

        {/* Resumo + ações */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '10px 16px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: needAttention.length ? '#d97706' : '#16a34a' }}>{needAttention.length}</span>
            <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>{cfg.personNounPlural?.toLowerCase() || 'pessoas'} com tendência a vigiar</span>
          </div>
          {stable.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '10px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{stable.length}</span>
              <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>estáve{stable.length === 1 ? 'l' : 'is'}</span>
            </div>
          )}
          {noData.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '10px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: '#94a3b8' }}>{noData.length}</span>
              <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>sem dados suficientes ainda</span>
            </div>
          )}
          {needAttention.length > 0 && (
            <button onClick={printBriefing} style={{ marginLeft: 'auto', padding: '9px 16px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}55`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Imprimir para a equipa
            </button>
          )}
        </div>

        {/* Filtro */}
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['attention', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 14px', borderRadius: 8, fontFamily: 'var(--font-sans)',
                border: `1.5px solid ${effectiveFilter === f ? ACCENT : '#e2e8f0'}`,
                background: effectiveFilter === f ? ACCENT_BG : 'white',
                color: effectiveFilter === f ? ACCENT : '#64748b',
                fontSize: 12.5, fontWeight: effectiveFilter === f ? 700 : 500, cursor: 'pointer',
              }}>
                {f === 'attention' ? `A vigiar (${needAttention.length})` : `Todos (${results.length})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 14 }} />)}</div>
        ) : err ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 18, color: '#991b1b', fontSize: 14 }}>{err}</div>
        ) : results.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 12 }}><Icon name="chart" size={36} color="#cbd5e1" /></div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#0b1120', marginBottom: 8 }}>Ainda sem {cfg.personNounPlural?.toLowerCase() || 'utentes'}</div>
            <Link href="/patients" style={{ display: 'inline-block', padding: '12px 24px', background: ACCENT, color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Adicionar {cfg.personNoun?.toLowerCase()}</Link>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '28px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#15803d' }}>Sem tendências a vigiar nas últimas semanas.</div>
            <div style={{ fontSize: 13, color: '#16a34a', marginTop: 4 }}>Continuem a registar os cuidados — é isso que alimenta esta vista.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map(r => {
              const st = LEVEL_STYLE[r.level]
              const isOpen = open.has(r.patientId)
              return (
                <div key={r.patientId} style={{ background: 'white', border: `1px solid ${r.level === 'critical' ? '#fca5a5' : r.level === 'warning' ? '#fde68a' : '#e9eaec'}`, borderRadius: 16, overflow: 'hidden' }}>
                  <button onClick={() => toggle(r.patientId)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: st.bg, border: `1.5px solid ${st.border}`, color: st.color, fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textAlign: 'center', lineHeight: 1.1 }}>
                      {r.hasEnoughData ? st.label.split(' ')[0] : '—'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: '#0b1120' }}>{r.name}{cfg.hasBeds && r.room ? ` · ${cfg.roomLabel[0]}${r.room}` : ''}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: st.color, marginTop: 1 }}>
                        {!r.hasEnoughData
                          ? 'Ainda sem dados suficientes para uma leitura de tendência.'
                          : r.flags.length
                            ? `${r.flags.slice(0, 2).map(f => f.title).join(' · ')}${r.flags.length > 2 ? ` · +${r.flags.length - 2}` : ''}`
                            : 'Sem sinais a vigiar nas últimas semanas.'}
                      </span>
                    </span>
                    <span style={{ fontSize: 18, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
                  </button>
                  {isOpen && <ResidentDetail r={r} cfg={cfg} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ResidentDetail({ r, cfg }: { r: ResidentTrend; cfg: ReturnType<typeof institutionConfig> }) {
  const { supabase } = useAuth() as any
  const [narrative, setNarrative] = useState('')
  const [loadingNarrative, setLoadingNarrative] = useState(false)
  const [narrativeErr, setNarrativeErr] = useState('')

  async function genNarrative() {
    setLoadingNarrative(true); setNarrativeErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/tendencias/narrative', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({
          name: r.name, hasEnoughData: r.hasEnoughData,
          flags: r.flags.map(f => ({ title: f.title, detail: f.detail, severity: f.severity })),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Não consegui gerar agora.')
      setNarrative(d.narrative)
    } catch (e: any) { setNarrativeErr(e.message) }
    setLoadingNarrative(false)
  }

  return (
    <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f1f5f9' }}>
      {r.flags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {!narrative && !loadingNarrative && (
            <button onClick={genNarrative} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#5b21b6', cursor: 'pointer' }}>
              ✨ Resumo em palavras (IA)
            </button>
          )}
          {loadingNarrative && <div style={{ fontSize: 12.5, color: '#7c3aed' }}>A escrever…</div>}
          {narrativeErr && <div style={{ fontSize: 12, color: '#dc2626' }}>{narrativeErr}</div>}
          {narrative && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#4c1d95', lineHeight: 1.6 }}>
              {narrative}
            </div>
          )}
        </div>
      )}
      {r.flags.length > 0 && (
        <div style={{ marginTop: 14, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sinais encontrados</div>
          {r.flags.map((f, i) => {
            const c = f.severity === 'critical' ? { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' } : f.severity === 'warning' ? { color: '#d97706', bg: '#fffbeb', border: '#fde68a' } : { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }
            return (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 13px', marginBottom: 7 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: c.color }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
        Registo diário · últimos {r.metrics[0]?.points.length || 21} dias
      </div>
      <div className="trend-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {r.metrics.map(m => <MetricBlock key={m.key} m={m} />)}
      </div>

      {(r.incidents.recentCount > 0 || r.incidents.baselineCount > 0) && (
        <div style={{ marginTop: 14, background: r.incidents.rising ? '#fffbeb' : '#f8fafc', border: `1px solid ${r.incidents.rising ? '#fde68a' : '#e2e8f0'}`, borderRadius: 10, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: '#374151' }}>Ocorrências: <b>{r.incidents.recentCount}</b> nos últimos 14 dias · {r.incidents.baselineCount} nos 14 anteriores</span>
          {r.incidents.rising && <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>▲ a repetir-se</span>}
        </div>
      )}

      {r.assessments.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Avaliações</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {r.assessments.map(a => {
              const color = a.direction === 'agravou' ? (a.concerning ? '#dc2626' : '#d97706') : a.direction === 'melhorou' ? '#16a34a' : '#64748b'
              const arrow = a.direction === 'agravou' ? '▼' : a.direction === 'melhorou' ? '▲' : a.direction === 'sem alteração' ? '→' : ''
              return (
                <div key={a.scale} style={{ border: '1px solid #e2e8f0', borderRadius: 9, padding: '7px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0b1120' }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color, marginTop: 2 }}>
                    {a.previousScore != null ? `${a.previousScore} → ${a.latestScore} pts ${arrow}` : `${a.latestScore} pts (1ª avaliação)`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <Link href={`/patients/${r.patientId}`} style={{ fontSize: 12.5, fontWeight: 700, color: 'white', background: ACCENT, borderRadius: 9, padding: '8px 14px', textDecoration: 'none' }}>Abrir ficha</Link>
        <Link href={`/care-log?patient=${r.patientId}`} style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, background: 'white', border: `1.5px solid ${ACCENT}`, borderRadius: 9, padding: '8px 14px', textDecoration: 'none' }}>Registar o dia</Link>
      </div>

      <style>{`@media(max-width:640px){.trend-metrics{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

function MetricBlock({ m }: { m: MetricTrend }) {
  const chip = !m.reliable
    ? { label: 'dados insuficientes', color: '#94a3b8', bg: '#f8fafc' }
    : m.declining
      ? { label: m.severity === 'critical' ? '▼▼ a descer' : '▼ a descer', color: m.severity === 'critical' ? '#dc2626' : '#d97706', bg: m.severity === 'critical' ? '#fef2f2' : '#fffbeb' }
      : (m.delta != null && m.delta > 0.001)
        ? { label: '▲ a melhorar', color: '#16a34a', bg: '#f0fdf4' }
        : { label: '→ estável', color: '#64748b', bg: '#f8fafc' }
  const fmt = (v: number | null) => v == null ? '—' : m.unit === '%' ? `${Math.round(v)}%` : `${v.toFixed(1)}${m.unit}`
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120' }}>{m.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: chip.color, background: chip.bg, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{chip.label}</span>
      </div>
      <Spark points={m.points} scaleMax={m.scaleMax} color={ACCENT} />
      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 7, lineHeight: 1.5 }}>
        últimos 7d: <b style={{ color: '#0b1120' }}>{fmt(m.recentAvg)}</b><br />2 sem. antes: {fmt(m.baselineAvg)}
      </div>
    </div>
  )
}

// Sparkline leve em barras (sem biblioteca de gráficos) — os últimos 7 dias
// (janela "recente") ficam na cor cheia; os 14 dias anteriores ("baseline",
// o que é habitual) ficam esbatidos, para o próprio gráfico mostrar a
// comparação que o motor faz. Dias sem registo ficam com uma barra mínima
// cinzenta — não é "zero", é "não sabemos".
function Spark({ points, scaleMax, color }: { points: SparkPoint[]; scaleMax: number; color: string }) {
  const H = 36
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: H }}>
      {points.map((p, i) => {
        const isRecent = i >= points.length - 7
        const h = p.value == null ? 3 : Math.max(3, Math.round((Math.min(p.value, scaleMax) / scaleMax) * H))
        const bg = p.value == null ? '#e2e8f0' : (isRecent ? color : color + '4a')
        const label = p.value == null ? 'sem registo' : (scaleMax <= 5 ? p.value.toFixed(1) : `${Math.round(p.value)}%`)
        return <div key={p.date} title={`${p.date}: ${label}`} style={{ width: 5, height: h, background: bg, borderRadius: '2px 2px 0 0', flexShrink: 0 }} />
      })}
    </div>
  )
}
