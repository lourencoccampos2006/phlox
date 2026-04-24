'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef } from 'react'

const GROUPS = [
  {
    label: 'Para todos',
    items: [
      { href: '/labs',         label: 'Análises Clínicas',        sub: 'Interpreta os teus resultados' },
      { href: '/interactions', label: 'Interações',               sub: 'Medicamentos compatíveis?' },
      { href: '/otc',          label: 'Automedicação',            sub: 'O que comprar sem receita' },
      { href: '/prescription', label: 'Explicador de Receita',    sub: 'Foto ou texto da receita' },
      { href: '/drugs',        label: 'Base de Dados FDA',        sub: '10.000+ fármacos em PT' },
      { href: '/safety',       label: 'Segurança',                sub: 'Conduzir · gravidez · álcool' },
    ],
  },
  {
    label: 'Estudantes',
    items: [
      { href: '/study',   label: 'Flashcards e Quizzes', sub: '24 classes farmacológicas' },
      { href: '/exam',    label: 'Modo Exame',            sub: 'Simulação com timer' },
      { href: '/cases',   label: 'Casos Clínicos',        sub: 'Raciocínio clínico guiado' },
      { href: '/mymeds',  label: 'A Minha Medicação',     sub: 'Perfil farmacológico pessoal' },
    ],
  },
  {
    label: 'Profissionais',
    items: [
      { href: '/ai',           label: 'Phlox AI',              sub: 'Farmacologista clínico IA' },
      { href: '/nursing',      label: 'Farmacotecnia IV·SC·IM', sub: 'Compatibilidades e prep.' },
      { href: '/strategy',     label: 'Estratégias Terapêuticas', sub: 'Evidência A/B/C comparada' },
      { href: '/protocol',     label: 'Protocolo Terapêutico',  sub: 'ESC · ADA · NICE' },
      { href: '/med-review',   label: 'Revisão de Medicação',   sub: 'Análise + relatório PDF' },
      { href: '/calculators',  label: 'Calculadoras',           sub: 'SCORE2 · CKD-EPI · Beers' },
    ],
  },
]

function ToolsMenu({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
      transform: 'translateX(-24%)',
      background: 'white', border: '1px solid var(--border)',
      borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.13)',
      padding: '18px', display: 'grid',
      gridTemplateColumns: 'repeat(3, 200px)', gap: '0 8px',
      zIndex: 200,
    }}>
      {GROUPS.map((g, gi) => (
        <div key={g.label} style={{
          paddingRight: gi < GROUPS.length - 1 ? 8 : 0,
          borderRight: gi < GROUPS.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '0 8px 10px', fontWeight: 500 }}>
            {g.label}
          </div>
          {g.items.map(({ href, label, sub }) => (
            <Link key={href} href={href} onClick={onClose}
              style={{ display: 'block', padding: '7px 8px', borderRadius: 8, textDecoration: 'none', marginBottom: 1 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{sub}</div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openTools = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setToolsOpen(true) }
  const closeTools = () => { closeTimer.current = setTimeout(() => setToolsOpen(false), 150) }

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="page-container" style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect width="26" height="26" rx="6" fill="var(--green)"/>
              <path d="M13 6v14M7 13h12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.04em' }}>Phlox</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, marginLeft: 8 }} className="desktop-nav">
            <div style={{ position: 'relative' }} onMouseEnter={openTools} onMouseLeave={closeTools}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', background: toolsOpen ? 'var(--bg-2)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', transition: 'background 0.12s' }}>
                Ferramentas
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {toolsOpen && (
                <>
                  {/* bridge */}
                  <div style={{ position: 'absolute', top: '100%', left: -20, right: -20, height: 10 }} onMouseEnter={openTools} onMouseLeave={closeTools} />
                  <div onMouseEnter={openTools} onMouseLeave={closeTools}>
                    <ToolsMenu onClose={() => setToolsOpen(false)} />
                  </div>
                </>
              )}
            </div>

            {[{ href: '/pricing', label: 'Preços' }, { href: '/blog', label: 'Blog' }].map(({ href, label }) => (
              <Link key={href} href={href}
                style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Auth — desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="desktop-nav">
            {!loading && !user && (
              <>
                <Link href="/login" style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em' }}>Entrar</Link>
                <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Começar grátis</Link>
              </>
            )}
            {!loading && user && (
              <div style={{ position: 'relative' }} onMouseEnter={() => setUserOpen(true)} onMouseLeave={() => setUserOpen(false)}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 4px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer' }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
                  }
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0]}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {userOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', minWidth: 190, overflow: 'hidden', zIndex: 200 }}>
                    <div style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>{user.plan || 'free'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                    {[{ href: '/dashboard', l: 'Dashboard' }, { href: '/pricing', l: 'Ver planos' }].map(({ href, l }) => (
                      <Link key={href} href={href} style={{ display: 'block', padding: '9px 13px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {l}
                      </Link>
                    ))}
                    <button onClick={signOut} style={{ width: '100%', textAlign: 'left', padding: '9px 13px', fontSize: 14, color: 'var(--ink-4)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      Terminar sessão
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile right */}
          <div style={{ display: 'none', alignItems: 'center', gap: 10 }} className="mobile-right">
            {!loading && !user && <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Entrar</Link>}
            {!loading && user && (
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                {user.avatar
                  ? <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', display: 'block' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
                }
              </Link>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--ink)', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu — fullscreen overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, top: 58, zIndex: 99, background: 'white', overflowY: 'auto' }}>
          {GROUPS.map(g => (
            <div key={g.label}>
              <div style={{ padding: '14px 20px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>{g.label}</div>
              {g.items.map(({ href, label, sub }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                  style={{ display: 'flex', flexDirection: 'column', padding: '11px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</span>
                </Link>
              ))}
            </div>
          ))}
          <div style={{ padding: '14px 20px', borderTop: '2px solid var(--border)' }}>
            <Link href="/pricing" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '11px 0', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>Preços →</Link>
            <Link href="/blog" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '11px 0', fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>Blog</Link>
            {user
              ? <button onClick={() => { signOut(); setMobileOpen(false) }} style={{ width: '100%', textAlign: 'left', padding: '11px 0', fontSize: 15, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderTop: '1px solid var(--border)', marginTop: 4 }}>Terminar sessão</button>
              : <Link href="/login" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '11px 0', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', borderTop: '1px solid var(--border)', marginTop: 4 }}>Entrar / Criar conta →</Link>
            }
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-right { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-right { display: flex !important; } }
      `}</style>
    </>
  )
}