'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

// ─── Tool registry — grouped for mega-menu ──────────────────────────────────

const TOOL_GROUPS = [
  {
    id: 'everyone',
    heading: 'Para toda a gente',
    items: [
      { href: '/labs',         label: 'Análises Clínicas',       detail: 'Interpreta resultados em linguagem simples' },
      { href: '/interactions', label: 'Verificar Interações',    detail: 'Base RxNorm · NIH · nomes comerciais PT' },
      { href: '/otc',          label: 'Guia de Automedicação',   detail: 'O que comprar sem receita, com doses' },
      { href: '/prescription', label: 'Explicador de Receita',   detail: 'Foto ou texto explicados em PT' },
      { href: '/drugs',        label: 'Base de Dados FDA',       detail: '10.000+ fármacos em português' },
      { href: '/safety',       label: 'Segurança',               detail: 'Conduzir · gravidez · álcool · idosos' },
    ],
  },
  {
    id: 'students',
    heading: 'Estudantes',
    items: [
      { href: '/study',   label: 'Flashcards e Quizzes', detail: '24 classes farmacológicas por IA' },
      { href: '/exam',    label: 'Modo Exame',            detail: 'Simulação com timer e análise de erros' },
      { href: '/cases',   label: 'Casos Clínicos',        detail: 'Raciocínio clínico guiado' },
      { href: '/mymeds',  label: 'A Minha Medicação',     detail: 'Perfil farmacológico e interações' },
    ],
  },
  {
    id: 'professionals',
    heading: 'Profissionais',
    items: [
      { href: '/ai',          label: 'Phlox AI',               detail: 'Farmacologista clínico virtual' },
      { href: '/nursing',     label: 'IV · SC · IM',           detail: 'Compatibilidades e farmacotecnia' },
      { href: '/strategy',    label: 'Estratégias Terapêuticas', detail: 'Alternativas com evidência A/B/C' },
      { href: '/protocol',    label: 'Protocolo Terapêutico',  detail: 'ESC · ADA · NICE · DGS' },
      { href: '/med-review',  label: 'Revisão de Medicação',   detail: 'Análise clínica completa + PDF' },
      { href: '/calculators', label: 'Calculadoras',           detail: 'SCORE2 · CKD-EPI · Cockcroft' },
    ],
  },
]

// ─── Mega-menu panel ─────────────────────────────────────────────────────────

function MegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 1px)',
      left: '50%',
      transform: 'translateX(-30%)',
      background: 'white',
      border: '1px solid var(--border)',
      borderTop: '3px solid var(--green)',
      borderRadius: '0 0 12px 12px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 220px)',
      gap: '0',
      zIndex: 300,
      overflow: 'hidden',
    }}>
      {TOOL_GROUPS.map((group, gi) => (
        <div key={group.id} style={{
          borderRight: gi < TOOL_GROUPS.length - 1 ? '1px solid var(--border)' : 'none',
          padding: '20px 0',
        }}>
          <div style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: 'var(--ink-5)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '0 20px 12px',
          }}>
            {group.heading}
          </div>
          {group.items.map(({ href, label, detail }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: 'block',
                padding: '10px 20px',
                textDecoration: 'none',
                borderBottom: '1px solid transparent',
                transition: 'background 0.1s',
              }}
              className="mega-item"
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                {detail}
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── User dropdown ───────────────────────────────────────────────────────────

function UserDropdown({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const planLabels: Record<string, string> = {
    free: 'Plano Gratuito', student: 'Plano Student', pro: 'Plano Pro', clinic: 'Plano Clinic',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 32, padding: '5px 12px 5px 6px',
          cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        }}
        className="user-btn"
      >
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', display: 'block', flexShrink: 0 }} />
          : (
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--green)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {(user.name?.[0] || 'U').toUpperCase()}
            </div>
          )
        }
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '-0.01em', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name?.split(' ')[0] || 'Conta'}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: 'white', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-lg)',
          minWidth: 220, overflow: 'hidden', zIndex: 300,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
              {planLabels[user.plan || 'free']}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/dashboard?tab=meds', label: 'Os meus medicamentos' },
            { href: '/pricing', label: 'Gerir plano' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '11px 16px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
              className="dropdown-item"
            >
              {label}
            </Link>
          ))}
          <button
            onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 14, color: 'var(--ink-4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}
            className="dropdown-item"
          >
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ───────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: { open: boolean; onClose: () => void; user: any; signOut: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 58, background: 'rgba(0,0,0,0.4)', zIndex: 149, backdropFilter: 'blur(2px)' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 58, right: 0, bottom: 0, width: 'min(340px, 100vw)',
        background: 'white', borderLeft: '1px solid var(--border)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
        zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* User section at top of drawer */}
        {user && (
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Utilizador'}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>{user.plan || 'free'}</div>
            </div>
            <Link href="/dashboard" onClick={onClose} style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>Dashboard →</Link>
          </div>
        )}

        {!user && (
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border)', display: 'flex', gap: 8 }}>
            <Link href="/login" onClick={onClose} style={{ flex: 1, display: 'block', textAlign: 'center', padding: '10px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Entrar / Criar conta
            </Link>
          </div>
        )}

        {/* Tools by group */}
        <div style={{ flex: 1 }}>
          {TOOL_GROUPS.map((group, gi) => (
            <div key={group.id} style={{ borderBottom: gi < TOOL_GROUPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '14px 20px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>
                {group.heading}
              </div>
              {group.items.map(({ href, label, detail }) => (
                <Link key={href} href={href} onClick={onClose}
                  style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}
                  className="drawer-item"
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{detail}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '11px 16px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, textAlign: 'center', letterSpacing: '-0.01em' }}>
            Ver planos de preço
          </Link>
          <Link href="/blog" onClick={onClose} style={{ display: 'block', padding: '11px 16px', background: 'transparent', color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, textAlign: 'center', border: '1px solid var(--border)' }}>
            Blog
          </Link>
          {user && (
            <button onClick={() => { signOut(); onClose() }} style={{ padding: '11px 16px', background: 'transparent', color: 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
              Terminar sessão
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main Header ─────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [megaOpen, setMegaOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const megaRef = useRef<HTMLDivElement>(null)

  const openMega = () => { if (megaTimer.current) clearTimeout(megaTimer.current); setMegaOpen(true) }
  const closeMega = () => { megaTimer.current = setTimeout(() => setMegaOpen(false), 120) }

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="page-container" style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* ── Logo ──────────────────────────────────── */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <rect width="30" height="30" rx="6" fill="var(--green)"/>
              <path d="M15 7v16M8 15h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="15" cy="15" r="9.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.04em' }}>PHLOX</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 1 }} className="logo-sub">CLINICAL</span>
            </div>
          </Link>

          {/* ── Desktop nav ───────────────────────────── */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, marginLeft: 20 }}>

            {/* Ferramentas mega trigger */}
            <div ref={megaRef} style={{ position: 'relative' }} onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: megaOpen ? 'var(--green)' : 'var(--ink-3)',
                fontFamily: 'var(--font-sans)', letterSpacing: '0.01em',
                textTransform: 'uppercase', transition: 'color 0.15s',
                borderBottom: `2px solid ${megaOpen ? 'var(--green)' : 'transparent'}`,
                borderRadius: 0,
              }}>
                Ferramentas
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: megaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {megaOpen && (
                <>
                  <div style={{ position: 'absolute', top: '100%', left: -30, right: -30, height: 8 }} onMouseEnter={openMega} onMouseLeave={closeMega} />
                  <div onMouseEnter={openMega} onMouseLeave={closeMega}>
                    <MegaMenu onClose={() => setMegaOpen(false)} />
                  </div>
                </>
              )}
            </div>

            {[{ href: '/pricing', label: 'Preços' }, { href: '/blog', label: 'Blog' }].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                color: 'var(--ink-3)', textDecoration: 'none',
                letterSpacing: '0.01em', textTransform: 'uppercase',
                borderBottom: '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }} className="nav-link">
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Desktop auth ──────────────────────────── */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!loading && !user && (
              <>
                <Link href="/login" style={{
                  padding: '7px 14px', fontSize: 13, fontWeight: 600,
                  color: 'var(--ink-3)', textDecoration: 'none',
                  letterSpacing: '0.01em', textTransform: 'uppercase',
                }} className="nav-link">
                  Entrar
                </Link>
                <Link href="/login" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--ink)', color: 'white',
                  padding: '8px 18px', borderRadius: 7,
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  letterSpacing: '0.02em', textTransform: 'uppercase',
                  transition: 'background 0.15s, transform 0.15s',
                }} className="cta-btn">
                  Começar grátis
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </>
            )}
            {!loading && user && <UserDropdown user={user} signOut={signOut} />}
          </div>

          {/* ── Mobile controls ───────────────────────── */}
          <div className="mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
            {/* Account access — always visible on mobile */}
            {!loading && !user && (
              <Link href="/login" style={{
                padding: '6px 14px', background: 'var(--ink)', color: 'white',
                textDecoration: 'none', borderRadius: 7,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Entrar
              </Link>
            )}
            {!loading && user && (
              <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 32, padding: '4px 12px 4px 4px' }}>
                {user.avatar
                  ? <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
                }
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '-0.01em', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name?.split(' ')[0]}
                </span>
              </Link>
            )}

            {/* Menu button */}
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
              style={{
                width: 38, height: 38, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: drawerOpen ? 'var(--ink)' : 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 7,
                cursor: 'pointer', padding: 0, transition: 'background 0.15s',
              }}
            >
              {drawerOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <>
                  <span style={{ width: 18, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                  <span style={{ width: 14, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block', alignSelf: 'flex-start', marginLeft: 10 }} />
                  <span style={{ width: 18, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} />

      <style>{`
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .mobile-controls { display: none !important; }
          .logo-sub { display: block !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-controls { display: flex !important; }
        }
        .mega-item:hover { background: var(--bg-2) !important; }
        .dropdown-item:hover { background: var(--bg-2) !important; }
        .drawer-item:hover { background: var(--bg-2) !important; }
        .nav-link:hover { color: var(--ink) !important; border-bottom-color: var(--border-2) !important; }
        .user-btn:hover { background: var(--bg-3) !important; border-color: var(--border-2) !important; }
        .cta-btn:hover { background: var(--green) !important; transform: translateY(-1px); }
      `}</style>
    </>
  )
}