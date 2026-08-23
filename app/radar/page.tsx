'use client'

// /radar — "O que pode merecer a vossa atenção hoje" (briefing matinal da equipa).
// FERRAMENTA ORGANIZACIONAL: reúne TUDO o que a equipa registou sobre cada utente
// e destaca o que saiu do padrão habitual ou ficou por fazer — para a equipa não
// deixar escapar nada. NÃO é um dispositivo médico: não prevê, não diagnostica,
// não estratifica risco clínico. A avaliação e a decisão são do profissional.
// Ronda 5, 2026-06-30.

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, currentShiftFor } from '@/lib/institutionConfig'
import { useLiveData } from '@/lib/useLiveData'
import { SEVERITY_STYLE } from '@/lib/residentSignals'
import { CARE_DISCLAIMER, type CareResult } from '@/lib/careSignals'
import type { ResidentTrend } from '@/lib/trendSignals'
import { loadSentinel, combinedLevel, combinedScore, SEV_ORDER, SENTINEL_LIVE_TABLES } from '@/lib/sentinel'
import { printDoc } from '@/lib/print'
import { usePhloxContext } from '@/lib/copilotContext'

// Consolidação do Sentinel (Fase 2, 2026-08-16): /radar (hoje) e /tendencias
// (2-3 semanas) eram dois motores e duas páginas separadas — um utente com
// uma quebra lenta (só visível em tendência) nunca aparecia aqui, no sítio
// que a equipa vê todos os dias. Agora ambos vêm de lib/sentinel (a mesma
// fonte que o /guardiao usa); /tendencias continua a existir para quem quiser
// o detalhe (sparklines por métrica), sem alterações.

