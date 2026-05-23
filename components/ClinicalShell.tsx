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
  turno:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  mar:       <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  carelog:   <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  residents: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  assess:    <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 11l3 3 5-5"/><line x1="9" y1="7" x2="15" y2="7"/></>,
  careplan:  <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/></>,
  incidents: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  activities:<><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></>,
  census:    <><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></>,
  schedule:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  family:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>,
  roi:       <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  drug:      <><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/></>,
  round:     <><path d="M3 12h4l3 8 4-16 3 8h4"/></>,
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

// ─── Nav structure (consolidated) ─────────────────────────────────────────────

const NH_SECTIONS: NavSection[] = [
  { title: 'Hoje', items: [
    { href: '/cockpit',  label: 'Cockpit',          short: 'Cockpit',  icon: 'cockpit' },
    { href: '/turno',    label: 'Centro de Turno',  short: 'Turno',    icon: 'turno', badge: 'new' },
    { href: '/mar',      label: 'MAR',              short: 'MAR',      icon: 'mar' },
    { href: '/care-log', label: 'Registos Diários', short: 'Diários',  icon: 'carelog' },
  ]},
  { title: 'Residentes', items: [
    { href: '/patients',    label: 'Residentes',        short: 'Resid.',  icon: 'residents' },
    { href: '/assessments', label: 'Avaliações',         short: 'Aval.',   icon: 'assess' },
    { href: '/care-plans',  label: 'Planos de Cuidado',  short: 'Planos',  icon: 'careplan' },
    { href: '/incidents',   label: 'Ocorrências',        short: 'Ocorr.',  icon: 'incidents' },
    { href: '/activities',  label: 'Atividades',         short: 'Ativid.', icon: 'activities' },
  ]},
  { title: 'Gestão', items: [
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
  for (const s of sections) for (const it of s.items) if (isActive(pathname, it.href)) return { section: s.title, title: it.label }
  if (pathname === '/settings') return { section: 'Conta', title: 'Definições' }
  if (pathname === '/turno') return { section: 'Hoje', title: 'Centro de Turno' }
  if (pathname.startsWith('/patients/')) return { section: 'Residentes', title: 'Ficha do Residente' }
  return { section: 'Clínico', title: 'Phlox' }
}

const QUICK_ACTIONS: { label: string; href: string; icon: IconName }[] = [
  { label: 'Centro de Turno',  href: '/turno',     icon: 'turno' },
  { label: 'Registo diário',   href: '/care-log',  icon: 'carelog' },
  { label: 'Registar ocorrência', href: '/incidents', icon: 'incidents' },
  { label: 'Nova avaliação',   href: '/assessments', icon: 'assess' },
  { label: 'Marcar turno',     href: '/schedule',  icon: 'schedule' },
  { label: 'Mensagem família', href: '/family',    icon: 'family' },
]

const ACCENT = '#0d6e42'

// ─── Sidebar (desktop only) ────────────────────────────────────────────────────

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
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.03em', lineHeight: 1 }}>Phlox</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{INST_LABELS[inst]}</div>
        </div>
      </div>

      <div style={{ padding: '4px 12px 10px' }}>
        <button onClick={() => window.dispatchEvent(new Event('phlox:cmdk'))}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 9, border: '1px solid #e8eaed', background: '#f8fafc', cursor: 'pointer', color: '#94a3b8', fontFamily: 'var(--font-sans)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontSize: 12.5, flex: 1, textAlign: 'left' }}>Pesquisar...</span>
          <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', color: '#94a3b8' }}>⌘K</kbd>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 16px' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aab8', textTransform: 'uppercase', letterSpacing: '0.13em', padding: '8px 10px 5px' }}>{section.title}</div>
            {section.items.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  textDecoration: 'none', position: 'relative',
                  background: active ? '#eef6f1' : 'transparent', color: active ? ACCENT : '#475569',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f7f9' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  {active && <div style={{ position: 'absolute', left: 0, top: '22%', bottom: '22%', width: 3, borderRadius: '0 2px 2px 0', background: ACCENT }} />}
                  <NavIcon name={item.icon} />
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '-0.01em', flex: 1 }}>{item.label}</span>
                  {item.badge === 'new' && <span style={{ fontSize: 8, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', borderRadius: 4, padding: '1px 5px' }}>NOVO</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div ref={menuRef} style={{ borderTop: '1px solid #e8eaed', padding: 10, position: 'relative' }}>
        <button onClick={() => setMenuOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer' }}>
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
              <Link key={i.href} href={i.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 11px', fontSize: 13, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>{i.label}</Link>
            ))}
            <button onClick={() => { setMenuOpen(false); signOut() }} style={{ width: '100%', textAlign: 'left', padding: '9px 11px', fontSize: 13, color: '#dc2626', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderRadius: 7 }}>Terminar sessão</button>
          </div>
        )}
      </div>
    </nav>
  )
}

