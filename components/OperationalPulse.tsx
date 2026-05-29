'use client'

// Pulso operacional no cockpit — a instituição como um todo num relance.
// Mostra apenas os sinais que existem (tabelas aplicadas) e destaca os urgentes.
// Cada cartão leva à ferramenta respetiva.

import Link from 'next/link'
import { useOperationalPulse } from '@/lib/useOperationalPulse'
import type { InstitutionType } from '@/lib/useClinicPrefs'

type Card = { href: string; label: string; value: string | number; tone: 'ok' | 'warn' | 'alert' | 'info'; sub?: string }

const TONE: Record<string, { color: string; bg: string; border: string }> = {
  ok:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  warn:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  alert: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  info:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
}

export default function OperationalPulse({ supabase, userId, institution }: {
  supabase: any; userId: string | null | undefined; institution: InstitutionType
}) {
  const p = useOperationalPulse(supabase, userId, institution)
  if (p.loading) return null

  const cards: Card[] = []

  if (p.waiting !== null) {
    const total = (p.waiting || 0) + (p.inService || 0)
    cards.push({
      href: '/sala-espera', label: 'Sala de espera',
      value: p.waiting || 0,
      tone: (p.waiting || 0) > 0 ? 'info' : 'ok',
      sub: total > 0 ? `${p.inService || 0} a ser atendidos` : 'fila vazia',
    })
  }
  if (p.tasksOpen !== null) {
    cards.push({
      href: '/tarefas-equipa', label: 'Tarefas abertas',
      value: p.tasksOpen || 0,
      tone: (p.tasksOverdue || 0) > 0 ? 'alert' : (p.tasksOpen || 0) > 0 ? 'warn' : 'ok',
      sub: (p.tasksOverdue || 0) > 0 ? `${p.tasksOverdue} em atraso` : 'em dia',
    })
  }
  if (p.stockLow !== null) {
    const bad = (p.stockLow || 0) + (p.stockExpiring || 0)
    cards.push({
      href: '/stock', label: 'Stock',
      value: bad,
      tone: (p.stockLow || 0) > 0 ? 'alert' : (p.stockExpiring || 0) > 0 ? 'warn' : 'ok',
      sub: bad > 0 ? `${p.stockLow || 0} rutura · ${p.stockExpiring || 0} validade` : 'tudo ok',
    })
  }
  if (p.compliancePct !== null) {
    cards.push({
      href: '/conformidade', label: 'Conformidade',
      value: `${p.compliancePct}%`,
      tone: p.compliancePct >= 90 ? 'ok' : p.compliancePct >= 60 ? 'warn' : 'alert',
      sub: (p.compliancePending || 0) > 0 ? `${p.compliancePending} pendentes` : 'pronto',
    })
  }

  if (cards.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#0b1120' }}>Pulso operacional</span>
        <span style={{ fontSize: 11.5, color: '#9ca3af' }}>a instituição num relance</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 9 }}>
        {cards.map(c => {
          const t = TONE[c.tone]
          return (
            <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 11, padding: '12px 14px', height: '100%' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{c.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0b1120', marginTop: 5 }}>{c.label}</div>
                {c.sub && <div style={{ fontSize: 11, color: t.color, marginTop: 2, fontWeight: 600 }}>{c.sub}</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
