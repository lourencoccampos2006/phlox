'use client'

// app/radar/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O QUE PODE MERECER ATENÇÃO HOJE — refeito de raiz na linguagem da mesa.
//
// FERRAMENTA ORGANIZACIONAL: reúne tudo o que a equipa registou sobre cada
// pessoa e destaca o que saiu do padrão habitual ou ficou por fazer, para a
// equipa não deixar escapar nada. NÃO é um dispositivo médico: não prevê, não
// diagnostica, não estratifica risco clínico. A avaliação e a decisão são do
// profissional.
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. ERA UM ACORDEÃO. Cada pessoa era um cartão fechado; para comparar duas
//     era preciso abrir uma, ler, fechar, abrir a outra — e o que se leu na
//     primeira já não está no ecrã. Num briefing matinal de oito pessoas isso
//     são oito aberturas e nenhuma vista do conjunto.
//
//     Passa a MESTRE/DETALHE: a tabela de quem precisa de atenção à esquerda,
//     sempre inteira; o detalhe de quem está escolhido à direita.
//
//  2. O NÚMERO ESTAVA DENTRO DE UM QUADRADO DE 38px COM FUNDO DE COR, e o
//     resto da linha repetia a cor. Quando tudo numa linha é âmbar, o âmbar
//     deixa de querer dizer «atenção» e passa a querer dizer «linha».
//
//  3. NÃO HAVIA MANEIRA DE ORDENAR OU PROCURAR. Num lar de sessenta pessoas o
//     briefing tem trinta linhas; sem pesquisa, encontra-se alguém por sorte.
//
//  4. A ADVERTÊNCIA REGULATÓRIA ERA UMA CAIXA CINZENTA DE TRÊS LINHAS no topo,
//     com um ⓘ. Passa à barra de estado do fundo, onde está sempre visível e
//     não empurra o trabalho para baixo — continua a ler-se, e deixa de ser a
//     primeira coisa que se salta.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, currentShiftFor } from '@/lib/institutionConfig'
import { useLiveData } from '@/lib/useLiveData'
import { CARE_DISCLAIMER, type CareResult } from '@/lib/careSignals'
import type { ResidentTrend } from '@/lib/trendSignals'
import { loadSentinel, combinedLevel, combinedScore, SEV_ORDER, SENTINEL_LIVE_TABLES } from '@/lib/sentinel'
import { printDoc } from '@/lib/print'
import { usePhloxContext } from '@/lib/copilotContext'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo, Bandeira,
  Botao, Seletor, Vazio, ACarregar, Aviso, Grupo, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

/* ── A COR DE UM NÍVEL ──────────────────────────────────────────────────────
   O `SEVERITY_STYLE` do lib/residentSignals traz fundo, borda e cor por nível
   — e usá-lo em cada caixa de cada secção punha cor em tudo. Aqui a cor vive
   só no NÚMERO e no filete da esquerda; o resto da linha é tinta normal. */
const COR_NIVEL: Record<string, string> = {
  critical: 'var(--red)',
  warning: 'var(--amber)',
  info: 'var(--ink-4)',
  ok: 'var(--green)',
}

/** De que secção vem cada ponto. Um código, não um fundo de cor. */
const CODIGO_SECCAO = {
  padrao: 'PADRÃO',
  confirmar: 'CONFIRMAR',
  tendencia: 'TENDÊNCIA',
} as const

type Ordem = 'gravidade' | 'nome' | 'quarto'

