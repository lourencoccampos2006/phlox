'use client'

// HealthModule — "A minha saúde" (pessoal + cuidador, sobre a PRÓPRIA pessoa).
// REBUILD 2026-07-21: autónomo, busca os seus próprios dados (antes vinha de
// um objeto central HomeData partilhado com o resto da página).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
/* Os «alertas de saúde» saíram em 2026-10-23: liam tensões, sintomas e
   medicação e devolviam avisos classificados por nível sobre uma pessoa — a
   Regra 11 do Regulamento (UE) 2017/745 chama a isso apoio à decisão e põe-no
   em dispositivo médico. O que fica são as variações medidas, ditas como
   factos: quanto mudou o peso, quantas tomas foram marcadas. */
import type { ModeTheme } from '@/lib/modeTheme'


export default function HealthModule({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [pronto, setPronto] = useState(false)
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
      if (cancel) return
      setPronto(true)

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

  if (!pronto) return <div className="skeleton" style={{ height: 90, borderRadius: 'var(--r-lg)' }} />
  if (trend.length === 0) {
    return <div style={{ fontSize: 13, color: t.inkFaint, padding: '6px 0' }}>Ainda sem registos que cheguem para comparar.</div>
  }

  const TONE: Record<string, { c: string; bg: string }> = {
    good: { c: 'var(--green)', bg: 'var(--badge-green-bg)' }, warn: { c: 'var(--amber)', bg: 'var(--badge-amber-bg)' }, neutral: { c: t.inkSoft, bg: t.surfaceMuted },
  }

  return (
    <div>
      {trend.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 0 }}>
          {trend.map((c, i) => {
            const s = TONE[c.tone]
            return <span key={i} style={{ fontSize: 12, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 'var(--r)', padding: '4px 9px' }}>{c.label}</span>
          })}
        </div>
      )}
    </div>
  )
}
