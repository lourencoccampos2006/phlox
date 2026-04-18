'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/interactions', label: 'Interações' },
  { href: '/drugs', label: 'Medicamentos' },
  { href: '/calculators', label: 'Calculadoras' },
  { href: '/study', label: 'Estudantes' },
  { href: '/pricing', label: 'Preços' },
]

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em' }}>Phlox</span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', display: 'none' }} className="desktop-subtitle">Clinical</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="desktop-nav-items">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>
                {label}
              </Link>
            ))}

            {/* Auth */}
            {loading ? (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)' }} />
            ) : user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px 5px 5px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{user.name[0]}</div>
                  }
                  <span style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name.split(' ')[0]}
                  </span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>▾</span>
                </button>

                {dropdownOpen && (
                  <>
                    <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 50, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{user.email}</div>
                      </div>
                      {[
                        { href: '/dashboard', label: 'Perfil', icon: '👤' },
                        { href: '/dashboard?tab=history', label: 'Histórico', icon: '🕐' },
                        { href: '/dashboard?tab=meds', label: 'Medicamentos', icon: '💊' },
                        { href: '/pricing', label: 'Actualizar plano', icon: '⭐' },
                      ].map(({ href, label, icon }) => (
                        <Link key={href} href={href} onClick={() => setDropdownOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                          <span>{icon}</span>{label}
                        </Link>
                      ))}
                      <button onClick={() => { signOut(); setDropdownOpen(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                        <span>→</span>Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
                Entrar
              </Link>
            )}
          </nav>

          {/* Mobile right side */}
          <div style={{ display: 'none', alignItems: 'center', gap: 12 }} className="mobile-right">
            {!loading && user && (
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%', display: 'block' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{user.name[0]}</div>
                }
              </Link>
            )}
            {!loading && !user && (
              <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '6px 12px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
                Entrar
              </Link>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--ink)', display: 'flex' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'white', padding: '8px 0' }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '13px 20px', fontSize: 16, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                {label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                  style={{ display: 'block', padding: '13px 20px', fontSize: 15, color: 'var(--ink-3)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                  Dashboard
                </Link>
                <button onClick={() => { signOut(); setMobileOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', padding: '13px 20px', fontSize: 15, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Terminar sessão
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '13px 20px', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
                Entrar / Criar conta
              </Link>
            )}
          </div>
        )}
      </header>

      <style>{`
        @media (min-width: 769px) {
          .desktop-nav-items { display: flex !important; }
          .mobile-right { display: none !important; }
          .desktop-subtitle { display: inline !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav-items { display: none !important; }
          .mobile-right { display: flex !important; }
        }
      `}</style>
    </>
  )
}