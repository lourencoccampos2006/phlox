'use client'

// HealthAlertsCard — PRO. Avisos proativos no /inicio: o Phlox olha para a tua
// medicação, vitais recentes e adesão e diz-te o que merece atenção HOJE.
// 100% determinístico (lib/healthAlerts) — sem custo de IA, atualiza sozinho.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { computeHealthAlerts, type HealthAlert } from '@/lib/healthAlerts'

const LVL: Record<HealthAlert['level'], { c: string; bg: string; b: string }> = {
  high:   { c: '#991b1b', bg: '#fef2f2', b: '#fecaca' },
  medium: { c: '#92400e', bg: '#fffbeb', b: '#fde68a' },
  low:    { c: '#1e40af', bg: '#eff6ff', b: '#bfdbfe' },
}

export default function HealthAlertsCard() {
  const { user, supabase } = useAuth() as any
  const [alerts, setAlerts] = useState<HealthAlert[] | null>(null)

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'

  useEffect(() => {
    if (!isPro || !user || !supabase) return
    let cancelled = false
    ;(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const [{ data: meds }, { data: vitals }, { data: logs }, { data: slots }] = await Promise.all([
          supabase.from('personal_meds').select('name').eq('user_id', user.id),
          supabase.from('vitals').select('bp_sys,bp_dia,hr,spo2,glucose,recorded_at').eq('user_id', user.id).gte('recorded_at', weekAgo).order('recorded_at', { ascending: false }).limit(1),
          supabase.from('med_logs').select('id').eq('user_id', user.id).gte('date', today).eq('status', 'taken'),
          supabase.from('personal_meds').select('reminder_times').eq('user_id', user.id).not('reminder_times', 'is', null),
        ])
        const totalSlots = (slots || []).reduce((n: number, m: any) => n + (m.reminder_times?.length || 0), 0)
        const taken = (logs || []).length
        const adherencePct = totalSlots > 0 ? Math.round((taken / totalSlots) * 100) : null
        const prof = user
        const out = computeHealthAlerts({
          meds: meds || [],
          age: (prof as any)?.age ?? null,
          sex: (prof as any)?.sex ?? null,
          conditions: (prof as any)?.conditions ?? null,
          vitals: (vitals || [])[0] || null,
          adherencePct,
        })
        if (!cancelled) setAlerts(out)
      } catch { if (!cancelled) setAlerts([]) }
    })()
    return () => { cancelled = true }
  }, [isPro, user, supabase])

  if (!isPro || !alerts || alerts.length === 0) return null

  return (
    <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>🔔</span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>A precisar de atenção</span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>· {alerts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => {
          const s = LVL[a.level]
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: s.bg, border: `1px solid ${s.b}`, borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: s.c }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: s.c, opacity: 0.9, lineHeight: 1.5, marginTop: 2 }}>{a.detail}</div>
              </div>
              {a.href && (
                <Link href={a.href} style={{ flexShrink: 0, alignSelf: 'center', fontSize: 11.5, fontWeight: 800, color: s.c, textDecoration: 'none', whiteSpace: 'nowrap' }}>{a.cta || 'Ver'} →</Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
