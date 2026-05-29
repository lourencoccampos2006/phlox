'use client'

// Painel de Gestão ESPECÍFICO para instituições não-lar (farmácia, clínica, CSP, hospital).
// Constrói-se a partir dos sinais REAIS de cada uma: vendas/atos do dia, sala de espera,
// agenda, atendimentos, stock, conformidade, equipa, ocorrências e risco dos doentes.
// Mostra apenas o que faz sentido para o tipo de instituição (via institutionConfig).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { analyzeResident, SEVERITY_STYLE, type Severity, type Signal } from '@/lib/residentSignals'
import { institutionConfig } from '@/lib/institutionConfig'
import { checklistFor } from '@/lib/complianceChecklists'
import type { InstitutionType } from '@/lib/useClinicPrefs'

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const today = () => new Date().toISOString().slice(0, 10)
const monthOf = (d: string) => d.slice(0, 7)

async function safe(p: any): Promise<any[] | null> {
  try { const { data, error } = await p; if (error) return null; return data || [] } catch { return null }
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }
function secTitle(t: string, href?: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t}</span>
      {href && <Link href={href} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Abrir →</Link>}
    </div>
  )
}

export default function OpsGestao({ institution }: { institution: InstitutionType }) {
  const { user, supabase } = useAuth() as any
  const cfg = institutionConfig(institution)
  const [loading, setLoading] = useState(true)

  const [patients, setPatients] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [monthSales, setMonthSales] = useState<any[]>([])
  const [waiting, setWaiting] = useState<any[] | null>(null)
  const [appts, setAppts] = useState<any[] | null>(null)
  const [encounters, setEncounters] = useState<any[] | null>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [stock, setStock] = useState<any[] | null>(null)
  const [compliance, setCompliance] = useState<any[] | null>(null)
  const [medsByPt, setMedsByPt] = useState<Record<string, string[]>>({})

  const d = today(), m = monthOf(d)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const dayStart = new Date(d + 'T00:00:00').toISOString()
    const monthStart = new Date(m + '-01T00:00:00').toISOString()
    const yearStart = `${new Date().getFullYear()}-01-01`

    const [p, sToday, sMonth, wr, ap, enc, inc, t, st, comp, meds] = await Promise.all([
      safe(supabase.from('patients').select('id,name,age,conditions,allergies,active').eq('user_id', user.id)),
      safe(supabase.from('sales').select('*').eq('user_id', user.id).gte('at', dayStart)),
      safe(supabase.from('sales').select('gross,discount,paid,at').eq('user_id', user.id).gte('at', monthStart)),
      cfg.hasWaitingRoom ? safe(supabase.from('waiting_room').select('status,arrived_at').eq('user_id', user.id).gte('arrived_at', dayStart)) : Promise.resolve(null),
      cfg.hasAppointments ? safe(supabase.from('appointments').select('*').eq('user_id', user.id)) : Promise.resolve(null),
      cfg.hasWalkins ? safe(supabase.from('encounters').select('id,at,type,reason').eq('user_id', user.id).gte('at', monthStart)) : Promise.resolve(null),
      safe(supabase.from('incidents').select('id,patient_id,type,severity,status,date').eq('user_id', user.id).gte('date', yearStart)),
      safe(supabase.from('team_members').select('id,name,role,status').eq('user_id', user.id)),
      safe(supabase.from('stock_items').select('quantity,min_quantity,expiry_date').eq('user_id', user.id)),
      safe(supabase.from('compliance_items').select('key,status').eq('user_id', user.id)),
      safe(supabase.from('patient_meds').select('patient_id,name').eq('user_id', user.id)),
    ])

    setPatients((p || []).filter((x: any) => x.active !== false))
    setSales(sToday || []); setMonthSales(sMonth || [])
    setWaiting(wr); setAppts(ap); setEncounters(enc)
    setIncidents(inc || []); setTeam(t || []); setStock(st); setCompliance(comp)
    const md: Record<string, string[]> = {}
    ;(meds || []).forEach((x: any) => { (md[x.patient_id] ||= []).push(x.name) })
    setMedsByPt(md)
    setLoading(false)
  }, [user, supabase, d, m, cfg.hasWaitingRoom, cfg.hasAppointments, cfg.hasWalkins])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['sales', 'waiting_room', 'appointments', 'encounters', 'incidents', 'team_members', 'stock_items', 'patients'], userId: user?.id, onChange: load })

  // ── Métricas ──
  const net = (s: any) => Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0))
  const revToday = sales.reduce((a, s) => a + net(s), 0)
  const revMonth = monthSales.reduce((a, s) => a + net(s), 0)
  const txToday = sales.length

  const waitingNow = waiting ? waiting.filter(w => w.status === 'waiting').length : null
  const inService = waiting ? waiting.filter(w => w.status === 'called' || w.status === 'in_service').length : null
  const servedToday = waiting ? waiting.filter(w => w.status === 'done').length : null

  const apptToday = appts ? appts.filter(a => (a.date || a.at || '').slice(0, 10) === d).length : null
  const encMonth = encounters ? encounters.length : null

  const openInc = incidents.filter(i => i.status !== 'closed')
  const onShift = team.filter(m => m.status === 'on_shift' || m.status === 'active').length

  const stockLow = stock ? stock.filter(s => Number(s.min_quantity) > 0 && Number(s.quantity) <= Number(s.min_quantity)).length : null
  const stockExp = stock ? stock.filter(s => { if (!s.expiry_date) return false; const dd = Math.floor((new Date(s.expiry_date + 'T12:00').getTime() - Date.now()) / 86400000); return dd <= 30 }).length : null

  let compPct: number | null = null, compPending: number | null = null
  if (compliance) {
    const items = checklistFor(institution).flatMap(g => g.items)
    const map: Record<string, string> = {}; compliance.forEach(c => { map[c.key] = c.status })
    const na = items.filter(i => map[i.key] === 'na').length
    const done = items.filter(i => map[i.key] === 'done').length
    const applicable = items.length - na
    compPct = applicable > 0 ? Math.round((done / applicable) * 100) : 0
    compPending = items.filter(i => (map[i.key] || 'pending') === 'pending').length
  }

  // Risco dos doentes (motor partilhado)
  const ranked = patients.map(p => {
    const a = analyzeResident({
      age: p.age, conditions: p.conditions, allergies: p.allergies,
      meds: medsByPt[p.id] || [],
      incidents: incidents.filter(x => x.patient_id === p.id && x.status !== 'closed').map(x => ({ type: x.type, severity: x.severity, status: x.status })),
    })
    return { p, ...a }
  }).sort((a, b) => b.score - a.score)
  const attention = ranked.filter(r => r.level === 'critical' || r.level === 'warning')

  // ── KPIs específicos por instituição ──
  const kpis: { label: string; value: string | number; sub: string; color: string; href: string }[] = []
  kpis.push({ label: cfg.personNounPlural, value: patients.length, sub: 'em ficha', color: '#0b1120', href: '/patients' })
  if (cfg.revenue !== 'internal') kpis.push({ label: cfg.revenue === 'pos_sales' ? 'Caixa hoje' : 'Faturado hoje', value: euro(revToday), sub: `${txToday} mov.`, color: '#0d6e42', href: '/faturacao' })
  if (cfg.hasWaitingRoom) kpis.push({ label: 'Na sala de espera', value: (waitingNow ?? 0), sub: inService != null && inService > 0 ? `${inService} a atender` : 'fila', color: (waitingNow || 0) > 0 ? '#2563eb' : '#16a34a', href: '/sala-espera' })
  if (cfg.hasAppointments) kpis.push({ label: 'Marcações hoje', value: (apptToday ?? 0), sub: 'agenda', color: '#7c3aed', href: '/agenda' })
  kpis.push({ label: 'Ocorrências abertas', value: openInc.length, sub: 'por resolver', color: openInc.length ? '#dc2626' : '#16a34a', href: '/incidents' })
  if (compPct !== null) kpis.push({ label: 'Conformidade', value: `${compPct}%`, sub: compPending ? `${compPending} pendentes` : 'pronto', color: compPct >= 90 ? '#16a34a' : compPct >= 60 ? '#d97706' : '#dc2626', href: '/conformidade' })

  // Top vendas/atos por tipo (hoje)
  const byKind: Record<string, { n: number; sum: number }> = {}
  sales.forEach(s => { const k = s.kind || 'outro'; (byKind[k] ||= { n: 0, sum: 0 }); byKind[k].n++; byKind[k].sum += net(s) })
  const maxKind = Math.max(1, ...Object.values(byKind).map(v => v.sum))
  const KIND_LABEL: Record<string, string> = { venda: 'Vendas', dispensa: 'Dispensa', rastreio: 'Rastreios', consulta: 'Consultas', ato: 'Atos', outro: 'Outros' }

  const instName = cfg.unitNoun

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1040 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Tempo real</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Painel de Gestão</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Visão completa de {instName} — {cfg.currencyFlow.toLowerCase()}, atividade e qualidade.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: 'white', border: '1px solid var(--border)', borderRadius: 9 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
          {kpis.map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
              <div style={{ ...card, padding: '14px 16px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: k.color, lineHeight: 1 }}>{loading ? '—' : k.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{k.sub}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="gestao-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Receita do mês (não-internal) */}
          {cfg.revenue !== 'internal' && (
            <div style={card}>
              {secTitle(`${cfg.revenue === 'pos_sales' ? 'Caixa' : 'Faturação'} · este mês`, '/faturacao')}
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: '#0d6e42', lineHeight: 1 }}>{loading ? '—' : euro(revMonth)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>Hoje: {euro(revToday)} · {txToday} movimento(s)</div>
              {Object.keys(byKind).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  {Object.entries(byKind).sort((a, b) => b[1].sum - a[1].sum).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ink-3)' }}>{KIND_LABEL[k] || k} <span style={{ color: 'var(--ink-5)' }}>· {v.n}</span></span>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{euro(v.sum)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(v.sum / maxKind) * 100}%`, background: '#0d6e42', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fluxo de atendimento (sala de espera / agenda / atendimentos) */}
          {(cfg.hasWaitingRoom || cfg.hasAppointments || cfg.hasWalkins) && (
            <div style={card}>
              {secTitle('Fluxo de atendimento · hoje', cfg.hasWaitingRoom ? '/sala-espera' : '/agenda')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {cfg.hasWaitingRoom && <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#2563eb', lineHeight: 1 }}>{loading ? '—' : (waitingNow ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>A aguardar</div></div>}
                {cfg.hasWaitingRoom && <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#16a34a', lineHeight: 1 }}>{loading ? '—' : (servedToday ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>Atendidos hoje</div></div>}
                {cfg.hasAppointments && <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#7c3aed', lineHeight: 1 }}>{loading ? '—' : (apptToday ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>Marcações hoje</div></div>}
                {cfg.hasWalkins && <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#0d9488', lineHeight: 1 }}>{loading ? '—' : (encMonth ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>Atendimentos (mês)</div></div>}
              </div>
            </div>
          )}

          {/* Stock & validades (quem tem dispensa/stock) */}
          {stock !== null && (cfg.hasDispensing || stock.length > 0) && (
            <div style={card}>
              {secTitle('Stock & validades', '/stock')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: stockLow ? '#fef2f2' : 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: stockLow ? '#dc2626' : '#16a34a', lineHeight: 1 }}>{loading ? '—' : (stockLow ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>Em rutura</div></div>
                <div style={{ background: stockExp ? '#fffbeb' : 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: stockExp ? '#d97706' : '#16a34a', lineHeight: 1 }}>{loading ? '—' : (stockExp ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>Validade ≤30d</div></div>
              </div>
            </div>
          )}

          {/* Doentes a vigiar — motor de risco */}
          {patients.length > 0 && (
            <div style={{ ...card, gridColumn: attention.length > 4 ? '1 / -1' : 'auto' }}>
              {secTitle(`${cfg.personNounPlural} a vigiar${attention.length ? ` · ${attention.length}` : ''}`, '/rounds')}
              {loading ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A analisar…</div>
                : attention.length === 0 ? <div style={{ fontSize: 12, color: '#16a34a' }}>Sem sinais de alerta de momento.</div>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {attention.slice(0, 8).map(({ p, score, level, signals }) => {
                      const st = SEVERITY_STYLE[level as Severity]
                      const top = (signals as Signal[]).filter(s => s.severity === 'critical' || s.severity === 'warning').slice(0, 2)
                      return (
                        <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none', display: 'flex', gap: 10, padding: '10px 12px', border: `1px solid ${st.border}`, background: st.bg, borderRadius: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'white', border: `1.5px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 800, color: st.color }}>{score}</span></div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{top.map(s => s.title).join(' · ') || st.label}</div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
            </div>
          )}

          {/* Equipa */}
          <div style={card}>
            {secTitle('Equipa', '/schedule')}
            {team.length === 0 ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>Sem equipa registada. <Link href="/team" style={{ color: '#2563eb' }}>Adicionar →</Link></div> : (
              <>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#2563eb', lineHeight: 1 }}>{onShift}<span style={{ fontSize: 13, color: 'var(--ink-4)' }}> / {team.length}</span></div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>em serviço</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {team.slice(0, 8).map(mb => (
                    <span key={mb.id} style={{ fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--bg-2)', borderRadius: 6, padding: '4px 9px' }}>{mb.name.split(' ')[0]}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ocorrências abertas — full width */}
        {openInc.length > 0 && (
          <div style={{ ...card, marginTop: 12 }}>
            {secTitle(`Ocorrências abertas · ${openInc.length}`, '/incidents')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {openInc.slice(0, 8).map(i => (
                <Link key={i.id} href="/incidents" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', borderLeft: `3px solid ${i.severity === 'critical' || i.severity === 'major' ? '#dc2626' : '#d97706'}`, textDecoration: 'none', background: 'white' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{i.type} · {patients.find(p => p.id === i.patient_id)?.name || cfg.personNoun}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{new Date(i.date + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', padding: '18px 0', lineHeight: 1.6 }}>
          Painel adaptado a {instName}. Sinais que não aparecem precisam da ferramenta respetiva ativada (ver migrações sprint32/33).
        </div>
      </div>
      <style>{`@media (max-width: 760px){ .gestao-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
