'use client'

// /guardiao — Modo Guardião (Módulo 12, 2026-08-16).
//
// O problema real: ao fim de semana e à noite há MENOS pessoal e MAIS risco.
// Quem está de serviço não precisa de um painel com tudo — precisa de saber
// a quem ir ver primeiro. O /radar mostra tudo o que merece atenção (incluindo
// tarefas administrativas por completar); aqui só entra quem tem sinal
// clínico relevante, por ordem de urgência, com alvos grandes para usar no
// telemóvel, num corredor, possivelmente com uma mão.
//
// Usa exatamente a mesma fonte que o /radar (lib/sentinel) — não é um motor
// novo, é uma LEITURA diferente do mesmo Sentinel. Foi por isso que o
// carregamento foi extraído para lib/sentinel na Fase 3.
//
// REGRA DE CONFIANÇA: nunca esconder pessoas em silêncio. A página diz
// sempre quantas ficaram de fora e porquê — quem está de turno tem de poder
// confiar que não lhe está a ser ocultado nada sem aviso.

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

const ACCENT = '#b45309'

export default function GuardiaoPage() {
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
    setResults(s.results); setTrends(s.trends)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load, table: SENTINEL_LIVE_TABLES })

  // Contexto: porque é que esta vista faz sentido AGORA.
  const context = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const weekend = day === 0 || day === 6
    const shift = currentShiftFor(institution)
    if (weekend && shift === 'noite') return 'Fim de semana · turno da noite'
    if (weekend) return 'Fim de semana'
    if (shift === 'noite') return 'Turno da noite'
    return null
  }, [institution])

  // Só sinal clínico relevante: crítico ou a vigiar. O que é "por confirmar /
  // completar" (registo do dia em falta, avaliação por fazer) é trabalho
  // administrativo — importante, mas não é para onde se corre primeiro.
  const urgent = useMemo(() => {
    return results
      .map(r => ({ r, t: trends[r.patientId], level: combinedLevel(r, trends[r.patientId]) }))
      .filter(x => x.level === 'critical' || x.level === 'warning')
      .sort((a, b) =>
        SEV_ORDER[a.level] - SEV_ORDER[b.level] ||
        combinedScore(b.r, b.t) - combinedScore(a.r, a.t))
  }, [results, trends])

  const rest = results.length - urgent.length
  const criticalCount = urgent.filter(x => x.level === 'critical').length

  function toggle(id: string) { setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 80px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>
          Modo Guardião{context ? ` · ${context}` : ''}
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 500, color: '#0b1120', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          A quem ir ver primeiro
        </h1>
        <p style={{ fontSize: 15, color: '#475569', margin: '0 0 18px', lineHeight: 1.55 }}>
          Só quem tem sinais que merecem atenção agora, por ordem de urgência. Feito para turnos com pouca gente.
        </p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />)}</div>
        ) : err ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 18, color: '#991b1b', fontSize: 14 }}>{err}</div>
        ) : (
          <>
            {/* Resumo — número grande, legível de relance */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <div style={{ background: 'white', border: `1.5px solid ${urgent.length ? '#fca5a5' : '#bbf7d0'}`, borderRadius: 14, padding: '14px 20px', flex: '1 1 150px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800, color: urgent.length ? '#b91c1c' : '#16a34a', lineHeight: 1 }}>{urgent.length}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 5 }}>a precisar de atenção</div>
              </div>
              {criticalCount > 0 && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 14, padding: '14px 20px', flex: '1 1 150px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800, color: '#7f1d1d', lineHeight: 1 }}>{criticalCount}</div>
                  <div style={{ fontSize: 13, color: '#991b1b', marginTop: 5 }}>{criticalCount === 1 ? 'urgente' : 'urgentes'}</div>
                </div>
              )}
            </div>

            {urgent.length === 0 ? (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>✓</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#15803d', marginBottom: 6 }}>Ninguém com sinais de alerta agora.</div>
                <div style={{ fontSize: 13.5, color: '#16a34a', lineHeight: 1.55 }}>
                  {results.length > 0
                    ? `${results.length} ${results.length === 1 ? (cfg.personNoun?.toLowerCase() || 'pessoa') : (cfg.personNounPlural?.toLowerCase() || 'pessoas')} sem nada fora do padrão com o que está registado.`
                    : 'Ainda sem pessoas registadas.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {urgent.map(({ r, t, level }) => {
                  const st = SEVERITY_STYLE[level]
                  const isOpen = open.has(r.patientId)
                  // No Guardião mostramos o sinal clínico, não a lista de
                  // tarefas administrativas por completar.
                  const items = [...r.outOfPattern, ...(t?.flags || [])]
                  return (
                    <div key={r.patientId} style={{ background: 'white', border: `2px solid ${level === 'critical' ? '#fca5a5' : '#fde68a'}`, borderRadius: 16, overflow: 'hidden' }}>
                      <button onClick={() => toggle(r.patientId)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 46, height: 46, borderRadius: 12, background: st.bg, border: `1.5px solid ${st.border}`, color: st.color, fontWeight: 800, fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1.1 }}>
                          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{level === 'critical' ? 'Já' : 'Ver'}</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.01em' }}>
                            {r.name}{r.room ? ` · ${cfg.roomLabel} ${r.room}` : ''}
                          </span>
                          <span style={{ display: 'block', fontSize: 13.5, color: st.color, marginTop: 3, fontWeight: 600 }}>
                            {items[0]?.title || r.note}{items.length > 1 ? ` · +${items.length - 1}` : ''}
                          </span>
                        </span>
                        <span style={{ fontSize: 20, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>⌄</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 20px 18px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map((s, i) => {
                              const ss = SEVERITY_STYLE[s.severity]
                              return (
                                <div key={i} style={{ background: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: ss.color }}>{s.title}</div>
                                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 3 }}>{s.detail}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                            <Link href={`/patients/${r.patientId}`} style={{ flex: '1 1 130px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'white', background: ACCENT, borderRadius: 10, padding: '13px 16px', textDecoration: 'none' }}>Abrir ficha</Link>
                            <Link href={`/care-log?patient=${r.patientId}`} style={{ flex: '1 1 130px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: ACCENT, background: 'white', border: `1.5px solid ${ACCENT}`, borderRadius: 10, padding: '13px 16px', textDecoration: 'none' }}>Registar</Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Transparência: nunca esconder gente em silêncio. */}
            {rest > 0 && (
              <div style={{ marginTop: 18, background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>
                  <strong style={{ color: '#0b1120' }}>{rest}</strong> {rest === 1 ? (cfg.personNoun?.toLowerCase() || 'pessoa') : (cfg.personNounPlural?.toLowerCase() || 'pessoas')} fora desta lista — sem sinais clínicos de alerta, ou só com registos administrativos por completar.
                </div>
                <Link href="/radar" style={{ display: 'inline-block', marginTop: 8, fontSize: 13.5, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>Ver tudo no briefing completo →</Link>
              </div>
            )}

            <div style={{ marginTop: 16, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              ⓘ {CARE_DISCLAIMER}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
