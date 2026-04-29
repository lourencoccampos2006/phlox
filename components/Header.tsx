'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

// ─── Tool registry ─────────────────────────────────────────────────────────────

const GROUPS = [
  {
    id: 'geral',
    heading: 'Para toda a gente',
    color: '#0d6e42',
    tools: [
      { href: '/interactions',  label: 'Verificar Interações',      sub: 'Brufen + Xarelto — analisamos em segundos',   badge: 'Grátis' },
      { href: '/bula',          label: 'Tradutor de Bula',           sub: 'Cola o texto ou escreve o nome — explicamos',  badge: 'Grátis' },
      { href: '/dose-crianca',  label: 'Dose Pediátrica',            sub: 'Dose por kg para crianças com alertas',       badge: 'Grátis' },
      { href: '/prescription',  label: 'Perceber a Receita',         sub: 'Foto ou texto → explicação simples' },
      { href: '/labs',          label: 'Perceber as Análises',       sub: 'PDF ou texto → o que está fora do normal' },
      { href: '/otc',           label: 'O Que Comprar sem Receita',  sub: 'Sintoma → o que levar da farmácia' },
      { href: '/generics',      label: 'Verificador de Genéricos',   sub: 'Há alternativa mais barata?' },
      { href: '/vaccines',      label: 'Verificador de Vacinas',     sub: 'Calendário PT · viagens · perfil' },
      { href: '/diary',         label: 'Diário de Sintomas',         sub: 'Tracker diário + análise farmacológica' },
      { href: '/consult-prep',  label: 'Preparar Consulta',          sub: 'Perguntas certas para o médico' },
      { href: '/safety',        label: 'Segurança',                  sub: 'Conduzir · gravidez · álcool · idosos' },
    ],
  },
  {
    id: 'familiar',
    heading: 'Perfis & Família',
    color: '#b45309',
    tools: [
      { href: '/perfis',        label: 'Perfis Familiares',          sub: 'Medicação de cada familiar num só sítio' },
      { href: '/ai',            label: 'Phlox AI',                   sub: 'Consulta sobre qualquer perfil familiar' },
      { href: '/quickcheck',    label: 'Análise Rápida de Medicação',sub: 'Lista completa → risco em segundos' },
      { href: '/drugs',         label: 'Base de Dados de Fármacos',  sub: '10.000+ medicamentos em PT' },
      { href: '/monograph',     label: 'Monografia',                 sub: 'Qualquer fármaco, completo' },
    ],
  },
  {
    id: 'student',
    heading: 'Estudantes',
    color: '#7c3aed',
    tools: [
      { href: '/study',   label: 'Flashcards e Quizzes',   sub: '24 classes farmacológicas' },
      { href: '/exam',    label: 'Modo Exame',              sub: 'Simulação com timer e análise' },
      { href: '/cases',   label: 'Casos Clínicos',          sub: 'Raciocínio clínico guiado' },
      { href: '/shift',   label: 'Turno Virtual',           sub: '3 doentes · score · feedback IA' },
      { href: '/compare', label: 'Comparar Fármacos',       sub: 'A vs B — linha a linha' },
      { href: '/disease', label: 'Fármacos por Doença',     sub: '1ª e 2ª linha com doses' },
      { href: '/mymeds',  label: 'A Minha Medicação',       sub: 'Perfil pessoal e interações' },
    ],
  },
  {
    id: 'clinical',
    heading: 'Decisão Clínica',
    color: '#1d4ed8',
    tools: [
      { href: '/strategy',     label: 'Estratégias Terapêuticas', sub: 'Alternativas com evidência A/B/C' },
      { href: '/protocol',     label: 'Protocolo Terapêutico',    sub: 'ESC · ADA · NICE · DGS' },
      { href: '/briefing',     label: 'Briefing de Consulta',     sub: 'Preparação em 15 segundos' },
      { href: '/med-review',   label: 'Revisão de Medicação',     sub: 'Análise clínica + PDF' },
      { href: '/nursing',      label: 'IV · SC · IM',             sub: 'Compatibilidades e farmacotecnia' },
      { href: '/calculators',  label: 'Calculadoras Clínicas',    sub: 'SCORE2 · CKD-EPI · Cockcroft' },
      { href: '/compatibility',label: 'Compatibilidade IV',       sub: "Trissel's e King Guide" },
      { href: '/dilutions',    label: 'Diluições IV',             sub: 'Velocidades e estabilidade' },
      { href: '/doses',        label: 'Posologia',                sub: 'Por indicação e guideline' },
    ],
  },
]

