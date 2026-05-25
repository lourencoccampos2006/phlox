'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import NotificationBell from '@/components/NotificationBell'
import { useInstitutionProfile } from '@/lib/useInstitutionProfile'

// ════════════════════════════════════════════════════════════════════════════
//  PHLOX CLINICAL LAYOUT — built from scratch, mobile-first, bulletproof.
//  Rules: only `position: fixed` (relative to viewport) + a padded content box.
//  No `position: sticky`, no backdrop-filter, no transforms on layout boxes.
//  Z-index ladder:  content 1  ·  topbar 800  ·  sidebar 850  ·  drawer 1900
// ════════════════════════════════════════════════════════════════════════════

type InstType = 'hospital' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'clinic' | 'health_center'
type IconName = keyof typeof ICONS
interface NavItem { href: string; label: string; icon: IconName; badge?: boolean }
interface NavSection { title: string; items: NavItem[] }

const ACCENT = '#0d6e42'
const TOPBAR_H = 54
const SIDEBAR_W = 240
const BP = 1024 // px — below this = mobile drawer; at/above = sidebar

// ─── Icons ─────────────────────────────────────────────────────────────────
const ICONS = {
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
  wound:     <><path d="M12 2a3 3 0 0 0-3 3c0 1.5 1 2.5 1 4s-1 2-1 3a3 3 0 0 0 6 0c0-1-1-1.5-1-3s1-2.5 1-4a3 3 0 0 0-3-3z"/><circle cx="12" cy="12" r="9"/></>,
  board:     <><line x1="3" y1="3" x2="3" y2="21"/><rect x="7" y="13" width="3" height="6"/><rect x="12" y="9" width="3" height="10"/><rect x="17" y="5" width="3" height="14"/></>,
  protocol:  <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 12l2 2 4-4"/></>,
  nutrition: <><path d="M3 12h4l3 8 4-16 3 8h4"/></>,
  agenda:    <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14l1.5 1.5"/><circle cx="12" cy="15" r="3"/></>,
  hydration: <><path d="M12 2.5S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
}
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ICONS[name]}</svg>
}

// ─── Nav data ────────────────────────────────────────────────────────────────
const NH: NavSection[] = [
  { title: 'Hoje', items: [
    { href: '/cockpit', label: 'Cockpit', icon: 'cockpit' },
    { href: '/turno', label: 'Centro de Turno', icon: 'turno', badge: true },
    { href: '/mar', label: 'MAR', icon: 'mar' },
    { href: '/care-log', label: 'Registos Diários', icon: 'carelog' },
  ]},
  { title: 'Residentes', items: [
    { href: '/patients', label: 'Residentes', icon: 'residents' },
    { href: '/assessments', label: 'Avaliações', icon: 'assess' },
    { href: '/care-plans', label: 'Planos de Cuidado', icon: 'careplan' },
    { href: '/feridas', label: 'Gestão de Feridas', icon: 'wound', badge: true },
    { href: '/incidents', label: 'Ocorrências', icon: 'incidents' },
    { href: '/activities', label: 'Atividades', icon: 'activities' },
  ]},
  { title: 'Clínico', items: [
    { href: '/residentes', label: 'Rev. Farmacoterapêutica', icon: 'drug' },
    { href: '/nutricao', label: 'Peso & Nutrição', icon: 'nutrition', badge: true },
    { href: '/hidratacao', label: 'Hidratação & Eliminação', icon: 'hydration', badge: true },
    { href: '/rounds', label: 'Ronda Farmacêutica', icon: 'round' },
    { href: '/quality', label: 'Qualidade', icon: 'quality' },
    { href: '/connect', label: 'Connect', icon: 'connect' },
  ]},
  { title: 'Gestão do lar', items: [
    { href: '/gestao', label: 'Painel de Gestão', icon: 'board', badge: true },
    { href: '/agenda', label: 'Agenda & Transportes', icon: 'agenda', badge: true },
    { href: '/census', label: 'Ocupação', icon: 'census' },
    { href: '/schedule', label: 'Equipa & Escalas', icon: 'schedule' },
    { href: '/protocolos', label: 'Protocolos', icon: 'protocol' },
    { href: '/family', label: 'Famílias', icon: 'family' },
    { href: '/roi', label: 'Poupança', icon: 'roi' },
  ]},
]
const GENERIC: NavSection[] = [
  { title: 'Clínico', items: [
    { href: '/cockpit', label: 'Cockpit', icon: 'cockpit' },
    { href: '/patients', label: 'Doentes', icon: 'patients' },
    { href: '/mar', label: 'Administração', icon: 'mar' },
    { href: '/rounds', label: 'Ronda', icon: 'round' },
    { href: '/drug-intelligence', label: 'Farmacoterapia', icon: 'drug' },
    { href: '/quality', label: 'Qualidade', icon: 'quality' },
    { href: '/schedule', label: 'Equipa', icon: 'schedule' },
    { href: '/connect', label: 'Connect', icon: 'connect' },
  ]},
]
const INST_LABELS: Record<InstType, string> = {
  hospital: 'Hospital', clinic: 'Clínica', pharmacy_hospital: 'Farmácia Hosp.',
  pharmacy_community: 'Farmácia', nursing_home: 'Lar / ERPI', health_center: 'Centro de Saúde',
}

