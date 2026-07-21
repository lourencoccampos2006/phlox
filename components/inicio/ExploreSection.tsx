'use client'

// ExploreSection — REBUILD 2026-07-21. Substitui de vez a página /tudo (e a
// vista "Tudo o que o Phlox faz" que ainda existia dentro de /inicio): sem
// botão, sem pesquisa, sem toggle — é só a parte de baixo desta MESMA página,
// sempre visível, organizada por assunto. Ícones de categoria (só 5, o
// conjunto original de components/Icon.tsx), texto simples por ferramenta —
// nunca um ícone por ferramenta (impraticável para ~150 ferramentas, e o
// texto sozinho já é claro).

import Link from 'next/link'
import Icon from '@/components/Icon'
import { getNavForMode } from '@/lib/navigation'
import type { ModeTheme } from '@/lib/modeTheme'

const CATEGORY_ICON: Record<string, string> = {
  medication: 'pill', health: 'heart', caregiver: 'family', clinical: 'briefcase', student: 'book',
}

export default function ExploreSection({ mode, theme: t }: { mode: string; theme: ModeTheme }) {
  const navMode = (mode === 'clinical' ? 'clinical' : mode) as 'personal' | 'caregiver' | 'student' | 'clinical'
  const cats = getNavForMode(navMode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {cats.map(cat => (
        <div key={cat.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <Icon name={CATEGORY_ICON[cat.id] || 'grid'} size={17} color={t.inkFaint} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat.label}</span>
          </div>
          <div>
            {cat.tools.map((tool, i) => (
              <Link key={tool.href} href={tool.href} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '11px 0', textDecoration: 'none', borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{tool.label}</span>
                    {tool.badge && <span style={{ fontSize: 9, fontWeight: 800, color: t.accent, background: t.accentSoft, padding: '1px 6px', borderRadius: 4 }}>{tool.badge}</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
                </span>
                <Icon name="chevron" size={15} color={t.inkFaint} style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
