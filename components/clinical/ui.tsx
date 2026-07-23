'use client'

// components/clinical/ui.tsx — peças de UI partilhadas do lado clínico/
// institucional (R0.2, 2026-07-23). Tudo assente nos tokens de globals.css —
// nada de hex à mão. A cor de acento vem de `--accent` (definida pelo
// contentor, ex.: o cockpit por tipo de instituição), com o verde da marca
// como fallback. Ícones do conjunto próprio (components/Icon.tsx), nunca emoji.
//
// Fundação da unificação visual: à medida que os ecrãs institucionais adotam
// estas peças, ficam todos coerentes e as rondas seguintes ficam mais rápidas.

import Link from 'next/link'
import Icon from '@/components/Icon'
import { MSG } from '@/lib/clientError'
import type { CSSProperties, ReactNode } from 'react'

const ACCENT = 'var(--accent, var(--green))'
const ACCENT_SOFT = 'var(--accent-soft, var(--green-light))'

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'
const TONE: Record<Tone, { fg: string; bg: string; bd: string }> = {
  good:    { fg: 'var(--green-2)', bg: 'var(--green-light)', bd: 'var(--green-mid)' },
  warn:    { fg: 'var(--amber)',   bg: 'var(--amber-light)', bd: '#efdcb0' },
  bad:     { fg: 'var(--red)',     bg: 'var(--red-light)',   bd: '#eecaca' },
  info:    { fg: 'var(--blue)',    bg: 'var(--blue-light)',  bd: '#ccd8ec' },
  neutral: { fg: 'var(--ink-3)',   bg: 'var(--bg-2)',        bd: 'var(--border)' },
}

// ── Surface — o cartão base. accent → fundo de acento com texto claro. ────────
export function Surface({ children, accent, pad = 18, style, className }: {
  children: ReactNode; accent?: boolean; pad?: number; style?: CSSProperties; className?: string
}) {
  return (
    <div className={className} style={{
      background: accent ? ACCENT : 'var(--bg)',
      border: accent ? 'none' : '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: pad, height: '100%', boxSizing: 'border-box',
      color: accent ? '#fff' : 'var(--ink-2)', boxShadow: accent ? 'none' : 'var(--shadow-xs)',
      ...style,
    }}>{children}</div>
  )
}

// ── SectionTitle — ícone + título + contagem opcional + ação à direita. ───────
export function SectionTitle({ icon, title, count, action }: {
  icon?: string; title: string; count?: number
  action?: { href: string; label: string }
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {icon && <Icon name={icon} size={16} color={ACCENT} />}
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {count != null && count > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: ACCENT, background: ACCENT_SOFT, padding: '1px 7px', borderRadius: 999 }}>{count}</span>
        )}
      </div>
      {action && (
        <Link href={action.href} style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: ACCENT, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {action.label}<Icon name="chevron" size={13} color={ACCENT} />
        </Link>
      )}
    </div>
  )
}

// ── Stat — número grande + rótulo. light → sobre fundo de acento. ─────────────
export function Stat({ value, label, tone, light }: {
  value: ReactNode; label: string; tone?: 'good' | 'warn' | 'bad'; light?: boolean
}) {
  const color = light ? '#fff' : tone ? TONE[tone].fg : 'var(--ink)'
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, marginTop: 5, fontWeight: 600, color: light ? 'rgba(255,255,255,0.82)' : 'var(--ink-4)' }}>{label}</div>
    </div>
  )
}

// ── Pill — chip de estado. ────────────────────────────────────────────────────
export function Pill({ label, tone = 'neutral', icon }: { label: ReactNode; tone?: Tone; icon?: string }) {
  const s = TONE[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: s.fg, background: s.bg, border: `1px solid ${s.bd}`, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {icon && <Icon name={icon} size={12} color={s.fg} />}{label}
    </span>
  )
}

// ── EmptyState — mensagem calma + CTA opcional. ───────────────────────────────
export function EmptyState({ msg, cta, icon }: { msg: string; cta?: { href: string; label: string }; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
      {icon && <Icon name={icon} size={22} color="var(--ink-5)" style={{ margin: '0 auto 8px', display: 'block' }} />}
      <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: cta ? 8 : 0, lineHeight: 1.5 }}>{msg}</div>
      {cta && <Link href={cta.href} style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>{cta.label} →</Link>}
    </div>
  )
}

// ── ErrorState — mensagem calma (nunca técnica) + repetir. ───────────────────
export function ErrorState({ msg = MSG.load, onRetry }: { msg?: string; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--red-light)', border: '1px solid #eecaca', borderRadius: 'var(--r-lg)', padding: '12px 15px' }}>
      <Icon name="alert" size={18} color="var(--red)" />
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--red)' }}>{msg}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ flexShrink: 0, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
      )}
    </div>
  )
}

// ── Skeleton — placeholder de carregamento (usa .skeleton de globals.css). ────
export function Skeleton({ h = 12, w = '100%', r = 6, style }: { h?: number | string; w?: number | string; r?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

// ── Button — primary (acento) · soft (acento suave) · ghost (contorno). ───────
export function Button({ children, variant = 'primary', size = 'md', onClick, href, disabled, full, icon }: {
  children: ReactNode; variant?: 'primary' | 'soft' | 'ghost'; size?: 'sm' | 'md'
  onClick?: () => void; href?: string; disabled?: boolean; full?: boolean; icon?: string
}) {
  const pad = size === 'sm' ? '7px 13px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : 14
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 'var(--r-md)', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'var(--font-sans)', textDecoration: 'none', width: full ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1, transition: 'filter 0.15s',
    border: variant === 'ghost' ? '1px solid var(--border-2)' : 'none',
    background: variant === 'primary' ? ACCENT : variant === 'soft' ? ACCENT_SOFT : 'var(--bg)',
    color: variant === 'primary' ? '#fff' : variant === 'soft' ? ACCENT : 'var(--ink-2)',
  }
  const inner = <>{icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}{children}</>
  if (href && !disabled) return <Link href={href} style={base}>{inner}</Link>
  return <button onClick={onClick} disabled={disabled} style={base}>{inner}</button>
}
