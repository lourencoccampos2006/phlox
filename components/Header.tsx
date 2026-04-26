'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

// ─── Tool registry ────────────────────────────────────────────────────────────

const GROUPS = [
  {
    heading: 'Para toda a gente',
    color: '#0d6e42',
    tools: [
      { href: '/prescription', label: 'Perceber a Receita',        sub: 'Foto ou texto → explicação simples' },
      { href: '/labs',         label: 'Perceber as Análises',      sub: 'PDF ou texto → o que está fora do normal' },
      { href: '/interactions', label: 'Verificar Interações',      sub: 'Brufen, Voltaren, Xarelto — reconhecemos' },
      { href: '/otc',          label: 'O Que Comprar sem Receita', sub: 'Sintoma → o que levar da farmácia' },
      { href: '/drugs',        label: 'Base de Dados de Fármacos', sub: '10.000+ medicamentos em PT' },
      { href: '/safety',       label: 'Segurança',                 sub: 'Conduzir · gravidez · álcool · idosos' },
      { href: '/quickcheck',   label: 'Análise Rápida',            sub: 'Lista completa de medicamentos' },
    ],
  },
  {
    heading: 'Estudantes',
    color: '#7c3aed',
    tools: [
      { href: '/study',   label: 'Flashcards e Quizzes',  sub: '24 classes farmacológicas' },
      { href: '/exam',    label: 'Modo Exame',             sub: 'Simulação com timer e análise' },
      { href: '/cases',   label: 'Casos Clínicos',         sub: 'Raciocínio clínico guiado' },
      { href: '/compare', label: 'Comparar Fármacos',      sub: 'A vs B — linha a linha + exame' },
      { href: '/disease', label: 'Fármacos por Doença',   sub: '1ª e 2ª linha com doses + exame' },
      { href: '/mymeds',  label: 'A Minha Medicação',      sub: 'Perfil pessoal e interações' },
    ],
  },
  {
    heading: 'Decisão Clínica',
    color: '#1d4ed8',
    tools: [
      { href: '/ai',        label: 'Phlox AI',               sub: 'Farmacologista clínico IA' },
      { href: '/strategy',  label: 'Estratégias',            sub: 'Alternativas com evidência A/B/C' },
      { href: '/protocol',  label: 'Protocolo Terapêutico',  sub: 'ESC · ADA · NICE · DGS' },
      { href: '/briefing',  label: 'Briefing de Consulta',   sub: 'Preparação em 15 segundos' },
      { href: '/med-review',label: 'Revisão de Medicação',   sub: 'Análise clínica + PDF' },
    ],
  },
  {
    heading: 'Referência Clínica',
    color: '#0f766e',
    tools: [
      { href: '/nursing',      label: 'IV · SC · IM',        sub: 'Compatibilidades e farmacotecnia' },
      { href: '/calculators',  label: 'Calculadoras',        sub: 'SCORE2 · CKD-EPI · Cockcroft' },
      { href: '/monograph',    label: 'Monografia',          sub: 'Qualquer fármaco, completo' },
      { href: '/doses',        label: 'Posologia',           sub: 'Por indicação e guideline' },
      { href: '/compatibility',label: 'Compatibilidade IV',  sub: "Trissel's e King Guide" },
      { href: '/dilutions',    label: 'Diluições IV',        sub: 'Velocidades e estabilidade' },
    ],
  },
]

// Flat list for mobile
const ALL_TOOLS = GROUPS.flatMap(g => g.tools)

// ─── Mega menu — full-width bar below header ──────────────────────────────────

function MegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 62,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'white',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 52px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 24px' }}>
        {GROUPS.map((group, gi) => (
          <div key={group.heading} style={{ borderRight: gi < GROUPS.length - 1 ? '1px solid var(--border)' : 'none', paddingRight: gi < GROUPS.length - 1 ? 24 : 0 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 2, background: group.color, borderRadius: 1 }} />
              {group.heading}
            </div>
            {group.tools.map(({ href, label, sub }) => (
              <Link key={href} href={href} onClick={onClose}
                style={{ display: 'block', padding: '7px 0', textDecoration: 'none', borderBottom: '1px solid transparent' }}
                className="mega-link"
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {/* Close on outside click */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 62, zIndex: -1 }} />
    </div>
  )
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const PLAN_COLORS: Record<string, string> = { free: 'var(--ink-4)', student: '#7c3aed', pro: '#1d4ed8', clinic: 'var(--green)' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 4px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 32, cursor: 'pointer', transition: 'all 0.15s' }} className="user-btn">
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
        }
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0] || 'Conta'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden', zIndex: 300 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: PLAN_COLORS[user.plan || 'free'], letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{user.plan || 'free'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          {[{ href: '/dashboard', label: 'Dashboard' }, { href: '/pricing', label: 'Ver planos' }].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{ display: 'block', padding: '10px 14px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }} className="dropdown-item">{label}</Link>
          ))}
          <button onClick={() => { signOut(); setOpen(false) }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14, color: 'var(--ink-4)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }} className="dropdown-item">
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: { open: boolean; onClose: () => void; user: any; signOut: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 62, background: 'rgba(0,0,0,0.45)', zIndex: 149 }} />
      <div style={{ position: 'fixed', top: 62, right: 0, bottom: 0, width: 'min(360px, 100vw)', background: 'white', borderLeft: '1px solid var(--border)', boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* User block */}
        {user ? (
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Utilizador'}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{user.plan || 'free'}</div>
            </div>
            <Link href="/dashboard" onClick={onClose} style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>Dashboard →</Link>
          </div>
        ) : (
          <div style={{ padding: '14px 20px', borderBottom: '2px solid var(--border)' }}>
            <Link href="/login" onClick={onClose} style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Entrar / Criar conta
            </Link>
          </div>
        )}

        {/* Tools by group */}
        <div style={{ flex: 1 }}>
          {GROUPS.map((group, gi) => (
            <div key={group.heading} style={{ borderBottom: gi < GROUPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '12px 20px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: group.color, borderRadius: 1 }} />
                {group.heading}
              </div>
              {group.tools.map(({ href, label, sub }) => (
                <Link key={href} href={href} onClick={onClose}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}
                  className="drawer-item">
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '11px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Ver planos de preço
          </Link>
          {user && <button onClick={() => { signOut(); onClose() }} style={{ padding: '10px', background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Terminar sessão</button>}
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [megaOpen, setMegaOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 52px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="var(--green)"/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>PHLOX</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.16em', lineHeight: 1, marginTop: 2 }}>CLINICAL</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, marginLeft: 24 }}>
            <button
              onClick={() => setMegaOpen(!megaOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: megaOpen ? 'var(--bg-2)' : 'transparent', border: 'none', borderBottom: `2px solid ${megaOpen ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: megaOpen ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'all 0.15s', borderRadius: 0 }}
            >
              Ferramentas
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: megaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {[{ href: '/pricing', label: 'Preços' }, { href: '/blog', label: 'Blog' }].map(({ href, label }) => (
              <Link key={href} href={href} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.02em', textTransform: 'uppercase', borderBottom: '2px solid transparent', transition: 'color 0.15s, border-color 0.15s' }} className="nav-link">
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && !user && (
              <>
                <Link href="/login" style={{ padding: '7px 14px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'color 0.15s' }} className="nav-link">Entrar</Link>
                <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ink)', color: 'white', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }} className="cta-btn">
                  Começar grátis
                </Link>
              </>
            )}
            {!loading && user && <UserMenu user={user} signOut={signOut} />}
          </div>

          {/* Mobile controls */}
          <div className="mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
            {!loading && !user && (
              <Link href="/login" style={{ padding: '7px 14px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Entrar
              </Link>
            )}
            {!loading && user && (
              <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 32, padding: '4px 12px 4px 4px' }}>
                {user.avatar
                  ? <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
                }
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0]}</span>
              </Link>
            )}
            <button onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Menu"
              style={{ width: 38, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: drawerOpen ? 'var(--ink)' : 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 0, transition: 'background 0.15s' }}>
              {drawerOpen
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <>
                    <span style={{ width: 17, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                    <span style={{ width: 13, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block', alignSelf: 'flex-start', marginLeft: 10 }} />
                    <span style={{ width: 17, height: 2, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                  </>
              }
            </button>
          </div>
        </div>
      </header>

      {megaOpen && <MegaMenu onClose={() => setMegaOpen(false)} />}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} />

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-controls { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-controls { display: flex !important; } }
        @media (max-width: 640px) { header > div { padding: 0 16px !important; } }
        .mega-link:hover { background: var(--bg-2) !important; border-radius: 6px !important; padding-left: 6px !important; }
        .drawer-item:hover { background: var(--bg-2) !important; }
        .dropdown-item:hover { background: var(--bg-2) !important; }
        .nav-link:hover { color: var(--ink) !important; border-bottom-color: var(--border-2) !important; }
        .user-btn:hover { background: var(--bg-3) !important; border-color: var(--border-2) !important; }
        .cta-btn:hover { background: var(--green) !important; }
      `}</style>
    </>
  )
}