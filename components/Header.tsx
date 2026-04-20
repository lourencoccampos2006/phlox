'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

const TOOL_GROUPS = [
  {
    label: 'Para toda a gente',
    tools: [
      { href: '/labs',          label: 'Interpretação de Análises',  desc: 'Percebe os teus resultados' },
      { href: '/interactions',  label: 'Verificador de Interações',  desc: 'Medicamentos compatíveis?' },
      { href: '/drugs',         label: 'Base de Dados de Fármacos',  desc: 'Informação clínica completa' },
      { href: '/safety',        label: 'Segurança do Medicamento',   desc: 'Conduzir, gravidez, álcool' },
      { href: '/quickcheck',    label: 'Análise Rápida',             desc: 'Lista completa em segundos' },
      { href: '/calculators',   label: 'Calculadoras Clínicas',      desc: 'SCORE2, HAS-BLED e mais' },
    ],
  },
  {
    label: 'Para estudantes',
    tools: [
      { href: '/study',   label: 'Plataforma de Estudo', desc: 'Flashcards e quizzes' },
      { href: '/exam',    label: 'Modo Exame',            desc: 'Simulação com timer' },
      { href: '/cases',   label: 'Casos Clínicos',        desc: 'Raciocínio guiado' },
      { href: '/mymeds',  label: 'A Minha Medicação',     desc: 'Perfil farmacológico pessoal' },
    ],
  },
  {
    label: 'Para profissionais',
    tools: [
      { href: '/ai',           label: 'Phlox AI',                  desc: 'Farmacologista clínico IA' },
      { href: '/protocol',     label: 'Protocolo Terapêutico',     desc: 'Baseado em guidelines' },
      { href: '/monograph',    label: 'Monografia Clínica IA',     desc: 'Qualquer fármaco em PT' },
      { href: '/doses',        label: 'Posologia por Indicação',   desc: 'Doses e alternativas' },
      { href: '/compatibility', label: 'Compatibilidade IV',       desc: 'Trissel\'s e King Guide' },
      { href: '/dilutions',    label: 'Diluições e Perfusões IV',  desc: 'Protocolos hospitalares' },
    ],
  },
]

const ALL_MOBILE = TOOL_GROUPS.flatMap(g => g.tools)

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>

          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/><path d="M12 8v8M8 12h8"/></svg>
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Phlox</span>
          </Link>

          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <div style={{ position: 'relative' }}
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', borderRadius: 6, letterSpacing: '-0.01em' }}>
                Ferramentas
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M6 9l6 6 6-6"/></svg>
              </button>

              {toolsOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-40%)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-xl)', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 200px)', gap: '0 12px', zIndex: 100 }}>
                  {TOOL_GROUPS.map(group => (
                    <div key={group.label}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '0 8px 8px', fontWeight: 500 }}>
                        {group.label}
                      </div>
                      {group.tools.map(({ href, label, desc }) => (
                        <Link key={href} href={href} onClick={() => setToolsOpen(false)}
                          style={{ display: 'block', padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s', marginBottom: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{desc}</div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link href="/pricing" style={{ padding: '6px 10px', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 6, letterSpacing: '-0.01em' }}>
              Preços
            </Link>

            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />

            {!loading && !user && (
              <>
                <Link href="/login" style={{ padding: '6px 10px', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 6, letterSpacing: '-0.01em' }}>
                  Entrar
                </Link>
                <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 13px', borderRadius: 7, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  Começar grátis
                </Link>
              </>
            )}

            {!loading && user && (
              <div style={{ position: 'relative' }}
                onMouseEnter={() => setUserOpen(true)}
                onMouseLeave={() => setUserOpen(false)}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 4px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer' }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>{user.name?.[0] || 'U'}</div>
                  }
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', letterSpacing: '-0.01em', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name?.split(' ')[0]}
                  </span>
                </button>
                {userOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', minWidth: 170, overflow: 'hidden', zIndex: 100 }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{user.plan || 'free'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                    <Link href="/dashboard" style={{ display: 'block', padding: '9px 12px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '-0.01em' }}>
                      Dashboard
                    </Link>
                    <button onClick={signOut} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', borderTop: '1px solid var(--border)' }}>
                      Terminar sessão
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="mobile-btn"
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: 'var(--ink)', display: 'none' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'white', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ padding: '10px 16px 4px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Ferramentas</div>
            {ALL_MOBILE.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '11px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)', letterSpacing: '-0.01em' }}>
                {label}
              </Link>
            ))}
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              style={{ display: 'block', padding: '11px 16px', fontSize: 14, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', borderBottom: '1px solid var(--border)', letterSpacing: '-0.01em' }}>
              Preços
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '11px 16px', fontSize: 14, color: 'var(--ink-3)', textDecoration: 'none' }}>Dashboard</Link>
                <button onClick={() => { signOut(); setMobileOpen(false) }} style={{ width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 14, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Terminar sessão</button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '11px 16px', fontSize: 14, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>Entrar / Criar conta →</Link>
            )}
          </div>
        )}
      </header>
      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-btn { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-btn { display: flex !important; } }
      `}</style>
    </>
  )
}