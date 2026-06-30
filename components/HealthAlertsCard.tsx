'use client'

// HealthAlertsCard — avisos proativos no /inicio: o Phlox olha para a sua medicação,
// vitais (com TENDÊNCIAS), sintomas, stock e adesão e diz-lhe o que merece atenção HOJE.
// 100% determinístico (lib/healthAlerts + lib/healthTrends) — sem custo de IA, por isso é
// GRÁTIS no modo pessoal (segurança básica). Atualiza sozinho.

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

  useEffect(() => {
    if (!user || !supabase) return
    let cancelled = false
    ;(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const monthAgo = new Date(Date.now() - 60 * 86400000).toISOString()
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        // Lê dados reais do PRÓPRIO. Tudo degrada a vazio se faltar tabela/coluna.
        const [{ data: meds }, { data: vitals }, { data: logs }, { data: syms }, { data: prof }] = await Promise.all([
          supabase.from('personal_meds').select('name, reminder_times, pills_remaining, pills_per_day').eq('user_id', user.id),
          supabase.from('vitals').select('bp_sys,bp_dia,hr,spo2,glucose,weight,temp,recorded_at').eq('user_id', user.id).gte('recorded_at', monthAgo).order('recorded_at', { ascending: false }).limit(40),
          supabase.from('med_logs').select('id').eq('user_id', user.id).gte('date', today).eq('status', 'taken'),
          supabase.from('symptom_logs').select('at, pain, temperature, symptoms').eq('user_id', user.id).is('profile_id', null).gte('at', weekAgo).then((r: any) => r, () => ({ data: [] })),
          supabase.from('profiles').select('age, sex, conditions').eq('id', user.id).maybeSingle().then((r: any) => r, () => ({ data: null })),
        ])
        const medRows = (meds || []) as any[]
        const totalSlots = medRows.reduce((n: number, m: any) => n + (m.reminder_times?.length || 0), 0)
        const taken = (logs || []).length
        const adherencePct = totalSlots > 0 ? Math.round((taken / totalSlots) * 100) : null
        const out = computeHealthAlerts({
          meds: medRows.map(m => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
          age: prof?.age ?? (user as any)?.age ?? null,
          sex: prof?.sex ?? (user as any)?.sex ?? null,
          conditions: prof?.conditions ?? (user as any)?.conditions ?? null,
          vitalSeries: (vitals || []) as any[],
          symptoms: (syms || []) as any[],
          adherencePct,
        })
        if (!cancelled) setAlerts(out)
      } catch { if (!cancelled) setAlerts([]) }
    })()
    return () => { cancelled = true }
  }, [user, supabase])

  if (!alerts || alerts.length === 0) return null

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
