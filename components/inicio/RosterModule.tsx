'use client'

// RosterModule — "As pessoas de quem cuido" (cuidador). REBUILD 2026-07-21:
// o estado de CADA pessoa num relance (nome + nível de atenção), em vez de um
// hero genérico só sobre o alerta mais urgente. Consolida também o item nº8
// das sugestões extra (resumo visual do estado de cada familiar).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { analyzeFamilyMember, WATCH_LEVEL_META } from '@/lib/caregiverWatch'
import { setActiveProfile } from '@/lib/profileContext'
import Icon from '@/components/Icon'
import type { ModeTheme } from '@/lib/modeTheme'

interface PersonStatus { id: string; name: string; relation?: string; level: 'critical' | 'warning' | 'info' | 'ok'; topSignal?: string }

function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() }

export default function RosterModule({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [people, setPeople] = useState<PersonStatus[] | null>(null)

  useEffect(() => {
    if (!user || !supabase) return
    let cancel = false
    ;(async () => {
      const { data: profiles } = await supabase.from('family_profiles').select('id, name, relation, age, sex, weight, conditions, allergies').eq('user_id', user.id)
      const list = (profiles || []) as any[]
      if (list.length === 0) { if (!cancel) setPeople([]); return }
      const ids = list.map(p => p.id)
      const since = new Date(Date.now() - 90 * 86400000).toISOString()
      const [{ data: meds }, { data: vitals }, { data: syms }] = await Promise.all([
        supabase.from('family_profile_meds').select('profile_id, name, pills_remaining, pills_per_day').in('profile_id', ids),
        supabase.from('vitals').select('profile_id, recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').in('profile_id', ids).gte('recorded_at', since),
        supabase.from('symptom_logs').select('profile_id, at, pain, temperature, symptoms').in('profile_id', ids).gte('at', since).then((r: any) => r, () => ({ data: [] })),
      ])
      const statuses: PersonStatus[] = list.map(p => {
        const result = analyzeFamilyMember({
          age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies,
          meds: (meds || []).filter((m: any) => m.profile_id === p.id),
          vitals: (vitals || []).filter((v: any) => v.profile_id === p.id),
          symptoms: (syms || []).filter((s: any) => s.profile_id === p.id),
        })
        return { id: p.id, name: p.name, relation: p.relation, level: result.level, topSignal: result.signals[0]?.title }
      })
      // mais preocupante primeiro
      const rank = { critical: 0, warning: 1, info: 2, ok: 3 }
      statuses.sort((a, b) => rank[a.level] - rank[b.level])
      if (!cancel) setPeople(statuses)
    })()
    return () => { cancel = true }
  }, [user, supabase])

  if (people === null) return <div className="skeleton" style={{ height: 140, borderRadius: 10 }} />

  if (people.length === 0) {
    return (
      <Link href="/familia" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', textDecoration: 'none', color: t.inkSoft, fontSize: 13.5 }}>
        <Icon name="plus" size={16} color={t.accent} /> Cria um espaço para a primeira pessoa de quem cuidas
      </Link>
    )
  }

  return (
    <div>
      {people.map((p, i) => {
        const meta = WATCH_LEVEL_META[p.level]
        return (
          <Link key={p.id} href="/familia" onClick={() => setActiveProfile({ id: p.id, name: p.name, type: 'family' })} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', textDecoration: 'none',
            borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
          }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: t.surfaceMuted, color: t.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.name}{p.relation ? <span style={{ fontWeight: 500, color: t.inkFaint }}> · {p.relation}</span> : null}</div>
              {p.topSignal && p.level !== 'ok' && <div style={{ fontSize: 12, color: meta.color, marginTop: 1 }}>{p.topSignal}</div>}
            </div>
            <span title={meta.label} style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
          </Link>
        )
      })}
    </div>
  )
}
