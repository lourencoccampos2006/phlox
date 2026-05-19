// app/blog/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { template: '%s | Phlox Clinical', default: 'Blog — Phlox Clinical' },
  description: 'Artigos sobre farmacologia clínica, interações medicamentosas, dosagem pediátrica, saúde em Portugal. Verificado por especialistas.',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {children}
    </div>
  )
}