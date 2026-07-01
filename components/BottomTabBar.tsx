'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'

const TABS: Record<string, { href: string; icon: string; label: string; badge?: boolean }[]> = {
  personal: [
    { href: '/inicio',       icon: '🏠', label: 'Início' },
    { href: '/mymeds',       icon: '💊', label: 'Meds' },
    { href: '/vitals',       icon: '❤️', label: 'Saúde' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar' },
    { href: '/interactions', icon: '🔍', label: 'Verificar' },
  ],
  caregiver: [
    { href: '/inicio',    icon: '🏠',   label: 'Início' },
    { href: '/perfis',    icon: '👨‍👩‍👧', label: 'Família' },
    { href: '/mymeds',    icon: '💊',   label: 'Meds' },
    { href: '/vitals',    icon: '❤️',   label: 'Saúde' },
    { href: '/passport',  icon: '🆘',   label: 'SOS' },
  ],
  clinical: [
    { href: '/inicio',   icon: '🏠',  label: 'Início' },
    { href: '/turno',    icon: '🏥',  label: 'Turno' },
    { href: '/rounds',   icon: '📋',  label: 'Ronda' },
    { href: '/patients', icon: '👥',  label: 'Doentes' },
    { href: '/oracle',   icon: '🤖',  label: 'Oracle' },
  ],
  student: [
    { href: '/inicio',    icon: '🏠', label: 'Início' },
    { href: '/arena',     icon: '🏆', label: 'Arena' },
    { href: '/study',     icon: '🃏', label: 'Estudar' },
    { href: '/simulador', icon: '🎮', label: 'Simular' },
    { href: '/tutor',     icon: '🤖', label: 'Tutor' },
  ],
}

const MODE_ACCENT: Record<string, string> = {
  personal:  '#059669',
  caregiver: '#b45309',
  clinical:  '#1d4ed8',
  student:   '#7c3aed',
}

export default function BottomTabBar() {
  const { user, supabase } = useAuth()
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      if (!token) return
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const d = await res.json()
      setUnread(d.unread || 0)
    })()
  }, [user, supabase])

  if (!user) return null

  const mode = (user as any)?.experience_mode || 'personal'
  const tabs = TABS[mode] || TABS.personal
  const accent = MODE_ACCENT[mode] || '#059669'

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 90,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.06)',
      }} className="phlox-bottom-bar">
        {tabs.map(tab => {
          const isActive = pathname === tab.href ||
            (tab.href !== '/inicio' && tab.href !== '/dashboard' && pathname.startsWith(tab.href))
          const showBadge = tab.href === '/ai' && unread > 0
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
              {/* Active top bar */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: 2.5,
                  background: accent,
                  borderRadius: '0 0 3px 3px',
                }} />
              )}
              {/* Active bg pill */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 6, bottom: 10,
                  left: '12%', right: '12%',
                  borderRadius: 10,
                  background: `${accent}12`,
                }} />
              )}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{
                  fontSize: 22,
                  lineHeight: 1,
                  display: 'block',
                  filter: isActive ? 'none' : 'grayscale(40%)',
                  opacity: isActive ? 1 : 0.7,
                  transition: 'all 0.15s',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                }}>{tab.icon}</span>
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: -3, right: -5,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#dc2626', border: '2px solid white',
                    fontSize: 8, fontWeight: 800, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 9.5,
                fontWeight: isActive ? 800 : 500,
                letterSpacing: '-0.01em',
                lineHeight: 1,
                zIndex: 1,
                transition: 'all 0.15s',
              }}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (min-width: 769px) { .phlox-bottom-bar { display: none !important; } }
        @media (max-width: 768px) { .phlox-main, .has-bottom-nav { padding-bottom: calc(64px + env(safe-area-inset-bottom)) !important; } }
      `}</style>
    </>
  )
}
