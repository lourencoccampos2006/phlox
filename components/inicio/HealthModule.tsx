'use client'

// HealthModule — "A minha saúde" (pessoal + cuidador, sobre a PRÓPRIA pessoa).
// REBUILD 2026-07-21: autónomo, busca os seus próprios dados (antes vinha de
// um objeto central HomeData partilhado com o resto da página).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { computeHealthAlerts, type HealthAlert } from '@/lib/healthAlerts'
import { getAlertPrefs } from '@/lib/alertPrefs'
import type { ModeTheme } from '@/lib/modeTheme'

const LVL_COLOR: Record<string, string> = { high: '#dc2626', medium: '#b45309', low: '#2563eb' }

export default function HealthModule({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [alerts, setAlerts] = useState<HealthAlert[] | null>(null)
  const [trend, setTrend] = useState<{ label: string; tone: 'good' | 'warn' | 'neutral' }[]>([])

  useEffect(() => {
    if (!user || !supabase) return
    let cancel = false
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const monthAgo = new Date(Date.now() - 60 * 86400000).toISOString()
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [{ data: meds }, { data: logs }, { data: vitals }, { data: syms }] = await Promise.all([
        supabase.from('personal_meds').select('name, pills_remaining, pills_per_day').eq('user_id', user.id),
        supabase.from('med_logs').select('id').eq('user_id', user.id).gte('date', today).eq('status', 'taken'),
        supabase.from('vitals').select('bp_sys,bp_dia,hr,spo2,glucose,weight,temp,recorded_at').eq('user_id', user.id).gte('recorded_at', monthAgo).order('recorded_at', { ascending: false }).limit(40),
        supabase.from('symptom_logs').select('at, pain, temperature, symptoms').eq('user_id', user.id).is('profile_id', null).gte('at', weekAgo).then((r: any) => r, () => ({ data: [] })),
      ])
      const vitalRows = (vitals || []) as any[]
      const totalSlots = ((meds || []) as any[]).length
      const adherencePct = totalSlots > 0 ? Math.round(((logs || []).length / Math.max(1, totalSlots)) * 100) : null
      const out = computeHealthAlerts({
        meds: (meds || []).map((m: any) => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
        age: null, sex: null, conditions: null, vitalSeries: vitalRows, symptoms: (syms || []) as any[], adherencePct,
      })
      if (cancel) return
      const allowed = new Set(getAlertPrefs())
      setAlerts(out.filter(a => allowed.has(a.category)).slice(0, 3))

      const chips: { label: string; tone: 'good' | 'warn' | 'neutral' }[] = []
      const weights = vitalRows.filter(v => v.weight != null)
      if (weights.length >= 2) {
        const delta = Math.round((weights[0].weight - weights[weights.length - 1].weight) * 10) / 10
        if (Math.abs(delta) >= 0.3) chips.push({ label: `Peso ${delta < 0 ? '↓' : '↑'}${Math.abs(delta)} kg`, tone: 'neutral' })
      }
      const bps = vitalRows.filter(v => v.bp_sys != null)
      if (bps.length >= 2) {
        const diff = bps[0].bp_sys - bps[bps.length - 1].bp_sys
        if (diff <= -5) chips.push({ label: 'Tensão a melhorar', tone: 'good' })
        else if (diff >= 5) chips.push({ label: 'Tensão a subir', tone: 'warn' })
      }
      if (adherencePct != null) chips.push({ label: `Medicação ${adherencePct}%`, tone: adherencePct >= 80 ? 'good' : adherencePct >= 50 ? 'neutral' : 'warn' })
      setTrend(chips)
    })()
    return () => { cancel = true }
  }, [user, supabase])

  if (alerts === null) return <div className="skeleton" style={{ height: 90, borderRadius: 10 }} />
  if (alerts.length === 0 && trend.length === 0) {
    return <div style={{ fontSize: 13, color: t.inkFaint, padding: '6px 0' }}>Está tudo calmo — sem sinais a assinalar.</div>
  }

  const TONE: Record<string, { c: string; bg: string }> = {
    good: { c: '#15803d', bg: '#f0fdf4' }, warn: { c: '#b45309', bg: '#fffbeb' }, neutral: { c: t.inkSoft, bg: t.surfaceMuted },
  }

  return (
    <div>
      {alerts.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${t.border}` }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: LVL_COLOR[a.level] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{a.title}</div>
            {a.detail && <div style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 1 }}>{a.detail}</div>}
          </div>
          {a.href && <Link href={a.href} style={{ fontSize: 11.5, fontWeight: 700, color: t.accent, textDecoration: 'none', flexShrink: 0, alignSelf: 'center' }}>{a.cta || 'Ver'} →</Link>}
        </div>
      ))}
      {trend.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: alerts.length > 0 ? 10 : 0 }}>
          {trend.map((c, i) => {
            const s = TONE[c.tone]
            return <span key={i} style={{ fontSize: 12, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 6, padding: '4px 9px' }}>{c.label}</span>
          })}
        </div>
      )}
    </div>
  )
}
