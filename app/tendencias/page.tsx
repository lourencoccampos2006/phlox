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
  rankByTrendAttention, TREND_DISCLAIMER,
  type ResidentTrend, type MetricTrend, type SparkPoint,
} from '@/lib/trendSignals'
import { loadTrends, SENTINEL_LIVE_TABLES } from '@/lib/sentinel'

const ACCENT = 'var(--green)'
const ACCENT_BG = 'var(--green-light)'

interface PatientLite { id: string; name: string; room_number?: string | null }

const LEVEL_STYLE: Record<ResidentTrend['level'], { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', label: 'A vigiar' },
  warning: { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', label: 'A vigiar' },
  info: { color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)', label: 'A completar' },
  good: { color: 'var(--green)', bg: 'var(--badge-green-bg)', border: 'var(--badge-green-border)', label: 'Estável' },
}

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function TendenciasPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<ResidentTrend[]>([])
  const largo = useLargo()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'attention' | 'all'>('attention')

  // 2026-08-16: passou a usar lib/sentinel loadTrends — a MESMA função que o
  // /radar, o /guardiao e o /apoio-psicossocial usam. Antes esta página tinha
  // a sua própria cópia do carregamento, o que a deixou de fora da correção
  // da métrica de atividades (dias sem participação a contar como 0, ver
  // buildResidentTrend): mostrava uma deteção mais fraca que as outras.
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const p = await scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name')
    if (p.error) { setErr('Não foi possível carregar. Verifica a ligação.'); setLoading(false); return }
    const patients: PatientLite[] = p.data || []
    const trendMap = await loadTrends(supabase, scope, patients)
    setResults(rankByTrendAttention(patients.map(pt => trendMap[pt.id]).filter(Boolean)))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({
    supabase, userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load,
    table: SENTINEL_LIVE_TABLES,
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

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Era um acordeão. Para comparar duas tendências — que é exactamente o que
     uma reunião de equipa faz — abria-se uma, fechava-se, abria-se a outra, e
     o que se leu na primeira já não estava no ecrã.

     Passa a mestre/detalhe. O que a página já faz bem fica inteiro: a
     sparkline mostra a comparação que o motor faz (os últimos 7 dias cheios,
     os 14 anteriores esbatidos), e um dia sem registo é uma barra cinzenta
     mínima — não é «zero», é «não sabemos».
     ══════════════════════════════════════════════════════════════════════════ */
  const aberta = shown.find(r => open.has(r.patientId)) || null

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Tendências</span>

          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            2 A 3 SEMANAS
          </span>

          {results.length > 0 && (
            <Seletor
              opcoes={[
                { id: 'attention', rotulo: `A vigiar ${needAttention.length}` },
                { id: 'all', rotulo: `Todos ${results.length}` },
              ]}
              ativa={effectiveFilter} aoMudar={f => setFilter(f as any)} />
          )}

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{
                ...MONO, fontSize: 'var(--t-meta)',
                color: needAttention.length ? 'var(--amber)' : 'var(--green)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>{needAttention.length} A VIGIAR</span>
              {stable.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)' }}>
                  {stable.length} ESTÁVE{stable.length === 1 ? 'L' : 'IS'}
                </span>
              )}
              {noData.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                  {noData.length} SEM DADOS SUFICIENTES
                </span>
              )}
            </span>
          )}

          {needAttention.length > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <Botao onClick={printBriefing}>IMPRIMIR PARA A EQUIPA</Botao>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>▼▼ a descer depressa</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>▼ a descer</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>▲ a melhorar</span>
          <span style={MONO}>Barra cinzenta = dia sem registo, não é zero</span>
          <span title={TREND_DISCLAIMER} style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
            APOIO AO TRABALHO — NÃO É DIAGNÓSTICO
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo && aberta ? 'minmax(320px, 420px) minmax(420px, 1fr)' : '1fr',
      }}>
        {(largo || !aberta) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 44 }}>Estado</span>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural} · o que mudou</span>
                <span style={{ ...ROTULO, width: 48, textAlign: 'right' }}>Sinais</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{shown.length} de {results.length}</span>}
          >
            {loading ? (
              <ACarregar oQue="A olhar para as últimas semanas…" />
            ) : results.length === 0 ? (
              <Vazio titulo={`Ainda não há ${cfg.personNounPlural?.toLowerCase() || 'utentes'}.`}
                oQueFazer="Esta vista faz-se do que a equipa regista ao longo das semanas. Sem fichas não há nada para comparar."
                acao={<Link href="/patients" style={{ textDecoration: 'none' }}>
                  <Botao feitio="principal">ADICIONAR {(cfg.personNoun || 'pessoa').toUpperCase()} →</Botao>
                </Link>} />
            ) : shown.length === 0 ? (
              <Vazio titulo="Sem tendências a vigiar nas últimas semanas."
                oQueFazer="Continuem a registar os cuidados — é isso que alimenta esta vista. Uma quebra gradual de várias semanas raramente aparece num único dia." />
            ) : shown.map(r => {
              const st = LEVEL_STYLE[r.level]
              return (
                <LinhaTabela key={r.patientId}
                  aoTocar={() => toggle(r.patientId)}
                  ativa={open.has(r.patientId)}
                  filete={r.level === 'critical' ? 'var(--red)' : r.level === 'warning' ? 'var(--amber)' : undefined}
                  antes={{
                    largura: 44,
                    conteudo: (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                        textTransform: 'uppercase', fontWeight: 'var(--peso-forte)' as any,
                        color: r.hasEnoughData ? st.color : 'var(--ink-5)',
                      }}>{r.hasEnoughData ? st.label.split(' ')[0] : '—'}</span>
                    ),
                  }}
                  principal={
                    <>
                      {r.name}
                      {cfg.hasBeds && r.room && (
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                          {' '}· {r.room}
                        </span>
                      )}
                    </>
                  }
                  secundaria={
                    !r.hasEnoughData
                      ? 'Ainda sem dados suficientes para uma leitura de tendência.'
                      : r.flags.length
                        ? `${r.flags.slice(0, 2).map(f => f.title).join(' · ')}${r.flags.length > 2 ? ` · +${r.flags.length - 2}` : ''}`
                        : 'Sem sinais a vigiar nas últimas semanas.'
                  }
                  celulas={[
                    {
                      rotulo: 'Sinais', largura: 48, direita: true,
                      valor: r.flags.length || '—', forte: !!r.flags.length,
                      cor: r.flags.length ? st.color : 'var(--ink-5)',
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {aberta ? (
          <Painel
            cabeca={
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <Botao onClick={() => toggle(aberta.patientId)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-destaque)',
                    fontWeight: 'var(--peso-corpo)' as any,
                  }}>{aberta.name}</span>
                  <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: LEVEL_STYLE[aberta.level].color }}>
                    {aberta.hasEnoughData ? LEVEL_STYLE[aberta.level].label.toUpperCase() : 'SEM DADOS SUFICIENTES'}
                  </span>
                </span>
              </div>
            }
          >
            <ResidentDetail r={aberta} cfg={cfg} />
          </Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo={`Escolha um ${cfg.personNoun.toLowerCase()}.`}
              oQueFazer="Humor, alimentação, adesão à medicação, ocorrências e avaliações ao longo do tempo. Uma quebra gradual de várias semanas raramente aparece num único dia." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
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
    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--bg-3)' }}>
      {r.flags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {!narrative && !loadingNarrative && (
            <button onClick={genNarrative} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', cursor: 'pointer' }}>
              ✨ Resumo em palavras (IA)
            </button>
          )}
          {loadingNarrative && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>A escrever…</div>}
          {narrativeErr && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)' }}>{narrativeErr}</div>}
          {narrative && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '11px 14px', fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {narrative}
            </div>
          )}
        </div>
      )}
      {r.flags.length > 0 && (
        <div style={{ marginTop: 14, marginBottom: 4 }}>
          <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sinais encontrados</div>
          {r.flags.map((f, i) => {
            const c = f.severity === 'critical' ? { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' } : f.severity === 'warning' ? { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)' } : { color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)' }
            return (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--r-lg)', padding: '10px 13px', marginBottom: 7 }}>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: c.color }}>{f.title}</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
        Registo diário · últimos {r.metrics[0]?.points.length || 21} dias
      </div>
      <div className="trend-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {r.metrics.map(m => <MetricBlock key={m.key} m={m} />)}
      </div>

      {(r.incidents.recentCount > 0 || r.incidents.baselineCount > 0) && (
        <div style={{ marginTop: 14, background: r.incidents.rising ? 'var(--badge-amber-bg)' : 'var(--bg-2)', border: `1px solid ${r.incidents.rising ? 'var(--badge-amber-border)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>Ocorrências: <b>{r.incidents.recentCount}</b> nos últimos 14 dias · {r.incidents.baselineCount} nos 14 anteriores</span>
          {r.incidents.rising && <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--amber)' }}>▲ a repetir-se</span>}
        </div>
      )}

      {r.assessments.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Avaliações</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {r.assessments.map(a => {
              const color = a.direction === 'agravou' ? (a.concerning ? 'var(--red)' : 'var(--amber)') : a.direction === 'melhorou' ? 'var(--green)' : 'var(--ink-4)'
              const arrow = a.direction === 'agravou' ? '▼' : a.direction === 'melhorou' ? '▲' : a.direction === 'sem alteração' ? '→' : ''
              return (
                <div key={a.scale} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '7px 12px', background: 'var(--bg)' }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{a.label}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color, marginTop: 2 }}>
                    {a.previousScore != null ? `${a.previousScore} → ${a.latestScore} pts ${arrow}` : `${a.latestScore} pts (1ª avaliação)`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <Link href={`/patients/${r.patientId}`} style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'white', background: ACCENT, borderRadius: 'var(--r-lg)', padding: '8px 14px', textDecoration: 'none' }}>Abrir ficha</Link>
        <Link href={`/care-log?patient=${r.patientId}`} style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: ACCENT, background: 'white', border: `1.5px solid ${ACCENT}`, borderRadius: 'var(--r-lg)', padding: '8px 14px', textDecoration: 'none' }}>Registar o dia</Link>
      </div>

      <style>{`@media(max-width:640px){.trend-metrics{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

function MetricBlock({ m }: { m: MetricTrend }) {
  const chip = !m.reliable
    ? { label: 'dados insuficientes', color: 'var(--ink-5)', bg: 'var(--bg-2)' }
    : m.declining
      ? { label: m.severity === 'critical' ? '▼▼ a descer' : '▼ a descer', color: m.severity === 'critical' ? 'var(--red)' : 'var(--amber)', bg: m.severity === 'critical' ? 'var(--badge-red-bg)' : 'var(--badge-amber-bg)' }
      : (m.delta != null && m.delta > 0.001)
        ? { label: '▲ a melhorar', color: 'var(--green)', bg: 'var(--badge-green-bg)' }
        : { label: '→ estável', color: 'var(--ink-4)', bg: 'var(--bg-2)' }
  const fmt = (v: number | null) => v == null ? '—' : m.unit === '%' ? `${Math.round(v)}%` : `${v.toFixed(1)}${m.unit}`
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '11px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{m.label}</span>
        <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: chip.color, background: chip.bg, padding: '2px 7px', borderRadius: 'var(--r)', whiteSpace: 'nowrap' }}>{chip.label}</span>
      </div>
      <Spark points={m.points} scaleMax={m.scaleMax} color={ACCENT} />
      <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-4)', marginTop: 7, lineHeight: 1.5 }}>
        últimos 7d: <b style={{ color: 'var(--ink)' }}>{fmt(m.recentAvg)}</b><br />2 sem. antes: {fmt(m.baselineAvg)}
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
        const bg = p.value == null ? 'var(--border)' : (isRecent ? color : color + '4a')
        const label = p.value == null ? 'sem registo' : (scaleMax <= 5 ? p.value.toFixed(1) : `${Math.round(p.value)}%`)
        return <div key={p.date} title={`${p.date}: ${label}`} style={{ width: 5, height: h, background: bg, borderRadius: '2px 2px 0 0', flexShrink: 0 }} />
      })}
    </div>
  )
}