export default function RadarPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<CareResult[]>([])
  const [trends, setTrends] = useState<Record<string, ResidentTrend>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const s = await loadSentinel(supabase, scope)
    if (s.error) { setErr(s.error); setLoading(false); return }
    setResults(s.results)
    setTrends(s.trends)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load, table: SENTINEL_LIVE_TABLES })

  // Combina hoje (careSignals) + tendência (trendSignals): um utente com só
  // uma quebra lenta (sem nada fora do padrão hoje) também tem de aparecer —
  // era exatamente o que se perdia com as duas páginas separadas.
  const needAttention = useMemo(() => {
    const withTrend = results.filter(r => r.outOfPattern.length > 0 || r.openItems.length > 0 || !!trends[r.patientId])
    return [...withTrend].sort((a, b) => {
      const la = combinedLevel(a, trends[a.patientId])
      const lb = combinedLevel(b, trends[b.patientId])
      if (SEV_ORDER[la] !== SEV_ORDER[lb]) return SEV_ORDER[la] - SEV_ORDER[lb]
      return combinedScore(b, trends[b.patientId]) - combinedScore(a, trends[a.patientId])
    })
  }, [results, trends])
  const calm = results.length - needAttention.length

  // Dá contexto ao Phlox Copilot: o que a equipa registou que pode merecer atenção.
  usePhloxContext(
    results.length ? 'Briefing do que pode merecer atenção' : '',
    results.length ? { com_sinais: needAttention.slice(0, 8).map(r => `${r.name}: ${[...r.outOfPattern, ...r.openItems, ...(trends[r.patientId]?.flags || [])].map(i => i.title).join(', ')}`) } : null as any
  )

  // Fim de semana / turno da noite — o contexto em que o Guardião é útil.
  const guardiaoContext = useMemo(() => {
    const day = new Date().getDay()
    const weekend = day === 0 || day === 6
    const night = currentShiftFor(institution) === 'noite'
    if (weekend && night) return 'É fim de semana e turno da noite'
    if (weekend) return 'É fim de semana'
    if (night) return 'É turno da noite'
    return null
  }, [institution])

  function toggle(id: string) { setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  function printBriefing() {
    const records = needAttention.map(r => ({
      title: `${r.name}${r.room ? ` · ${cfg.roomLabel} ${r.room}` : ''}`,
      meta: `Pontos: ${r.outOfPattern.length + r.openItems.length}`,
      bullets: [
        ...r.outOfPattern.map(s => `Fora do padrão — ${s.title}: ${s.detail}`),
        ...r.openItems.map(s => `Por confirmar — ${s.title}: ${s.detail}`),
      ],
    }))
    printDoc({
      docTitle: `O que pode merecer atenção — ${cfg.unitNoun}`,
      docSubtitle: new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      sections: [{ heading: 'Pontos a confirmar pela equipa', records }],
      footerNote: CARE_DISCLAIMER,
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 70px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b45309', fontWeight: 700, marginBottom: 6 }}>Briefing da equipa · {cfg.unitNoun}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>O que pode merecer atenção hoje</h1>
        <p style={{ fontSize: 14.5, color: '#475569', margin: '0 0 14px', lineHeight: 1.55 }}>
          Reúne tudo o que a equipa registou — hoje e nas últimas 2-3 semanas — e destaca o que saiu do padrão habitual, ficou por confirmar, ou tem vindo a piorar aos poucos. Para a equipa não deixar escapar nada.
        </p>

        {/* Ponte para o Modo Guardião — é ao fim de semana e à noite que ele
            serve, e é exatamente quando ninguém tem tempo de o ir procurar no
            menu. Só no lar: um centro de dia não tem turno da noite. */}
        {institution === 'nursing_home' && guardiaoContext && needAttention.length > 0 && (
          <Link href="/guardiao" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 14px', marginBottom: 14, textDecoration: 'none' }}>
            <Icon name="shield" size={16} color="#b45309" />
            <span style={{ flex: 1, fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
              <strong>{guardiaoContext}.</strong> O Modo Guardião mostra só quem precisa de atenção agora.
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309', flexShrink: 0 }}>Abrir →</span>
          </Link>
        )}

        {/* Disclaimer regulatório bem visível */}
        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 18 }}>
          ⓘ {CARE_DISCLAIMER}
        </div>

        {/* Resumo + ações */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '10px 16px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: needAttention.length ? '#b45309' : '#16a34a' }}>{needAttention.length}</span>
            <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>{cfg.personNounPlural?.toLowerCase() || 'pessoas'} com algo a confirmar</span>
          </div>
          {calm > 0 && <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '10px 16px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{calm}</span>
            <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>sem nada fora do padrão</span>
          </div>}
          {needAttention.length > 0 && <button onClick={printBriefing} style={{ marginLeft: 'auto', padding: '9px 16px', background: 'white', color: '#1d4ed8', border: '1.5px solid #bfdbfe', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Imprimir para a passagem</button>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />)}</div>
        ) : err ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 18, color: '#991b1b', fontSize: 14 }}>{err}</div>
        ) : results.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 12 }}><Icon name="users" size={36} color="#cbd5e1" /></div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#0b1120', marginBottom: 8 }}>Ainda sem {cfg.personNounPlural?.toLowerCase() || 'utentes'}</div>
            <Link href="/patients" style={{ display: 'inline-block', padding: '12px 24px', background: '#b45309', color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Adicionar {cfg.personNoun?.toLowerCase()}</Link>
          </div>
        ) : needAttention.length === 0 ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '28px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#15803d' }}>Nada fora do padrão com o que foi registado.</div>
            <div style={{ fontSize: 13, color: '#16a34a', marginTop: 4 }}>Continuem a registar os cuidados ao longo do dia.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {needAttention.map(r => {
              const trend = trends[r.patientId]
              const level = combinedLevel(r, trend)
              const score = combinedScore(r, trend)
              const st = SEVERITY_STYLE[level]
              const isOpen = open.has(r.patientId)
              const allItems = [...r.outOfPattern, ...r.openItems, ...(trend?.flags || [])]
              return (
                <div key={r.patientId} style={{ background: 'white', border: `1px solid ${level === 'critical' ? '#fca5a5' : level === 'warning' ? '#fde68a' : '#e9eaec'}`, borderRadius: 16, overflow: 'hidden' }}>
                  <button onClick={() => toggle(r.patientId)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: st.bg, border: `1.5px solid ${st.border}`, color: st.color, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{score}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: '#0b1120' }}>{r.name}{r.room ? ` · ${cfg.roomLabel?.[0] || ''}${r.room}` : ''}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: st.color, marginTop: 1 }}>{allItems.slice(0, 2).map(i => i.title).join(' · ')}{allItems.length > 2 ? ` · +${allItems.length - 2}` : ''}</span>
                    </span>
                    <span style={{ fontSize: 18, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                      {r.outOfPattern.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Saiu do padrão habitual</div>
                          {r.outOfPattern.map((s, i) => {
                            const ss = SEVERITY_STYLE[s.severity]
                            return <div key={i} style={{ background: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 10, padding: '10px 13px', marginBottom: 7 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: ss.color }}>{s.title}</div>
                              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            </div>
                          })}
                        </div>
                      )}
                      {r.openItems.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Por confirmar / completar</div>
                          {r.openItems.map((s, i) => (
                            <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 13px', marginBottom: 7 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>{s.title}</div>
                              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {trend && trend.flags.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tendência (2-3 semanas)</div>
                          {trend.flags.map((s, i) => {
                            const ss = SEVERITY_STYLE[s.severity]
                            return <div key={i} style={{ background: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 10, padding: '10px 13px', marginBottom: 7 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: ss.color }}>{s.title}</div>
                              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            </div>
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <Link href={`/patients/${r.patientId}`} style={{ fontSize: 12.5, fontWeight: 700, color: 'white', background: '#b45309', borderRadius: 9, padding: '8px 14px', textDecoration: 'none' }}>Abrir ficha</Link>
                        <Link href="/care-log" style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', background: 'white', border: '1.5px solid #b45309', borderRadius: 9, padding: '8px 14px', textDecoration: 'none' }}>Registar o dia</Link>
                        {trend && <Link href="/tendencias" style={{ fontSize: 12.5, fontWeight: 700, color: '#7c3aed', background: 'white', border: '1.5px solid #ddd6fe', borderRadius: 9, padding: '8px 14px', textDecoration: 'none' }}>Ver tendências completas →</Link>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
