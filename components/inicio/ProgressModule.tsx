'use client'

// ProgressModule — "O meu progresso" (estudante). REBUILD 2026-07-21: números
// reais em destaque (mono, como um placar), não um cartão de gradiente —
// experiência própria do modo estudante, focada em progresso e não em saúde.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { summarize, syncStudyProgress } from '@/lib/studyProgress'
import Icon from '@/components/Icon'
import type { ModeTheme } from '@/lib/modeTheme'

export default function ProgressModule({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [s, setS] = useState<ReturnType<typeof summarize> | null>(null)
  const [cardsDue, setCardsDue] = useState<number | null>(null)
  const [examSoon, setExamSoon] = useState<{ name: string; days: number } | null>(null)

  useEffect(() => {
    syncStudyProgress()
    setS(summarize())
  }, [])

  useEffect(() => {
    if (!user || !supabase) return
    ;(async () => {
      try {
        const { data: sd } = await supabase.auth.getSession()
        const r = await fetch('/api/study/cards?limit=1', { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
        if (r.ok) { const j = await r.json(); setCardsDue(j?.dashboard?.due_today || 0) }
      } catch { setCardsDue(0) }
    })()
  }, [user, supabase])

  // Próximo exame a contar (Modo Exame) — se houver um objetivo ativo, é o
  // sinal mais urgente de "por onde continuar" no /inicio.
  useEffect(() => {
    if (!user || !supabase) return
    ;(async () => {
      try {
        const { data: sd } = await supabase.auth.getSession()
        const r = await fetch('/api/study/exam-mode', { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
        if (!r.ok) return
        const j = await r.json()
        const goals = Array.isArray(j.goals) ? j.goals : []
        if (!goals.length) return
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const soonest = [...goals].sort((a: any, b: any) => a.exam_date.localeCompare(b.exam_date))[0]
        const exam = new Date(soonest.exam_date + 'T00:00:00')
        const days = Math.round((exam.getTime() - today.getTime()) / 86400000)
        setExamSoon({ name: soonest.name, days })
      } catch { /* sem exame ativo — normal */ }
    })()
  }, [user, supabase])

  if (!s) return <div className="skeleton" style={{ height: 100, borderRadius: 10 }} />

  const stats = [
    { n: s.streak, l: s.streak === 1 ? 'dia seguido' : 'dias seguidos', icon: 'flame' },
    { n: s.xpToday, l: `XP hoje · meta ${s.dailyGoal}`, icon: 'target' },
    { n: s.level, l: `nível · ${s.xpTotal} XP total`, icon: 'trophy' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
        {stats.map(st => (
          <div key={st.l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={st.icon} size={17} color={t.accent} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{st.n}</div>
              <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 2 }}>{st.l}</div>
            </div>
          </div>
        ))}
      </div>

      {cardsDue != null && cardsDue > 0 && (
        <Link href="/study/notas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${t.border}`, textDecoration: 'none' }}>
          <span style={{ fontSize: 13.5, color: t.ink }}>{cardsDue === 1 ? '1 cartão para rever hoje' : `${cardsDue} cartões para rever hoje`}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>Rever →</span>
        </Link>
      )}
      {examSoon && (
        <Link href="/modo-exame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${t.border}`, textDecoration: 'none' }}>
          <span style={{ fontSize: 13.5, color: t.ink }}>{examSoon.days >= 0 ? `${examSoon.days} dias até ${examSoon.name}` : `${examSoon.name} já passou`}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>Ver plano →</span>
        </Link>
      )}
      {s.weakAreas[0] && (
        <Link href={`/study?mode=quiz&area=${encodeURIComponent(s.weakAreas[0].area)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${t.border}`, textDecoration: 'none' }}>
          <span style={{ fontSize: 13.5, color: t.ink }}>Reforçar {s.weakAreas[0].area}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>Praticar →</span>
        </Link>
      )}
    </div>
  )
}
