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
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em' }}>Phlox</span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }} className="desktop-only">Clinical</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="desktop-nav">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>{label}</Link>
            ))}
            <AuthSection user={user} loading={loading} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
          </nav>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--ink)' }}
            className="mobile-menu-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'white', padding: '16px 20px' }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '12px 0', fontSize: 16, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                {label}
              </Link>
            ))}
            <div style={{ paddingTop: 16 }}>
              {user ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>{user.email}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                      style={{ flex: 1, background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px', borderRadius: 4, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                      Perfil
                    </Link>
                    <button onClick={() => { signOut(); setMobileOpen(false) }}
                      style={{ flex: 1, background: 'var(--bg-3)', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Sair
                    </button>
                  </div>
                </div>
              ) : (
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px', borderRadius: 4, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                  Entrar
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .desktop-only { display: none !important; }
        }
      `}</style>
    </>
  )
}

function AuthSection({ user, loading, signOut, menuOpen, setMenuOpen }: any) {
  if (loading) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', animation: 'pulse 1s infinite' }} />

  if (!user) return (
    <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
      Entrar
    </Link>
  )

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setMenuOpen(!menuOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px 5px 5px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
        {user.avatar
          ? <img src={user.avatar} alt={user.name} style={{ width: 24, height: 24, borderRadius: '50%' }} />
          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{user.name[0]}</div>
        }
        <span style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name.split(' ')[0]}</span>
        <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>▾</span>
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-lg)', minWidth: 220, zIndex: 50, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{user.email}</div>
              <div style={{ display: 'inline-block', marginTop: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>
                {user.plan === 'free' ? 'Gratuito' : user.plan}
              </div>
            </div>
            {[
              { href: '/dashboard', label: 'O meu perfil', icon: '👤' },
              { href: '/dashboard?tab=history', label: 'Histórico', icon: '🕐' },
              { href: '/dashboard?tab=meds', label: 'Os meus medicamentos', icon: '💊' },
              { href: '/pricing', label: 'Actualizar plano', icon: '⭐' },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}>
                <span>{icon}</span>{label}
              </Link>
            ))}
            <button onClick={() => { signOut(); setMenuOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
              <span>→</span>Terminar sessão
            </button>
          </div>
        </>
      )}
    </div>
  )
}