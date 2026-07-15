'use client'

// RiskIndexCard — Índice de Risco Contínuo (Pro Ronda 3). Um número sempre
// atualizado (0-100), recalculado automaticamente ao abrir a página, com
// tendência dos últimos 14 dias. Sem profileId = a própria pessoa; com
// profileId = um familiar (lib/riskIndex partilha a MESMA fórmula dos dois).
// Fonte: /api/risk-index.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'

interface TopFactor { title: string; severity: string }
interface RiskResp {
  today: { score: number; level: 'critical' | 'warning' | 'info' | 'ok'; topFactors: TopFactor[] }
  history: { snapshot_date: string; score: number; level: string }[]
}

const LEVEL_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Precisa de atenção', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  warning:  { label: 'A acompanhar',       color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  info:     { label: 'Tudo sob controlo',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  ok:       { label: 'Tudo bem',           color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26, cx = 32, cy = 32
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={64} height={64} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: 'rotate(90deg) translate(0px, -64px)', fontSize: 16, fontWeight: 800, fill: color, fontFamily: 'var(--font-mono, monospace)' }}>
        {score}
      </text>
    </svg>
  )
}

export default function RiskIndexCard({ profileId, title = 'Índice de Risco' }: { profileId?: string; title?: string }) {
  const { supabase } = useAuth() as any
  const [data, setData] = useState<RiskResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr('')
      try {
        const { data: sd } = await supabase.auth.getSession()
        const url = profileId ? `/api/risk-index?profile_id=${profileId}` : '/api/risk-index'
        const res = await fetch(url, { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
        const j = await res.json()
        if (!cancelled) { if (!res.ok) setErr(j.error || 'Erro'); else setData(j) }
      } catch (e: any) { if (!cancelled) setErr(String(e?.message || e)) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, profileId])

  if (loading) return <div className="skeleton" style={{ height: 88, borderRadius: 14 }} />
  if (err || !data) return null

  const lv = LEVEL_META[data.today.level]
  const hist = data.history
  const trend = hist.length >= 2 ? data.today.score - hist[0].score : null

  return (
    <div style={{ background: 'white', border: `1px solid ${lv.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ScoreRing score={data.today.score} color={lv.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: lv.color }}>{lv.label}</span>
            {trend != null && trend !== 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: trend > 0 ? '#b45309' : '#15803d' }}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)} em {hist.length} dias
              </span>
            )}
          </div>
          {data.today.topFactors.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
              {data.today.topFactors.slice(0, 2).map(f => f.title).join(' · ')}
            </div>
          )}
        </div>
      </div>
      {hist.length >= 3 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28, marginTop: 12 }}>
          {hist.map((h, i) => (
            <div key={i} title={`${h.snapshot_date}: ${h.score}`} style={{ flex: 1, height: `${Math.max(8, h.score)}%`, background: LEVEL_META[h.level]?.color || '#cbd5e1', borderRadius: 2, opacity: 0.55 + (i / hist.length) * 0.45 }} />
          ))}
        </div>
      )}
    </div>
  )
}
