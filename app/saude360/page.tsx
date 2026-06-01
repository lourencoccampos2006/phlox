'use client'

// /saude360 — Vista 360º da saúde pessoal.
// Junta num só ecrã: adesão (heatmap 90d), tendências de análises (sparklines),
// projeção de fim de comprimidos, próximos compromissos, e risco global.
// Cada widget é clicável e leva à ferramenta detalhada.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface RefillItem { name: string; pillsRemaining: number; perDay: number; daysLeft: number; outOn?: string }
interface LabSeries { test_code: string; test_label: string; unit: string; points: { x: string; y: number }[]; ref_low?: number; ref_high?: number }
interface UpcomingEvt { id: string; title: string; starts_at: string; kind: string }

export default function Saude360Page() {
  const { user, supabase } = useAuth()
  const [adherence, setAdherence] = useState<{ date: string; count: number }[]>([])
  const [refills, setRefills] = useState<RefillItem[]>([])
  const [labs, setLabs] = useState<LabSeries[]>([])
  const [evts, setEvts] = useState<UpcomingEvt[]>([])
  const [loading, setLoading] = useState(true)
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const start = new Date(Date.now() - 89 * 86400 * 1000)
      const [med, meds, lab, ev] = await Promise.all([
        supabase.from('med_logs').select('taken_at').eq('user_id', user.id).gte('taken_at', start.toISOString()).order('taken_at'),
        supabase.from('personal_meds').select('name, pills_remaining, pills_per_day').eq('user_id', user.id),
        supabase.from('lab_results').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }).limit(200),
        supabase.from('cal_events').select('id,title,starts_at,kind').eq('user_id', user.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
      ])

      // Heatmap por dia
      const days = new Map<string, number>()
      for (let i = 0; i < 90; i++) {
        const d = new Date(start.getTime() + i * 86400 * 1000)
        days.set(d.toISOString().slice(0, 10), 0)
      }
      ;(med.data || []).forEach((row: any) => {
        const k = (row.taken_at || '').slice(0, 10)
        if (days.has(k)) days.set(k, (days.get(k) || 0) + 1)
      })
      setAdherence(Array.from(days.entries()).map(([date, count]) => ({ date, count })))

      // Refill
      const today = new Date()
      const refillItems: RefillItem[] = (meds.data || [])
        .filter((m: any) => m.pills_remaining != null && m.pills_per_day)
        .map((m: any) => {
          const daysLeft = Math.max(0, Math.floor((m.pills_remaining || 0) / Math.max(0.25, m.pills_per_day)))
          const outOn = new Date(today.getTime() + daysLeft * 86400 * 1000).toISOString().slice(0, 10)
          return { name: m.name, pillsRemaining: m.pills_remaining, perDay: m.pills_per_day, daysLeft, outOn }
        })
        .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      setRefills(refillItems)

      // Lab series por test_code
      const byCode = new Map<string, LabSeries>()
      ;(lab.data || []).forEach((r: any) => {
        if (!byCode.has(r.test_code)) byCode.set(r.test_code, { test_code: r.test_code, test_label: r.test_label, unit: r.unit, points: [], ref_low: r.ref_low, ref_high: r.ref_high })
        byCode.get(r.test_code)!.points.push({ x: r.measured_at, y: r.value })
      })
      // Ordena cada série cronologicamente
      const labSeries = Array.from(byCode.values()).map(s => ({ ...s, points: s.points.sort((a, b) => a.x.localeCompare(b.x)) }))
      setLabs(labSeries)

      setEvts(ev.data || [])
      setLoading(false)
    })()
  }, [user?.id])

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)' }}>Saúde 360°</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          Adesão, tendências de análises, projeção de fim de comprimidos e próximos compromissos — num só ecrã. Disponível no plano premium.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#0d6e42', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  const adhTotal = adherence.reduce((a, b) => a + b.count, 0)
  const adhActiveDays = adherence.filter(d => d.count > 0).length
  const adhPct = Math.round((adhActiveDays / 90) * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Pessoal · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Saúde 360°</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Tudo o que importa, num só ecrã.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 14 }}>

          {/* Adesão heatmap */}
          <Card>
            <CardHead label="Adesão · últimos 90 dias" right={`${adhPct}% dias com toma`} href="/adherencia" />
            <Heatmap days={adherence} />
            <FootStats items={[
              { label: 'Tomas registadas', v: adhTotal },
              { label: 'Dias ativos', v: adhActiveDays },
            ]} />
          </Card>

          {/* Refill */}
          <Card>
            <CardHead label="Próximas faltas de comprimidos" right={refills[0] ? `${refills[0].daysLeft} d até o 1º` : '—'} href="/mymeds" />
            {refills.length === 0 ? (
              <Empty msg="Sem stock registado. Em /mymeds, indica quantos comprimidos tens e quantos tomas por dia." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {refills.slice(0, 5).map(r => {
                  const c = r.daysLeft <= 3 ? '#dc2626' : r.daysLeft <= 7 ? '#d97706' : '#475569'
                  return (
                    <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: c === '#dc2626' ? '#fef2f2' : c === '#d97706' ? '#fffbeb' : '#f8fafc', borderRadius: 7, border: `1px solid ${c}30` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>{r.pillsRemaining} cp · {r.perDay}/dia</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c, lineHeight: 1 }}>{r.daysLeft}d</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{r.outOn?.slice(5)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Lab trends */}
          <Card style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <CardHead label="Tendências de análises" right={`${labs.length} parâmetros`} href="/labs" />
            {labs.length === 0 ? (
              <Empty msg="Sem análises registadas. Acrescenta em /labs ou importa do Apple Saúde." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
                {labs.slice(0, 8).map(s => <Sparkline key={s.test_code} series={s} />)}
              </div>
            )}
          </Card>

          {/* Próximos compromissos */}
          <Card>
            <CardHead label="Próximos compromissos" right={`${evts.length}`} href="/calendario" />
            {evts.length === 0 ? (
              <Empty msg="Nenhum compromisso futuro. Adiciona consultas e exames em /calendario." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {evts.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: 7 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120' }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{e.kind}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--font-mono)' }}>
                      {new Date(e.starts_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Perfil de risco */}
          <Card>
            <CardHead label="Perfil de risco" right="SCORE2 · ACB · STOPP" href="/risco" />
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, margin: 0 }}>
              Cruza a tua medicação e os teus vitais com algoritmos validados. <Link href="/risco" style={{ color: '#0d6e42', fontWeight: 700 }}>Abrir →</Link>
            </p>
          </Card>

        </div>

        {loading && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 }}>A carregar dados…</div>}
      </div>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, ...style }}>{children}</div>
}
function CardHead({ label, right, href }: { label: string; right?: string; href: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
      <Link href={href} style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120', textDecoration: 'none', letterSpacing: '-0.01em' }}>{label}</Link>
      {right && <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{right}</span>}
    </div>
  )
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center', padding: 16, lineHeight: 1.55 }}>{msg}</div>
}
function FootStats({ items }: { items: { label: string; v: number }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: '#475569' }}>
      {items.map(it => (
        <div key={it.label}>
          <div style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{it.label}</div>
          <div style={{ fontWeight: 800, color: '#0b1120', fontSize: 14 }}>{it.v}</div>
        </div>
      ))}
    </div>
  )
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
function Heatmap({ days }: { days: { date: string; count: number }[] }) {
  // 90 dias agrupados em colunas de 7 (semanas) → 13 colunas × 7
  const cols: { date: string; count: number }[][] = []
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7))
  const max = Math.max(1, ...days.map(d => d.count))
  return (
    <div>
      <div style={{ display: 'flex', gap: 2 }}>
        {cols.map((col, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {col.map(d => {
              const intensity = d.count / max
              const bg = d.count === 0 ? '#f1f5f9' : `rgba(13,110,66,${0.25 + intensity * 0.75})`
              return <div key={d.date} title={`${d.date}: ${d.count} toma${d.count === 1 ? '' : 's'}`}
                style={{ width: 12, height: 12, borderRadius: 2, background: bg }} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ series }: { series: LabSeries }) {
  const pts = series.points
  if (!pts.length) return null
  const w = 160, h = 50, pad = 6
  const ys = pts.map(p => p.y)
  const lo = Math.min(...ys, series.ref_low ?? Infinity)
  const hi = Math.max(...ys, series.ref_high ?? -Infinity)
  const range = hi - lo || 1
  const path = pts.map((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((p.y - lo) / range) * (h - 2 * pad)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = pts[pts.length - 1]
  const outOfRange = (series.ref_low != null && last.y < series.ref_low) || (series.ref_high != null && last.y > series.ref_high)
  const c = outOfRange ? '#dc2626' : '#0d6e42'
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{series.test_label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: c }}>{last.y}</span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{series.unit}</span>
      </div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {series.ref_low != null && series.ref_high != null && (() => {
          const y1 = h - pad - ((series.ref_high - lo) / range) * (h - 2 * pad)
          const y2 = h - pad - ((series.ref_low - lo) / range) * (h - 2 * pad)
          return <rect x={pad} y={Math.min(y1, y2)} width={w - 2 * pad} height={Math.abs(y2 - y1)} fill="#16a34a" opacity={0.06} />
        })()}
        <path d={path} fill="none" stroke={c} strokeWidth={1.5} />
      </svg>
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{pts.length} medições</div>
    </div>
  )
}
