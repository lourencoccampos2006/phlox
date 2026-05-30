// Componentes da página /seguranca — separados para que a página seja server component.

import { ReactNode } from 'react'

export function SecuritySection({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{title}</h2>
      {intro && <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 12px', lineHeight: 1.55 }}>{intro}</p>}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>{children}</div>
    </section>
  )
}

export function CardItem({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, padding: '12px 18px', borderBottom: '1px solid var(--bg-2)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>{k}</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{v}</div>
    </div>
  )
}
