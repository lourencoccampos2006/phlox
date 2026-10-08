'use client'

// /painel-dono — Painel ADMINISTRATIVO (só owner/admin/direção da organização).
//
// O endereço continua a ser /painel-dono para não partir os links que já
// existem (menus, emails, marcadores de quem já o usa). O nome mudou em todo
// o lado onde alguém o lê.
// Mostra a linha do tempo de "quem fez o quê a quem" na instituição: medicação
// dada, registos do dia, ocorrências — com nome de quem fez, utente, data e hora.
// Os funcionários NÃO veem esta página (a API valida o papel; aqui escondemos).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { buildLedger } from '@/lib/workLedger'
import { printDoc } from '@/lib/print'
import OwnerPerformance from '@/components/owner/OwnerPerformance'
import OwnerInsights from '@/components/owner/OwnerInsights'
import PatientTimeline from '@/components/PatientTimeline'
import PainelAdmin from './PainelAdmin'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho,
  Botao, Seletor, Vazio, ACarregar, Aviso, MONO, ROTULO,
} from '@/components/ui/mesa'

/* Era o turquesa que saiu de toda a aplicacao a 2026-10-07. O acento desta
   casa e o verde, como em todo o resto. */
const ACCENT = 'var(--green)'

interface Ev { kind: string; icon: string; at: string; who: string; patient: string; detail: string; shift?: string; severity?: string }

// Atalhos do dono ADAPTADOS ao tipo de instituição (antes mostrava faturação/
// stock/agenda a todos — um centro de dia não vende ao balcão nem tem stock).
// [href, ícone (nome do Icon set), label]
//
// "Pôr a postos" (/comecar-instituicao) foi retirado daqui 2026-08-09: era o
// assistente de CRIAR uma instituição, acessível a partir do painel de uma
// instituição que já existe — dava a entender (e, em contas com mais do que
// uma organização, permitia mesmo) criar/confundir com outra. A configuração
// desta instituição faz-se agora na própria secção "Definições" abaixo.
function ownerLinks(kind: string): [string, string, string][] {
  const common: [string, string, string][] = [['/painel', 'chart', 'Cockpit do dia'], ['/equipa', 'users', 'Equipa']]
  if (kind === 'pharmacy_community') return [...common, ['/stock', 'package', 'Stock'], ['/faturacao', 'euro', 'Faturação']]
  if (kind === 'clinic' || kind === 'health_center') return [...common, ['/agenda', 'calendar', 'Agenda'], ['/faturacao', 'euro', 'Faturação']]
  // day_care / nursing_home
  return [...common, ['/radar', 'clipboard', 'A vigiar'], ['/faturacao', 'euro', 'Mensalidades']]
}