export default function RadarPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const largo = useLargo()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<CareResult[]>([])
  const [trends, setTrends] = useState<Record<string, ResidentTrend>>({})
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [procura, setProcura] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('gravidade')

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
  useLiveData({
    supabase, userId: user?.id,
    filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue,
    onChange: load, table: SENTINEL_LIVE_TABLES,
  })

  // Combina hoje (careSignals) + tendência (trendSignals): quem tem só uma
  // quebra lenta, sem nada fora do padrão hoje, também tem de aparecer — era
  // exactamente o que se perdia com as duas páginas separadas.
  const comSinais = useMemo(() => {
    return results.filter(r => r.outOfPattern.length > 0 || r.openItems.length > 0 || !!trends[r.patientId])
  }, [results, trends])

  const visiveis = useMemo(() => {
    const t = procura.trim().toLowerCase()
    const lista = comSinais.filter(r =>
      !t || r.name.toLowerCase().includes(t) || (r.room || '').toLowerCase().includes(t))
    return [...lista].sort((a, b) => {
      if (ordem === 'nome') return a.name.localeCompare(b.name, 'pt')
      if (ordem === 'quarto') return (a.room || 'zzz').localeCompare(b.room || 'zzz', 'pt', { numeric: true })
      const la = combinedLevel(a, trends[a.patientId])
      const lb = combinedLevel(b, trends[b.patientId])
      if (SEV_ORDER[la] !== SEV_ORDER[lb]) return SEV_ORDER[la] - SEV_ORDER[lb]
      return combinedScore(b, trends[b.patientId]) - combinedScore(a, trends[a.patientId])
    })
  }, [comSinais, trends, procura, ordem])

  const calmos = results.length - comSinais.length
  const graves = useMemo(
    () => comSinais.filter(r => combinedLevel(r, trends[r.patientId]) === 'critical').length,
    [comSinais, trends])

  const aberto = useMemo(
    () => visiveis.find(r => r.patientId === escolhido) || null,
    [visiveis, escolhido])

  // Dá contexto ao Phlox Copilot: o que a equipa registou que pode merecer atenção.
  usePhloxContext(
    results.length ? 'Briefing do que pode merecer atenção' : '',
    results.length ? {
      com_sinais: comSinais.slice(0, 8).map(r =>
        `${r.name}: ${[...r.outOfPattern, ...r.openItems, ...(trends[r.patientId]?.flags || [])].map(i => i.title).join(', ')}`),
    } : null as any
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

  function printBriefing() {
    const records = visiveis.map(r => ({
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

  /* ── O DETALHE DE UMA PESSOA ────────────────────────────────────────────────
     Três secções, e a ordem é a da urgência: o que saiu do padrão HOJE, o que
     ficou por confirmar, e o que tem vindo a piorar aos poucos. Cada ponto é
     uma linha com um código — não uma caixa com fundo de cor, que era o que
     fazia um ecrã inteiro âmbar. */
  const detalhe = aberto ? (() => {
    const trend = trends[aberto.patientId]
    const nivel = combinedLevel(aberto, trend)
    const score = combinedScore(aberto, trend)

    const ponto = (seccao: keyof typeof CODIGO_SECCAO, titulo: string, detalhe: string, grave?: string) => (
      <div key={`${seccao}-${titulo}`} style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '8px 0', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ width: 82, flexShrink: 0, paddingTop: 1 }}>
          <Codigo texto={CODIGO_SECCAO[seccao]}
            cor={grave === 'critical' ? 'var(--red)' : grave === 'warning' ? 'var(--amber)' : undefined} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'block', fontSize: 'var(--t-dado)',
            fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
          }}>{titulo}</span>
          <span style={{
            display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-3)',
            lineHeight: 1.5, marginTop: 2,
          }}>{detalhe}</span>
        </span>
      </div>
    )

    return (
      <>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{
            ...MONO, fontSize: 'var(--t-numero)', lineHeight: 1,
            fontWeight: 'var(--peso-forte)' as any, color: COR_NIVEL[nivel] || 'var(--ink-4)',
          }}>{score}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'block', fontSize: 'var(--t-destaque)',
              fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
            }}>{aberto.name}</span>
            <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {aberto.room ? `${cfg.roomLabel?.toUpperCase() || 'QUARTO'} ${aberto.room} · ` : ''}
              {aberto.outOfPattern.length + aberto.openItems.length + (trend?.flags.length || 0)} PONTO
              {aberto.outOfPattern.length + aberto.openItems.length + (trend?.flags.length || 0) === 1 ? '' : 'S'}
            </span>
          </span>
          <Botao onClick={() => setEscolhido(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          {aberto.outOfPattern.length > 0 && (
            <Grupo titulo="Saiu do padrão habitual">
              {aberto.outOfPattern.map(s => ponto('padrao', s.title, s.detail, s.severity))}
            </Grupo>
          )}
          {aberto.openItems.length > 0 && (
            <Grupo titulo="Por confirmar ou completar">
              {aberto.openItems.map(s => ponto('confirmar', s.title, s.detail))}
            </Grupo>
          )}
          {trend && trend.flags.length > 0 && (
            <Grupo titulo="A piorar aos poucos · 2 a 3 semanas">
              {trend.flags.map(s => ponto('tendencia', s.title, s.detail, s.severity))}
            </Grupo>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Link href={`/patients/${aberto.patientId}`} style={{ textDecoration: 'none' }}>
              <Botao feitio="principal">ABRIR A FICHA →</Botao>
            </Link>
            <Link href="/care-log" style={{ textDecoration: 'none' }}>
              <Botao>REGISTAR O DIA</Botao>
            </Link>
            {trend && (
              <Link href="/tendencias" style={{ textDecoration: 'none' }}>
                <Botao>VER AS TENDÊNCIAS →</Botao>
              </Link>
            )}
          </div>
        </div>
      </>
    )
  })() : null

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Pode merecer atenção</span>

          <input value={procura} onChange={e => setProcura(e.target.value)}
            placeholder={`Procurar ${cfg.personNoun?.toLowerCase() || 'pessoa'} ou ${cfg.roomLabel?.toLowerCase() || 'quarto'}…`}
            aria-label="Procurar" style={{ ...CAIXA, width: 240 }} />

          <Seletor
            opcoes={[
              { id: 'gravidade', rotulo: 'Por gravidade' },
              { id: 'nome', rotulo: 'Por nome' },
              { id: 'quarto', rotulo: `Por ${cfg.roomLabel?.toLowerCase() || 'quarto'}` },
            ]}
            ativa={ordem} aoMudar={o => setOrdem(o as Ordem)} />

          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            {graves > 0 && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                {graves} A CONFIRMAR HOJE
              </span>
            )}
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: comSinais.length ? 'var(--amber)' : 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
              {comSinais.length} COM PONTOS
            </span>
            {calmos > 0 && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)' }}>
                {calmos} SEM NADA FORA DO PADRÃO
              </span>
            )}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* Ponte para o Modo Guardião — é ao fim de semana e à noite que
                ele serve, e é exactamente quando ninguém tem tempo de o ir
                procurar no menu. Só no lar: um centro de dia não tem noite. */}
            {institution === 'nursing_home' && guardiaoContext && comSinais.length > 0 && (
              <Link href="/guardiao" style={{ textDecoration: 'none' }}>
                <Botao titulo={`${guardiaoContext}. O Modo Guardião mostra só quem precisa de atenção agora.`}>
                  MODO GUARDIÃO →
                </Botao>
              </Link>
            )}
            {visiveis.length > 0 && (
              <Botao onClick={printBriefing}>IMPRIMIR PARA A PASSAGEM</Botao>
            )}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>PADRÃO = saiu do habitual hoje</span>
          <span style={{ ...MONO, color: 'var(--ink-4)' }}>CONFIRMAR = ficou por completar</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>TENDÊNCIA = a piorar aos poucos</span>
          {/* A advertência regulatória. Não cabe numa linha de legenda — e a
              barra de estado é uma linha. Fica a frase curta, com o texto
              inteiro no `title`, e o texto inteiro também sai impresso no
              rodapé do briefing (ver `printBriefing`), que é onde alguém o
              lê mesmo. */}
          <span title={CARE_DISCLAIMER} style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
            APOIO AO TRABALHO — NÃO É DIAGNÓSTICO
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(380px, 1fr) minmax(380px, 520px)' : '1fr',
      }}>
        {(largo || !aberto) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 42, textAlign: 'right' }}>Nº</span>
                <span style={{ ...ROTULO, flex: 1 }}>
                  {cfg.personNounPlural || 'Pessoas'} · o que está em cima da mesa
                </span>
                <span style={{ ...ROTULO, width: 44, textAlign: 'right' }}>Hoje</span>
                <span style={{ ...ROTULO, width: 52, textAlign: 'right' }}>Falta</span>
                <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Lenta</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{visiveis.length} de {results.length} {(cfg.personNounPlural || 'pessoas').toLowerCase()}</span>}
          >
            {loading ? (
              <ACarregar oQue="A juntar o que a equipa registou…" />
            ) : results.length === 0 ? (
              <Vazio titulo={`Ainda não há ${(cfg.personNounPlural || 'utentes').toLowerCase()} nesta casa.`}
                oQueFazer="Este briefing sai do que a equipa registou. Sem fichas não há nada para reunir."
                acao={<Link href="/patients" style={{ textDecoration: 'none' }}>
                  <Botao feitio="principal">ADICIONAR {(cfg.personNoun || 'pessoa').toUpperCase()} →</Botao>
                </Link>} />
            ) : visiveis.length === 0 ? (
              procura ? (
                <Vazio titulo="Ninguém com esse nome tem pontos a confirmar."
                  acao={<Botao onClick={() => setProcura('')}>LIMPAR</Botao>} />
              ) : (
                <Vazio titulo="Nada fora do padrão com o que foi registado."
                  oQueFazer="As pessoas todas sem pontos a confirmar. Continuem a registar os cuidados ao longo do dia — é disso que este briefing se faz." />
              )
            ) : visiveis.map(r => {
              const trend = trends[r.patientId]
              const nivel = combinedLevel(r, trend)
              const score = combinedScore(r, trend)
              const cor = COR_NIVEL[nivel] || 'var(--ink-4)'
              const on = escolhido === r.patientId
              const pontos = [...r.outOfPattern, ...r.openItems, ...(trend?.flags || [])]
              return (
                <LinhaTabela key={r.patientId}
                  aoTocar={() => setEscolhido(on ? null : r.patientId)}
                  ativa={on}
                  filete={nivel === 'critical' || nivel === 'warning' ? cor : undefined}
                  antes={{
                    largura: 42,
                    conteudo: (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                        color: cor,
                      }}>{score}</span>
                    ),
                  }}
                  principal={
                    <>
                      {r.name}
                      {r.room && (
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                          {' '}· {r.room}
                        </span>
                      )}
                    </>
                  }
                  secundaria={
                    pontos.slice(0, 2).map(i2 => i2.title).join(' · ')
                    + (pontos.length > 2 ? ` · +${pontos.length - 2}` : '')
                  }
                  celulas={[
                    { rotulo: 'Hoje', valor: r.outOfPattern.length || '—', largura: 44, direita: true, forte: !!r.outOfPattern.length, cor: r.outOfPattern.length ? 'var(--red)' : 'var(--ink-5)' },
                    { rotulo: 'Falta', valor: r.openItems.length || '—', largura: 52, direita: true, cor: r.openItems.length ? 'var(--ink-3)' : 'var(--ink-5)' },
                    { rotulo: 'Lenta', valor: trend?.flags.length || '—', largura: 56, direita: true, forte: !!trend?.flags.length, cor: trend?.flags.length ? 'var(--amber)' : 'var(--ink-5)' },
                  ]} />
              )
            })}
          </Painel>
        )}

        {aberto ? (
          <Painel>{detalhe}</Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo="Escolha uma pessoa."
              oQueFazer="Abre aqui ao lado, com a lista sempre à vista — para se poderem ver duas seguidas sem perder o sítio." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
  )
}
