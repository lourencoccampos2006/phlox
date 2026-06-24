'use client'

// ToolHeader — cabeçalho consistente para páginas de ferramenta. Dá a todas o
// mesmo topo polido: título claro, subtítulo opcional, e ações à direita. Tom
// adapta-se ao modo (serif quente nos modos de cuidado, sans forte nos premium).
// Usado para elevar a coerência sem reescrever cada ferramenta de raiz.

import { useAuth } from '@/components/AuthContext'
import { modeTheme } from '@/lib/modeTheme'

interface Props {
  title: string
  subtitle?: string
  kicker?: string                 // pequena etiqueta acima do título
  right?: React.ReactNode         // ações (botões) à direita
  children?: React.ReactNode      // conteúdo extra por baixo (ex: seletor de perfil)
}

export default function ToolHeader({ title, subtitle, kicker, right, children }: Props) {
  const { user } = useAuth() as any
  const t = modeTheme(user?.experience_mode)
  const serif = t.greetWarm

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {kicker && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: t.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 700 }}>{kicker}</div>
          )}
          <h1 style={{ fontFamily: serif ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 'clamp(22px,5.5vw,28px)', fontWeight: serif ? 400 : 800, color: t.ink, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.12 }}>
            {title}
          </h1>
          {subtitle && <p style={{ fontSize: 14.5, color: t.inkSoft, margin: '6px 0 0', lineHeight: 1.5, maxWidth: '52ch' }}>{subtitle}</p>}
        </div>
        {right && <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>}
      </div>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}