function isActive(pathname: string, href: string) {
  if (href === '/cockpit') return pathname === '/cockpit'
  return pathname === href || pathname.startsWith(href + '/')
}
function shiftInfo() {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return { label: 'Manhã', color: '#d97706' }
  if (h >= 14 && h < 21) return { label: 'Tarde', color: '#2563eb' }
  return { label: 'Noite', color: '#6d28d9' }
}

// ─── Nav link (shared) ───────────────────────────────────────────────────────
function NavLink({ item, active, accent = ACCENT, onClick }: { item: NavItem; active: boolean; accent?: string; onClick?: () => void }) {
  return (
    <Link href={item.href} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, marginBottom: 1,
      textDecoration: 'none', position: 'relative',
      background: active ? accent + '14' : 'transparent', color: active ? accent : '#4a5260',
      fontWeight: active ? 700 : 500, transition: 'background 0.12s, color 0.12s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f5f7' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <Icon name={item.icon} size={18} />
      <span style={{ fontSize: 14, flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
      {item.badge && <span title="Novo" style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />}
    </Link>
  )
}

// ─── Main layout ─────────────────────────────────────────────────────────────
export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth() as any
  const profile = useInstitutionProfile()
  const accent = profile?.accent_color || ACCENT

  const [inst, setInst] = useState<InstType>('nursing_home')
  const [drawer, setDrawer] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem('phlox-clinic-institution') as InstType | null
    if (s) setInst(s)
    const h = (e: StorageEvent) => { if (e.key === 'phlox-clinic-institution' && e.newValue) setInst(e.newValue as InstType) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // Close overlays on navigation
  useEffect(() => { setDrawer(false); setAddOpen(false) }, [pathname])

  // Lock scroll while drawer open
  useEffect(() => {
    if (drawer) { const p = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = p } }
  }, [drawer])

  const [showHelp, setShowHelp] = useState(false)

  // Global keyboard shortcuts — "g then key" navigation (Linear-style)
  useEffect(() => {
    let gPending = false
    let gTimer: ReturnType<typeof setTimeout>
    const NAV: Record<string, string> = {
      c: '/cockpit', t: '/turno', m: '/mar', d: '/care-log',
      r: '/patients', f: '/feridas', e: '/schedule', o: '/incidents',
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShowHelp(h => !h); return }
      if (e.key === 'Escape') { setShowHelp(false); return }
      if (gPending) {
        gPending = false
        const dest = NAV[e.key.toLowerCase()]
        if (dest) { e.preventDefault(); router.push(dest) }
        return
      }
      if (e.key === 'g' || e.key === 'G') { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => { gPending = false }, 1200) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer) }
  }, [router])

  const sections = inst === 'nursing_home' ? NH : GENERIC
  const all = sections.flatMap(s => s.items)
  const current = all.find(i => isActive(pathname, i.href))
  const title = current?.label || (pathname === '/settings' ? 'Definições' : pathname.startsWith('/patients/') ? 'Ficha do Residente' : 'Phlox')
  const currentSection = sections.find(s => s.items.some(i => isActive(pathname, i.href)))?.title || ''
  const sh = shiftInfo()
  const firstName = user?.name?.split(' ')[0] || 'Conta'
  const initial = (user?.name?.[0] || 'U').toUpperCase()

  const quickActions = [
    { label: 'Centro de Turno', href: '/turno', icon: 'turno' as IconName },
    { label: 'Registo diário', href: '/care-log', icon: 'carelog' as IconName },
    { label: 'Registar ocorrência', href: '/incidents', icon: 'incidents' as IconName },
    { label: 'Nova avaliação', href: '/assessments', icon: 'assess' as IconName },
    { label: 'Marcar turno', href: '/schedule', icon: 'schedule' as IconName },
  ]

  const instName = profile?.short_name || profile?.name
  const Brand = ({ small }: { small?: boolean }) => (
    <Link href="/cockpit" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', minWidth: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
        {profile?.logo_url
          ? <img src={profile.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>}
      </span>
      {!small && <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.03em', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{instName || 'Phlox'}</span>
        <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{instName ? 'Phlox' : INST_LABELS[inst]}</span>
      </span>}
    </Link>
  )

  return (
    <div>
      {/* ═══ SIDEBAR (desktop) ═══ */}
      <aside className="cl-sidebar" style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: SIDEBAR_W, zIndex: 850,
        background: '#fff', borderRight: '1px solid #e6e8eb', display: 'none', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px 10px' }}><Brand /></div>
        <div style={{ padding: '0 12px 10px' }}>
          <button onClick={() => window.dispatchEvent(new Event('phlox:cmdk'))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 9, border: '1px solid #e6e8eb', background: '#f7f9fa', cursor: 'pointer', color: '#94a3b8', fontFamily: 'var(--font-sans)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span style={{ fontSize: 12.5, flex: 1, textAlign: 'left' }}>Pesquisar...</span>
            <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
          </button>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 16px' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#a3acb8', textTransform: 'uppercase', letterSpacing: '0.13em', padding: '8px 12px 5px' }}>{s.title}</div>
              {s.items.map(it => <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} accent={accent} />)}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid #e6e8eb', padding: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{user?.plan === 'clinic' ? 'Institucional' : user?.plan === 'pro' ? 'Pro' : 'Conta'}</div>
          </div>
          <Link href="/settings" title="Definições" style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Icon name="settings" size={15} /></Link>
        </div>
      </aside>

      {/* ═══ TOP BAR (fixed, all sizes) ═══ */}
      <header className="cl-topbar" style={{
        position: 'fixed', top: 0, right: 0, left: 0, height: TOPBAR_H, zIndex: 800,
        background: '#fff', borderBottom: '1px solid #e6e8eb',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
      }}>
        {/* hamburger (mobile) */}
        <button className="cl-mobile" onClick={() => setDrawer(true)} aria-label="Menu" style={{ width: 40, height: 40, borderRadius: 9, border: '1px solid #e6e8eb', background: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {/* title — mobile (single line) */}
        <span className="cl-mobile" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {/* breadcrumb + title — desktop */}
        <span className="cl-desktop" style={{ flexDirection: 'column', flex: 1, minWidth: 0, lineHeight: 1.1 }}>
          {currentSection && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{currentSection}</span>}
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </span>

        {/* shift (desktop) */}
        <span className="cl-desktop" style={{ alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 9, background: sh.color + '12', border: `1px solid ${sh.color}26`, flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: sh.color }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: sh.color }}>Turno {sh.label}</span>
        </span>
        {/* quick add (desktop) */}
        <button className="cl-desktop" onClick={() => setAddOpen(true)} style={{ alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, background: accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo
        </button>
        <span style={{ flexShrink: 0 }}><NotificationBell /></span>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="cl-content" style={{ minHeight: '100vh', paddingTop: TOPBAR_H }}>
        {children}
      </main>

      {/* ═══ MOBILE DRAWER ═══ */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1900 }}>
          <div onClick={() => setDrawer(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,24,0.5)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(86vw, 320px)', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '8px 0 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid #e6e8eb', flexShrink: 0 }}>
              <Brand />
              <span style={{ flex: 1 }} />
              <button onClick={() => setDrawer(false)} aria-label="Fechar" style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '10px 12px', flexShrink: 0 }}>
              <button onClick={() => { setDrawer(false); window.dispatchEvent(new Event('phlox:cmdk')) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, border: '1px solid #e6e8eb', background: '#f7f9fa', cursor: 'pointer', color: '#94a3b8', fontFamily: 'var(--font-sans)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Pesquisar residente ou página</span>
              </button>
            </div>
            <nav style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', WebkitOverflowScrolling: 'touch' }}>
              {sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#a3acb8', textTransform: 'uppercase', letterSpacing: '0.13em', padding: '8px 12px 5px' }}>{s.title}</div>
                  {s.items.map(it => <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} accent={accent} onClick={() => setDrawer(false)} />)}
                </div>
              ))}
            </nav>
            <div style={{ borderTop: '1px solid #e6e8eb', padding: 12, flexShrink: 0, display: 'flex', gap: 8 }}>
              <Link href="/settings" onClick={() => setDrawer(false)} style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#f1f5f9', borderRadius: 9, textDecoration: 'none' }}>Definições</Link>
              <button onClick={() => { setDrawer(false); signOut() }} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ QUICK-ADD SHEET ═══ */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1900 }}>
          <div onClick={() => setAddOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,24,0.4)' }} />
          <div className="cl-add-sheet" style={{ position: 'absolute', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '6px' }}>
              {quickActions.map(a => (
                <button key={a.href} onClick={() => { setAddOpen(false); router.push(a.href) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 9, color: '#374151', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ color: '#94a3b8' }}><Icon name={a.icon} size={17} /></span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ KEYBOARD SHORTCUTS HELP ═══ */}
      {showHelp && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowHelp(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e6e8eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0b1120' }}>Atalhos de teclado</span>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '14px 20px' }}>
              {[
                { keys: ['⌘', 'K'], label: 'Pesquisar / navegar' },
                { keys: ['G', 'C'], label: 'Cockpit' },
                { keys: ['G', 'T'], label: 'Centro de Turno' },
                { keys: ['G', 'M'], label: 'MAR' },
                { keys: ['G', 'D'], label: 'Registos Diários' },
                { keys: ['G', 'R'], label: 'Residentes' },
                { keys: ['G', 'F'], label: 'Gestão de Feridas' },
                { keys: ['G', 'E'], label: 'Equipa & Escalas' },
                { keys: ['G', 'O'], label: 'Ocorrências' },
                { keys: ['?'], label: 'Esta ajuda' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f4f6f8' }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{s.label}</span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k, i) => <kbd key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 8px', color: '#475569', fontWeight: 600 }}>{k}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* default = mobile: show .cl-mobile (flex), hide .cl-desktop & sidebar */
        .cl-mobile { display: flex !important; }
        .cl-desktop { display: none !important; }
        .cl-content { padding-left: 0; }
        .cl-add-sheet { left: 12px; right: 12px; bottom: 14px; border-radius: 14px; box-shadow: 0 16px 50px rgba(0,0,0,0.2); }

        @media (min-width: ${BP}px) {
          .cl-sidebar { display: flex !important; }
          .cl-topbar { left: ${SIDEBAR_W}px !important; }
          .cl-content { padding-left: ${SIDEBAR_W}px; }
          .cl-mobile { display: none !important; }
          .cl-desktop { display: flex !important; }
          .cl-add-sheet { left: auto; right: 16px; bottom: auto; top: ${TOPBAR_H + 6}px; width: 240px; border-radius: 12px; box-shadow: 0 16px 50px rgba(0,0,0,0.16); border: 1px solid #e6e8eb; }
        }
      `}</style>
    </div>
  )
}
