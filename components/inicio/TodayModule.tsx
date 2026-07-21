'use client'

// TodayModule — "O meu dia" (pessoal). REBUILD 2026-07-21: substitui o hero de
// gradiente por uma linha do tempo real das tomas de hoje — o género de coisa
// que só faz sentido no modo pessoal, não um molde recolorido dos outros modos.
// Autónomo: busca os seus próprios dados, não depende do /inicio central.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import type { ModeTheme } from '@/lib/modeTheme'

interface DoseEvent { time: string; medName: string; taken: boolean; pending: boolean }

export default function TodayModule({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [events, setEvents] = useState<DoseEvent[] | null>(null)

  useEffect(() => {
    if (!user || !supabase) return
    let cancel = false
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const hour = new Date().getHours()
      const [{ data: meds }, { data: logs }] = await Promise.all([
        supabase.from('personal_meds').select('id, name, reminder_times').eq('user_id', user.id),
        supabase.from('med_logs').select('med_id, status').eq('user_id', user.id).eq('date', today).eq('status', 'taken'),
      ])
      // med_logs não distingue QUAL horário do dia foi tomado, só que o
      // medicamento foi tomado hoje N vezes — aproximação já usada no resto do
      // site: as N tomas mais cedo do dia contam-se como feitas.
      const takenCountByMed = new Map<string, number>()
      ;((logs || []) as any[]).forEach(l => takenCountByMed.set(l.med_id, (takenCountByMed.get(l.med_id) || 0) + 1))

      const out: DoseEvent[] = []
      ;((meds || []) as any[]).forEach(m => {
        const times = [...(m.reminder_times || [])].sort()
        let remainingTaken = takenCountByMed.get(m.id) || 0
        times.forEach((time: string) => {
          const h = parseInt(String(time).slice(0, 2), 10)
          const taken = remainingTaken > 0
          if (taken) remainingTaken--
          out.push({ time: String(time).slice(0, 5), medName: m.name, taken, pending: !taken && !isNaN(h) && h <= hour })
        })
      })
      out.sort((a, b) => a.time.localeCompare(b.time))
      if (!cancel) setEvents(out)
    })()
    return () => { cancel = true }
  }, [user, supabase])

  if (events === null) return <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />

  const pendingCount = events.filter(e => e.pending).length

  return (
    <div>
      {events.length === 0 ? (
        <Link href="/mymeds" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', textDecoration: 'none', color: t.inkSoft, fontSize: 13.5 }}>
          <Icon name="plus" size={16} color={t.accent} /> Ainda não tens medicação com horários — adiciona a primeira
        </Link>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {pendingCount > 0 && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, marginBottom: 10 }}>
              {pendingCount === 1 ? '1 toma por fazer' : `${pendingCount} tomas por fazer`}
            </div>
          )}
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${t.border}` }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: e.pending ? t.accent : t.inkFaint, width: 42, flexShrink: 0 }}>{e.time}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: e.taken ? '#16a34a' : e.pending ? t.accent : t.border }} />
              <span style={{ flex: 1, fontSize: 13.5, color: e.taken ? t.inkFaint : t.ink, textDecoration: e.taken ? 'line-through' : 'none' }}>{e.medName}</span>
              {e.taken && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Tomado</span>}
              {e.pending && <Link href="/mymeds" style={{ fontSize: 11.5, fontWeight: 700, color: t.accent, textDecoration: 'none' }}>Marcar →</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
