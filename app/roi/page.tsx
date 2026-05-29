'use client'

// Indicadores & Desempenho — painel de ANALYTICS REAL da instituição (substitui a
// antiga "calculadora de poupança", que era só argumento de venda e inútil para quem
// já usa o Phlox). Lê os dados reais e mostra tendências e KPIs ESPECÍFICOS por tipo:
//  • farmácia / clínica / CSP → receita, ticket médio, vendas por tipo/método, atividade
//  • lar / hospital → ocupação, adesão ao MAR, registos por turno, ocorrências
// Tudo a partir dos dados existentes — zero sliders de hipóteses.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { printDoc } from '@/lib/print'

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€`
const euro2 = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
async function safe(p: any): Promise<any[] | null> { try { const { data, error } = await p; if (error) return null; return data || [] } catch { return null } }

// últimos 6 meses como chaves YYYY-MM
function last6Months(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
  return out
}
const mLabel = (key: string) => MONTH_LABELS[parseInt(key.slice(5, 7)) - 1]

function TrendBars({ data, color, fmt }: { data: { key: string; value: number }[]; color: string; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, padding: '0 2px' }}>
      {data.map(d => (
        <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(d.value) : d.value}</span>
          <div style={{ width: '100%', maxWidth: 38, height: `${Math.max(4, (d.value / max) * 86)}px`, background: color, borderRadius: '5px 5px 0 0', transition: 'height 0.4s ease' }} />
          <span style={{ fontSize: 10, color: 'var(--ink-5)' }}>{mLabel(d.key)}</span>
        </div>
      ))}
    </div>
  )
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

export default function IndicadoresPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const isRevenue = cfg.revenue === 'pos_sales' || cfg.revenue === 'fee_for_service'
  const isLar = institution === 'nursing_home'

  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any[]>([])
  const [encounters, setEncounters] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [care, setCare] = useState<any[]>([])
  const [mar, setMar] = useState<any[]>([])

  const months = last6Months()
  const sinceMonth = months[0] + '-01'

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const sinceISO = new Date(sinceMonth + 'T00:00:00').toISOString()
    const [sl, enc, inc, p, t, cr, mr] = await Promise.all([
      isRevenue ? safe(supabase.from('sales').select('at,kind,gross,discount,method').eq('user_id', user.id).gte('at', sinceISO)) : Promise.resolve([]),
      cfg.hasWalkins ? safe(supabase.from('encounters').select('at,type').eq('user_id', user.id).gte('at', sinceISO)) : Promise.resolve([]),
      safe(supabase.from('incidents').select('type,severity,date').eq('user_id', user.id).gte('date', sinceMonth)),
      safe(supabase.from('patients').select('id,active,admission_date,discharge_date').eq('user_id', user.id)),
      safe(supabase.from('team_members').select('id,status').eq('user_id', user.id)),
      isLar ? safe(supabase.from('care_records').select('date,shift').eq('user_id', user.id).gte('date', sinceMonth)) : Promise.resolve([]),
      isLar ? safe(supabase.from('mar_records').select('date,status').eq('user_id', user.id).gte('date', sinceMonth)) : Promise.resolve([]),
    ])
    setSales(sl || []); setEncounters(enc || []); setIncidents(inc || [])
    setPatients((p || []).filter((x: any) => x.active !== false)); setTeam(t || [])
    setCare(cr || []); setMar(mr || [])
    setLoading(false)
  }, [user, supabase, sinceMonth, isRevenue, isLar, cfg.hasWalkins])

  useEffect(() => { load() }, [load])

  const net = (s: any) => Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0))
  const monthKey = (iso: string) => iso.slice(0, 7)

  // ── Receita ──
  const revByMonth = months.map(k => ({ key: k, value: sales.filter(s => monthKey(s.at) === k).reduce((a, s) => a + net(s), 0) }))
  const txByMonth = months.map(k => ({ key: k, value: sales.filter(s => monthKey(s.at) === k).length }))
  const revTotal = sales.reduce((a, s) => a + net(s), 0)
  const txTotal = sales.length
  const avgTicket = txTotal ? revTotal / txTotal : 0
  const thisM = months[months.length - 1]
  const prevM = months[months.length - 2]
  const revThis = revByMonth[revByMonth.length - 1]?.value || 0
  const revPrev = revByMonth[revByMonth.length - 2]?.value || 0
  const revDelta = revPrev > 0 ? Math.round(((revThis - revPrev) / revPrev) * 100) : 0
  const byMethod: Record<string, number> = {}; sales.forEach(s => { byMethod[s.method] = (byMethod[s.method] || 0) + net(s) })
  const byKind: Record<string, number> = {}; sales.forEach(s => { byKind[s.kind] = (byKind[s.kind] || 0) + net(s) })

  // ── Atividade (atendimentos / encounters) ──
  const encByMonth = months.map(k => ({ key: k, value: encounters.filter(e => monthKey(e.at) === k).length }))

  // ── Ocorrências ──
  const incByMonth = months.map(k => ({ key: k, value: incidents.filter(i => (i.date || '').slice(0, 7) === k).length }))
  const incTotal = incidents.length
  const fallsTotal = incidents.filter(i => i.type === 'fall').length

  // ── Lar: adesão MAR + registos ──
  const marDone = mar.filter(m => m.status === 'administered').length
  const marPct = mar.length ? Math.round((marDone / mar.length) * 100) : 0
  const careByMonth = months.map(k => ({ key: k, value: care.filter(c => (c.date || '').slice(0, 7) === k).length }))
  const admissions6m = patients.filter(p => months.includes((p.admission_date || '').slice(0, 7))).length

  const onShift = team.filter(m => m.status === 'on_shift' || m.status === 'active').length
  const METHOD_LABEL: Record<string, string> = { dinheiro: 'Dinheiro', multibanco: 'Multibanco', mbway: 'MB WAY', transferencia: 'Transf.', comparticipado: 'Compart.', isento: 'Isento' }
  const KIND_LABEL: Record<string, string> = { venda: 'Vendas', dispensa: 'Dispensa', rastreio: 'Rastreios', consulta: 'Consultas', ato: 'Atos', outro: 'Outros' }

  // ── KPIs de topo (por tipo) ──
  const kpis: { label: string; value: string; sub?: string; color: string; delta?: number }[] = []
  if (isRevenue) {
    kpis.push({ label: `Receita · ${mLabel(thisM)}`, value: euro(revThis), color: '#0d6e42', delta: revDelta })
    kpis.push({ label: 'Receita 6 meses', value: euro(revTotal), color: '#0b1120' })
    kpis.push({ label: 'Ticket médio', value: euro2(avgTicket), sub: `${txTotal} movimentos`, color: '#2563eb' })
  }
  if (cfg.hasWalkins) kpis.push({ label: 'Atendimentos 6m', value: String(encounters.length), color: '#7c3aed' })
  if (isLar) {
    kpis.push({ label: `${cfg.personNounPlural}`, value: String(patients.length), color: '#0b1120' })
    kpis.push({ label: 'Adesão MAR', value: `${marPct}%`, sub: 'doses administradas', color: marPct >= 90 ? '#16a34a' : '#d97706' })
    kpis.push({ label: 'Admissões 6m', value: String(admissions6m), color: '#2563eb' })
  }
  kpis.push({ label: 'Ocorrências 6m', value: String(incTotal), sub: fallsTotal ? `${fallsTotal} quedas` : undefined, color: incTotal ? '#d97706' : '#16a34a' })
  kpis.push({ label: 'Equipa ativa', value: `${onShift}/${team.length}`, color: '#0891b2' })

  function printReport() {
    printDoc({
      docTitle: 'Indicadores & Desempenho',
      docSubtitle: `${cfg.unitNoun} · últimos 6 meses`,
      meta: [
        ...(isRevenue ? [{ label: 'receita 6m', value: euro(revTotal) }, { label: 'ticket médio', value: euro2(avgTicket) }] : []),
        ...(isLar ? [{ label: 'adesão MAR', value: `${marPct}%` }] : []),
        { label: 'ocorrências', value: String(incTotal) },
      ],
      sections: [
        ...(isRevenue ? [{ heading: 'Receita por mês', records: [{ title: 'Tendência', fields: revByMonth.map(d => ({ label: mLabel(d.key), value: euro(d.value) })) }] }] : []),
        ...(isRevenue && Object.keys(byKind).length ? [{ heading: 'Por tipo', records: [{ title: '', fields: Object.entries(byKind).map(([k, v]) => ({ label: KIND_LABEL[k] || k, value: euro(v) })) }] }] : []),
        ...(isLar ? [{ heading: 'Operação', records: [{ title: '', fields: [{ label: 'Adesão MAR', value: `${marPct}%` }, { label: 'Registos 6m', value: String(care.length) }, { label: 'Admissões 6m', value: String(admissions6m) }] }] }] : []),
        { heading: 'Ocorrências por mês', records: [{ title: '', fields: incByMonth.map(d => ({ label: mLabel(d.key), value: String(d.value) })) }] },
      ],
      footerNote: 'Indicadores reais · Phlox',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · {cfg.unitNoun}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Indicadores & Desempenho</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Os teus números reais dos últimos 6 meses — {isRevenue ? 'receita, atividade' : 'operação, qualidade'} e tendências.</p>
          </div>
          <button onClick={printReport} style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: '#374151' }}>Imprimir relatório</button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: k.color, lineHeight: 1 }}>{loading ? '—' : k.value}</span>
                {k.delta !== undefined && k.delta !== 0 && !loading && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: k.delta > 0 ? '#16a34a' : '#dc2626' }}>{k.delta > 0 ? '▲' : '▼'} {Math.abs(k.delta)}%</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{k.label}</div>
              {k.sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        <div className="ind-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Receita por mês */}
          {isRevenue && (
            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Receita por mês</span>
                <Link href="/faturacao" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Abrir caixa →</Link>
              </div>
              {loading ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> : <TrendBars data={revByMonth} color="#0d6e42" fmt={euro} />}
            </div>
          )}

          {/* Vendas por tipo */}
          {isRevenue && Object.keys(byKind).length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 12 }}>Por tipo</div>
              {(() => { const mx = Math.max(1, ...Object.values(byKind)); return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ink-3)' }}>{KIND_LABEL[k] || k}</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{euro(v)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(v / mx) * 100}%`, background: '#0d6e42', borderRadius: 3 }} /></div>
                    </div>
                  ))}
                </div>
              ) })()}
            </div>
          )}

          {/* Métodos de pagamento */}
          {isRevenue && Object.keys(byMethod).length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 12 }}>Métodos de pagamento</div>
              {(() => { const mx = Math.max(1, ...Object.values(byMethod)); return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ink-3)' }}>{METHOD_LABEL[k] || k}</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{euro(v)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(v / mx) * 100}%`, background: '#2563eb', borderRadius: 3 }} /></div>
                    </div>
                  ))}
                </div>
              ) })()}
            </div>
          )}

          {/* Atividade (atendimentos) */}
          {cfg.hasWalkins && (
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 14 }}>Atendimentos por mês</div>
              {loading ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> : <TrendBars data={encByMonth} color="#7c3aed" />}
            </div>
          )}

          {/* Lar: registos por mês */}
          {isLar && (
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 14 }}>Registos de cuidado por mês</div>
              {loading ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> : <TrendBars data={careByMonth} color="#2563eb" />}
            </div>
          )}

          {/* Ocorrências por mês — todas */}
          <div style={{ ...card, gridColumn: isRevenue ? 'auto' : '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Ocorrências por mês</span>
              <Link href="/incidents" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver →</Link>
            </div>
            {loading ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> : <TrendBars data={incByMonth} color="#d97706" />}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', padding: '18px 0', lineHeight: 1.6 }}>
          Indicadores calculados a partir dos teus dados reais. {isRevenue ? 'Receita precisa de vendas/atos registados em Faturação.' : 'Quanto mais registas, mais fiáveis ficam.'}
        </div>
      </div>
      <style>{`@media (max-width: 760px){ .ind-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
