'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import NotificationBell from '@/components/NotificationBell'

// ─── Types ──────────────────────────────────────────────────────────────────

type InstType = 'hospital' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'clinic' | 'health_center'
type IconName = keyof typeof ICON_PATHS
interface NavItem { href: string; label: string; short: string; icon: IconName; badge?: 'new' }
interface NavSection { title: string; items: NavItem[] }

// ─── Icons (currentColor) ─────────────────────────────────────────────────────

const ICON_PATHS = {
  cockpit:   <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
  today:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  mar:       <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  carelog:   <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  handover:  <><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  round:     <><path d="M3 12h4l3 8 4-16 3 8h4"/></>,
  residents: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  assess:    <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 11l3 3 5-5"/><line x1="9" y1="7" x2="15" y2="7"/></>,
  careplan:  <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/></>,
  incidents: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  activities:<><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></>,
  board:     <><line x1="3" y1="3" x2="3" y2="21"/><rect x="7" y="13" width="3" height="6"/><rect x="12" y="9" width="3" height="10"/><rect x="17" y="5" width="3" height="14"/></>,
  census:    <><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></>,
  schedule:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  family:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>,
  roi:       <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  drug:      <><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/></>,
  quality:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  connect:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  patients:  <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
}

function NavIcon({ name, size = 17 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {ICON_PATHS[name]}
    </svg>
  )
}

// ─── Nav structure ─────────────────────────────────────────────────────────────

const NH_SECTIONS: NavSection[] = [
  { title: 'Hoje', items: [
    { href: '/cockpit',  label: 'Cockpit',         short: 'Cockpit',  icon: 'cockpit' },
    { href: '/hoje',     label: 'Tarefas do Turno', short: 'Tarefas', icon: 'today', badge: 'new' },
    { href: '/mar',      label: 'MAR',             short: 'MAR',      icon: 'mar' },
    { href: '/care-log', label: 'Registos Diários', short: 'Diários', icon: 'carelog' },
    { href: '/ronda-guiada', label: 'Ronda Guiada', short: 'Ronda',   icon: 'round', badge: 'new' },
    { href: '/handover', label: 'Passagem de Turno', short: 'Turno',  icon: 'handover' },
  ]},
  { title: 'Residentes', items: [
    { href: '/patients',    label: 'Residentes',        short: 'Resid.',  icon: 'residents' },
    { href: '/assessments', label: 'Avaliações',         short: 'Aval.',   icon: 'assess' },
    { href: '/care-plans',  label: 'Planos de Cuidado',  short: 'Planos',  icon: 'careplan' },
    { href: '/incidents',   label: 'Ocorrências',        short: 'Ocorr.',  icon: 'incidents' },
    { href: '/activities',  label: 'Atividades',         short: 'Ativid.', icon: 'activities' },
  ]},
  { title: 'Gestão', items: [
    { href: '/painel',   label: 'Painel do Lar',    short: 'Painel',   icon: 'board', badge: 'new' },
    { href: '/census',   label: 'Ocupação',         short: 'Ocup.',    icon: 'census' },
    { href: '/schedule', label: 'Equipa & Escalas', short: 'Equipa',   icon: 'schedule' },
    { href: '/family',   label: 'Famílias',         short: 'Família',  icon: 'family' },
    { href: '/roi',      label: 'Poupança',         short: 'ROI',      icon: 'roi' },
  ]},
  { title: 'Clínico', items: [
    { href: '/residentes', label: 'Rev. Farmacoterapêutica', short: 'Rev.',    icon: 'drug' },
    { href: '/rounds',     label: 'Ronda Farmacêutica',      short: 'Ronda F.', icon: 'round' },
    { href: '/quality',    label: 'Qualidade',               short: 'Qual.',   icon: 'quality' },
    { href: '/connect',    label: 'Connect',                 short: 'Connect', icon: 'connect' },
  ]},
]

const GENERIC_SECTIONS: NavSection[] = [
  { title: 'Clínico', items: [
    { href: '/cockpit',           label: 'Cockpit',        short: 'Cockpit', icon: 'cockpit' },
    { href: '/patients',          label: 'Doentes',        short: 'Doentes', icon: 'patients' },
    { href: '/mar',               label: 'Administração',  short: 'MAR',     icon: 'mar' },
    { href: '/rounds',            label: 'Ronda',          short: 'Ronda',   icon: 'round' },
    { href: '/drug-intelligence', label: 'Farmacoterapia', short: 'Farma',   icon: 'drug' },
    { href: '/quality',           label: 'Qualidade',      short: 'Qual.',   icon: 'quality' },
    { href: '/schedule',          label: 'Equipa',         short: 'Equipa',  icon: 'schedule' },
    { href: '/connect',           label: 'Connect',        short: 'Connect', icon: 'connect' },
  ]},
]

