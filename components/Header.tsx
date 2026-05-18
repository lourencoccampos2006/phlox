'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MODE_META, type ExperienceMode } from '../lib/experienceMode'

// ─── Drawer content per mode ──────────────────────────────────────────────────

interface DrawerItem { href: string; icon: string; label: string; desc: string }
interface DrawerSection { title: string; items: DrawerItem[] }

const SECTIONS: Record<string, DrawerSection[]> = {
  personal: [
    { title: 'Medicação', items: [
      { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos',    desc: 'Lista, lembretes e horário de tomas' },
      { href: '/interactions', icon: '🔍', label: 'Verificar interações',    desc: 'São seguros juntos?' },
      { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',      desc: 'O que não misturar com a medicação' },
      { href: '/schedule',     icon: '⏰', label: 'Horário inteligente',     desc: 'IA cria o melhor horário' },
      { href: '/bula',         icon: '📄', label: 'Perceber uma bula',       desc: 'Texto clínico em português simples' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',     desc: 'Genéricos e alternativas mais seguras' },
    ]},
    { title: 'Saúde', items: [
      { href: '/vitals',    icon: '❤️', label: 'Sinais vitais',             desc: 'Tensão, pulso, peso' },
      { href: '/objetivos', icon: '🎯', label: 'Objetivos de saúde',        desc: 'Metas e acompanhamento' },
      { href: '/passport',  icon: '🆘', label: 'Passaporte de emergência',  desc: 'QR code com todos os dados' },
      { href: '/link',      icon: '🔗', label: 'Partilhar com o médico',    desc: 'Link direto para o historial' },
      { href: '/relatorio', icon: '📊', label: 'Relatório semanal',         desc: 'Resumo IA da sua semana' },
      { href: '/labs',      icon: '🧪', label: 'Perceber análises',         desc: 'O que cada valor significa' },
    ]},
    { title: 'Ajuda & IA', items: [
      { href: '/ai',          icon: '🤖',  label: 'Perguntar à IA',          desc: 'Qualquer dúvida de saúde' },
      { href: '/oracle',      icon: '👩‍⚕️', label: 'Farmacêutico virtual',   desc: 'Consulta estruturada' },
      { href: '/integracoes', icon: '📲',  label: 'Importar dados',          desc: 'Apple Saúde, Garmin, MySNS' },
    ]},
  ],
  caregiver: [
    { title: 'Família', items: [
      { href: '/perfis',       icon: '👨‍👩‍👧', label: 'Perfis familiares',     desc: 'Saúde de cada familiar' },
      { href: '/mymeds',       icon: '💊',   label: 'Medicamentos',           desc: 'Lista, lembretes e verificação' },
      { href: '/interactions', icon: '🔍',   label: 'Verificar interações',   desc: 'São seguros juntos?' },
      { href: '/dose-crianca', icon: '👶',   label: 'Dose pediátrica',        desc: 'Peso + medicamento = dose certa' },
    ]},
    { title: 'Saúde & Documentos', items: [
      { href: '/passport', icon: '🆘', label: 'Passaporte de emergência',  desc: 'QR code para urgências' },
      { href: '/vitals',   icon: '❤️', label: 'Sinais vitais',             desc: 'Tensão, pulso, peso' },
      { href: '/link',     icon: '🔗', label: 'Partilhar com o médico',    desc: 'Link para o historial' },
      { href: '/labs',     icon: '🧪', label: 'Perceber análises',         desc: 'O que cada valor significa' },
    ]},
    { title: 'Ajuda', items: [
      { href: '/ai',    icon: '🤖',  label: 'Perguntar à IA',         desc: 'Qualquer dúvida de saúde' },
      { href: '/oracle',icon: '👩‍⚕️', label: 'Farmacêutico virtual',  desc: 'Consulta estruturada' },
    ]},
  ],
  clinical: [
    { title: 'Trabalho', items: [
      { href: '/turno',         icon: '🏥', label: 'Turno',              desc: 'Doentes, doses e alertas' },
      { href: '/rounds',        icon: '📋', label: 'Ronda',              desc: 'PCNE, pendentes e métricas' },
      { href: '/mar',           icon: '📝', label: 'MAR',                desc: 'Registo de administração' },
      { href: '/patients',      icon: '👥', label: 'Doentes',            desc: 'Fichas e medicação' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação',      desc: 'Antes vs depois da admissão' },
    ]},
    { title: 'Clínica', items: [
      { href: '/oracle',       icon: '🤖', label: 'Oracle AI',          desc: 'SOAP e intervenção farmacêutica' },
      { href: '/interactions', icon: '🔍', label: 'Interações',         desc: 'Mecanismo e evidência' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',desc: 'STOPP/START e genéricos' },
      { href: '/calculators',  icon: '🔢', label: 'Calculadoras',       desc: 'SCORE2, CKD-EPI e mais' },
      { href: '/adr-report',   icon: '⚠️', label: 'Notificação RAM',    desc: 'WHO-UMC e INFARMED' },
    ]},
  ],
  student: [
    { title: 'Praticar', items: [
      { href: '/arena',     icon: '🏆', label: 'Arena',             desc: 'Ligas competitivas' },
      { href: '/simulador', icon: '🎮', label: 'Simulador clínico', desc: 'Casos reais com IA' },
      { href: '/osce',      icon: '🎯', label: 'Simulação OSCE',    desc: 'IA como doente' },
      { href: '/exam',      icon: '📝', label: 'Modo exame',        desc: 'Timer e análise de erros' },
    ]},
    { title: 'Estudar', items: [
      { href: '/study',     icon: '🃏', label: 'Flashcards e quizzes', desc: '200+ tópicos' },
      { href: '/tutor',     icon: '🤖', label: 'AI Tutor',             desc: 'Explicações passo a passo' },
      { href: '/ficha',     icon: '📋', label: 'Ficha de fármaco',     desc: 'Mecanismo e mnemónica' },
      { href: '/progresso', icon: '📈', label: 'O meu progresso',      desc: 'XP, streak e pontos fracos' },
    ]},
  ],
}

const GUEST_SECTION: DrawerSection = {
  title: 'Ferramentas gratuitas',
  items: [
    { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Sem conta necessária' },
    { href: '/bula',         icon: '📄', label: 'Perceber uma bula',     desc: 'Sem conta necessária' },
    { href: '/dose-crianca', icon: '👶', label: 'Dose pediátrica',       desc: 'Sem conta necessária' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar à IA',        desc: 'Sem conta necessária' },
  ],
}

// ─── Mode color helper ────────────────────────────────────────────────────────

const modeColor: Record<string, string> = {
  personal: '#059669', caregiver: '#d97706', clinical: '#2563eb', student: '#7c3aed',
}

const HEADER_NAV: Record<string, { href: string; label: string }[]> = {
  personal:  [{ href: '/mymeds', label: 'Medicação' }, { href: '/vitals', label: 'Saúde' }, { href: '/interactions', label: 'Verificar' }, { href: '/ai', label: 'Perguntar' }],
  caregiver: [{ href: '/perfis', label: 'Família' }, { href: '/mymeds', label: 'Medicação' }, { href: '/vitals', label: 'Saúde' }, { href: '/passport', label: 'SOS' }],
  clinical:  [{ href: '/turno', label: 'Turno' }, { href: '/rounds', label: 'Ronda' }, { href: '/patients', label: 'Doentes' }, { href: '/oracle', label: 'Oracle' }],
  student:   [{ href: '/arena', label: 'Arena' }, { href: '/study', label: 'Estudar' }, { href: '/simulador', label: 'Simular' }, { href: '/tutor', label: 'Tutor' }],
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown({ user, signOut, supabase }: { user: any; signOut: () => void; supabase: any }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mode: ExperienceMode = user.experience_mode || 'personal'

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function switchMode(m: ExperienceMode) {
    setOpen(false)
    await supabase.from('profiles').update({ experience_mode: m }).eq('id', user.id)
    window.location.reload()
  }

  const color = modeColor[mode] || '#059669'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-label="A minha conta"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: color, border: `2px solid ${color}`,
          cursor: 'pointer', padding: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 14, fontWeight: 900,
          flexShrink: 0,
          boxShadow: `0 0 0 2px white, 0 0 0 4px ${color}30`,
        }}>
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (user.name?.[0] || 'U').toUpperCase()}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 12px)',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(15,23,42,0.14)',
          minWidth: 260,
          overflow: 'hidden',
          zIndex: 999,
        }}>
          {/* User header */}
          <div style={{ padding: '18px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 18, fontWeight: 900, flexShrink: 0, overflow: 'hidden',
              }}>
                {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{user.email}</div>
              </div>
            </div>
          </div>

          {/* Links */}
          {[
            { href: '/dashboard', emoji: '🏠', label: 'Início' },
            { href: '/settings',  emoji: '⚙️', label: 'Definições' },
            { href: '/pricing',   emoji: '⭐', label: 'Ver planos' },
          ].map(({ href, emoji, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', fontSize: 15, color: '#374151', textDecoration: 'none', borderBottom: '1px solid #f8fafc' }}
              className="hdd-item">
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{emoji}</span>
              {label}
            </Link>
          ))}

          {/* Mode switcher */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Mudar modo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['personal','caregiver','clinical','student'] as const).map(m => {
                const mm = MODE_META[m]
                const active = mode === m
                return (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{
                      padding: '9px 10px', borderRadius: 10,
                      border: `1.5px solid ${active ? mm.color + '40' : '#f1f5f9'}`,
                      background: active ? mm.color + '10' : '#f8fafc',
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? mm.color : '#64748b',
                      display: 'flex', alignItems: 'center', gap: 7,
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                    {mm.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={() => { signOut(); setOpen(false) }}
            style={{
              width: '100%', textAlign: 'left', padding: '13px 20px',
              fontSize: 15, color: '#ef4444', background: 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 12,
            }} className="hdd-item">
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🚪</span>
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Side drawer ──────────────────────────────────────────────────────────────

function Drawer({ open, onClose, user, signOut }: {
  open: boolean; onClose: () => void; user: any; signOut: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const sections = user ? (SECTIONS[mode] || SECTIONS.personal) : [GUEST_SECTION]
  const color = modeColor[mode] || '#059669'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(400px, 100vw)',
        background: 'white',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(15,23,42,0.2)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 900, flexShrink: 0, overflow: 'hidden' }}>
                {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{user.name}</div>
                <Link href="/dashboard" onClick={onClose} style={{ fontSize: 13, color, fontWeight: 600, textDecoration: 'none' }}>Ver início →</Link>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Ferramentas</span>
          )}
          <button onClick={onClose} aria-label="Fechar"
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {sections.map(section => (
            <div key={section.title} style={{ marginBottom: 8 }}>
              <div style={{ padding: '8px 20px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {section.title}
              </div>
              <div style={{ padding: '0 12px' }}>
                {section.items.map(item => (
                  <Link key={item.href} href={item.href} onClick={onClose}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 8px', textDecoration: 'none', borderRadius: 12, minHeight: 60 }}
                    className="dr-item">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: '1px solid #f1f5f9' }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {!user && (
            <div style={{ padding: '8px 12px' }}>
              <Link href="/login" onClick={onClose} style={{ display: 'block', padding: '16px', background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
                Entrar / Criar conta grátis
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 12px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '14px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', textDecoration: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
            ⭐ Ver planos e preços
          </Link>
          {user && (
            <button onClick={() => { signOut(); onClose() }}
              style={{ padding: '12px', background: 'transparent', color: '#94a3b8', border: '1.5px solid #f1f5f9', borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Terminar sessão
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .dr-item:hover { background: #f8fafc !important; }
        .hdd-item:hover { background: #f8fafc !important; }
      `}</style>
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  const mode = (user as any)?.experience_mode || 'personal'
  const isClinical = mode === 'clinical'
  const bg     = isClinical ? '#0f172a' : 'white'
  const border = isClinical ? '#1e293b' : '#f1f5f9'
  const logoBg = isClinical ? '#2563eb' : '#059669'
  const logoText = isClinical ? 'white' : '#0f172a'
  const color  = modeColor[mode] || '#059669'

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: bg, borderBottom: `1px solid ${border}`,
        borderTop: `3px solid ${color}`,
        height: 60,
      }}>
        <div style={{ height: '100%', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1280, margin: '0 auto' }}>

          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: logoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 900, color: logoText, letterSpacing: '-0.04em' }}>Phlox</span>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {!loading && user && (
              <nav className="phlox-hdr-nav" style={{ display: 'flex', gap: 2 }}>
                {(HEADER_NAV[mode] || HEADER_NAV.personal).map(link => {
                  const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                  return (
                    <Link key={link.href} href={link.href}
                      style={{
                        padding: '6px 14px', fontSize: 14,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? (isClinical ? 'white' : color) : (isClinical ? 'rgba(255,255,255,0.5)' : '#64748b'),
                        background: isActive ? (isClinical ? 'rgba(255,255,255,0.12)' : `${color}14`) : 'transparent',
                        textDecoration: 'none', borderRadius: 8,
                        transition: 'all 0.12s',
                      }}
                      className="hh-nav-link">
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>

          {/* Auth buttons (guests) */}
          {!loading && !user && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/login" style={{ padding: '7px 14px', fontSize: 14, fontWeight: 600, color: '#64748b', textDecoration: 'none', borderRadius: 8, border: '1.5px solid #e2e8f0' }} className="hh-btn">
                Entrar
              </Link>
              <Link href="/login" style={{ padding: '8px 16px', background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>
                Começar grátis
              </Link>
            </div>
          )}

          {/* Authenticated controls */}
          {!loading && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificationBell />
              <UserDropdown user={user} signOut={signOut} supabase={supabase} />
            </div>
          )}

          {/* Hamburger — always visible */}
          <button onClick={() => setDrawerOpen(o => !o)} aria-label="Todas as ferramentas"
            style={{
              width: 36, height: 36, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: isClinical ? '#1e293b' : '#f1f5f9',
              border: 'none', borderRadius: 9, cursor: 'pointer', padding: 0, flexShrink: 0,
            }}>
            <span style={{ width: 16, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 1, display: 'block' }} />
            <span style={{ width: 11, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 1, display: 'block' }} />
            <span style={{ width: 16, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 1, display: 'block' }} />
          </button>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} />

      <style>{`
        .hh-btn:hover { background: #f8fafc !important; }
        .hh-nav-link:hover { opacity: 0.8; }
        @media (max-width: 768px) { .phlox-hdr-nav { display: none !important; } }
      `}</style>
    </>
  )
}
