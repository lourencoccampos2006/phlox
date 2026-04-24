'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

const TOOL_GROUPS = [
  {
    label: 'Análise e Diagnóstico',
    tools: [
      { href: '/labs',         label: 'Interpretação de Análises',  sub: 'PDF ou texto → relatório completo' },
      { href: '/interactions', label: 'Verificador de Interações',  sub: 'RxNorm + IA clínica' },
      { href: '/safety',       label: 'Segurança do Medicamento',   sub: 'Conduzir · gravidez · álcool · idosos' },
      { href: '/quickcheck',   label: 'Análise Rápida',             sub: 'Lista de medicamentos em segundos' },
    ],
  },
  {
    label: 'Referência Clínica',
    tools: [
      { href: '/drugs',         label: 'Base de Dados FDA',        sub: '10.000+ fármacos em PT' },
      { href: '/monograph',     label: 'Monografia IA',            sub: 'Qualquer fármaco, completo' },
      { href: '/doses',         label: 'Posologia',                sub: 'Por indicação e guideline' },
      { href: '/compatibility', label: 'Compatibilidade IV',       sub: "Trissel's e King Guide" },
      { href: '/dilutions',     label: 'Diluições IV',             sub: 'Velocidades e estabilidade' },
      { href: '/calculators',   label: 'Calculadoras',             sub: 'SCORE2 · HAS-BLED · Cockroft' },
    ],
  },
  {
    label: 'Estudo',
    tools: [
      { href: '/study',  label: 'Flashcards e Quizzes', sub: '24 classes farmacológicas' },
      { href: '/exam',   label: 'Modo Exame',            sub: 'Simulação com timer e análise' },
      { href: '/cases',  label: 'Casos Clínicos',        sub: 'Raciocínio clínico guiado' },
      { href: '/mymeds', label: 'A Minha Medicação',     sub: 'Perfil e verificação pessoal' },
    ],
  },
  {
    label: 'Pro — Decisão Clínica',
    tools: [
      { href: '/nursing',      label: 'Guia de Administração',      sub: 'IV · SC · IM — preparação e técnica' },
      { href: '/ai',          label: 'Phlox AI',                   sub: 'Farmacologista clínico IA' },
      { href: '/strategy',    label: 'Simulador de Estratégias',   sub: 'Alternativas com evidência A/B/C' },
      { href: '/protocol',    label: 'Protocolo Terapêutico',      sub: 'ESC · ADA · NICE · DGS' },
      { href: '/med-review',  label: 'Revisão de Medicação',       sub: 'Relatório clínico + PDF' },
    ],
  },
]

function UserMenu({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 24, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', display: 'block' }} />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
        }
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name?.split(' ')[0] || 'Conta'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', minWidth: 200, overflow: 'hidden', zIndex: 200 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
              {user.plan || 'free'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          <Link href="/dashboard" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '10px 14px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none', transition: 'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Dashboard
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '10px 14px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none', transition: 'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Ver planos
          </Link>
          <button onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14, color: 'var(--ink-4)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

function ToolsDropdown() {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', background: open ? 'var(--bg-2)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: open ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'background 0.12s, color 0.12s', letterSpacing: '-0.01em' }}>
        Ferramentas
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Invisible bridge between button and panel to prevent gap issues */}
      {open && <div style={{ position: 'absolute', top: '100%', left: -20, right: -20, height: 8 }} />}

      {open && (
        <div
          style={{ position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-30%)', background: 'white', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 210px)', gap: '0 8px', zIndex: 200, minWidth: 880 }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {TOOL_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ paddingRight: gi < TOOL_GROUPS.length - 1 ? 8 : 0, borderRight: gi < TOOL_GROUPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 8px 10px', fontWeight: 500 }}>
                {group.label}
              </div>
              {group.tools.map(({ href, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{ display: 'block', padding: '8px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.1s', marginBottom: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{sub}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}>
        <div className="page-container" style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#0d7a4e"/>
              <path d="M14 7v14M8 14h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="8" stroke="white" strokeWidth="1.5" strokeDasharray="2 2"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.04em' }}>Phlox</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em' }} className="desktop-only">CLINICAL</span>
          </Link>

          {/* Desktop nav */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-start', marginLeft: 16 }}>
            <ToolsDropdown />
            <Link href="/blog"
              style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              Blog
            </Link>
            <Link href="/api-docs"
              style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              API
            </Link>
            <Link href="/pricing"
              style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              Preços
            </Link>
          </nav>

          {/* Auth */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && !user && (
              <>
                <Link href="/login"
                  style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
                  Entrar
                </Link>
                <Link href="/login"
                  style={{ padding: '7px 16px', fontSize: 14, fontWeight: 600, color: 'white', background: 'var(--green)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.15s, transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-2)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,122,78,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                  Começar grátis
                </Link>
              </>
            )}
            {!loading && user && <UserMenu user={user} signOut={signOut} />}
          </div>

          {/* Mobile button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="mobile-btn"
            aria-label="Menu"
            style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--ink)', transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, top: 58, zIndex: 99, background: 'white', overflowY: 'auto' }}>
          {TOOL_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{ padding: '16px 20px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
                {group.label}
              </div>
              {group.tools.map(({ href, label, sub }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</span>
                </Link>
              ))}
            </div>
          ))}
          <div style={{ padding: '12px 20px', borderTop: '2px solid var(--border)' }}>
            <Link href="/blog"
              style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              Blog
            </Link>
            <Link href="/api-docs"
              style={{ padding: '7px 11px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, letterSpacing: '-0.01em', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              API
            </Link>
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              style={{ display: 'block', padding: '12px 0', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
              Ver preços →
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                  style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--ink-2)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}>
                  Dashboard
                </Link>
                <button onClick={() => { signOut(); setMobileOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 0', fontSize: 15, color: 'var(--ink-4)', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Terminar sessão
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '12px 0', fontSize: 15, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}>
                Entrar / Criar conta →
              </Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .mobile-btn  { display: none !important; }
          .desktop-only { display: inline !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-btn  { display: flex !important; }
          .desktop-only { display: none !important; }
        }
      `}</style>
    </>
  )
}