// ─── Mobile nav drawer ─────────────────────────────────────────────────────

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const inst = useInstitution()
  const sections = getSections(inst)
  const { user, signOut } = useAuth() as any

  useEffect(() => {
    if (open) { const p = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = p } }
  }, [open])

  if (!open) return null
  const initial = (user?.name?.[0] || 'U').toUpperCase()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,24,0.5)', backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(290px, 86vw)',
        background: 'white', display: 'flex', flexDirection: 'column',
        boxShadow: '12px 0 48px rgba(0,0,0,0.18)', animation: 'csDrawerIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid #e8eaed' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.03em', flex: 1 }}>Phlox</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '10px 12px' }}>
          <button onClick={() => { onClose(); window.dispatchEvent(new Event('phlox:cmdk')) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 9, border: '1px solid #e8eaed', background: '#f8fafc', cursor: 'pointer', color: '#94a3b8', fontFamily: 'var(--font-sans)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Pesquisar residente ou página...</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px' }}>
          {sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#a0aab8', textTransform: 'uppercase', letterSpacing: '0.13em', padding: '8px 10px 5px' }}>{section.title}</div>
              {section.items.map(item => {
                const active = isActive(pathname, item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={onClose} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 10px', borderRadius: 9, marginBottom: 1,
                    textDecoration: 'none', background: active ? '#eef6f1' : 'transparent', color: active ? ACCENT : '#374151',
                  }}>
                    <NavIcon name={item.icon} size={18} />
                    <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, flex: 1 }}>{item.label}</span>
                    {item.badge === 'new' && <span style={{ fontSize: 8, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', borderRadius: 4, padding: '1px 5px' }}>NOVO</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #e8eaed', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: ACCENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden' }}>
              {user?.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Conta'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{user?.email || ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/settings" onClick={onClose} style={{ flex: 1, textAlign: 'center', padding: '9px', fontSize: 12.5, fontWeight: 600, color: '#374151', background: '#f1f5f9', borderRadius: 9, textDecoration: 'none' }}>Definições</Link>
            <button onClick={() => { onClose(); signOut() }} style={{ flex: 1, padding: '9px', fontSize: 12.5, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Sair</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes csDrawerIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
    </div>
  )
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

export function ClinicalTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const inst = useInstitution()
  const sections = getSections(inst)
  const meta = pageMeta(pathname, sections)
  const sh = shiftInfo()
  const [addOpen, setAddOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Close add-sheet on route change
  useEffect(() => { setAddOpen(false); setDrawerOpen(false) }, [pathname])

  return (
    <header className="cs-topbar" style={{
      zIndex: 80, height: 54,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e8eaed',
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
    }}>
      {/* Mobile hamburger */}
      <button className="cs-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu"
        style={{ display: 'none', width: 38, height: 38, borderRadius: 9, border: '1px solid #e8eaed', background: 'white', cursor: 'pointer', flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Title / breadcrumb */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="cs-crumb" style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.section}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.title}</div>
      </div>

      {/* Shift chip (desktop) */}
      <div className="cs-shift" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, background: sh.color + '12', border: `1px solid ${sh.color}28`, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: sh.color }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: sh.color }}>Turno {sh.label}</span>
        <span className="cs-shift-hours" style={{ fontSize: 11, color: sh.color, opacity: 0.7 }}>{sh.hours}</span>
      </div>

      {/* Quick add */}
      <div ref={addRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setAddOpen(o => !o)} aria-label="Ações rápidas" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, background: ACCENT, color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="cs-add-label">Novo</span>
        </button>
      </div>

      <NotificationBell />

      {/* Quick-add menu: dropdown on desktop, bottom-sheet on mobile */}
      {addOpen && (
        <>
          <div className="cs-add-backdrop" onClick={() => setAddOpen(false)} style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(8,12,24,0.45)' }} />
          <div className="cs-add-menu" style={{ position: 'absolute', right: 14, top: 'calc(100% + 6px)', width: 230, background: 'white', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 16px 50px rgba(0,0,0,0.16)', overflow: 'hidden', padding: 5, zIndex: 220 }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => { setAddOpen(false); router.push(a.href) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8, color: '#374151', fontFamily: 'var(--font-sans)' }}>
                <span style={{ color: '#94a3b8' }}><NavIcon name={a.icon} size={16} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style>{`
        .cs-topbar { position: sticky; top: 0; }
        @media (max-width: 768px) {
          .cs-topbar { position: static; }
          .cs-hamburger { display: flex !important; }
          .cs-shift { display: none !important; }
          .cs-add-label { display: none !important; }
          .cs-crumb { display: none !important; }
          .cs-add-backdrop { display: block !important; }
          .cs-add-menu {
            position: fixed !important; left: 12px !important; right: 12px !important; width: auto !important;
            top: auto !important; bottom: 16px !important; padding: 8px !important;
          }
        }
      `}</style>
    </header>
  )
}
