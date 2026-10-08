'use client'

// StudyProgressBar — barra partilhada de progresso de estudo (streak, XP, meta
// diária, "continuar onde ficaste"). Aparece no topo das ferramentas/hub de
// estudo para dar consistência e motivar o regresso diário. Lê lib/studyProgress.
// BUG CORRIGIDO 2026-07-17: o CTA "Rever" apontava para /study360?tab=review —
// /study360 é um redirect incondicional para /study que ignora query strings
// (Ronda 13b), por isso o "?tab=review" nunca chegava a lado nenhum. A revisão
// espaçada real (SM-2, /api/study/cards) vive em /study/notas, que já abre por
// defeito no separador "review".

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { summarize, STUDY_EVENT, type StudySummary } from '@/lib/studyProgress'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'

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
  const ring = `conic-gradient(var(--roxo) ${s.goalPct * 3.6}deg, var(--roxo-claro) ${s.goalPct * 3.6}deg)`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 12 : 16, flexWrap: 'wrap',
      background: 'white', border: '1px solid var(--blue-light)', borderRadius: 'var(--r-xl)',
      padding: compact ? '10px 14px' : '14px 16px', marginBottom: 16,
    }}>
      {/* Anel de meta diária */}
      <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: ring, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--roxo)', lineHeight: 1 }}>{s.goalPct}%</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontWeight: 'var(--peso-forte)' as any }}>META</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: compact ? 12 : 18, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        <Metric icon="flame" value={`${s.streak}`} label={s.streak === 1 ? 'dia seguido' : 'dias seguidos'} color="var(--red)" />
        <Metric icon="spark" value={`${s.xpToday}`} label={`XP hoje · meta ${s.dailyGoal}`} color="var(--roxo)" />
        <Metric icon="target" value={`Nv. ${s.level}`} label={`${s.xpTotal} XP total`} color="var(--ink-2)" />
        {s.accuracy7d != null && <Metric icon="check" value={`${s.accuracy7d}%`} label="acerto 7 dias" color="var(--green)" />}
        {cardsDue != null && cardsDue > 0 && (
          <Link href="/study/notas" style={{ textDecoration: 'none' }}>
            <Metric icon="cards" value={`${cardsDue}`} label="a rever hoje" color="var(--amber)" />
          </Link>
        )}
      </div>

      {/* Se há cartões a rever, esse é o melhor próximo passo; senão, "continuar". */}
      {cardsDue != null && cardsDue > 0 ? (
        <Link href="/study/notas" style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: 'var(--amber)', color: 'white', borderRadius: 'var(--r-sm)', minHeight: 'var(--alvo)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none',
        }}>
          <Icon name="cards" size={13} color="white" /> Rever {cardsDue}
        </Link>
      ) : s.lastTool && (
        <Link href={s.lastTool.href} style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: 'var(--roxo)', color: 'white', borderRadius: 'var(--r-sm)', minHeight: 'var(--alvo)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none',
        }}>
          Continuar →
        </Link>
      )}
    </div>
  )
}

/* O `icon` era um emoji (🔥 ✨ 🎯 ✅ 🃏) colado à esquerda do número com
   4px de margem. Passa a um ícone desenhado, da mesma espessura das linhas
   do resto — e o número passa a mono tabular, porque é um número que se
   compara com o de ontem. */
function Metric({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-mono)', fontSize: 'var(--t-corpo)',
        fontWeight: 'var(--peso-forte)' as any, color, lineHeight: 1.1, whiteSpace: 'nowrap',
      }}>
        <Icon name={icon} size={13} color={color} />{value}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
    </div>
  )
}
