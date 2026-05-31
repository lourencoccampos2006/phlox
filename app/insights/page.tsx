'use client'

// Phlox Insights — benchmarks anonimizados contra o pool de instituições do mesmo
// tipo. Mostra média, p25/p75/p90 e onde estou no percentil. Aprende com o agregado
// sem expor dados individuais.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Metric { key: string; label: string; unit: string; better_high: boolean; me: number; p25: number; median: number; p75: number; p90: number; my_percentile: number | null }
interface Resp { institution_type?: string; pool_size: number; window?: string; metrics?: Metric[]; blocked?: string; error?: string }

const eur = (v: number) => `${(Math.round(v)).toLocaleString('pt-PT')}€`
const fmt = (v: number, unit: string) => unit === '€' ? eur(v) : String(Math.round(v))

export default function InsightsPage() {
  const { supabase } = useAuth() as any
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

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Insights (Pro)</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Como te comparas</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>Benchmarks anonimizados contra o pool de instituições do mesmo tipo. Janela: últimos 30 dias. Os dados que aqui aparecem nunca identificam outras instituições.</p>
        </div>

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
          <Link href="/roi" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Indicadores internos →</Link>
          <Link href="/trust" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Como protegemos a privacidade →</Link>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ m }: { m: Metric }) {
  const pct = m.my_percentile ?? 0
  // posição: better_high → high pct é bom. Caso contrário, alto pct é mau.
  const good = m.better_high ? pct >= 50 : pct < 50
  const arrowColor = good ? '#16a34a' : pct >= 75 || pct < 25 ? '#d97706' : '#64748b'
  const trackColors = ['#fef2f2', '#fffbeb', '#f0fdf4', '#eff6ff', '#f5f3ff']

  // posições em % no eixo (0–100) para p25 / median / p75 / p90 e meu valor.
  // Mapeamento simples: 0..p90 → 0..90, > p90 → 95. Garante visualização decente.
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

      {/* eixo */}
      <div style={{ position: 'relative', height: 36, marginBottom: 6 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 14, height: 8, background: 'linear-gradient(to right, #fef2f2, #fffbeb 25%, #f0fdf4 50%, #eff6ff 75%, #f5f3ff)', borderRadius: 4, border: '1px solid var(--border)' }} />
        {/* marcadores */}
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
        {/* meu marcador */}
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
