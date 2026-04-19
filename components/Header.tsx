'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

const TOOL_LINKS = [
  { href: '/ai', label: 'Phlox AI — Farmacologista Clínico', icon: '🧠' },
  { href: '/quickcheck', label: 'Análise Rápida de Medicação', icon: '🔍' },
  { href: '/dilutions', label: 'Diluições e Perfusões IV', icon: '💉' },
  { href: '/interactions', label: 'Verificador de Interações', icon: '⚕' },
  { href: '/drugs', label: 'Base de Dados de Fármacos', icon: '💊' },
  { href: '/monograph', label: 'Monografia Clínica IA', icon: '📋' },
  { href: '/doses', label: 'Posologia por Indicação', icon: '📋' },
  { href: '/compatibility', label: 'Compatibilidade IV', icon: '🧪' },
  { href: '/calculators', label: 'Calculadoras Clínicas', icon: '🧮' },
  { href: '/study', label: 'Plataforma de Estudo', icon: '📚' },
  { href: '/exam', label: 'Modo Exame', icon: '🏆' },
  { href: '/mymeds', label: 'A Minha Medicação', icon: '💊' },
  { href: '/cases', label: 'Casos Clínicos', icon: '🏥' },
  { href: '/protocol', label: 'Protocolo Terapêutico', icon: '📋' },
  { href: '/safety', label: 'Segurança do Medicamento', icon: '🛡️' },
]

const NAV_LINKS = [
  { href: '/pricing', label: 'Preços' },
]

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
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
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav-items">

            {/* Ferramentas dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 4, fontFamily: 'var(--font-sans)' }}
              >
                Ferramentas
                <span style={{ fontSize: 9, color: 'var(--ink-4)', transition: 'transform 0.15s', display: 'inline-block', transform: toolsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>

              {toolsOpen && (
                <>
                  <div onClick={() => setToolsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', minWidth: 240, zIndex: 50, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 0' }}>
                      {TOOL_LINKS.map(({ href, label, icon }) => (
                        <Link key={href} href={href} onClick={() => setToolsOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}>
                          <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', padding: '6px 10px' }}>
                {label}
              </Link>
            ))}

            {/* Auth */}
            {loading ? (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', marginLeft: 8 }} />
            ) : user ? (
              <div style={{ position: 'relative', marginLeft: 4 }}>
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
              <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600, marginLeft: 4 }}>
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
            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ferramentas</div>
            {TOOL_LINKS.map(({ href, label, icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}>
                <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>
                {label}
              </Link>
            ))}
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              style={{ display: 'block', padding: '11px 20px', fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
              Preços
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                  style={{ display: 'block', padding: '11px 20px', fontSize: 15, color: 'var(--ink-3)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                  Dashboard
                </Link>
                <button onClick={() => { signOut(); setMobileOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 20px', fontSize: 15, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Terminar sessão
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '11px 20px', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
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