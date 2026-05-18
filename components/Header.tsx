'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { useState, useRef, useEffect } from 'react'
import { MODE_META, type ExperienceMode } from '../lib/experienceMode'

// ─── All tools grouped for the drawer ─────────────────────────────────────────

const DRAWER: Record<string, { heading: string; items: { href: string; icon: string; label: string; desc: string }[] }[]> = {
  personal: [
    { heading: '💊 Medicação', items: [
      { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos',   desc: 'Lista, lembretes e horário' },
      { href: '/interactions', icon: '🔍', label: 'Verificar interações',   desc: 'São seguros juntos?' },
      { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',     desc: 'O que não misturar com a medicação' },
      { href: '/schedule',     icon: '⏰', label: 'Horário de tomas',       desc: 'IA cria o melhor horário' },
      { href: '/bula',         icon: '📄', label: 'Perceber uma bula',      desc: 'Texto clínico em português simples' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',    desc: 'Genéricos e alternativas' },
    ]},
    { heading: '❤️ Saúde', items: [
      { href: '/vitals',    icon: '❤️',  label: 'Sinais vitais',           desc: 'Tensão, pulso, peso e mais' },
      { href: '/objetivos', icon: '🎯',  label: 'Objetivos de saúde',      desc: 'Defina metas e acompanhe' },
      { href: '/passport',  icon: '🆘',  label: 'Passaporte de emergência',desc: 'QR code com todos os dados' },
      { href: '/link',      icon: '🔗',  label: 'Partilhar com o médico',  desc: 'Link direto para o historial' },
      { href: '/relatorio', icon: '📊',  label: 'Relatório semanal',       desc: 'Resumo IA da sua semana' },
      { href: '/labs',      icon: '🧪',  label: 'Perceber análises',       desc: 'O que cada valor significa' },
    ]},
    { heading: '🤖 IA & Ajuda', items: [
      { href: '/ai',          icon: '🤖',  label: 'Perguntar à IA',         desc: 'Qualquer dúvida de saúde' },
      { href: '/oracle',      icon: '👩‍⚕️', label: 'Farmacêutico virtual',  desc: 'Consulta estruturada' },
      { href: '/integracoes', icon: '📲',  label: 'Importar dados',         desc: 'Apple Saúde, Garmin, MySNS' },
    ]},
  ],
  caregiver: [
    { heading: '👨‍👩‍👧 Família', items: [
      { href: '/perfis',       icon: '👨‍👩‍👧', label: 'Perfis familiares',    desc: 'Saúde e medicação de cada familiar' },
      { href: '/mymeds',       icon: '💊',   label: 'Medicamentos',          desc: 'Lista, lembretes e verificação' },
      { href: '/interactions', icon: '🔍',   label: 'Verificar interações',  desc: 'São seguros juntos?' },
      { href: '/dose-crianca', icon: '👶',   label: 'Dose pediátrica',       desc: 'Peso + medicamento = dose certa' },
      { href: '/schedule',     icon: '⏰',   label: 'Horário de tomas',      desc: 'IA cria o melhor horário' },
    ]},
    { heading: '🆘 Saúde & Documentos', items: [
      { href: '/passport', icon: '🆘', label: 'Passaporte de emergência', desc: 'QR code para urgências' },
      { href: '/vitals',   icon: '❤️', label: 'Sinais vitais',            desc: 'Tensão, pulso e mais' },
      { href: '/link',     icon: '🔗', label: 'Partilhar com o médico',   desc: 'Link para o historial' },
      { href: '/labs',     icon: '🧪', label: 'Perceber análises',        desc: 'O que cada valor significa' },
    ]},
    { heading: '🤖 Ajuda', items: [
      { href: '/ai',    icon: '🤖',  label: 'Perguntar à IA',          desc: 'Qualquer dúvida de saúde' },
      { href: '/oracle',icon: '👩‍⚕️', label: 'Farmacêutico virtual',   desc: 'Consulta estruturada' },
    ]},
  ],
  clinical: [
    { heading: '🏥 Trabalho', items: [
      { href: '/turno',         icon: '🏥', label: 'Turno',               desc: 'Doentes, doses e alertas' },
      { href: '/rounds',        icon: '📋', label: 'Ronda',               desc: 'PCNE, pendentes e métricas' },
      { href: '/mar',           icon: '📝', label: 'MAR',                 desc: 'Registo de administração' },
      { href: '/patients',      icon: '👥', label: 'Doentes',             desc: 'Fichas e medicação' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação',       desc: 'Antes vs depois da admissão' },
    ]},
    { heading: '🔬 Clínica', items: [
      { href: '/oracle',       icon: '🤖', label: 'Oracle AI',           desc: 'SOAP e intervenção farmacêutica' },
      { href: '/interactions', icon: '🔍', label: 'Interações',          desc: 'Mecanismo e evidência' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição', desc: 'STOPP/START e genéricos' },
      { href: '/calculators',  icon: '🔢', label: 'Calculadoras',        desc: 'SCORE2, CKD-EPI, 15+' },
      { href: '/adr-report',   icon: '⚠️', label: 'Notificação RAM',     desc: 'WHO-UMC e INFARMED' },
    ]},
  ],
  student: [
    { heading: '🎮 Praticar', items: [
      { href: '/arena',     icon: '🏆', label: 'Arena',            desc: 'Ligas competitivas' },
      { href: '/simulador', icon: '🎮', label: 'Simulador clínico',desc: 'Casos reais com IA' },
      { href: '/osce',      icon: '🎯', label: 'Simulação OSCE',   desc: 'IA como doente' },
      { href: '/exam',      icon: '📝', label: 'Modo exame',       desc: 'Timer e análise de erros' },
    ]},
    { heading: '📚 Estudar', items: [
      { href: '/study',     icon: '🃏', label: 'Flashcards e quizzes',  desc: '200+ tópicos' },
      { href: '/tutor',     icon: '🤖', label: 'AI Tutor',              desc: 'Explicações passo a passo' },
      { href: '/ficha',     icon: '📋', label: 'Ficha de fármaco',      desc: 'Mecanismo e mnemónica' },
      { href: '/progresso', icon: '📈', label: 'O meu progresso',       desc: 'XP, streak e pontos fracos' },
    ]},
  ],
}

const GUEST_ITEMS = [
  { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Grátis — sem conta necessária' },
  { href: '/bula',         icon: '📄', label: 'Perceber uma bula',     desc: 'Grátis — sem conta necessária' },
  { href: '/dose-crianca', icon: '👶', label: 'Dose pediátrica',       desc: 'Grátis — sem conta necessária' },
  { href: '/ai',           icon: '🤖', label: 'Perguntar à IA',        desc: 'Grátis — sem conta necessária' },
]

// ─── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase }: { user: any; signOut: () => void; supabase: any }) {
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Conta"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: mode === 'clinical' ? '#2563eb' : mode === 'student' ? '#7c3aed' : mode === 'caregiver' ? '#d97706' : '#059669',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 800,
          padding: 0, overflow: 'hidden', flexShrink: 0,
        }}>
        {user.avatar
          ? <img src={user.avatar} alt="" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} />
          : (user.name?.[0] || 'U').toUpperCase()}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          minWidth: 252, overflow: 'hidden', zIndex: 300,
        }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 2 }}>{user.name || 'Utilizador'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{user.email}</div>
          </div>

          {[
            { href: '/dashboard', icon: '🏠', label: 'Início' },
            { href: '/settings',  icon: '⚙️', label: 'Definições' },
            { href: '/pricing',   icon: '⭐', label: 'Ver planos' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', fontSize: 15, color: '#374151', textDecoration: 'none' }}
              className="dd-item">
              <span style={{ fontSize: 18 }}>{icon}</span> {label}
            </Link>
          ))}

          <div style={{ padding: '12px 18px', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Mudar modo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['personal','caregiver','clinical','student'] as const).map(m => {
                const mm = MODE_META[m]
                const active = mode === m
                return (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{
                      padding: '8px 10px', border: `1.5px solid ${active ? mm.border : '#e5e7eb'}`,
                      borderRadius: 8, background: active ? mm.bg : 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? mm.color : '#6b7280',
                      display: 'flex', alignItems: 'center', gap: 6,
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
              width: '100%', textAlign: 'left', padding: '13px 18px', fontSize: 15,
              color: '#dc2626', background: 'transparent', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12,
            }} className="dd-item">
            <span style={{ fontSize: 18 }}>🚪</span> Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Full-screen mobile drawer ─────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: {
  open: boolean; onClose: () => void; user: any; signOut: () => void; supabase?: any
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const groups = user ? (DRAWER[mode] || DRAWER.personal) : [{ heading: '🆓 Ferramentas gratuitas', items: GUEST_ITEMS }]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.55)', zIndex: 149, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: 60, right: 0, bottom: 0,
        width: 'min(380px, 100vw)',
        background: 'white',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
        zIndex: 150, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {user ? (
          <div style={{ padding: '18px 22px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#059669',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, fontWeight: 800, flexShrink: 0, overflow: 'hidden',
            }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%' }} />
                : (user.name?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <Link href="/dashboard" onClick={onClose} style={{ fontSize: 13, color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Ir para início →</Link>
            </div>
          </div>
        ) : (
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6' }}>
            <Link href="/login" onClick={onClose} style={{ display: 'block', textAlign: 'center', padding: '16px', background: '#111', color: 'white', textDecoration: 'none', borderRadius: 12, fontSize: 17, fontWeight: 800 }}>
              Entrar / Criar conta grátis
            </Link>
          </div>
        )}

        <div style={{ flex: 1 }}>
          {groups.map(group => (
            <div key={group.heading} style={{ borderBottom: '1px solid #f9fafb' }}>
              <div style={{ padding: '16px 22px 8px', fontSize: 14, fontWeight: 800, color: '#374151' }}>{group.heading}</div>
              {group.items.map(item => (
                <Link key={item.href} href={item.href} onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '15px 22px', textDecoration: 'none',
                    borderBottom: '1px solid #f9fafb', minHeight: 70,
                  }}
                  className="drawer-row">
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0,
                  }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.desc}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 22px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '15px', background: '#111', color: 'white', textDecoration: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
            ⭐ Ver planos e preços
          </Link>
          {user && (
            <button onClick={() => { signOut(); onClose() }}
              style={{ padding: '13px', background: 'transparent', color: '#9ca3af', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Terminar sessão
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const mode: ExperienceMode | null = (user as any)?.experience_mode || null
  const isClinical = mode === 'clinical'
  const bg     = isClinical ? '#0f172a' : 'white'
  const border = isClinical ? '#1e293b' : '#f3f4f6'
  const logoC  = isClinical ? 'white' : '#111'
  const logoBg = isClinical ? '#2563eb' : '#059669'

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: bg, borderBottom: `1px solid ${border}`,
        height: 60,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto', padding: '0 20px',
          height: '100%', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, flex: 1 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <rect width="30" height="30" rx="8" fill={logoBg}/>
              <path d="M15 7v16M8 15h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 18, fontWeight: 900, color: logoC, letterSpacing: '-0.04em' }}>Phlox</span>
          </Link>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!loading && !user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href="/login"
                  style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', borderRadius: 8, border: '1.5px solid #e5e7eb' }}
                  className="header-btn">Entrar</Link>
                <Link href="/login"
                  style={{ padding: '8px 18px', background: '#111', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  Começar grátis →
                </Link>
              </div>
            )}
            {!loading && user && <NotificationBell />}
            {!loading && user && <UserMenu user={user} signOut={signOut} supabase={supabase} />}
            <button onClick={() => setDrawerOpen(o => !o)} aria-label="Menu"
              style={{
                width: 40, height: 40, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                background: drawerOpen ? '#111' : (isClinical ? '#1e293b' : '#f3f4f6'),
                border: 'none', borderRadius: 10, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}>
              {drawerOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <>
                    <span style={{ width: 18, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 2, display: 'block' }} />
                    <span style={{ width: 12, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 2, display: 'block' }} />
                    <span style={{ width: 18, height: 2, background: isClinical ? '#94a3b8' : '#374151', borderRadius: 2, display: 'block' }} />
                  </>}
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} supabase={supabase} />

      <style>{`
        .dd-item:hover { background: #f9fafb !important; }
        .drawer-row:hover { background: #f9fafb !important; }
        .header-btn:hover { background: #f9fafb !important; }
      `}</style>
    </>
  )
}
