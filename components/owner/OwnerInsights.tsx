'use client'

// Phlox Insights — era a página /insights. Fundido em /painel-dono como
// separador "Comparar" (Pro): benchmarks anonimizados contra o pool de
// instituições do mesmo tipo. Gate de plano feito aqui (a rota antiga só
// bloqueava por ser uma página inteira em PLAN_ROUTES — agora que é um
// separador, o gate tem de estar no componente + na API, ver route.ts).

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Metric { key: string; label: string; unit: string; better_high: boolean; me: number; p25: number; median: number; p75: number; p90: number; my_percentile: number | null }
interface Resp { institution_type?: string; pool_size: number; window?: string; metrics?: Metric[]; blocked?: string; error?: string }

const eur = (v: number) => `${(Math.round(v)).toLocaleString('pt-PT')}€`
const fmt = (v: number, unit: string) => unit === '€' ? eur(v) : String(Math.round(v))

function UpgradeGate() {
  return (
    <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Funcionalidade Pro</h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
        Compara-te, de forma anonimizada, com o pool de instituições do mesmo tipo — mediana, percentis e onde estás.
      </p>
      <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '11px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
        Upgrade para Pro — 12,99€/mês →
      </Link>
      <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 16, fontFamily: 'var(--font-mono)' }}>Cancela quando quiseres. Sem compromisso.</p>
    </div>
  )
}

export default function OwnerInsights() {
  const { user, supabase } = useAuth() as any
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [r, setR] = useState<Resp | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/insights/benchmark', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Erro')
      else setR(j)
    } catch (e: any) { setErr(String(e?.message || e)) }
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (isPro) load() }, [isPro, load])

  if (!isPro) return <UpgradeGate />

  return (
    <div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '0 0 16px', lineHeight: 1.6 }}>Benchmarks anonimizados contra o pool de instituições do mesmo tipo. Janela: últimos 30 dias. Os dados que aqui aparecem nunca identificam outras instituições.</p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}</div>
      ) : err ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 18, color: '#991b1b', fontSize: 13.5 }}>{err}</div>
      ) : r?.blocked ? (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 18, color: '#92400e', fontSize: 13.5 }}>
          <strong>Pool insuficiente</strong> — {r.blocked} O Phlox respeita k-anonymity: precisamos de pelo menos 5 instituições do mesmo tipo para mostrar agregados sem risco de identificação.
        </div>
      ) : r?.metrics ? (
        <>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>Comparado com <strong style={{ color: 'var(--ink)' }}>{r.pool_size}</strong> instituição(ões) do tipo <strong style={{ color: 'var(--ink)' }}>{r.institution_type}</strong>.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.metrics.map(m => <MetricCard key={m.key} m={m} />)}
          </div>

          <div style={{ marginTop: 18, fontSize: 11.5, color: '#9ca3af', lineHeight: 1.6 }}>
            Metodologia: agregados calculados sobre {r.pool_size} pares; mediana, percentis (p25, p75, p90) com interpolação linear. O teu valor é comparado contra a distribuição. Pool inclui apenas planos Pro e Institucional.
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/trust" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Como protegemos a privacidade →</Link>
      </div>
    </div>
  )
}

function MetricCard({ m }: { m: Metric }) {
  const pct = m.my_percentile ?? 0
  const good = m.better_high ? pct >= 50 : pct < 50
  const arrowColor = good ? '#16a34a' : pct >= 75 || pct < 25 ? '#d97706' : '#64748b'

  const maxVal = Math.max(m.p90, m.me, 1)
  const xOf = (v: number) => Math.max(2, Math.min(98, (v / maxVal) * 95))

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.label}</span>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>{fmt(m.me, m.unit)}</span>
          {m.my_percentile != null && <span style={{ fontSize: 12.5, fontWeight: 700, color: arrowColor }}>percentil {m.my_percentile}</span>}
        </div>
      </div>

      <div style={{ position: 'relative', height: 36, marginBottom: 6 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 14, height: 8, background: 'linear-gradient(to right, #fef2f2, #fffbeb 25%, #f0fdf4 50%, #eff6ff 75%, #f5f3ff)', borderRadius: 4, border: '1px solid var(--border)' }} />
        {[
          { v: m.p25, l: 'p25', c: '#9ca3af' },
          { v: m.median, l: 'mediana', c: '#475569' },
          { v: m.p75, l: 'p75', c: '#9ca3af' },
          { v: m.p90, l: 'p90', c: '#9ca3af' },
        ].map(t => (
          <div key={t.l} style={{ position: 'absolute', left: `${xOf(t.v)}%`, top: 8, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 1.5, height: 20, background: t.c }} />
            <div style={{ fontSize: 9, color: t.c, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{t.l}</div>
          </div>
        ))}
        <div style={{ position: 'absolute', left: `${xOf(m.me)}%`, top: 4, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: arrowColor, color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>TU</div>
          <div style={{ width: 2, height: 14, background: arrowColor, marginTop: 1 }} />
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>p25: {fmt(m.p25, m.unit)}</span>
        <span>mediana: <strong style={{ color: 'var(--ink-3)' }}>{fmt(m.median, m.unit)}</strong></span>
        <span>p75: {fmt(m.p75, m.unit)}</span>
        <span>p90: {fmt(m.p90, m.unit)}</span>
      </div>
    </div>
  )
}
