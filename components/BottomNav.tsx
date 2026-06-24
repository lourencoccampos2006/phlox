'use client'

// BottomNav — barra de navegação inferior fixa (mobile). Resolve o "como volto
// ao início?" — o botão Início está SEMPRE à mão, grande e com texto. Padrão que
// toda a gente já conhece das apps do telemóvel.
//
// Cuidado com a barra do browser (Safari/Chrome mobile escondem/mostram a sua
// própria barra inferior): usamos env(safe-area-inset-bottom) + padding extra,
// e o layout adiciona um espaçador para o conteúdo nunca ficar tapado.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import type { ExperienceMode } from '@/lib/experienceMode'
import { modeTheme, isPremiumMode } from '@/lib/modeTheme'

interface NavItem { href: string; label: string; icon: React.ReactNode }

// Ícones desenhados (line icons) — claros e grandes, sem depender de emoji.
const I = {
  home: (a: boolean) => <Icon a={a}><path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /></Icon>,
  pill: (a: boolean) => <Icon a={a}><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(45 12 12)" /></Icon>,
  family: (a: boolean) => <Icon a={a}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.2" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 15c2.3 0 4 1.6 4 4" /></Icon>,
  heart: (a: boolean) => <Icon a={a}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></Icon>,
  grid: (a: boolean) => <Icon a={a}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>,
  book: (a: boolean) => <Icon a={a}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 17H6a2 2 0 0 0-2 2" /></Icon>,
  trophy: (a: boolean) => <Icon a={a}><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3M9 16h6M10 20h4M12 16v4" /></Icon>,
}

function Icon({ children, a }: { children: React.ReactNode; a: boolean }) {
  // currentColor → herda a cor do link (definida por tema/modo no .bn-item)
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const NAV: Record<string, NavItem[]> = {
  personal: [
    { href: '/inicio', label: 'Início', icon: I.home(false) },
    { href: '/mymeds', label: 'Medicação', icon: I.pill(false) },
    { href: '/sintomas', label: 'Saúde', icon: I.heart(false) },
    { href: '/tudo', label: 'Tudo', icon: I.grid(false) },
  ],
  caregiver: [
    { href: '/inicio', label: 'Início', icon: I.home(false) },
    { href: '/familia', label: 'Família', icon: I.family(false) },
    { href: '/mymeds', label: 'Medicação', icon: I.pill(false) },
    { href: '/tudo', label: 'Tudo', icon: I.grid(false) },
  ],
  student: [
    { href: '/inicio', label: 'Início', icon: I.home(false) },
    { href: '/aprender', label: 'Aprender', icon: I.book(false) },
    { href: '/arena', label: 'Arena', icon: I.trophy(false) },
    { href: '/tudo', label: 'Tudo', icon: I.grid(false) },
  ],
}


export default function BottomNav() {
  const { user, loading } = useAuth() as any
  const pathname = usePathname()

  if (loading || !user) return null
  const mode: ExperienceMode = user.experience_mode || 'personal'
  // Modo clínico tem navegação própria (densa) — a barra inferior é para os
  // modos pessoais/familiares/estudante, o público que se perde.
  if (mode === 'clinical') return null
  // Não mostrar em páginas de ecrã-inteiro/portais públicos.
  if (pathname.startsWith('/portal-familia') || pathname.startsWith('/hp') || pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/onboarding')) return null

  const items = NAV[mode] || NAV.personal
  const t = modeTheme(mode)
  const premium = isPremiumMode(mode)
  const active = t.accent
  const inactive = t.inkFaint

  const isActive = (href: string) =>
    href === '/inicio' ? pathname === '/inicio' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="phlox-bottom-nav" aria-label="Navegação principal"
      style={{
        ['--bn-active' as any]: active,
        background: premium ? 'rgba(17,17,26,0.94)' : 'rgba(255,255,255,0.97)',
        borderTop: `1px solid ${premium ? t.border : 'rgba(0,0,0,0.08)'}`,
      }}>
      {items.map(it => {
        const a = isActive(it.href)
        const iconFn = it.label === 'Início' ? I.home : it.label === 'Medicação' ? I.pill
          : it.label === 'Família' ? I.family : it.label === 'Saúde' ? I.heart
          : it.label === 'Aprender' ? I.book : it.label === 'Arena' ? I.trophy : I.grid
        return (
          <Link key={it.href} href={it.href} className="bn-item" aria-current={a ? 'page' : undefined}
            style={{ color: a ? active : inactive }}>
            {iconFn(a)}
            <span style={{ fontWeight: a ? 800 : 600 }}>{it.label}</span>
          </Link>
        )
      })}
      <style>{`
        .phlox-bottom-nav {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 120;
          display: none;
          backdrop-filter: blur(14px) saturate(160%);
          -webkit-backdrop-filter: blur(14px) saturate(160%);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .phlox-bottom-nav .bn-item {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; padding: 8px 4px 7px; text-decoration: none;
          font-size: 11px; min-height: 56px; -webkit-tap-highlight-color: transparent;
        }
        .phlox-bottom-nav .bn-item:active { opacity: 0.6; }
        @media (max-width: 768px) {
          .phlox-bottom-nav { display: flex; }
        }
      `}</style>
    </nav>
  )
}
