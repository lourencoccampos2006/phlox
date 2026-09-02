'use client'

// /painel-dono — Painel do Dono (só owner/admin da organização).
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

const ACCENT = '#0d9488'

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
  const [tab, setTab] = useState<'negocio' | 'qualidade' | 'registos' | 'desempenho' | 'comparar'>(() => {
    if (typeof window !== 'undefined') { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'qualidade' || t === 'registos' || t === 'desempenho' || t === 'comparar') return t }
    return 'negocio'
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
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const h = { Authorization: `Bearer ${sd?.session?.access_token}` }
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

  const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '18px 20px' }
  const staffRows = Object.entries(byStaff).sort((a, b) => b[1] - a[1])
  // Personalização real da instituição (2026-08-09): se o dono definiu uma cor
  // de marca em Equipa → Definições, o cabeçalho usa-a — senão fica o teal do
  // produto. Só o cabeçalho, de propósito: mudar TODO o painel (botões, links,
  // gráficos) para uma cor arbitrária escolhida por cada instituição arrisca
  // contraste/legibilidade sem revisão — o eyebrow+título já assinam a página.
  const bizAccent = biz?.org?.accentColor || ACCENT

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {biz?.org?.logoUrl && (
              <img src={biz.org.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid #e9eaec', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bizAccent, fontWeight: 700, marginBottom: 6 }}>Painel do dono</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 400, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>{biz?.org?.name || 'Registo de tudo'}</h1>
              <p style={{ fontSize: 13.5, color: '#64748b', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Ocupação, receita, equipa e tudo o que a equipa regista — num só sítio.</p>
            </div>
          </div>
        </div>

        {/* HUB de gestão — os destinos que o dono precisa, a um toque. É daqui que
            se gere a instituição; /equipa é agora uma destas secções. Aparece
            SEMPRE (mesmo que os dados de negócio falhem), para poder navegar. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 22 }}>
          {[
            { href: '/equipa', icon: 'users', title: 'Equipa & acessos', desc: 'Convidar e gerir funcionários' },
            { href: '/faturacao', icon: 'euro', title: 'Faturação', desc: 'Mensalidades, despesas, receitas' },
            { href: '/stock', icon: 'package', title: 'Stock', desc: 'Consumíveis, ruturas, encomendas' },
            { href: '/equipa?tab=mural', icon: 'megaphone', title: 'Mural da equipa', desc: 'Recados e avisos, com push' },
            { href: '/radar', icon: 'clipboard', title: 'A vigiar', desc: 'O que merece atenção hoje' },
            { href: '/equipa?tab=definicoes', icon: 'sliders', title: 'Definições', desc: 'Nome, tipo, lotação e mensalidade' },
          ].map(h => (
            <Link key={h.href} href={h.href} style={{ ...card, padding: '14px 16px', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6, borderColor: '#e2e8f0' }}>
              <Icon name={h.icon} size={20} color={ACCENT} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120' }}>{h.title}</span>
              <span style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>{h.desc}</span>
            </Link>
          ))}
        </div>

        {err && (
          <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            {err} {err.includes('dono') && <Link href="/equipa" style={{ color: '#991b1b', fontWeight: 700 }}>· Voltar à equipa</Link>}
          </div>
        )}

        {!err && (
          <>
            {/* Separadores: Visão geral | Qualidade | Registos */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid #eceef0', flexWrap: 'wrap' }}>
              {([['negocio', 'Visão geral'], ['desempenho', 'Desempenho'], ['qualidade', 'Qualidade'], ['comparar', 'Comparar'], ['registos', 'Registos & auditoria']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: `2.5px solid ${tab === k ? ACCENT : 'transparent'}`, cursor: 'pointer', fontSize: 14, fontWeight: tab === k ? 800 : 600, color: tab === k ? ACCENT : '#64748b', marginBottom: -1, fontFamily: 'inherit' }}>{l}</button>
              ))}
            </div>

            {/* ── NEGÓCIO ── */}
            {tab === 'negocio' && biz && (() => {
              const k = biz.kpis
              const eur = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 0 }) + ' €'
              const KCard = ({ big, label, sub, color = '#0b1120' }: any) => (
                <div style={{ ...card }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{big}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 5, fontWeight: 600 }}>{label}</div>
                  {sub && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                    <KCard big={k.patients} label={biz.org.kind === 'day_care' ? 'utentes ativos' : 'pessoas'} sub={k.capacity ? `de ${k.capacity} lugares` : 'lotação não definida'} color={ACCENT} />
                    {k.occupancy != null && <KCard big={`${k.occupancy}%`} label="ocupação" sub={k.occupancy >= 90 ? 'quase cheio' : k.occupancy >= 60 ? 'saudável' : 'há lugares'} color={k.occupancy >= 60 ? '#16a34a' : '#b45309'} />}
                    {k.revenueEstimate != null
                      ? <KCard big={eur(k.revenueEstimate)} label="receita estimada/mês" sub="utentes × mensalidade" color="#0d6e42" />
                      : <KCard big="—" label="receita/mês" sub="defina a mensalidade nas Definições" />}
                    <KCard big={k.presentToday} label="presentes hoje" sub="com registo do dia" />
                    <KCard big={k.teamSize} label="na equipa" sub={<Link href="/equipa" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>gerir →</Link>} />
                    {k.logAdherence != null && <KCard big={`${k.logAdherence}%`} label="registos feitos (7 dias)" sub="adesão da equipa" color={k.logAdherence >= 80 ? '#16a34a' : '#b45309'} />}
                    <KCard big={k.marGivenMonth} label="tomas dadas (mês)" sub={k.marHomeMonth ? `${k.marHomeMonth} em casa pela família` : 'no centro'} color="#dc2626" />
                    <KCard big={k.familiesEngaged} label="famílias ativas (7 dias)" sub={`${k.familyReplies} respostas das famílias`} color="#7c3aed" />
                  </div>

                  {/* ── RESULTADO DO MÊS: mensalidades recebidas + outras receitas − despesas ── */}
                  {biz.finance && (biz.finance.feesReceived > 0 || biz.finance.otherIncome > 0 || biz.finance.expenses > 0) && (
                    <div style={{ ...card }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>Resultado do mês</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{biz.finance.monthLabel} · <Link href="/faturacao" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>abrir faturação →</Link></div>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: biz.finance.result >= 0 ? '#16a34a' : '#dc2626', lineHeight: 1 }}>{eur(biz.finance.result)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                        <div><div style={{ fontSize: 17, fontWeight: 700, color: '#16a34a' }}>{eur(biz.finance.feesReceived)}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>mensalidades recebidas</div></div>
                        <div><div style={{ fontSize: 17, fontWeight: 700, color: '#16a34a' }}>{eur(biz.finance.otherIncome)}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>outras receitas</div></div>
                        <div><div style={{ fontSize: 17, fontWeight: 700, color: '#dc2626' }}>−{eur(biz.finance.expenses)}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>despesas</div></div>
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
                      <div style={{ ...card, background: 'linear-gradient(135deg,#f0fdfa,#ffffff)', border: '1px solid #99f6e4' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>O que o Phlox organizou este mês</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{biz.ledger.monthLabel} · números reais, prontos a mostrar</div>
                          </div>
                          {led.lines.length > 0 && <button onClick={exportLedger} style={{ padding: '8px 14px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}55`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Exportar A4</button>}
                        </div>
                        {led.lines.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#64748b' }}>{led.note}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {led.lines.map((l, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{l.icon}</span>
                                <span style={{ fontSize: 18, fontWeight: 800, color: l.tone === 'good' ? '#0d6e42' : '#0b1120', fontVariantNumeric: 'tabular-nums', minWidth: 54 }}>{l.value}</span>
                                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.4 }}>{l.label}</span>
                              </div>
                            ))}
                            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>{led.note}</div>
                          </div>
                        )}
                        {led.lines.length > 0 && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #99f6e4' }}>
                            {!narrative && !loadingNarrative && (
                              <button onClick={() => genNarrative(led)} style={{ padding: '8px 14px', background: '#5b21b6', color: 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>✨ Resumo em palavras (IA)</button>
                            )}
                            {loadingNarrative && <div style={{ fontSize: 12.5, color: '#64748b' }}>A escrever o resumo…</div>}
                            {narrativeErr && <div style={{ fontSize: 12, color: '#dc2626' }}>{narrativeErr}</div>}
                            {narrative && (
                              <div>
                                <p style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.7, margin: 0 }}>{narrative}</p>
                                <button onClick={() => setNarrative('')} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 11.5, color: '#5b21b6', fontWeight: 600, cursor: 'pointer' }}>gerar de novo</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {k.incidentsOpen > 0 && (
                    <div style={{ ...card, background: k.incidentsGrave > 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${k.incidentsGrave > 0 ? '#fecaca' : '#fde68a'}` }}>
                      <span style={{ fontSize: 13.5, color: k.incidentsGrave > 0 ? '#991b1b' : '#92400e', fontWeight: 700 }}>
                        ⚠ {k.incidentsOpen} {k.incidentsOpen === 1 ? 'ocorrência em aberto' : 'ocorrências em aberto'}
                        {k.incidentsGrave > 0 && ` · ${k.incidentsGrave} grave${k.incidentsGrave === 1 ? '' : 's'}`}
                      </span>
                      <Link href="/incidents" style={{ marginLeft: 8, fontSize: 12.5, color: '#b45309', fontWeight: 700 }}>resolver →</Link>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ownerLinks(biz.org.kind).map(([href, ic, l]) => (
                      <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'white', border: '1px solid #e9eaec', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#0b1120', textDecoration: 'none' }}><Icon name={ic} size={15} color={ACCENT} /> {l}</Link>
                    ))}
                  </div>
                  <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>Defina a lotação e a mensalidade em <Link href="/equipa" style={{ color: ACCENT, fontWeight: 700 }}>Equipa → Definições da instituição</Link> para ver ocupação e receita.</p>
                </div>
              )
            })()}
            {tab === 'negocio' && !biz && <div style={{ ...card, color: '#94a3b8' }}>A carregar indicadores…</div>}

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
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: good == null ? '#cbd5e1' : good ? '#16a34a' : '#d97706', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{label}</div>
                    {hint && <div style={{ fontSize: 12, color: '#94a3b8' }}>{hint}</div>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: good == null ? '#64748b' : good ? '#16a34a' : '#b45309' }}>{value}</div>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 2 }}>Indicadores do mês ({led.monthLabel || '—'}), calculados a partir do que a equipa registou. Prontos a mostrar numa inspeção.</div>
                  <QRow label="Adesão da medicação" value={led.marAdherence != null ? `${led.marAdherence}%` : '—'} good={led.marAdherence != null ? led.marAdherence >= 90 : null} hint="Tomas dadas / previstas" />
                  <QRow label="Registos do dia feitos" value={k.logAdherence != null ? `${k.logAdherence}%` : '—'} good={k.logAdherence != null ? k.logAdherence >= 80 : null} hint="Adesão da equipa (7 dias)" />
                  <QRow label="Ocorrências com seguimento" value={led.incidentsMonth ? `${led.incidentsFollowed}/${led.incidentsMonth}` : '0'} good={led.incidentsMonth ? led.incidentsFollowed >= led.incidentsMonth : null} hint="Fechadas / abertas no mês" />
                  <QRow label="Avaliações (escalas) feitas" value={String(led.assessmentsMonth || 0)} good={(led.assessmentsMonth || 0) > 0} hint="Barthel, MNA, Braden…" />
                  <QRow label="Ocorrências graves em aberto" value={String(k.incidentsGrave || 0)} good={(k.incidentsGrave || 0) === 0} hint="A resolver com prioridade" />
                  <div style={{ marginTop: 6 }}>
                    <button onClick={printDossier} style={{ padding: '10px 16px', background: ACCENT, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗂 Relatório de qualidade para inspeção (A4)</button>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Números reais e auditáveis. Não constitui avaliação clínica — organiza o que foi registado.</div>
                </div>
              )
            })() : <div style={{ ...card, color: '#94a3b8' }}>A carregar indicadores…</div>)}

            {/* ── REGISTOS (o que existia: auditoria) ── */}
            {tab === 'registos' && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={printDossier} style={{ padding: '9px 15px', background: ACCENT, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗂 Gerar dossier para inspeção</button>
              {/* Intervalo único: controla a lista abaixo E a exportação Excel.
                  Antes eram dois controlos diferentes — um dia único aqui, um
                  intervalo só para o Excel — por isso os registos de vários
                  dias só apareciam no ficheiro descarregado, nunca no ecrã. */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} max={expTo} style={{ border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                <span style={{ fontSize: 12.5, color: '#94a3b8' }}>até</span>
                <input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} min={expFrom} max={new Date().toISOString().slice(0, 10)} style={{ border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>

            {/* Exportar — mesmo intervalo escolhido acima, só muda o tipo de registo. */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Exportar para Excel</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Tipo de registo</label>
                  <select value={expSource} onChange={e => setExpSource(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                    <option value="medicacao">Medicação (MAR)</option>
                    <option value="registos">Registo do dia</option>
                    <option value="ocorrencias">Ocorrências</option>
                    <option value="avaliacoes">Avaliações</option>
                    <option value="atividades">Atividades</option>
                  </select>
                </div>
                <button onClick={exportRange} disabled={exporting} style={{ padding: '9px 16px', background: exporting ? '#94a3b8' : ACCENT, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: exporting ? 'default' : 'pointer' }}>{exporting ? 'A gerar…' : `Exportar ${expFrom} a ${expTo}`}</button>
              </div>
              {expErr && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{expErr}</div>}
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>Todos os registos ficam guardados para sempre — útil para responder a uma inspeção que peça um mês inteiro de uma vez.</div>
            </div>

            {/* Resumo do dia */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { n: totals.meds, l: 'tomas de medicação', c: '#dc2626' },
                { n: totals.care, l: 'registos do dia', c: ACCENT },
                { n: totals.incidents, l: 'ocorrências', c: '#b45309' },
              ].map(s => (
                <div key={s.l} style={{ ...card, borderLeft: `3px solid ${s.c}` }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#0b1120', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Por funcionário */}
            {staffRows.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Atividade por funcionário</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffRows.map(([name, n]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#f0fdfa', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{(name || '?')[0].toUpperCase()}</span>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#0b1120' }}>{name}</span>
                      <span style={{ fontSize: 12.5, color: '#64748b' }}>{n} {n === 1 ? 'registo' : 'registos'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linha do tempo */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Linha do tempo · {expFrom === expTo ? expFrom : `${expFrom} a ${expTo}`}</div>
                {totalEvents > 0 && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{totalEvents} {totalEvents === 1 ? 'registo' : 'registos'}</div>}
              </div>
              {truncated && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                  A mostrar os {events.length} mais recentes de {totalEvents}. Reduz o intervalo de datas para ver todos no ecrã, ou usa "Exportar para Excel" acima para o intervalo completo.
                </div>
              )}
              {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>A carregar…</div>
              : events.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem registos neste intervalo.</div>
              : <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {events.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < events.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{e.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: '#0b1120', lineHeight: 1.5 }}>
                          <strong>{e.who}</strong> {e.detail} {e.kind !== 'care' && <>a <strong>{e.patient}</strong></>}{e.kind === 'care' && <> de <strong>{e.patient}</strong></>}
                          {e.severity && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: e.severity === 'high' || e.severity === 'grave' ? '#dc2626' : '#b45309' }}>· {e.severity}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Linha do tempo por utente</div>
              <select value={timelinePatientId} onChange={e => setTimelinePatientId(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: 'white', marginBottom: timelinePatientId ? 14 : 0 }}>
                <option value="">Escolher utente…</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {timelinePatientId && (
                <PatientTimeline patientId={timelinePatientId} supabase={supabase} scope={scope}
                  patientName={patients.find(p => p.id === timelinePatientId)?.name} accent={ACCENT} />
              )}
            </div>

            <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, lineHeight: 1.6 }}>
              Este registo serve a responsabilidade do serviço e a segurança dos utentes. O acesso é exclusivo do dono e administradores da instituição (RGPD — responsável pelo tratamento).
            </p>
            </>}
          </>
        )}
      </div>
    </div>
  )
}
