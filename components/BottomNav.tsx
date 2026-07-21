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
import { modeTheme } from '@/lib/modeTheme'
import { PRIMARY_NAV } from '@/lib/primaryNav'
import Icon from '@/components/Icon'

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

  const items = PRIMARY_NAV[mode] || PRIMARY_NAV.personal
  const t = modeTheme(mode)
  const active = t.accent
  const inactive = t.inkFaint

  const isActive = (href: string) =>
    href.startsWith('/inicio#') ? false
      : href === '/inicio' ? pathname === '/inicio'
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="phlox-bottom-nav" aria-label="Navegação principal"
      style={{ ['--bn-active' as any]: active }}>
      {items.map(it => {
        const a = isActive(it.href)
        return (
          <Link key={it.href} href={it.href} className="bn-item" aria-current={a ? 'page' : undefined}
            style={{ color: a ? active : inactive }}>
            <Icon name={it.icon} size={24} stroke={a ? 2.4 : 2} />
            <span style={{ fontWeight: a ? 800 : 600 }}>{it.label}</span>
          </Link>
        )
      })}
      <style>{`
        .phlox-bottom-nav {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 120;
          display: none;
          background: rgba(255,255,255,0.97);
          border-top: 1px solid rgba(0,0,0,0.08);
          backdrop-filter: blur(14px) saturate(160%);
          -webkit-backdrop-filter: blur(14px) saturate(160%);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          /* Sem isto, o iOS Safari "destacava" a barra do fundo real do ecrã
             durante o bounce de overscroll — ficava a meio do ecrã até ao
             próximo toque. translateZ força a barra para a sua própria camada
             de composição, em vez de repintar junto com o resto da página. */
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          will-change: transform;
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
