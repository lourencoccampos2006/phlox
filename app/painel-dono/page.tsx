'use client'

// /painel-dono — Painel do Dono (só owner/admin da organização).
// Mostra a linha do tempo de "quem fez o quê a quem" na instituição: medicação
// dada, registos do dia, ocorrências — com nome de quem fez, utente, data e hora.
// Os funcionários NÃO veem esta página (a API valida o papel; aqui escondemos).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { buildLedger } from '@/lib/workLedger'
import { printDoc } from '@/lib/print'

const ACCENT = '#0d9488'

interface Ev { kind: string; icon: string; at: string; who: string; patient: string; detail: string; shift?: string; severity?: string }

export default function PainelDonoPage() {
  const { user, supabase } = useAuth() as any
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [events, setEvents] = useState<Ev[]>([])
  const [byStaff, setByStaff] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState({ meds: 0, care: 0, incidents: 0 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'negocio' | 'registos'>('negocio')
  const [biz, setBiz] = useState<any | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const h = { Authorization: `Bearer ${sd?.session?.access_token}` }
      const [auditR, bizR] = await Promise.all([
        fetch(`/api/org/audit?date=${date}`, { headers: h }).then(r => r.json()),
        fetch(`/api/org/dashboard`, { headers: h }).then(r => r.json()).catch(() => null),
      ])
      if (auditR?.error) { setErr(auditR.error); setEvents([]); setLoading(false); return }
      setEvents(auditR.events || []); setByStaff(auditR.byStaff || {}); setTotals(auditR.totals || { meds: 0, care: 0, incidents: 0 })
      if (bizR && !bizR.error) setBiz(bizR)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [user, supabase, date])

  useEffect(() => { load() }, [load])

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
    const staffRecords = Object.entries(byStaff).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, n]) => ({ title: name, meta: `${n} ${n === 1 ? 'registo' : 'registos'} em ${date}` }))
    const dayRecords = events.slice(0, 60).map(e => ({ title: `${e.who} → ${e.patient}`, meta: `${new Date(e.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${e.detail}` }))
    printDoc({
      docTitle: `Dossier de registos — ${biz?.org?.name || 'Instituição'}`,
      docSubtitle: led?.monthLabel ? `Mês de ${led.monthLabel}` : undefined,
      sections: [
        ...(ledgerRecords.length ? [{ heading: 'Resumo do mês', records: ledgerRecords }] : []),
        ...(staffRecords.length ? [{ heading: `Atividade por funcionário · ${date}`, records: staffRecords }] : []),
        ...(dayRecords.length ? [{ heading: `Registos do dia · ${date}`, records: dayRecords }] : []),
      ],
      footerNote: 'Dossier organizado a partir dos registos da equipa. Documento de gestão.',
    })
  }

  if (!user) return null

  const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '18px 20px' }
  const staffRows = Object.entries(byStaff).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Painel do dono</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 400, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>Registo de tudo</h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Gira a instituição a partir daqui: ocupação, receita, equipa e tudo o que a equipa regista.</p>
          </div>
        </div>

        {err && (
          <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            {err} {err.includes('dono') && <Link href="/equipa" style={{ color: '#991b1b', fontWeight: 700 }}>· Voltar à equipa</Link>}
          </div>
        )}

        {!err && (
          <>
            {/* Separadores: Negócio | Registos */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid #eceef0' }}>
              {([['negocio', 'Negócio'], ['registos', 'Registos']] as const).map(([k, l]) => (
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
                          {led.lines.length > 0 && <button onClick={exportLedger} style={{ padding: '8px 14px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}55`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🖨 Exportar A4</button>}
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
                      </div>
                    )
                  })()}

                  {k.incidentsOpen > 0 && (
                    <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <span style={{ fontSize: 13.5, color: '#92400e', fontWeight: 700 }}>⚠ {k.incidentsOpen} {k.incidentsOpen === 1 ? 'ocorrência em aberto' : 'ocorrências em aberto'}</span>
                      <Link href="/incidents" style={{ marginLeft: 8, fontSize: 12.5, color: '#b45309', fontWeight: 700 }}>resolver →</Link>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[['/comecar-instituicao', '🚀 Pôr a postos'], ['/painel', '📊 Cockpit do dia'], ['/equipa', '👥 Equipa'], ['/faturacao', '💶 Faturação'], ['/stock', '📦 Stock'], ['/agenda', '📅 Agenda']].map(([href, l]) => (
                      <Link key={href} href={href} style={{ padding: '9px 14px', background: 'white', border: '1px solid #e9eaec', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#0b1120', textDecoration: 'none' }}>{l}</Link>
                    ))}
                  </div>
                  <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>Defina a lotação e a mensalidade em <Link href="/equipa" style={{ color: ACCENT, fontWeight: 700 }}>Equipa → Definições da instituição</Link> para ver ocupação e receita.</p>
                </div>
              )
            })()}
            {tab === 'negocio' && !biz && <div style={{ ...card, color: '#94a3b8' }}>A carregar indicadores…</div>}

            {/* ── REGISTOS (o que existia: auditoria) ── */}
            {tab === 'registos' && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={printDossier} style={{ padding: '9px 15px', background: ACCENT, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗂 Gerar dossier para inspeção</button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
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
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Linha do tempo</div>
              {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>A carregar…</div>
              : events.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem registos neste dia.</div>
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
                          {e.at ? new Date(e.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'}{e.shift ? ` · turno ${e.shift}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
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
