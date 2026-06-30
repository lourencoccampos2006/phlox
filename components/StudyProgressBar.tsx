'use client'

// StudyProgressBar — barra partilhada de progresso de estudo (streak, XP, meta
// diária, "continuar onde ficaste"). Aparece no topo das ferramentas/hub de
// estudo para dar consistência e motivar o regresso diário. Lê lib/studyProgress.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { summarize, STUDY_EVENT, type StudySummary } from '@/lib/studyProgress'
import { useAuth } from '@/components/AuthContext'

export default function StudyProgressBar({ compact = false }: { compact?: boolean }) {
  const { supabase } = useAuth() as any
  const [s, setS] = useState<StudySummary | null>(null)
  const [cardsDue, setCardsDue] = useState<number | null>(null)
  useEffect(() => {
    const refresh = () => setS(summarize())
    refresh()
    window.addEventListener(STUDY_EVENT, refresh)
    return () => window.removeEventListener(STUDY_EVENT, refresh)
  }, [])

  // Cartões de repetição espaçada a rever hoje (sistema SM-2 do servidor).
  useEffect(() => {
    if (!supabase) return
    let cancel = false
    ;(async () => {
      try {
        const { data: sd } = await supabase.auth.getSession()
        if (!sd.session) return
        const r = await fetch('/api/study/cards?limit=1', { headers: { Authorization: `Bearer ${sd.session.access_token}` } })
        if (r.ok && !cancel) { const j = await r.json(); setCardsDue(j?.dashboard?.due_today || 0) }
      } catch { /* degrada — não mostra o chip */ }
    })()
    return () => { cancel = true }
  }, [supabase])

  if (!s) return null
  const ring = `conic-gradient(#7c3aed ${s.goalPct * 3.6}deg, #ede9fe ${s.goalPct * 3.6}deg)`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 12 : 16, flexWrap: 'wrap',
      background: 'white', border: '1px solid #ece9f6', borderRadius: 14,
      padding: compact ? '10px 14px' : '14px 16px', marginBottom: 16,
    }}>
      {/* Anel de meta diária */}
      <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: ring, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{s.goalPct}%</span>
          <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700 }}>META</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: compact ? 12 : 18, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        <Metric icon="🔥" value={`${s.streak}`} label={s.streak === 1 ? 'dia seguido' : 'dias seguidos'} color="#dc2626" />
        <Metric icon="✨" value={`${s.xpToday}`} label={`XP hoje · meta ${s.dailyGoal}`} color="#7c3aed" />
        <Metric icon="🎯" value={`Nv. ${s.level}`} label={`${s.xpTotal} XP total`} color="#1d4ed8" />
        {s.accuracy7d != null && <Metric icon="✅" value={`${s.accuracy7d}%`} label="acerto 7 dias" color="#0d6e42" />}
        {cardsDue != null && cardsDue > 0 && (
          <Link href="/study360?tab=review" style={{ textDecoration: 'none' }}>
            <Metric icon="🃏" value={`${cardsDue}`} label="a rever hoje" color="#b45309" />
          </Link>
        )}
      </div>

      {/* Se há cartões a rever, esse é o melhor próximo passo; senão, "continuar". */}
      {cardsDue != null && cardsDue > 0 ? (
        <Link href="/study360?tab=review" style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: '#b45309', color: 'white', borderRadius: 999,
          fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
        }}>
          🃏 Rever {cardsDue}
        </Link>
      ) : s.lastTool && (
        <Link href={s.lastTool.href} style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: '#7c3aed', color: 'white', borderRadius: 999,
          fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
        }}>
          ▸ Continuar
        </Link>
      )}
    </div>
  )
}

function Metric({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        <span style={{ marginRight: 4 }}>{icon}</span>{value}
      </div>
      <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    </div>
  )
}