export default function PainelDonoPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])
  const [timelinePatientId, setTimelinePatientId] = useState('')
  // Intervalo ÚNICO que controla tanto a lista no ecrã como a exportação Excel
  // (antes eram dois controlos separados: um "date" de um único dia para o
  // ecrã, e um from/to só para o Excel — confuso, e o ecrã nunca mostrava mais
  // do que um dia). Default de 7 dias: suficiente para rever a semana sem
  // carregar um mês inteiro de eventos por omissão.
  const [expFrom, setExpFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })
  const [expTo, setExpTo] = useState(new Date().toISOString().slice(0, 10))
  const [events, setEvents] = useState<Ev[]>([])
  const [byStaff, setByStaff] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState({ meds: 0, care: 0, incidents: 0 })
  const [truncated, setTruncated] = useState(false)
  const [totalEvents, setTotalEvents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'painel' | 'negocio' | 'qualidade' | 'registos' | 'desempenho' | 'comparar'>(() => {
    if (typeof window !== 'undefined') { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'qualidade' || t === 'registos' || t === 'desempenho' || t === 'comparar' || t === 'negocio') return t }
    // O painel a sério é o que abre. Os outros separadores são relatórios —
    // valem quando alguém os procura, não como primeira coisa que se vê.
    return 'painel'
  })
  const [biz, setBiz] = useState<any | null>(null)
  const [expSource, setExpSource] = useState('medicacao')
  const [exporting, setExporting] = useState(false)
  const [expErr, setExpErr] = useState('')
  const [narrative, setNarrative] = useState('')
  const [loadingNarrative, setLoadingNarrative] = useState(false)
  const [narrativeErr, setNarrativeErr] = useState('')

  async function genNarrative(led: ReturnType<typeof buildLedger>) {
    setLoadingNarrative(true); setNarrativeErr(''); setNarrative('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/org/weekly-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({
          orgName: biz?.org?.name, periodLabel: biz?.ledger?.monthLabel || 'este mês',
          lines: led.lines.map(l => ({ value: l.value, label: l.label })),
          byStaff, incidentsOpen: biz?.kpis?.incidentsOpen, incidentsGrave: biz?.kpis?.incidentsGrave,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Não foi possível gerar agora.')
      setNarrative(j.narrative)
    } catch (e: any) { setNarrativeErr(e.message) }
    setLoadingNarrative(false)
  }

  const load = useCallback(async () => {
    if (!user) return
    // Sem organização estas duas rotas respondem sempre 400 (e com razão).
    // Não vale a pena pedir — só enchia a consola de erros que não são erros.
    if (!scope.orgId) { setLoading(false); return }
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const h = { Authorization: `Bearer ${sd?.session?.access_token}` }
      // Sem organização estes dois respondem sempre 400 (e com razão). Não
      // vale a pena pedir — só enchia a consola de erros que não são erros.

      const [auditR, bizR] = await Promise.all([
        fetch(`/api/org/audit?from=${expFrom}&to=${expTo}`, { headers: h }).then(r => r.json()),
        fetch(`/api/org/dashboard`, { headers: h }).then(r => r.json()).catch(() => null),
      ])
      if (auditR?.error) { setErr(auditR.error); setEvents([]); setLoading(false); return }
      setEvents(auditR.events || []); setByStaff(auditR.byStaff || {}); setTotals(auditR.totals || { meds: 0, care: 0, incidents: 0 })
      setTruncated(!!auditR.truncated); setTotalEvents(auditR.totalEvents || 0)
      if (bizR && !bizR.error) setBiz(bizR)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [user, supabase, expFrom, expTo])

  useEffect(() => { load() }, [load])

  // Lista de utentes para o seletor da linha do tempo por pessoa (abaixo).
  useEffect(() => {
    if (!user) return
    scope.filter(supabase.from('patients').select('id,name')).eq('active', true).order('name')
      .then(({ data }: any) => setPatients((data || []) as { id: string; name: string }[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  // Dossier para inspeção: junta o resumo do mês (cofre de valor) + a atividade do
  // dia (auditoria) + por funcionário, num A4 organizado. "Na inspeção, está à mão."
  function printDossier() {
    const led = biz?.ledger
    const ledgerRecords = led ? [
      { title: `${led.careRecordsMonth} registos de cuidados`, meta: `${led.careDaysMonth} dias documentados` },
      { title: `${led.marGivenMonth} tomas de medicação registadas`, meta: led.marAdherence != null ? `${led.marAdherence}% das previstas` : undefined },
      { title: `${led.incidentsFollowed}/${led.incidentsMonth} ocorrências com seguimento` },
      { title: `${led.assessmentsMonth} avaliações (escalas)` },
    ] : []
    const rangeLabel = expFrom === expTo ? expFrom : `${expFrom} a ${expTo}`
    const staffRecords = Object.entries(byStaff).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, n]) => ({ title: name, meta: `${n} ${n === 1 ? 'registo' : 'registos'} em ${rangeLabel}` }))
    const dayRecords = events.slice(0, 60).map(e => ({ title: `${e.who} → ${e.patient}`, meta: `${new Date(e.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${e.detail}` }))
    printDoc({
      docTitle: `Dossier de registos — ${biz?.org?.name || 'Instituição'}`,
      docSubtitle: led?.monthLabel ? `Mês de ${led.monthLabel}` : undefined,
      sections: [
        ...(ledgerRecords.length ? [{ heading: 'Resumo do mês', records: ledgerRecords }] : []),
        ...(staffRecords.length ? [{ heading: `Atividade por funcionário · ${rangeLabel}`, records: staffRecords }] : []),
        ...(dayRecords.length ? [{ heading: `Registos · ${rangeLabel}`, records: dayRecords }] : []),
      ],
      footerNote: 'Dossier organizado a partir dos registos da equipa. Documento de gestão.',
    })
  }

  // Exportação por intervalo de datas — para uma inspeção que pede "todos os
  // registos de fevereiro", sem ter de ir dia a dia. Devolve CSV (Excel).
  async function exportRange() {
    if (expFrom > expTo) { setExpErr('A data inicial é depois da final.'); return }
    setExporting(true); setExpErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch(`/api/org/export?source=${expSource}&from=${expFrom}&to=${expTo}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Falha na exportação') }
      const blob = await res.blob()
      const dl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dl; a.download = `phlox-${expSource}-${expFrom}_a_${expTo}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(dl)
    } catch (e: any) { setExpErr(e.message || 'Não foi possível exportar agora.') }
    setExporting(false)
  }

  if (!user) return null

  /* A moldura de um bloco deste painel. Era `background: white` com
     `--r-xl` e uma borda propria; passa a falar a lingua da mesa — fundo do
     sistema, raio medio, filete fino. */
  const card: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)', padding: '14px 16px',
  }
  const staffRows = Object.entries(byStaff).sort((a, b) => b[1] - a[1])
  // Personalização real da instituição (2026-08-09): se o dono definiu uma cor
  // de marca em Equipa → Definições, o cabeçalho usa-a — senão fica o teal do
  // produto. Só o cabeçalho, de propósito: mudar TODO o painel (botões, links,
  // gráficos) para uma cor arbitrária escolhida por cada instituição arrisca
  // contraste/legibilidade sem revisão — o eyebrow+título já assinam a página.
  const bizAccent = biz?.org?.accentColor || ACCENT

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Eram 330px antes do primeiro número: um cabeçalho com logótipo, migalha,
     título em serifa de 32px e uma frase de duas linhas; uma grelha de SEIS
     atalhos em cartões; seis separadores; e, dentro do painel, mais cinco.

     Os seis atalhos são um MENU — e um menu não é o que se vem ver a um
     painel administrativo. Vem-se ver os números. Passam para o fim, que é
     onde se vai a seguir depois de olhar.
     ══════════════════════════════════════════════════════════════════════════ */
  const ATALHOS = [
    { href: '/equipa', icon: 'users', title: 'Equipa e acessos', desc: 'Convidar e gerir funcionários' },
    { href: '/faturacao', icon: 'euro', title: 'Faturação', desc: 'Mensalidades, despesas, receitas' },
    { href: '/stock', icon: 'package', title: 'Stock', desc: 'Consumíveis, ruturas, encomendas' },
    { href: '/equipa?tab=mural', icon: 'megaphone', title: 'Mural da equipa', desc: 'Recados e avisos, com push' },
    { href: '/radar', icon: 'clipboard', title: 'A vigiar', desc: 'O que merece atenção hoje' },
    { href: '/equipa?tab=definicoes', icon: 'sliders', title: 'Definições', desc: 'Nome, tipo, lotação e mensalidade' },
  ]

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          {biz?.org?.logoUrl && (
            <img src={biz.org.logoUrl} alt="" style={{
              width: 26, height: 26, borderRadius: 'var(--r-sm)', objectFit: 'cover',
              border: '1px solid var(--border)', flexShrink: 0,
            }} />
          )}
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Administrativo</span>

          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>
            {biz?.org?.name || 'A casa'}
          </span>

          <Seletor
            opcoes={[
              { id: 'painel', rotulo: 'Painel' },
              { id: 'negocio', rotulo: 'Números do mês' },
              { id: 'desempenho', rotulo: 'Desempenho' },
              { id: 'qualidade', rotulo: 'Qualidade' },
              { id: 'comparar', rotulo: 'Comparar' },
              { id: 'registos', rotulo: 'Registos' },
            ]}
            ativa={tab} aoMudar={k => setTab(k as any)} />
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>A casa inteira num sítio</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Quem cá está e quem espera, o cuidado, a equipa, o dinheiro e o que uma
            inspeção pede
          </span>
        </BarraDeEstado>
      }
    >
      {err && (
        <Aviso tom="mau">
          {err}
          {err.includes('dono') && (
            <>{' '}<Link href="/equipa" style={{ color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
              Voltar à equipa
            </Link></>
          )}
        </Aviso>
      )}

      {!err && (
        <>
            {/* ── O PAINEL ──────────────────────────────────────────────
                Cinco vistas da casa, feitas com as MESMAS peças do /painel
                (app/painel/painelPecas.tsx): os mesmos cartões, a mesma
                grelha de doze colunas. Não é parecido com o painel — é feito
                dele, e por isso não se vai afastar. */}
            {tab === 'painel' && <PainelAdmin />}

            {/* ── NEGÓCIO ── */}
            {tab === 'negocio' && biz && (() => {
              const k = biz.kpis
              const eur = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 0 }) + ' €'
              const KCard = ({ big, label, sub, color = 'var(--ink)' }: any) => (
                <div style={{ ...card }}>
                  <div style={{ fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-forte)' as any, color, lineHeight: 1 }}>{big}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 5, fontWeight: 'var(--peso-corpo)' as any }}>{label}</div>
                  {sub && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>{sub}</div>}
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                    <KCard big={k.patients} label={biz.org.kind === 'day_care' ? 'utentes ativos' : 'pessoas'} sub={k.capacity ? `de ${k.capacity} lugares` : 'lotação não definida'} color={ACCENT} />
                    {k.occupancy != null && <KCard big={`${k.occupancy}%`} label="ocupação" sub={k.occupancy >= 90 ? 'quase cheio' : k.occupancy >= 60 ? 'saudável' : 'há lugares'} color={k.occupancy >= 60 ? 'var(--green)' : 'var(--amber)'} />}
                    {k.revenueEstimate != null
                      ? <KCard big={eur(k.revenueEstimate)} label="receita estimada/mês" sub="utentes × mensalidade" color="var(--green)" />
                      : <KCard big="—" label="receita/mês" sub="defina a mensalidade nas Definições" />}
                    <KCard big={k.presentToday} label="presentes hoje" sub="com registo do dia" />
                    <KCard big={k.teamSize} label="na equipa" sub={<Link href="/equipa" style={{ color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none' }}>gerir →</Link>} />
                    {k.logAdherence != null && <KCard big={`${k.logAdherence}%`} label="registos feitos (7 dias)" sub="adesão da equipa" color={k.logAdherence >= 80 ? 'var(--green)' : 'var(--amber)'} />}
                    <KCard big={k.marGivenMonth} label="tomas dadas (mês)" sub={k.marHomeMonth ? `${k.marHomeMonth} em casa pela família` : 'no centro'} color="var(--red)" />
                    <KCard big={k.familiesEngaged} label="famílias ativas (7 dias)" sub={`${k.familyReplies} respostas das famílias`} color="var(--ink-3)" />
                  </div>

                  {/* ── RESULTADO DO MÊS: mensalidades recebidas + outras receitas − despesas ── */}
                  {biz.finance && (biz.finance.feesReceived > 0 || biz.finance.otherIncome > 0 || biz.finance.expenses > 0) && (
                    <div style={{ ...card }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Resultado do mês</div>
                          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{biz.finance.monthLabel} · <Link href="/faturacao" style={{ color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none' }}>abrir faturação →</Link></div>
                        </div>
                        <div style={{ fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-forte)' as any, color: biz.finance.result >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>{eur(biz.finance.result)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                        <div><div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)' }}>{eur(biz.finance.feesReceived)}</div><div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>mensalidades recebidas</div></div>
                        <div><div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)' }}>{eur(biz.finance.otherIncome)}</div><div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>outras receitas</div></div>
                        <div><div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--red)' }}>−{eur(biz.finance.expenses)}</div><div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>despesas</div></div>
                      </div>
                    </div>
                  )}

                  {/* ── COFRE DE VALOR: o que ficou registado e organizado este mês ── */}
                  {biz.ledger && (() => {
                    const led = buildLedger(biz.ledger)
                    function exportLedger() {
                      printDoc({
                        docTitle: led.title,
                        docSubtitle: biz.org?.name || undefined,
                        sections: [{
                          heading: 'Resumo do trabalho registado',
                          records: led.lines.map(l => ({ title: `${l.value} — ${l.label}` })),
                        }],
                        footerNote: 'Números reais do que a equipa registou e o Phlox organizou. Não constitui avaliação clínica.',
                      })
                    }
                    return (
                      <div style={{ ...card, background: 'var(--green-light)', border: '1px solid var(--green-mid)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>O que o Phlox organizou este mês</div>
                            <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{biz.ledger.monthLabel} · números reais, prontos a mostrar</div>
                          </div>
                          {led.lines.length > 0 && <button onClick={exportLedger} style={{ padding: '8px 14px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}55`, borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>Exportar A4</button>}
                        </div>
                        {led.lines.length === 0 ? (
                          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>{led.note}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {led.lines.map((l, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                <Icon name={l.icon} size={16} />
                                <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: l.tone === 'good' ? 'var(--green)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', minWidth: 54 }}>{l.value}</span>
                                <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.4 }}>{l.label}</span>
                              </div>
                            ))}
                            <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.5 }}>{led.note}</div>
                          </div>
                        )}
                        {led.lines.length > 0 && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--green-mid)' }}>
                            {!narrative && !loadingNarrative && (
                              <button onClick={() => genNarrative(led)} style={{ padding: '8px 14px', background: 'var(--ink-2)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>✨ Resumo em palavras (IA)</button>
                            )}
                            {loadingNarrative && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>A escrever o resumo…</div>}
                            {narrativeErr && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)' }}>{narrativeErr}</div>}
                            {narrative && (
                              <div>
                                <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{narrative}</p>
                                <button onClick={() => setNarrative('')} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-2)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer' }}>gerar de novo</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {k.incidentsOpen > 0 && (
                    <div style={{ ...card, background: k.incidentsGrave > 0 ? 'var(--badge-red-bg)' : 'var(--badge-amber-bg)', border: `1px solid ${k.incidentsGrave > 0 ? 'var(--badge-red-border)' : 'var(--badge-amber-border)'}` }}>
                      <span style={{ fontSize: 'var(--t-dado)', color: k.incidentsGrave > 0 ? 'var(--red)' : 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                        ⚠ {k.incidentsOpen} {k.incidentsOpen === 1 ? 'ocorrência em aberto' : 'ocorrências em aberto'}
                        {k.incidentsGrave > 0 && ` · ${k.incidentsGrave} grave${k.incidentsGrave === 1 ? '' : 's'}`}
                      </span>
                      <Link href="/incidents" style={{ marginLeft: 8, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>resolver →</Link>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ownerLinks(biz.org.kind).map(([href, ic, l]) => (
                      <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', textDecoration: 'none' }}><Icon name={ic} size={15} color={ACCENT} /> {l}</Link>
                    ))}
                  </div>
                  <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.6 }}>Defina a lotação e a mensalidade em <Link href="/equipa" style={{ color: ACCENT, fontWeight: 'var(--peso-forte)' as any }}>Equipa → Definições da instituição</Link> para ver ocupação e receita.</p>
                </div>
              )
            })()}
            {tab === 'negocio' && !biz && <div style={{ ...card, color: 'var(--ink-5)' }}>A carregar indicadores…</div>}

            {/* ── DESEMPENHO (era /roi): receita, atividade e tendências reais ── */}
            {tab === 'desempenho' && <OwnerPerformance />}

            {/* ── COMPARAR (era /insights, Pro): benchmarks vs pool do mesmo tipo ── */}
            {tab === 'comparar' && <OwnerInsights />}

            {/* ── QUALIDADE (juntou o antigo /quality): indicadores reais do serviço,
                calculados dos registos, prontos para inspeção. ── */}
            {tab === 'qualidade' && (biz ? (() => {
              const k = biz.kpis; const led = biz.ledger || {}
              const QRow = ({ label, value, good, hint }: any) => (
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: good == null ? 'var(--border-2)' : good ? 'var(--green)' : 'var(--amber)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{label}</div>
                    {hint && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{hint}</div>}
                  </div>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: good == null ? 'var(--ink-4)' : good ? 'var(--green)' : 'var(--amber)' }}>{value}</div>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 2 }}>Indicadores do mês ({led.monthLabel || '—'}), calculados a partir do que a equipa registou. Prontos a mostrar numa inspeção.</div>
                  <QRow label="Adesão da medicação" value={led.marAdherence != null ? `${led.marAdherence}%` : '—'} good={led.marAdherence != null ? led.marAdherence >= 90 : null} hint="Tomas dadas / previstas" />
                  <QRow label="Registos do dia feitos" value={k.logAdherence != null ? `${k.logAdherence}%` : '—'} good={k.logAdherence != null ? k.logAdherence >= 80 : null} hint="Adesão da equipa (7 dias)" />
                  <QRow label="Ocorrências com seguimento" value={led.incidentsMonth ? `${led.incidentsFollowed}/${led.incidentsMonth}` : '0'} good={led.incidentsMonth ? led.incidentsFollowed >= led.incidentsMonth : null} hint="Fechadas / abertas no mês" />
                  <QRow label="Avaliações (escalas) feitas" value={String(led.assessmentsMonth || 0)} good={(led.assessmentsMonth || 0) > 0} hint="Barthel, MNA, Braden…" />
                  <QRow label="Ocorrências graves em aberto" value={String(k.incidentsGrave || 0)} good={(k.incidentsGrave || 0) === 0} hint="A resolver com prioridade" />
                  <div style={{ marginTop: 6 }}>
                    <button onClick={printDossier} style={{ padding: '10px 16px', background: ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>🗂 Relatório de qualidade para inspeção (A4)</button>
                  </div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>Números reais e auditáveis. Não constitui avaliação clínica — organiza o que foi registado.</div>
                </div>
              )
            })() : <div style={{ ...card, color: 'var(--ink-5)' }}>A carregar indicadores…</div>)}

            {/* ── REGISTOS (o que existia: auditoria) ── */}
            {tab === 'registos' && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={printDossier} style={{ padding: '9px 15px', background: ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>🗂 Gerar dossier para inspeção</button>
              {/* Intervalo único: controla a lista abaixo E a exportação Excel.
                  Antes eram dois controlos diferentes — um dia único aqui, um
                  intervalo só para o Excel — por isso os registos de vários
                  dias só apareciam no ficheiro descarregado, nunca no ecrã. */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} max={expTo} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '8px 12px', fontSize: 'var(--t-dado)', fontFamily: 'inherit', outline: 'none' }} />
                <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>até</span>
                <input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} min={expFrom} max={new Date().toISOString().slice(0, 10)} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '8px 12px', fontSize: 'var(--t-dado)', fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>

            {/* Exportar — mesmo intervalo escolhido acima, só muda o tipo de registo. */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Exportar para Excel</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginBottom: 4 }}>Tipo de registo</label>
                  <select value={expSource} onChange={e => setExpSource(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '8px 10px', fontSize: 'var(--t-dado)', fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                    <option value="medicacao">Medicação (MAR)</option>
                    <option value="registos">Registo do dia</option>
                    <option value="ocorrencias">Ocorrências</option>
                    <option value="avaliacoes">Avaliações</option>
                    <option value="atividades">Atividades</option>
                  </select>
                </div>
                <button onClick={exportRange} disabled={exporting} style={{ padding: '9px 16px', background: exporting ? 'var(--ink-5)' : ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: exporting ? 'default' : 'pointer' }}>{exporting ? 'A gerar…' : `Exportar ${expFrom} a ${expTo}`}</button>
              </div>
              {expErr && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 8 }}>{expErr}</div>}
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 10, lineHeight: 1.5 }}>Todos os registos ficam guardados para sempre — útil para responder a uma inspeção que peça um mês inteiro de uma vez.</div>
            </div>

            {/* Resumo do dia */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { n: totals.meds, l: 'tomas de medicação', c: 'var(--red)' },
                { n: totals.care, l: 'registos do dia', c: ACCENT },
                { n: totals.incidents, l: 'ocorrências', c: 'var(--amber)' },
              ].map(s => (
                <div key={s.l} style={{ ...card, borderLeft: `3px solid ${s.c}` }}>
                  <div style={{ fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Por funcionário */}
            {staffRows.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Atividade por funcionário</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffRows.map(([name, n]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-meta)', flexShrink: 0 }}>{(name || '?')[0].toUpperCase()}</span>
                      <span style={{ flex: 1, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{name}</span>
                      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{n} {n === 1 ? 'registo' : 'registos'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linha do tempo */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Linha do tempo · {expFrom === expTo ? expFrom : `${expFrom} a ${expTo}`}</div>
                {totalEvents > 0 && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{totalEvents} {totalEvents === 1 ? 'registo' : 'registos'}</div>}
              </div>
              {truncated && (
                <div style={{ background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-meta)', color: 'var(--amber)', marginBottom: 12 }}>
                  A mostrar os {events.length} mais recentes de {totalEvents}. Reduz o intervalo de datas para ver todos no ecrã, ou usa "Exportar para Excel" acima para o intervalo completo.
                </div>
              )}
              {loading ? <div style={{ color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>A carregar…</div>
              : events.length === 0 ? <div style={{ color: 'var(--ink-5)', fontSize: 'var(--t-dado)', textAlign: 'center', padding: '20px 0' }}>Sem registos neste intervalo.</div>
              : <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {events.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < events.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <Icon name={e.icon} size={16} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)', lineHeight: 1.5 }}>
                          <strong>{e.who}</strong> {e.detail} {e.kind !== 'care' && <>a <strong>{e.patient}</strong></>}{e.kind === 'care' && <> de <strong>{e.patient}</strong></>}
                          {e.severity && <span style={{ marginLeft: 6, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: e.severity === 'high' || e.severity === 'grave' ? 'var(--red)' : 'var(--amber)' }}>· {e.severity}</span>}
                        </div>
                        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {e.at ? (expFrom === expTo ? new Date(e.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : new Date(e.at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : '—'}{e.shift ? ` · turno ${e.shift}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
            </div>

            {/* Linha do tempo POR UTENTE — 2026-08-07: antes só se via na ficha de
                cada um (/patients/[id]). Aqui o dono escolhe qualquer utente e vê a
                história completa (medicação, cuidados, vitais, ocorrências,
                avaliações, consultas, família, pedidos) num só sítio, incluindo
                impressão A4 — sem ter de abrir a ficha um a um. Reutiliza o mesmo
                componente da ficha, não é uma versão nova. */}
            <div style={{ ...card, marginTop: 16 }}>
              <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Linha do tempo por utente</div>
              <select value={timelinePatientId} onChange={e => setTimelinePatientId(e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px', fontSize: 'var(--t-dado)', fontFamily: 'inherit', outline: 'none', background: 'white', marginBottom: timelinePatientId ? 14 : 0 }}>
                <option value="">Escolher utente…</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {timelinePatientId && (
                <PatientTimeline patientId={timelinePatientId} supabase={supabase} scope={scope}
                  patientName={patients.find(p => p.id === timelinePatientId)?.name} accent={ACCENT} />
              )}
            </div>

            <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 14, lineHeight: 1.6 }}>
              Este registo serve a responsabilidade do serviço e a segurança dos utentes.
              O acesso é exclusivo do dono e administradores da instituição
              (RGPD — responsável pelo tratamento).
            </p>
            </>}
        </>
      )}

      {/* ── PARA ONDE SE VAI A SEGUIR ──────────────────────────────────────
          Estes seis eram uma grelha de cartões NO TOPO, antes do primeiro
          número. São um menu — e um menu não é o que se vem ver a um painel
          administrativo. Ficam no fim, que é onde se vai depois de olhar. */}
      <Painel cabeca={<Cabecalho><span style={{ ...ROTULO, flex: 1 }}>Gerir a casa</span></Cabecalho>}>
        {ATALHOS.map(h => (
          <Link key={h.href} href={h.href} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderBottom: '1px solid var(--border)',
            textDecoration: 'none', color: 'var(--ink)',
          }}>
            <span style={{ width: 20, flexShrink: 0, display: 'flex' }}>
              <Icon name={h.icon} size={16} color="var(--ink-4)" />
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                display: 'block', fontSize: 'var(--t-dado)',
                fontWeight: 'var(--peso-corpo)' as any,
              }}>{h.title}</span>
              <span style={{
                display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
              }}>{h.desc}</span>
            </span>
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)', flexShrink: 0,
            }}>→</span>
          </Link>
        ))}
      </Painel>
    </Mesa>
  )
}
