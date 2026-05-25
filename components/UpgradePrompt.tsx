'use client'

import Link from 'next/link'
import { PLANS, planName } from '@/lib/plans'

// Prompt de upgrade elegante quando o limite diário é atingido.
export function UpgradePrompt({ open, onClose, toolLabel, plan, limit }: {
  open: boolean; onClose: () => void; toolLabel: string; plan: string; limit: number
}) {
  if (!open) return null
  const next = PLANS.find(p => p.id === 'student') // Plus
  const pro = PLANS.find(p => p.id === 'pro')
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(440px,100%)', background: 'white', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: 'var(--ink)', fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>Limite diário atingido</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 8 }}>
            Usaste as <strong>{limit}</strong> utilizações de hoje de <strong>{toolLabel}</strong> no plano {planName(plan)}. Faz upgrade para continuar — sem anúncios e com limites muito maiores.
          </p>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pro && (
            <Link href="/pricing" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#0d6e42', color: 'white', borderRadius: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{pro.name} — sem limites</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{pro.price.monthly.toFixed(2).replace('.', ',')}€/mês</span>
            </Link>
          )}
          {next && (
            <Link href="/pricing" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'white', color: 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{next.name} — limites maiores</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{next.price.monthly.toFixed(2).replace('.', ',')}€/mês</span>
            </Link>
          )}
          <button onClick={onClose} style={{ padding: '11px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>Talvez amanhã</button>
        </div>
      </div>
    </div>
  )
}

// Badge discreto de utilizações restantes.
export function UsageBadge({ remaining, unlimited }: { remaining: number; unlimited: boolean }) {
  if (unlimited) return null
  const low = remaining <= 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: low ? '#b45309' : 'var(--ink-4)', background: low ? '#fffbeb' : 'var(--bg-2)', border: `1px solid ${low ? '#fde68a' : 'var(--border)'}` }}>
      {remaining} restante{remaining !== 1 ? 's' : ''} hoje
    </span>
  )
}
