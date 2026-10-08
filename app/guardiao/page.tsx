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

import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

const ACCENT = 'var(--amber)'

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
  const largo = useLargo()

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

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — na linguagem da mesa, mas SEM a densidade dela (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Esta página é a excepção, e é-o de propósito. O resto da aplicação é uma
     mesa de trabalho: trinta linhas num ecrã, para varrer uma casa de cima a
     baixo. Isto é outra coisa — é um aviso que se lê de pé, ao fim de semana
     ou às três da manhã, no telemóvel, num corredor, possivelmente com uma
     mão só. Os alvos grandes são a razão de a página existir.

     O que muda é o sistema: tokens, escala e peças, para deixar de haver aqui
     um segundo sistema de estilo. O que não muda é o tamanho dos alvos.
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any,
          }}>Guardião{context ? ` · ${context}` : ''}</span>

          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>A quem ir ver primeiro</span>

          {!loading && !err && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              {criticalCount > 0 && (
                <span style={{
                  ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)',
                  fontWeight: 'var(--peso-forte)' as any,
                }}>{criticalCount} URGENTE{criticalCount === 1 ? '' : 'S'}</span>
              )}
              <span style={{
                ...MONO, fontSize: 'var(--t-meta)',
                color: urgent.length ? 'var(--amber)' : 'var(--green)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>
                {urgent.length} A PRECISAR DE ATENÇÃO
              </span>
            </span>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <Link href="/radar" style={{ textDecoration: 'none' }}>
              <Botao>BRIEFING COMPLETO →</Botao>
            </Link>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>JÁ = ir ver agora</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>VER = antes do fim do turno</span>
          <span title={CARE_DISCLAIMER} style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
            APOIO AO TRABALHO — NÃO É DIAGNÓSTICO
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      {loading ? (
        <Painel><ACarregar oQue="A ver quem precisa de atenção…" /></Painel>
      ) : urgent.length === 0 ? (
        <Painel>
          <Vazio titulo="Ninguém com sinais de alerta agora."
            oQueFazer={results.length > 0
              ? `${results.length} ${results.length === 1 ? (cfg.personNoun?.toLowerCase() || 'pessoa') : (cfg.personNounPlural?.toLowerCase() || 'pessoas')} sem nada fora do padrão com o que está registado. Continue a registar ao longo do turno — é daí que esta lista se faz.`
              : 'Ainda não há pessoas registadas nesta casa.'} />
        </Painel>
      ) : (
        <Painel>
          {urgent.map(({ r, t, level }) => {
            const isOpen = open.has(r.patientId)
            // No Guardião mostra-se o sinal clínico, não a lista de tarefas
            // administrativas por completar.
            const items = [...r.outOfPattern, ...(t?.flags || [])]
            const cor = level === 'critical' ? 'var(--red)' : 'var(--amber)'
            return (
              <div key={r.patientId} style={{
                borderBottom: '1px solid var(--border)',
                borderLeft: `4px solid ${cor}`,
              }}>
                <button onClick={() => toggle(r.patientId)} aria-expanded={isOpen} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 13,
                  /* 16px de altura em cada lado. Isto é um alvo para um polegar
                     num corredor, não uma linha de tabela. */
                  padding: '16px 18px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)',
                }}>
                  <span style={{
                    ...MONO, width: 44, height: 44, flexShrink: 0,
                    borderRadius: 'var(--r-md)', border: `1px solid ${cor}`,
                    color: cor, fontWeight: 'var(--peso-forte)' as any,
                    fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{level === 'critical' ? 'JÁ' : 'VER'}</span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 'var(--t-destaque)',
                      fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
                    }}>
                      {r.name}
                      {r.room && (
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                          {' '}· {cfg.roomLabel} {r.room}
                        </span>
                      )}
                    </span>
                    <span style={{
                      display: 'block', fontSize: 'var(--t-dado)', color: cor,
                      marginTop: 3, fontWeight: 'var(--peso-corpo)' as any,
                    }}>
                      {items[0]?.title || r.note}
                      {items.length > 1 ? ` · +${items.length - 1}` : ''}
                    </span>
                  </span>

                  <span style={{
                    ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', flexShrink: 0,
                  }}>{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 18px 16px 76px' }}>
                    {items.map((sinal, i) => (
                      <div key={i} style={{
                        padding: '9px 0', borderTop: '1px solid var(--border)',
                      }}>
                        <div style={{
                          fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
                          color: sinal.severity === 'critical' ? 'var(--red)'
                            : sinal.severity === 'warning' ? 'var(--amber)' : 'var(--ink)',
                        }}>{sinal.title}</div>
                        <div style={{
                          fontSize: 'var(--t-dado)', color: 'var(--ink-3)',
                          lineHeight: 1.55, marginTop: 2,
                        }}>{sinal.detail}</div>
                      </div>
                    ))}

                    {/* Dois alvos largos, lado a lado. É o que se consegue
                        tocar sem olhar com atenção. */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <Link href={`/patients/${r.patientId}`} style={{
                        flex: '1 1 140px', textAlign: 'center', textDecoration: 'none',
                        ...MONO, fontSize: 'var(--t-dado)', letterSpacing: '.06em',
                        fontWeight: 'var(--peso-forte)' as any,
                        color: 'var(--sobre-acento)', background: 'var(--green)',
                        borderRadius: 'var(--r-md)', padding: '14px 16px',
                      }}>ABRIR A FICHA</Link>
                      <Link href={`/care-log?patient=${r.patientId}`} style={{
                        flex: '1 1 140px', textAlign: 'center', textDecoration: 'none',
                        ...MONO, fontSize: 'var(--t-dado)', letterSpacing: '.06em',
                        fontWeight: 'var(--peso-forte)' as any,
                        color: 'var(--ink-2)', background: 'var(--bg)',
                        border: '1px solid var(--border-2)',
                        borderRadius: 'var(--r-md)', padding: '14px 16px',
                      }}>REGISTAR</Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </Painel>
      )}

      {/* Transparência: nunca esconder gente em silêncio. Quem está de turno
          tem de poder confiar que não lhe está a ser ocultado nada sem aviso. */}
      {!loading && rest > 0 && (
        <Painel>
          <div style={{ padding: '12px 16px' }}>
            <p style={{
              margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--ink)' }}>{rest}</strong>{' '}
              {rest === 1 ? (cfg.personNoun?.toLowerCase() || 'pessoa') : (cfg.personNounPlural?.toLowerCase() || 'pessoas')}{' '}
              fora desta lista — sem sinais clínicos de alerta, ou só com registos
              administrativos por completar.
            </p>
            <div style={{ marginTop: 9 }}>
              <Link href="/radar" style={{ textDecoration: 'none' }}>
                <Botao>VER TUDO NO BRIEFING COMPLETO →</Botao>
              </Link>
            </div>
          </div>
        </Painel>
      )}
    </Mesa>
  )
}
