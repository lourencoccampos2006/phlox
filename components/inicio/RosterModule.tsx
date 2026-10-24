'use client'

// RosterModule — "As pessoas de quem cuido" (cuidador). REBUILD 2026-07-21:
// o estado de CADA pessoa num relance (nome + nível de atenção), em vez de um
// hero genérico só sobre o alerta mais urgente. Consolida também o item nº8
// das sugestões extra (resumo visual do estado de cada familiar).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
/* Este módulo punha um nível de risco em cada familiar («critical», «warning»)
   a partir da medicação, das tensões e dos sintomas. Classificar o estado de
   uma pessoa a partir dos dados dela é apoio à decisão clínica — Regra 11 do
   Regulamento (UE) 2017/745. Fica a lista de quem se acompanha. */
import { setActiveProfile } from '@/lib/profileContext'
import Icon from '@/components/Icon'
import type { ModeTheme } from '@/lib/modeTheme'

interface PersonStatus { id: string; name: string; relation?: string }

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
      const statuses: PersonStatus[] = list.map(p => ({
        id: p.id, name: p.name, relation: p.relation,
      }))
      if (!cancel) setPeople(statuses)
    })()
    return () => { cancel = true }
  }, [user, supabase])

  if (people === null) return <div className="skeleton" style={{ height: 140, borderRadius: 'var(--r-lg)' }} />

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
        return (
          <Link key={p.id} href="/familia" onClick={() => setActiveProfile({ id: p.id, name: p.name, type: 'family' })} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', textDecoration: 'none',
            borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
          }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: t.surfaceMuted, color: t.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.name}{p.relation ? <span style={{ fontWeight: 500, color: t.inkFaint }}> · {p.relation}</span> : null}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
