'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { useState, useRef, useEffect } from 'react'
import { MODE_META, type ExperienceMode } from '../lib/experienceMode'

// 4 simple links per mode — plain Portuguese, no jargon
const NAV: Record<string, { href: string; label: string }[]> = {
  personal: [
    { href: '/mymeds',       label: 'Medicamentos' },
    { href: '/vitals',       label: 'Saúde' },
    { href: '/interactions', label: 'Verificar' },
    { href: '/ai',           label: 'Perguntar' },
  ],
  caregiver: [
    { href: '/perfis',       label: 'A minha família' },
    { href: '/mymeds',       label: 'Medicamentos' },
    { href: '/passport',     label: 'Passaporte' },
    { href: '/ai',           label: 'Perguntar' },
  ],
  clinical: [
    { href: '/turno',    label: 'Turno' },
    { href: '/rounds',   label: 'Ronda' },
    { href: '/patients', label: 'Doentes' },
    { href: '/oracle',   label: 'Oracle AI' },
  ],
  student: [
    { href: '/arena',     label: 'Arena' },
    { href: '/study',     label: 'Estudar' },
    { href: '/simulador', label: 'Simulador' },
    { href: '/tutor',     label: 'AI Tutor' },
  ],
}

// Drawer tools — big items with emoji, plain Portuguese descriptions
const DRAWER: Record<string, { heading: string; items: { href: string; icon: string; label: string; desc: string }[] }[]> = {
  personal: [
    { heading: '💊 Medicação', items: [
      { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos',    desc: 'Lista, adicione e configure lembretes' },
      { href: '/interactions', icon: '🔍', label: 'Verificar interações',    desc: 'Descubra se os medicamentos são seguros juntos' },
      { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',      desc: 'O que não combinar com a sua medicação' },
      { href: '/schedule',     icon: '⏰', label: 'Horário de tomas',        desc: 'IA cria o melhor horário para si' },
      { href: '/bula',         icon: '📄', label: 'Perceber uma bula',       desc: 'Texto clínico em linguagem simples' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',     desc: 'Genéricos e alternativas mais seguras' },
    ]},
    { heading: '❤️ Saúde', items: [
      { href: '/vitals',    icon: '❤️',  label: 'Sinais vitais',            desc: 'Registe tensão, pulso e mais' },
      { href: '/objetivos', icon: '🎯',  label: 'Objetivos de saúde',       desc: 'Defina metas e acompanhe o progresso' },
      { href: '/passport',  icon: '🆘',  label: 'Passaporte de emergência', desc: 'QR code com a sua medicação completa' },
      { href: '/link',      icon: '🔗',  label: 'Partilhar com o médico',   desc: 'Link direto para o seu historial' },
      { href: '/relatorio', icon: '📊',  label: 'Relatório semanal',        desc: 'Resumo IA da sua semana de saúde' },
      { href: '/labs',      icon: '🧪',  label: 'Perceber análises',        desc: 'O que cada valor do boletim significa' },
    ]},
    { heading: '🤖 Ajuda & IA', items: [
      { href: '/ai',          icon: '🤖',  label: 'Perguntar à IA',          desc: 'Qualquer dúvida de saúde ou medicação' },
      { href: '/oracle',      icon: '👩‍⚕️', label: 'Farmacêutico virtual',   desc: 'Consulta estruturada com IA especializada' },
      { href: '/integracoes', icon: '📲',  label: 'Importar dados',          desc: 'Apple Saúde, Garmin, MySNS' },
    ]},
  ],
  caregiver: [
    { heading: '👨‍👩‍👧 Família', items: [
      { href: '/perfis',       icon: '👨‍👩‍👧', label: 'Perfis familiares',      desc: 'Saúde e medicação de cada familiar' },
      { href: '/mymeds',       icon: '💊',   label: 'Medicamentos',            desc: 'Lista, lembretes e verificação' },
      { href: '/interactions', icon: '🔍',   label: 'Verificar interações',    desc: 'São seguros juntos?' },
      { href: '/dose-crianca', icon: '👶',   label: 'Dose pediátrica',         desc: 'Peso + medicamento = dose certa' },
      { href: '/schedule',     icon: '⏰',   label: 'Horário de tomas',        desc: 'IA cria o melhor horário' },
    ]},
    { heading: '🆘 Saúde & Documentos', items: [
      { href: '/passport', icon: '🆘', label: 'Passaporte de emergência', desc: 'QR code para urgências' },
      { href: '/vitals',   icon: '❤️', label: 'Sinais vitais',            desc: 'Tensão, pulso e mais' },
      { href: '/link',     icon: '🔗', label: 'Partilhar com o médico',   desc: 'Link para o historial' },
      { href: '/labs',     icon: '🧪', label: 'Perceber análises',        desc: 'O que cada valor significa' },
      { href: '/relatorio',icon: '📊', label: 'Relatório semanal',        desc: 'Resumo IA da semana' },
    ]},
    { heading: '🤖 Ajuda', items: [
      { href: '/ai',    icon: '🤖',  label: 'Perguntar à IA',          desc: 'Qualquer dúvida de saúde' },
      { href: '/oracle',icon: '👩‍⚕️', label: 'Farmacêutico virtual',   desc: 'Consulta estruturada' },
    ]},
  ],
  clinical: [
    { heading: '🏥 Trabalho', items: [
      { href: '/turno',         icon: '🏥', label: 'Turno',               desc: 'Todos os doentes, doses e alertas' },
      { href: '/rounds',        icon: '📋', label: 'Ronda',               desc: 'PCNE, pendentes e métricas' },
      { href: '/mar',           icon: '📝', label: 'MAR',                 desc: 'Registo de administração de medicação' },
      { href: '/patients',      icon: '👥', label: 'Doentes',             desc: 'Fichas, medicação e alertas' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação',       desc: 'Antes vs depois da admissão' },
    ]},
    { heading: '🔬 Decisão Clínica', items: [
      { href: '/oracle',       icon: '🤖', label: 'Oracle AI',           desc: 'SOAP e intervenção farmacêutica' },
      { href: '/interactions', icon: '🔍', label: 'Interações',          desc: 'Mecanismo, evidência e gestão' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição', desc: 'STOPP/START e genéricos' },
      { href: '/calculators',  icon: '🔢', label: 'Calculadoras',        desc: 'SCORE2, CKD-EPI e mais 15+' },
      { href: '/adr-report',   icon: '⚠️', label: 'Notificação RAM',     desc: 'WHO-UMC e INFARMED' },
    ]},
    { heading: '⚙️ Ferramentas', items: [
      { href: '/ai',      icon: '🤖', label: 'Phlox AI Clínico', desc: 'Co-piloto farmacológico' },
      { href: '/iv-calc', icon: '💉', label: 'Calculadora IV',   desc: 'Volume, infusão e reconstituição' },
      { href: '/protocol',icon: '📚', label: 'Protocolos',       desc: 'ESC, ADA, NICE, DGS' },
    ]},
  ],
  student: [
    { heading: '🎮 Praticar', items: [
      { href: '/arena',     icon: '🏆', label: 'Arena',            desc: 'Ligas competitivas Bronze → Diamante' },
      { href: '/simulador', icon: '🎮', label: 'Simulador clínico',desc: 'Casos clínicos realistas com IA' },
      { href: '/osce',      icon: '🎯', label: 'Simulação OSCE',   desc: 'IA como doente, feedback imediato' },
      { href: '/exam',      icon: '📝', label: 'Modo exame',       desc: 'Timer e análise de erros' },
    ]},
    { heading: '📚 Estudar', items: [
      { href: '/study',     icon: '🃏', label: 'Flashcards e quizzes',  desc: '200+ tópicos, repetição espaçada' },
      { href: '/tutor',     icon: '🤖', label: 'AI Tutor',              desc: 'Explicações passo a passo' },
      { href: '/ficha',     icon: '📋', label: 'Ficha de fármaco',      desc: 'Mecanismo, mnemónica e quiz' },
      { href: '/progresso', icon: '📈', label: 'O meu progresso',       desc: 'XP, streak e pontos fracos' },
    ]},
    { heading: '🔬 Ferramentas Clínicas', items: [
      { href: '/oracle',       icon: '🤖', label: 'Oracle AI',           desc: 'Raciocínio farmacológico guiado' },
      { href: '/calculators',  icon: '🔢', label: 'Calculadoras',        desc: 'SCORE2, CKD-EPI e mais' },
      { href: '/interactions', icon: '🔍', label: 'Interações',          desc: 'CYP450, PD, PK e evidência' },
    ]},
  ],
}

const GUEST_TOOLS = [
  { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Grátis, sem conta necessária' },
  { href: '/bula',         icon: '📄', label: 'Perceber uma bula',     desc: 'Grátis, sem conta necessária' },
  { href: '/dose-crianca', icon: '👶', label: 'Dose pediátrica',       desc: 'Grátis, sem conta necessária' },
  { href: '/ai',           icon: '🤖', label: 'Perguntar à IA',        desc: 'Grátis, sem conta necessária' },
]

// ─── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase }: { user: any; signOut: () => void; supabase: any }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mode: ExperienceMode = user.experience_mode || 'personal'
  const isClinical = mode === 'clinical'

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function switchMode(newMode: ExperienceMode) {
    setOpen(false)
    await supabase.from('profiles').update({ experience_mode: newMode }).eq('id', user.id)
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} aria-label="Menu da conta"
        style={{ width: 36, height: 36, borderRadius: '50%', background: isClinical ? '#1d4ed8' : 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700, padding: 0, overflow: 'hidden', flexShrink: 0 }}>
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          : (user.name?.[0] || 'U').toUpperCase()}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.12)', minWidth: 248, overflow: 'hidden', zIndex: 300 }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{user.name || 'Utilizador'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{user.email}</div>
          </div>
          {([
            { href: '/dashboard', icon: '🏠', label: 'Início' },
            { href: '/settings',  icon: '⚙️', label: 'Definições' },
            { href: '/pricing',   icon: '⭐', label: 'Ver planos' },
          ] as const).map(({ href, icon, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }}
              className="dropdown-item">
              <span style={{ fontSize: 16 }}>{icon}</span> {label}
            </Link>
          ))}
          <div style={{ padding: '10px 16px 8px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mudar modo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {(['personal', 'caregiver', 'clinical', 'student'] as const).map(m => {
                const mm = MODE_META[m]
                const isActive = mode === m
                return (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{ padding: '7px 9px', border: `1px solid ${isActive ? mm.border : 'var(--border)'}`, borderRadius: 7, background: isActive ? mm.bg : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? mm.color : 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                    {mm.label}
                  </button>
                )
              })}
            </div>
          </div>
          <button onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 14, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 10 }}
            className="dropdown-item">
            <span style={{ fontSize: 16 }}>🚪</span> Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mobile drawer ─────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut, supabase }: { open: boolean; onClose: () => void; user: any; signOut: () => void; supabase: any }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const groups = user ? (DRAWER[mode] || DRAWER.personal) : [{
    heading: '🔍 Ferramentas gratuitas',
    items: GUEST_TOOLS,
  }]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.5)', zIndex: 149 }} />
      <div style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 'min(360px, 100vw)', background: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {user ? (
          <div style={{ padding: '16px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
              {user.avatar ? <img src={user.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> : (user.name?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <Link href="/dashboard" onClick={onClose} style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>Ir para início →</Link>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <Link href="/login" onClick={onClose} style={{ display: 'block', textAlign: 'center', padding: '16px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700 }}>
              Entrar / Criar conta
            </Link>
          </div>
        )}

        <div style={{ flex: 1 }}>
          {groups.map(group => (
            <div key={group.heading} style={{ borderBottom: '1px solid var(--bg-3)' }}>
              <div style={{ padding: '14px 20px 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{group.heading}</div>
              {group.items.map(item => (
                <Link key={item.href} href={item.href} onClick={onClose}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)', minHeight: 64 }}
                  className="drawer-item">
                  <div style={{ fontSize: 26, flexShrink: 0, width: 36, textAlign: 'center' }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{item.desc}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '14px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
            ⭐ Ver planos
          </Link>
          {user && (
            <button onClick={() => { signOut(); onClose() }}
              style={{ padding: '12px', background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Terminar sessão
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Header principal ──────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const mode: ExperienceMode | null = (user as any)?.experience_mode || null
  const isClinical = mode === 'clinical'
  const navLinks = mode ? (NAV[mode] || NAV.personal) : []

  const headerBg    = isClinical ? '#0f172a' : 'white'
  const headerBorder = isClinical ? '#1e293b' : 'var(--border)'
  const logoColor   = isClinical ? '#f8fafc' : 'var(--ink)'
  const logoBg      = isClinical ? '#1d4ed8' : 'var(--green)'
  const navColor    = isClinical ? '#94a3b8' : 'var(--ink-3)'

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: headerBg, borderBottom: `1px solid ${headerBorder}`, transition: 'background 0.3s' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill={logoBg}/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 800, color: logoColor, letterSpacing: '-0.03em' }}>Phlox</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0, marginLeft: 12 }}>
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}
                style={{ padding: '7px 12px', fontSize: 14, fontWeight: 500, color: navColor, textDecoration: 'none', borderRadius: 7, transition: 'background 0.12s, color 0.12s' }}
                className="nav-link">
                {label}
              </Link>
            ))}
            {!user && (<>
              <Link href="/interactions" style={{ padding: '7px 12px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 7 }} className="nav-link">Verificar interações</Link>
              <Link href="/bula" style={{ padding: '7px 12px', fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 7 }} className="nav-link">Perceber bulas</Link>
            </>)}
          </nav>

          {/* Desktop right */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {!loading && !user && (<>
              <Link href="/login" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8 }} className="nav-link">Entrar</Link>
              <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--ink)', color: 'white', padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Começar grátis →
              </Link>
            </>)}
            {!loading && user && <NotificationBell />}
            {!loading && user && <UserMenu user={user} signOut={signOut} supabase={supabase} />}
          </div>

          {/* Mobile right */}
          <div className="mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {!loading && !user && <Link href="/login" style={{ padding: '8px 14px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Entrar</Link>}
            {!loading && user && <NotificationBell />}
            <button onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Menu"
              style={{ width: 40, height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: drawerOpen ? 'var(--ink)' : (isClinical ? '#1e293b' : 'var(--bg-2)'), border: `1px solid ${isClinical ? '#334155' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', padding: 0 }}>
              {drawerOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <>
                    <span style={{ width: 18, height: 2, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block' }} />
                    <span style={{ width: 13, height: 2, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block', alignSelf: 'flex-start', marginLeft: 11 }} />
                    <span style={{ width: 18, height: 2, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block' }} />
                  </>}
            </button>
          </div>

        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} supabase={supabase} />

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-controls { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-controls { display: flex !important; } }
        @media (max-width: 640px) { header > div { padding: 0 16px !important; } }
        .nav-link:hover { background: var(--bg-2) !important; color: var(--ink) !important; }
        .drawer-item:hover { background: var(--bg-2) !important; }
        .dropdown-item:hover { background: var(--bg-2) !important; }
      `}</style>
    </>
  )
}