function getOrderedGroups(experienceMode: string | undefined) {
  if (experienceMode === 'student') {
    const [geral, familiar, student, clinical] = GROUPS
    return [student, geral, familiar, clinical]
  }
  if (experienceMode === 'clinical') {
    const [geral, familiar, student, clinical] = GROUPS
    return [clinical, geral, familiar, student]
  }
  if (experienceMode === 'caregiver') {
    const [geral, familiar, student, clinical] = GROUPS
    return [familiar, geral, student, clinical]
  }
  return GROUPS
}

// ─── Mega menu ─────────────────────────────────────────────────────────────────

function MegaMenu({ onClose, groups }: { onClose: () => void; groups: typeof GROUPS }) {
  return (
    <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200, background: 'white', borderBottom: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.1)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 48px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 32px' }}>
        {groups.map((group, gi) => (
          <div key={group.heading} style={{ borderRight: gi < groups.length - 1 ? '1px solid var(--border)' : 'none', paddingRight: gi < groups.length - 1 ? 32 : 0 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 14, height: 2, background: group.color, borderRadius: 1, flexShrink: 0 }} />
              {group.heading}
            </div>
            {group.tools.map(({ href, label, sub, badge }) => (
              <Link key={href} href={href} onClick={onClose}
                style={{ display: 'block', padding: '8px 8px 8px 0', textDecoration: 'none', borderRadius: 6, transition: 'background 0.12s' }}
                className="mega-link">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{label}</span>
                  {badge && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', flexShrink: 0, textTransform: 'uppercase' }}>
                      {badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{sub}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, zIndex: -1 }} />
    </div>
  )
}

// ─── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const planBadgeStyle: Record<string, { bg: string; color: string }> = {
    free:    { bg: 'var(--bg-3)',  color: 'var(--ink-4)' },
    student: { bg: '#ede9fe',      color: '#6d28d9' },
    pro:     { bg: '#dbeafe',      color: '#1d4ed8' },
    clinic:  { bg: '#d1fae5',      color: '#065f46' },
  }
  const badge = planBadgeStyle[user.plan || 'free'] || planBadgeStyle.free

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 5px', background: open ? 'var(--bg-2)' : 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 32, cursor: 'pointer', transition: 'border-color 0.15s' }}
        className="user-btn">
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
        }
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0] || 'Conta'}</span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: 3 }}>{user.plan || 'free'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.1)', minWidth: 220, overflow: 'hidden', zIndex: 300 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Utilizador'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/perfis', label: 'Perfis Familiares' },
            { href: '/mymeds', label: 'A Minha Medicação' },
            { href: '/pricing', label: 'Ver planos' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}
              className="dropdown-item">{label}</Link>
          ))}
          <button onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: 'var(--ink-4)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            className="dropdown-item">
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ─────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: { open: boolean; onClose: () => void; user: any; signOut: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.4)', zIndex: 149 }} />
      <div style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 'min(380px, 100vw)', background: 'white', borderLeft: '1px solid var(--border)', boxShadow: '-24px 0 64px rgba(0,0,0,0.12)', zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {user ? (
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Utilizador'}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{user.plan || 'free'}</div>
            </div>
            <Link href="/dashboard" onClick={onClose} style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>Dashboard →</Link>
          </div>
        ) : (
          <div style={{ padding: '14px 20px', borderBottom: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/login" onClick={onClose} style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
              Entrar / Criar conta
            </Link>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>Grátis — algumas ferramentas não precisam de conta</div>
          </div>
        )}

        <div style={{ flex: 1 }}>
          {GROUPS.map((group, gi) => (
            <div key={group.heading} style={{ borderBottom: gi < GROUPS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '12px 20px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: group.color, borderRadius: 1 }} />
                {group.heading}
              </div>
              {group.tools.map(({ href, label, sub, badge }) => (
                <Link key={href} href={href} onClick={onClose}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}
                  className="drawer-item">
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>
                  </div>
                  {badge && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '2px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Ver planos
          </Link>
          {user && <button onClick={() => { signOut(); onClose() }} style={{ padding: '10px', background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Terminar sessão</button>}
        </div>
      </div>
    </>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [megaOpen, setMegaOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)

  useEffect(() => {
    setActiveProfileState(getActiveProfile())
  }, [])

  const orderedGroups = getOrderedGroups(user?.experience_mode)

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="var(--green)"/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>PHLOX</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'var(--ink-4)', letterSpacing: '0.18em', lineHeight: 1, marginTop: 2 }}>CLINICAL</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', flex: 1, marginLeft: 12, gap: 4 }}>
            {/* Ferramentas trigger */}
            <button
              onClick={() => setMegaOpen(!megaOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: megaOpen ? 'var(--bg-2)' : 'transparent', border: '1px solid', borderColor: megaOpen ? 'var(--border-2)' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: megaOpen ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'all 0.15s', borderRadius: 7, flexShrink: 0 }}>
              Ferramentas
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: megaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {/* Search/AI trigger */}
            <Link href="/ai"
              style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 320, padding: '7px 12px', background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderRadius: 28, textDecoration: 'none', fontSize: 12.5, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              className="search-bar-trigger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <span style={{ flex: 1 }}>Faz uma pergunta...</span>
              <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: 3, letterSpacing: '0.02em', flexShrink: 0, color: 'var(--ink-5)' }}>⌘K</kbd>
            </Link>

            {/* Preços */}
            <Link href="/pricing"
              style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'color 0.15s', flexShrink: 0 }}
              className="nav-link">
              Preços
            </Link>
          </nav>

          {/* Desktop auth + profile badge */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Active family profile badge */}
            {!loading && user && activeProfile?.type === 'family' && (
              <Link href={`/perfil/${activeProfile.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 6px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 20, textDecoration: 'none' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeProfile.name}
                </span>
              </Link>
            )}

            {!loading && !user && (
              <>
                <Link href="/login"
                  style={{ padding: '7px 14px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.01em', textTransform: 'uppercase', transition: 'color 0.15s' }}
                  className="nav-link">Entrar</Link>
                <Link href="/login"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ink)', color: 'white', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}
                  className="cta-btn">
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
              style={{ width: 38, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: drawerOpen ? 'var(--ink)' : 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 0, transition: 'background 0.15s' }}>
              {drawerOpen
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <>
                    <span style={{ width: 16, height: 1.5, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                    <span style={{ width: 12, height: 1.5, background: 'var(--ink)', borderRadius: 2, display: 'block', alignSelf: 'flex-start', marginLeft: 11 }} />
                    <span style={{ width: 16, height: 1.5, background: 'var(--ink)', borderRadius: 2, display: 'block' }} />
                  </>
              }
            </button>
          </div>
        </div>
      </header>

      {megaOpen && <MegaMenu onClose={() => setMegaOpen(false)} groups={orderedGroups} />}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} />

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-controls { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-controls { display: flex !important; } }
        @media (max-width: 640px) { header > div { padding: 0 16px !important; } }
        .mega-link:hover { background: var(--bg-2) !important; padding-left: 8px !important; }
        .search-bar-trigger:hover { border-color: var(--border-2) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }
        .drawer-item:hover { background: var(--bg-2) !important; }
        .dropdown-item:hover { background: var(--bg-2) !important; }
        .nav-link:hover { color: var(--ink) !important; border-bottom-color: var(--border-2) !important; }
        .user-btn:hover { border-color: var(--border-2) !important; }
        .cta-btn:hover { background: var(--green) !important; }
      `}</style>
    </>
  )
}
