'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

const TABS: Record<string, { href: string; icon: string; label: string }[]> = {
  personal: [
    { href: '/dashboard',    icon: '🏠', label: 'Início' },
    { href: '/mymeds',       icon: '💊', label: 'Meds' },
    { href: '/vitals',       icon: '❤️', label: 'Saúde' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar' },
    { href: '/interactions', icon: '🔍', label: 'Verificar' },
  ],
  caregiver: [
    { href: '/dashboard', icon: '🏠', label: 'Início' },
    { href: '/perfis',    icon: '👨‍👩‍👧', label: 'Família' },
    { href: '/mymeds',    icon: '💊', label: 'Meds' },
    { href: '/vitals',    icon: '❤️', label: 'Saúde' },
    { href: '/passport',  icon: '🆘', label: 'SOS' },
  ],
  clinical: [
    { href: '/dashboard', icon: '🏠', label: 'Início' },
    { href: '/turno',     icon: '🏥', label: 'Turno' },
    { href: '/rounds',    icon: '📋', label: 'Ronda' },
    { href: '/patients',  icon: '👥', label: 'Doentes' },
    { href: '/oracle',    icon: '🤖', label: 'Oracle' },
  ],
  student: [
    { href: '/dashboard', icon: '🏠', label: 'Início' },
    { href: '/arena',     icon: '🏆', label: 'Arena' },
    { href: '/study',     icon: '🃏', label: 'Estudar' },
    { href: '/simulador', icon: '🎮', label: 'Simular' },
    { href: '/tutor',     icon: '🤖', label: 'Tutor' },
  ],
}

const MODE_ACCENT: Record<string, string> = {
  personal: '#059669',
  caregiver: '#b45309',
  clinical:  '#1d4ed8',
  student:   '#7c3aed',
}

export default function BottomTabBar() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const mode = (user as any)?.experience_mode || 'personal'
  const tabs = TABS[mode] || TABS.personal
  const accent = MODE_ACCENT[mode] || '#059669'

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64,
        background: 'white',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 90,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
      }} className="phlox-bottom-bar">
        {tabs.map(tab => {
          const isActive = pathname === tab.href ||
            (tab.href !== '/dashboard' && pathname.startsWith(tab.href))
          return (
            <Link key={tab.href} href={tab.href} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              color: isActive ? accent : '#9ca3af',
              position: 'relative',
              transition: 'color 0.15s',
            }}>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '15%', right: '15%',
                  height: 3,
                  background: accent,
                  borderRadius: '0 0 4px 4px',
                }} />
              )}
              <span style={{ fontSize: 24, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (min-width: 769px) { .phlox-bottom-bar { display: none !important; } }
        @media (max-width: 768px) { .phlox-main { padding-bottom: calc(64px + env(safe-area-inset-bottom)) !important; } }
      `}</style>
    </>
  )
}