function getSections(inst: InstType): NavSection[] {
  return inst === 'nursing_home' ? NH_SECTIONS : GENERIC_SECTIONS
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function useInstitution(): InstType {
  const [inst, setInst] = useState<InstType>('nursing_home')
  useEffect(() => {
    const stored = localStorage.getItem('phlox-clinic-institution') as InstType | null
    if (stored) setInst(stored)
    const handler = (e: StorageEvent) => {
      if (e.key === 'phlox-clinic-institution' && e.newValue) setInst(e.newValue as InstType)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  return inst
}

function isActive(pathname: string, href: string) {
  if (href === '/cockpit') return pathname === '/cockpit'
  return pathname === href || pathname.startsWith(href + '/')
}

const INST_LABELS: Record<InstType, string> = {
  hospital: 'Hospital', clinic: 'Clínica', pharmacy_hospital: 'Farmácia Hosp.',
  pharmacy_community: 'Farmácia', nursing_home: 'Lar / ERPI', health_center: 'Centro de Saúde',
}

function shiftInfo() {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return { label: 'Manhã', hours: '07–14h', color: '#d97706' }
  if (h >= 14 && h < 21) return { label: 'Tarde', hours: '14–21h', color: '#2563eb' }
  return { label: 'Noite', hours: '21–07h', color: '#6d28d9' }
}

function pageMeta(pathname: string, sections: NavSection[]): { section: string; title: string } {
  for (const s of sections) {
    for (const it of s.items) {
      if (isActive(pathname, it.href)) return { section: s.title, title: it.label }
    }
  }
  const map: Record<string, { section: string; title: string }> = {
    '/settings': { section: 'Conta', title: 'Definições' },
  }
  if (map[pathname]) return map[pathname]
  if (pathname.startsWith('/patients/')) return { section: 'Residentes', title: 'Ficha do Residente' }
  return { section: 'Clínico', title: 'Phlox' }
}

const QUICK_ACTIONS = [
  { label: 'Registo diário',   href: '/care-log',    icon: 'carelog' as IconName },
  { label: 'Registar ocorrência', href: '/incidents', icon: 'incidents' as IconName },
  { label: 'Nova avaliação',   href: '/assessments', icon: 'assess' as IconName },
  { label: 'Marcar turno',     href: '/schedule',    icon: 'schedule' as IconName },
  { label: 'Mensagem família', href: '/family',      icon: 'family' as IconName },
]

const ACCENT = '#0d6e42'

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────

export function ClinicalSidebar() {
  const pathname = usePathname()
  const inst = useInstitution()
  const sections = getSections(inst)
  const { user, signOut } = useAuth() as any
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const firstName = user?.name?.split(' ')[0] || 'Conta'
  const initial = (user?.name?.[0] || 'U').toUpperCase()

  return (
    <nav className="cs-sidebar" style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 232, zIndex: 90,
      background: '#ffffff', borderRight: '1px solid #e8eaed',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Brand */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.03em', lineHeight: 1 }}>Phlox</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{INST_LABELS[inst]}</div>
        </div>
      </div>

      {/* Search trigger */}
      <div style={{ padding: '4px 12px 10px' }}>
        <button onClick={() => window.dispatchEvent(new Event('phlox:cmdk'))}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 9, border: '1px solid #e8eaed', background: '#f8fafc', cursor: 'pointer', color: '#94a3b8', fontFamily: 'var(--font-sans)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontSize: 12.5, flex: 1, textAlign: 'left' }}>Pesquisar...</span>
          <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', color: '#94a3b8' }}>⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 16px' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aab8', textTransform: 'uppercase', letterSpacing: '0.13em', padding: '8px 10px 5px' }}>
              {section.title}
            </div>
            {section.items.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  textDecoration: 'none', position: 'relative',
                  background: active ? '#eef6f1' : 'transparent',
                  color: active ? ACCENT : '#475569',
                  transition: 'background 0.12s, color 0.12s',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f7f9' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  {active && <div style={{ position: 'absolute', left: 0, top: '22%', bottom: '22%', width: 3, borderRadius: '0 2px 2px 0', background: ACCENT }} />}
                  <NavIcon name={item.icon} />
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '-0.01em', flex: 1 }}>{item.label}</span>
                  {item.badge === 'new' && <span style={{ fontSize: 8, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>NOVO</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div ref={menuRef} style={{ borderTop: '1px solid #e8eaed', padding: 10, position: 'relative' }}>
        <button onClick={() => setMenuOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f7f9'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: ACCENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{user?.plan === 'clinic' ? 'Institucional' : user?.plan === 'pro' ? 'Pro' : 'Conta'}</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', bottom: 'calc(100% - 4px)', left: 10, right: 10, background: 'white', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', overflow: 'hidden', padding: 5 }}>
            {[{ href: '/settings', label: 'Definições' }, { href: '/inicio', label: 'Sair do modo clínico' }].map(i => (
              <Link key={i.href} href={i.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 11px', fontSize: 13, color: '#374151', textDecoration: 'none', borderRadius: 7 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f7f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{i.label}</Link>
            ))}
            <button onClick={() => { setMenuOpen(false); signOut() }} style={{ width: '100%', textAlign: 'left', padding: '9px 11px', fontSize: 13, color: '#dc2626', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderRadius: 7 }}>
              Terminar sessão
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

// ─── Top bar (rich context) ─────────────────────────────────────────────────

export function ClinicalTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const inst = useInstitution()
  const sections = getSections(inst)
  const meta = pageMeta(pathname, sections)
  const sh = shiftInfo()
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <header className="cs-topbar" style={{
      position: 'sticky', top: 0, zIndex: 80, height: 56,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e8eaed',
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
    }}>
      {/* Mobile brand */}
      <Link href="/cockpit" className="cs-topbar-brand" style={{ display: 'none', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </div>
      </Link>

      {/* Breadcrumb / title */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="cs-crumb" style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.section}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.title}</div>
      </div>

      {/* Shift chip */}
      <div className="cs-shift" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, background: sh.color + '12', border: `1px solid ${sh.color}28`, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: sh.color }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: sh.color }}>Turno {sh.label}</span>
        <span className="cs-shift-hours" style={{ fontSize: 11, color: sh.color, opacity: 0.7 }}>{sh.hours}</span>
      </div>

      {/* Quick add */}
      <div ref={addRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setAddOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: ACCENT, color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="cs-add-label">Novo</span>
        </button>
        {addOpen && (
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 220, background: 'white', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 16px 50px rgba(0,0,0,0.14)', overflow: 'hidden', padding: 5 }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => { setAddOpen(false); router.push(a.href) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8, color: '#374151', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f7f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: '#94a3b8' }}><NavIcon name={a.icon} size={15} /></span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <NotificationBell />
    </header>
  )
}

// ─── Mobile bottom nav ──────────────────────────────────────────────────────

export function ClinicalMobileNav() {
  const pathname = usePathname()
  const inst = useInstitution()
  const sections = getSections(inst)
  const [moreOpen, setMoreOpen] = useState(false)

  const all = sections.flatMap(s => s.items)
  const pinned = inst === 'nursing_home'
    ? [all.find(i => i.href === '/cockpit')!, all.find(i => i.href === '/hoje')!, all.find(i => i.href === '/mar')!, all.find(i => i.href === '/patients')!].filter(Boolean)
    : all.slice(0, 4)
  const pinnedHrefs = new Set(pinned.map(i => i.href))
  const moreActive = !pinnedHrefs.has(pathname) && all.some(i => isActive(pathname, i.href))

  return (
    <>
      <nav className="cs-mobilenav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, zIndex: 90,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid #e8eaed', display: 'flex', alignItems: 'stretch',
      }}>
        {pinned.map(item => {
          const active = isActive(pathname, item.href)
          return (
            <Link key={item.href} href={item.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', color: active ? ACCENT : '#94a3b8', position: 'relative' }}>
              {active && <div style={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2.5, borderRadius: '0 0 2px 2px', background: ACCENT }} />}
              <NavIcon name={item.icon} size={20} />
              <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500 }}>{item.short}</span>
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(o => !o)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: moreOpen || moreActive ? ACCENT : '#94a3b8' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          <span style={{ fontSize: 9.5, fontWeight: moreOpen || moreActive ? 700 : 500 }}>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setMoreOpen(false)}>
          <div style={{ width: '100%', background: 'white', borderRadius: '18px 18px 0 0', padding: '12px 16px 80px', maxHeight: '82vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 38, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 18px' }} />
            {sections.map((section, si) => (
              <div key={si} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aab8', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 9, paddingLeft: 4 }}>{section.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {section.items.map(item => {
                    const active = isActive(pathname, item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 6px', borderRadius: 12, textDecoration: 'none', background: active ? '#eef6f1' : '#f8fafc', border: `1px solid ${active ? ACCENT + '40' : '#eef0f3'}`, color: active ? ACCENT : '#475569', position: 'relative' }}>
                        {item.badge === 'new' && <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />}
                        <NavIcon name={item.icon} size={21} />
                        <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.25, fontWeight: active ? 700 : 500 }}>{item.short}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
