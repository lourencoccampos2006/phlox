'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import NotificationBell from '@/components/NotificationBell'
import { useState, useEffect, useRef } from 'react'
import { NAV_CATEGORIES, PERSONA_NAV } from '@/lib/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

// ─── Mega dropdown (logged-out only) ─────────────────────────────────────────

function MegaDropdown({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
      <div style={{
        position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(860px, 96vw)',
        background: 'white',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
        zIndex: 150,
        animation: 'dropDown 0.18s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {NAV_CATEGORIES.map((cat, ci) => (
            <div key={cat.id} style={{
              padding: '20px 16px',
              borderRight: ci < NAV_CATEGORIES.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: cat.color,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
              }}>
                {cat.label}
              </div>
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} onClick={onClose}
                  className="mega-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '6px 8px', borderRadius: 8,
                    textDecoration: 'none', marginBottom: 1,
                  }}>
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{tool.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', lineHeight: 1.3 }}>
                    {tool.label}
                  </span>
                  {tool.badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: cat.color,
                      background: `${cat.color}18`, padding: '1px 5px', borderRadius: 3,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      marginLeft: 'auto', flexShrink: 0,
                    }}>
                      {tool.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>35+ ferramentas disponíveis</span>
          <Link href="/ferramentas" onClick={onClose}
            style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            Ver todas
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: {
  open: boolean; onClose: () => void; user: any; signOut: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(340px, 100vw)',
        background: 'white', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.2)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          padding: '18px 20px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Menu</span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {NAV_CATEGORIES.map(cat => (
            <div key={cat.id} style={{ padding: '14px 0 6px' }}>
              <div style={{ padding: '0 20px 8px', fontSize: 10, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {cat.label}
              </div>
              {cat.tools.slice(0, 5).map(tool => (
                <Link key={tool.href} href={tool.href} onClick={onClose}
                  className="mob-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', textDecoration: 'none' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{tool.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{tool.label}</span>
                  {tool.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, background: `${cat.color}15`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em', textTransform: 'uppercase', marginLeft: 'auto' }}>
                      {tool.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
          <div style={{ padding: '8px 20px 16px' }}>
            <Link href="/ferramentas" onClick={onClose}
              style={{ display: 'block', padding: '11px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#0f172a', textDecoration: 'none', textAlign: 'center' }}>
              Ver todas as ferramentas →
            </Link>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          {user ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: modeMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{modeMeta.labelShort}</div>
                </div>
              </div>
              <button onClick={() => { signOut(); onClose() }}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                Terminar sessão
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/login" onClick={onClose}
                style={{ display: 'block', padding: '11px', background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, textAlign: 'center' }}>
                Entrar
              </Link>
              <Link href="/login" onClick={onClose}
                style={{ display: 'block', padding: '10px', border: '1px solid #e2e8f0', color: '#0f172a', textDecoration: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                Criar conta grátis
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase, isDark }: {
  user: any; signOut: () => void; supabase: any; isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mode: ExperienceMode = user.experience_mode || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const color = modeMeta.color

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function switchMode(m: ExperienceMode) {
    setOpen(false)
    await supabase.from('profiles').update({ experience_mode: m }).eq('id', user.id)
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '4px 10px 4px 4px',
        background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
        borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, overflow: 'hidden' }}>
          {user.avatar
            ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (user.name?.[0] || 'U').toUpperCase()}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.85)' : '#374151', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name?.split(' ')[0]}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: 'white', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
          minWidth: 240, zIndex: 999, overflow: 'hidden',
          animation: 'dropDown2 0.16s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{user.email}</div>
          </div>
          {[
            { href: '/inicio',   label: 'Início' },
            { href: '/settings', label: 'Definições' },
            { href: '/pricing',  label: 'Ver planos' },
          ].map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className="um-item"
              style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: '#374151', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Modo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {(['personal','caregiver','clinical','student'] as const).map(m => {
                const mm = MODE_META[m]
                const active = mode === m
                return (
                  <button key={m} onClick={() => switchMode(m)} style={{
                    padding: '6px 8px', borderRadius: 8,
                    border: `1px solid ${active ? mm.color + '30' : '#f1f5f9'}`,
                    background: active ? mm.color + '10' : '#f8fafc',
                    cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? mm.color : '#64748b', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.1s',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                    {mm.labelShort}
                  </button>
                )
              })}
            </div>
          </div>
          <button onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14, color: '#ef4444', fontFamily: 'inherit' }}>
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isHomepage = pathname === '/'

  const mode: ExperienceMode = (user?.experience_mode as ExperienceMode) || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const modeColor = modeMeta.color

  // Clinical mode uses dark header regardless
  const isDark = user ? mode === 'clinical' : false

  // Background: clinical=dark, others=frosted white always (homepage was dark before, now it's light so frosted white)
  const headerBg = isDark
    ? '#0f172a'
    : 'rgba(255,255,255,0.92)'

  const personaLinks = user ? (PERSONA_NAV[mode] || PERSONA_NAV.personal) : []

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 56,
        background: headerBg,
        backdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${isDark ? '#1e293b' : 'rgba(0,0,0,0.07)'}`,
        transition: 'background 0.25s, border-color 0.25s',
      }}>
        <div style={{
          height: '100%', maxWidth: 1160, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: 0,
        }}>

          {/* Logo */}
          <Link href={user ? '/inicio' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: isDark ? '#1e40af' : '#0d6e42',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.25s',
            }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: isDark ? 'white' : '#0f172a', letterSpacing: '-0.04em', transition: 'color 0.25s' }}>
              Phlox
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 20, flex: 1 }} className="hdr-nav">
            {!loading && user ? (
              // Persona-aware nav links
              personaLinks.map(link => (
                <Link key={link.href} href={link.href}
                  style={{
                    fontSize: 13, fontWeight: pathname === link.href ? 700 : 500,
                    padding: '5px 9px',
                    color: pathname === link.href
                      ? (isDark ? 'white' : '#0f172a')
                      : (isDark ? 'rgba(255,255,255,0.7)' : '#374151'),
                    textDecoration: 'none', borderRadius: 7, transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}>
                  {link.label}
                </Link>
              ))
            ) : !loading && !user ? (
              // Logged-out nav
              <>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setToolsOpen(o => !o)} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '5px 9px', background: 'none', border: 'none',
                    cursor: 'pointer', borderRadius: 7, fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 500, color: '#374151', transition: 'color 0.15s',
                  }}>
                    Ferramentas
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  {toolsOpen && <MegaDropdown onClose={() => setToolsOpen(false)} />}
                </div>
                <Link href="/pricing" style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>
                  Preços
                </Link>
              </>
            ) : null}
          </nav>

          {/* Mobile spacer */}
          <div style={{ flex: 1 }} className="hdr-spacer" />

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!loading && !user && (
              <>
                <Link href="/login" className="hdr-nav" style={{
                  padding: '7px 13px', fontSize: 13, fontWeight: 600,
                  color: '#374151',
                  textDecoration: 'none', borderRadius: 7,
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.15s',
                }}>
                  Entrar
                </Link>
                <Link href="/login" style={{
                  padding: '7px 15px', fontSize: 13, fontWeight: 800,
                  background: '#0f172a', color: 'white',
                  textDecoration: 'none', borderRadius: 7,
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                }}>
                  Começar →
                </Link>
              </>
            )}

            {!loading && user && (
              <>
                <div className="hdr-nav"><NotificationBell /></div>
                <UserMenu user={user} signOut={signOut} supabase={supabase} isDark={isDark} />
              </>
            )}

            {/* Hamburger — mobile only */}
            <button onClick={() => setDrawerOpen(true)} className="hdr-hamburger" style={{
              width: 34, height: 34, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
              border: 'none', borderRadius: 7, cursor: 'pointer', flexShrink: 0,
            }}>
              {[16, 11, 16].map((w, i) => (
                <span key={i} style={{ width: w, height: 1.5, background: isDark ? 'rgba(255,255,255,0.8)' : '#374151', borderRadius: 1, display: 'block' }} />
              ))}
            </button>
          </div>
        </div>

        {/* Accent line — only for logged-in users */}
        {!loading && user && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: modeColor, opacity: 0.7 }} />
        )}
      </header>

      {/* Push content below fixed header */}
      {!isHomepage && <div style={{ height: 56 }} />}

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} />

      <style>{`
        @keyframes dropDown  { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes dropDown2 { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
        .mega-item:hover { background:#f8fafc !important; }
        .um-item:hover   { background:#f8fafc !important; }
        .mob-item:hover  { background:#f8fafc !important; }
        @media (min-width:769px) { .hdr-hamburger { display:none !important; } .hdr-spacer { display:none !important; } }
        @media (max-width:768px) { .hdr-nav { display:none !important; } }
      `}</style>
    </>
  )
}
