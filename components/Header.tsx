'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { ROUTE_GROUPS, MODE_META, type ExperienceMode } from '@/lib/experienceMode'

// ─── Mega menu ─────────────────────────────────────────────────────────────────

function MegaMenu({ onClose, mode }: { onClose: () => void; mode: ExperienceMode | null }) {
  const groups = mode ? ROUTE_GROUPS[mode] : [
    { id: 'free', heading: 'Grátis · Sem conta', color: '#0d6e42', tools: [
      { href: '/interactions', label: 'Verificar Interações', sub: 'Brufen + Xarelto — analisamos', badge: 'Grátis' },
      { href: '/bula', label: 'Tradutor de Bula', sub: 'Cola o texto — linguagem simples', badge: 'Grátis' },
      { href: '/dose-crianca', label: 'Dose Pediátrica', sub: 'Peso + medicamento → dose certa', badge: 'Grátis' },
    ]},
    { id: 'family', heading: 'Para Famílias', color: '#b45309', tools: [
      { href: '/perfis', label: 'Perfis Familiares', sub: 'Medicação de cada familiar' },
      { href: '/prescription', label: 'Perceber a Receita', sub: 'Foto ou texto → explicação simples' },
      { href: '/labs', label: 'Perceber as Análises', sub: 'PDF ou texto → o que importa' },
      { href: '/vaccines', label: 'Vacinas em Dia?', sub: 'Calendário PT · viagens' },
      { href: '/otc', label: 'Automedicação', sub: 'Sintoma → o que comprar' },
      { href: '/consult-prep', label: 'Preparar Consulta', sub: 'Perguntas certas para o médico' },
    ]},
    { id: 'student-preview', heading: 'Para Estudantes', color: '#7c3aed', tools: [
      { href: '/study', label: 'Flashcards e Quizzes', sub: 'Farmacologia e clínica médica' },
      { href: '/cases', label: 'Casos Clínicos', sub: 'Raciocínio guiado · todos os níveis' },
      { href: '/shift', label: 'Turno Virtual', sub: '3 doentes · score · feedback IA' },
      { href: '/compare', label: 'Comparar Fármacos', sub: 'A vs B — linha a linha' },
      { href: '/disease', label: 'Fármacos por Doença', sub: '1ª e 2ª linha com doses' },
      { href: '/exam', label: 'Modo Exame', sub: 'Timer + análise de erros' },
    ]},
    { id: 'clinical-preview', heading: 'Para Profissionais', color: '#1d4ed8', tools: [
      { href: '/ai', label: 'Phlox AI Clínico', sub: 'Co-piloto farmacológico IA' },
      { href: '/protocol', label: 'Protocolo Terapêutico', sub: 'ESC · ADA · NICE · DGS' },
      { href: '/briefing', label: 'Briefing de Consulta', sub: 'Preparação em 15 segundos' },
      { href: '/calculators', label: 'Calculadoras Clínicas', sub: 'SCORE2 · CKD-EPI · Cockcroft' },
      { href: '/nursing', label: 'IV · SC · IM', sub: 'Compatibilidades e farmacotecnia' },
      { href: '/med-review', label: 'Revisão de Medicação', sub: 'Análise clínica + PDF' },
    ]},
  ]

  const isClinical = mode === 'clinical'

  return (
    <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200, background: isClinical ? '#0f172a' : 'white', borderBottom: `1px solid ${isClinical ? '#1e293b' : 'var(--border)'}`, boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 48px 32px', display: 'grid', gridTemplateColumns: `repeat(${groups.length}, 1fr)`, gap: '0 32px' }}>
        {groups.map((group, gi) => (
          <div key={group.id} style={{ borderRight: gi < groups.length - 1 ? `1px solid ${isClinical ? '#1e293b' : 'var(--border)'}` : 'none', paddingRight: gi < groups.length - 1 ? 32 : 0 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 14, height: 2, background: group.color, borderRadius: 1, flexShrink: 0 }} />
              {group.heading}
            </div>
            {group.tools.map(({ href, label, sub, badge }: any) => (
              <Link key={href} href={href} onClick={onClose}
                style={{ display: 'block', padding: '8px 8px 8px 0', textDecoration: 'none', borderRadius: 6, transition: 'background 0.12s' }}
                className={isClinical ? 'mega-link-dark' : 'mega-link'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isClinical ? '#f1f5f9' : 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{label}</span>
                  {badge && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', flexShrink: 0, textTransform: 'uppercase' }}>{badge}</span>}
                </div>
                <div style={{ fontSize: 11, color: isClinical ? '#64748b' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{sub}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, zIndex: -1 }} />
    </div>
  )
}

// ─── Mode switcher ─────────────────────────────────────────────────────────────

function ModeSwitcher({ user, supabase }: { user: any; supabase: any }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mode: ExperienceMode = user.experience_mode || 'personal'
  const meta = MODE_META[mode]

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const modes: ExperienceMode[] = ['clinical', 'caregiver', 'personal', 'student']

  async function switchMode(newMode: ExperienceMode) {
    setOpen(false)
    await supabase.from('profiles').update({ experience_mode: newMode }).eq('id', user.id)
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 8px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, cursor: 'pointer' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: meta.color, whiteSpace: 'nowrap' }}>{meta.labelShort}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.1)', minWidth: 200, overflow: 'hidden', zIndex: 400 }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Mudar modo</div>
          </div>
          {modes.map(m => {
            const mm = MODE_META[m]
            return (
              <button key={m} onClick={() => switchMode(m)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: m === mode ? mm.bg : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--bg-3)', transition: 'background 0.12s' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: m === mode ? 700 : 500, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>{mm.label}</span>
                {m === mode && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mm.color} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase }: { user: any; signOut: () => void; supabase: any }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const planBadge: Record<string, { bg: string; color: string }> = {
    free: { bg: 'var(--bg-3)', color: 'var(--ink-4)' },
    student: { bg: '#ede9fe', color: '#6d28d9' },
    pro: { bg: '#dbeafe', color: '#1d4ed8' },
    clinic: { bg: '#d1fae5', color: '#065f46' },
  }
  const badge = planBadge[user.plan || 'free'] || planBadge.free
  const isClinical = user.experience_mode === 'clinical'

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard' },
    ...(user.experience_mode === 'caregiver' ? [{ href: '/perfis', label: 'Perfis Familiares' }] : []),
    ...(user.experience_mode === 'clinical' ? [{ href: '/patients', label: 'Doentes / Utentes' }] : []),
    ...(user.experience_mode === 'personal' ? [{ href: '/mymeds', label: 'Os Meus Meds' }] : []),
    ...((user.org_role === 'owner' || user.org_role === 'admin') ? [{ href: '/organizacao', label: 'Organização' }] : []),
    { href: '/pricing', label: 'Ver planos' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 5px', background: isClinical ? '#1e293b' : 'var(--bg-2)', border: `1px solid ${isClinical ? '#334155' : 'var(--border)'}`, borderRadius: 32, cursor: 'pointer' }}
        className="user-btn">
        {user.avatar ? <img src={user.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: isClinical ? '#334155' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isClinical ? '#94a3b8' : 'white', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>}
        <span style={{ fontSize: 13, fontWeight: 600, color: isClinical ? '#f1f5f9' : 'var(--ink-2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0] || 'Conta'}</span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: 3 }}>{user.plan || 'free'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isClinical ? '#64748b' : 'var(--ink-4)'} strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.1)', minWidth: 220, overflow: 'hidden', zIndex: 300 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{user.name || 'Utilizador'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{user.email}</div>
          </div>
          {menuItems.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}
              className="dropdown-item">{label}</Link>
          ))}
          <button onClick={() => { signOut(); setOpen(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: 'var(--ink-4)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            className="dropdown-item">Terminar sessão</button>
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
  const groups = user ? ROUTE_GROUPS[mode] : []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.4)', zIndex: 149 }} />
      <div style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 'min(380px, 100vw)', background: 'white', borderLeft: '1px solid var(--border)', boxShadow: '-24px 0 64px rgba(0,0,0,0.12)', zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {user ? (
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.avatar ? <img src={user.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{user.plan || 'free'}</div>
            </div>
            <Link href="/dashboard" onClick={onClose} style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>Dashboard →</Link>
          </div>
        ) : (
          <div style={{ padding: '14px 20px', borderBottom: '2px solid var(--border)' }}>
            <Link href="/login" onClick={onClose} style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Entrar / Criar conta</Link>
          </div>
        )}
        <div style={{ flex: 1 }}>
          {groups.map((group) => (
            <div key={group.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '12px 20px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: group.color, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: group.color, borderRadius: 1 }} />
                {group.heading}
              </div>
              {group.tools.map(({ href, label, sub, badge }: any) => (
                <Link key={href} href={href} onClick={onClose}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', textDecoration: 'none', borderBottom: '1px solid var(--bg-3)' }}
                  className="drawer-item">
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                    {sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>}
                  </div>
                  {badge && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '2px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{badge}</span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ─── NOVO: Mode switcher no mobile ─── */}
          {user && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Mudar modo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['clinical','caregiver','personal','student'] as const).map(m => {
                  const mm = MODE_META[m]
                  const isActive = (user as any).experience_mode === m
                  return (
                    <button key={m} onClick={async () => {
                      // ─── usa supabase directamente via session ───
                      try {
                        const { data: sd } = await supabase.auth.getSession()
                        if (sd.session?.access_token) {
                          await fetch('/api/profiles/mode', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session.access_token}` },
                            body: JSON.stringify({ mode: m })
                          })
                        }
                      } catch {}
                      onClose()
                      window.location.reload()
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 10px', border: `1px solid ${isActive ? mm.border : 'var(--border)'}`, borderRadius: 7, background: isActive ? mm.bg : 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? mm.color : 'var(--ink-3)' }}>{mm.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <Link href="/pricing" onClick={onClose} style={{ display: 'block', padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ver planos</Link>
          {user && <button onClick={() => { signOut(); onClose() }} style={{ padding: '10px', background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Terminar sessão</button>}
        </div>
      </div>
    </>
  )
}

// ─── Header principal ─────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const [megaOpen, setMegaOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  const mode: ExperienceMode | null = (user as any)?.experience_mode || null
  const isClinical = mode === 'clinical'
  const headerBg = isClinical ? '#0f172a' : 'white'
  const headerBorder = isClinical ? '#1e293b' : 'var(--border)'

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: headerBg, borderBottom: `1px solid ${headerBorder}`, transition: 'background 0.3s' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          <Link href={user ? '/dashboard' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill={isClinical ? '#1d4ed8' : 'var(--green)'}/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 800, color: isClinical ? '#f8fafc' : 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>PHLOX</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: isClinical ? '#475569' : 'var(--ink-4)', letterSpacing: '0.18em', lineHeight: 1, marginTop: 2 }}>CLINICAL</div>
            </div>
          </Link>

          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', flex: 1, marginLeft: 12, gap: 4 }}>
            <button onClick={() => setMegaOpen(!megaOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: megaOpen ? (isClinical ? '#1e293b' : 'var(--bg-2)') : 'transparent', border: '1px solid', borderColor: megaOpen ? (isClinical ? '#334155' : 'var(--border-2)') : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: isClinical ? '#94a3b8' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', borderRadius: 7, flexShrink: 0 }}>
              Ferramentas
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: megaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
            </button>

            <Link href="/ai"
              style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 320, padding: '7px 12px', background: isClinical ? '#1e293b' : 'var(--bg-2)', border: `1.5px solid ${isClinical ? '#334155' : 'var(--border)'}`, borderRadius: 28, textDecoration: 'none', fontSize: 12.5, color: isClinical ? '#64748b' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s' }}
              className="search-bar-trigger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isClinical ? '#475569' : 'var(--ink-5)'} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <span style={{ flex: 1 }}>
                {mode === 'clinical' ? 'Consulta clínica...' : mode === 'student' ? 'Pergunta ao tutor...' : mode === 'caregiver' ? 'Pergunta sobre a família...' : 'Faz uma pergunta...'}
              </span>
              <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: isClinical ? '#0f172a' : 'white', border: `1px solid ${isClinical ? '#334155' : 'var(--border)'}`, padding: '2px 5px', borderRadius: 3, flexShrink: 0, color: isClinical ? '#475569' : 'var(--ink-5)' }}>⌘K</kbd>
            </Link>

            <Link href="/pricing" style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, color: isClinical ? '#64748b' : 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.02em', textTransform: 'uppercase', flexShrink: 0 }} className="nav-link">Preços</Link>
          </nav>

          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && user && activeProfile?.type === 'family' && (
              <Link href={`/perfil/${activeProfile.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 6px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 20, textDecoration: 'none' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white', flexShrink: 0 }}>{activeProfile.name.charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProfile.name}</span>
              </Link>
            )}
            {!loading && user && <ModeSwitcher user={user} supabase={supabase} />}
            {!loading && !user && (<>
              <Link href="/login" style={{ padding: '7px 14px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.01em', textTransform: 'uppercase' }} className="nav-link">Entrar</Link>
              <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ink)', color: 'white', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }} className="cta-btn">Começar grátis</Link>
            </>)}
            {!loading && user && <UserMenu user={user} signOut={signOut} supabase={supabase} />}
          </div>

          <div className="mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
            {!loading && !user && <Link href="/login" style={{ padding: '7px 14px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Entrar</Link>}
            {!loading && user && (
              <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: isClinical ? '#1e293b' : 'var(--bg-2)', border: `1px solid ${isClinical ? '#334155' : 'var(--border)'}`, borderRadius: 32, padding: '4px 12px 4px 4px' }}>
                {user.avatar ? <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', background: isClinical ? '#334155' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isClinical ? '#94a3b8' : 'white', fontSize: 12, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>}
                <span style={{ fontSize: 12, fontWeight: 700, color: isClinical ? '#f1f5f9' : 'var(--ink-2)', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name?.split(' ')[0]}</span>
              </Link>
            )}
            <button onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Menu"
              style={{ width: 38, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: drawerOpen ? 'var(--ink)' : (isClinical ? '#1e293b' : 'var(--bg-2)'), border: `1px solid ${isClinical ? '#334155' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', padding: 0 }}>
              {drawerOpen ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <><span style={{ width: 16, height: 1.5, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block' }} /><span style={{ width: 12, height: 1.5, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block', alignSelf: 'flex-start', marginLeft: 11 }} /><span style={{ width: 16, height: 1.5, background: isClinical ? '#94a3b8' : 'var(--ink)', borderRadius: 2, display: 'block' }} /></>}
            </button>
          </div>
        </div>
      </header>

      {megaOpen && <MegaMenu onClose={() => setMegaOpen(false)} mode={mode} />}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} signOut={signOut} supabase={supabase} />

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-controls { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-controls { display: flex !important; } }
        @media (max-width: 640px) { header > div { padding: 0 16px !important; } }
        .mega-link:hover { background: var(--bg-2) !important; padding-left: 8px !important; }
        .mega-link-dark:hover { background: #1e293b !important; padding-left: 8px !important; }
        .search-bar-trigger:hover { border-color: var(--border-2) !important; }
        .drawer-item:hover { background: var(--bg-2) !important; }
        .dropdown-item:hover { background: var(--bg-2) !important; }
        .nav-link:hover { color: var(--ink) !important; }
        .user-btn:hover { border-color: var(--border-2) !important; }
        .cta-btn:hover { background: var(--green) !important; }
      `}</style>
    </>
  )
}