'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

type InstType = 'hospital' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'clinic' | 'health_center'

interface NavItem {
  href: string
  label: string
  short: string
  icon: (color: string, size?: number) => React.ReactNode
}

function Svg({ children, color, size = 20 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}

const ICONS: Record<string, (color: string, size?: number) => React.ReactNode> = {
  cockpit: (c, s) => <Svg color={c} size={s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></Svg>,
  patients: (c, s) => <Svg color={c} size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  mar: (c, s) => <Svg color={c} size={s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Svg>,
  rounds: (c, s) => <Svg color={c} size={s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Svg>,
  team: (c, s) => <Svg color={c} size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  quality: (c, s) => <Svg color={c} size={s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>,
  drug: (c, s) => <Svg color={c} size={s}><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/><path d="M15.5 18h5M18 15.5v5"/></Svg>,
  connect: (c, s) => <Svg color={c} size={s}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Svg>,
  validation: (c, s) => <Svg color={c} size={s}><polyline points="20 6 9 17 4 12"/></Svg>,
  interactions: (c, s) => <Svg color={c} size={s}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></Svg>,
  assessments: (c, s) => <Svg color={c} size={s}><path d="M9 11l3 3L22 4"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 15h6M9 19h6"/></Svg>,
  carelog: (c, s) => <Svg color={c} size={s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="12" cy="12" r="1" fill={c}/></Svg>,
  residentes: (c, s) => <Svg color={c} size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg>,
  transfer: (c, s) => <Svg color={c} size={s}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></Svg>,
}

function getLinks(institution: InstType): { main: NavItem[]; secondary: NavItem[] } {
  const patientLabel = institution === 'nursing_home' ? 'Residentes' : institution === 'pharmacy_community' ? 'Clientes' : institution === 'health_center' ? 'Utentes' : 'Doentes'

  const secondary: NavItem[] = [
    { href: '/quality',           label: 'Qualidade',       short: 'Qual.',   icon: ICONS.quality },
    { href: '/drug-intelligence', label: 'Farmacoterapia',  short: 'Farma',   icon: ICONS.drug },
    { href: '/connect',           label: 'Connect',         short: 'Connect', icon: ICONS.connect },
  ]

  switch (institution) {
    case 'pharmacy_hospital':
      return {
        main: [
          { href: '/cockpit',             label: 'Cockpit',      short: 'Cockpit', icon: ICONS.cockpit },
          { href: '/patients',            label: patientLabel,   short: 'Doentes', icon: ICONS.patients },
          { href: '/prescription-queue',  label: 'Validação',    short: 'Valid.',  icon: ICONS.validation },
          { href: '/drug-intelligence',   label: 'Farmacoterapia', short: 'Farma', icon: ICONS.drug },
          { href: '/team',                label: 'Equipa',       short: 'Equipa',  icon: ICONS.team },
        ],
        secondary: [
          { href: '/quality', label: 'Qualidade', short: 'Qual.', icon: ICONS.quality },
          { href: '/connect', label: 'Connect',   short: 'Connect', icon: ICONS.connect },
        ],
      }
    case 'pharmacy_community':
      return {
        main: [
          { href: '/cockpit',           label: 'Cockpit',      short: 'Cockpit', icon: ICONS.cockpit },
          { href: '/patients',          label: patientLabel,   short: 'Clientes', icon: ICONS.patients },
          { href: '/interactions',      label: 'Interações',   short: 'Inter.',  icon: ICONS.interactions },
          { href: '/drug-intelligence', label: 'Farmacoterapia', short: 'Farma', icon: ICONS.drug },
          { href: '/team',              label: 'Equipa',       short: 'Equipa',  icon: ICONS.team },
        ],
        secondary: [
          { href: '/quality', label: 'Qualidade', short: 'Qual.', icon: ICONS.quality },
          { href: '/connect', label: 'Connect',   short: 'Connect', icon: ICONS.connect },
        ],
      }
    case 'nursing_home':
      return {
        main: [
          { href: '/cockpit',     label: 'Cockpit',       short: 'Cockpit',  icon: ICONS.cockpit },
          { href: '/patients',    label: 'Residentes',    short: 'Resid.',   icon: ICONS.residentes },
          { href: '/mar',         label: 'MAR',           short: 'MAR',      icon: ICONS.mar },
          { href: '/assessments', label: 'Avaliações',    short: 'Aval.',    icon: ICONS.assessments },
          { href: '/care-log',    label: 'Reg. Diários',  short: 'Registos', icon: ICONS.carelog },
          { href: '/handover',    label: 'Pass. Turno',   short: 'Turno',    icon: ICONS.transfer },
        ],
        secondary: [
          { href: '/rounds',          label: 'Ronda',          short: 'Ronda',   icon: ICONS.rounds },
          { href: '/team',            label: 'Equipa',         short: 'Equipa',  icon: ICONS.team },
          { href: '/residentes',      label: 'Rev. Farmacot.', short: 'Rev.',    icon: ICONS.drug },
          { href: '/quality',         label: 'Qualidade',      short: 'Qual.',   icon: ICONS.quality },
          { href: '/connect',         label: 'Connect',        short: 'Connect', icon: ICONS.connect },
        ],
      }
    default: // hospital, clinic, health_center
      return {
        main: [
          { href: '/cockpit',  label: 'Cockpit',    short: 'Cockpit', icon: ICONS.cockpit },
          { href: '/patients', label: patientLabel, short: patientLabel, icon: ICONS.patients },
          { href: '/mar',      label: 'MAR',        short: 'MAR',     icon: ICONS.mar },
          { href: '/rounds',   label: 'Ronda',      short: 'Ronda',   icon: ICONS.rounds },
          { href: '/team',     label: 'Equipa',     short: 'Equipa',  icon: ICONS.team },
        ],
        secondary,
      }
  }
}

function useInstitution() {
  const [institution, setInstitution] = useState<InstType>('hospital')
  useEffect(() => {
    const stored = localStorage.getItem('phlox-clinic-institution') as InstType | null
    if (stored) setInstitution(stored)
    const onStore = (e: StorageEvent) => {
      if (e.key === 'phlox-clinic-institution' && e.newValue) setInstitution(e.newValue as InstType)
    }
    window.addEventListener('storage', onStore)
    return () => window.removeEventListener('storage', onStore)
  }, [])
  return institution
}

function isActive(pathname: string, href: string) {
  if (href === '/cockpit') return pathname === '/cockpit'
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Side Navigation (desktop ≥769px) ────────────────────────────────────────

export function ClinicalSideNav() {
  const pathname = usePathname()
  const institution = useInstitution()
  const { main, secondary } = getLinks(institution)

  const renderItem = (item: NavItem, small = false) => {
    const active = isActive(pathname, item.href)
    const color = active ? '#fff' : 'rgba(255,255,255,0.5)'
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: small ? '7px 10px' : '9px 10px',
          borderRadius: 7, marginBottom: 2,
          textDecoration: 'none', transition: 'background 0.1s',
          background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
          borderLeft: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
      >
        {item.icon(color, small ? 15 : 17)}
        <span style={{ fontSize: small ? 12 : 13, fontWeight: active ? 600 : 400, color, letterSpacing: '-0.01em' }}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <nav className="clinical-side-nav" style={{
      position: 'fixed', left: 0, top: 56, bottom: 0, width: 220,
      background: '#0f172a', borderRight: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
      zIndex: 89, overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 8px', flex: 1 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#334155',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0 4px 8px 14px',
        }}>
          Clínico
        </div>
        {main.map(item => renderItem(item))}
        <div style={{ height: 1, background: '#1e293b', margin: '8px 0 10px' }} />
        {secondary.map(item => renderItem(item, true))}
      </div>
    </nav>
  )
}

// ─── Bottom Navigation (mobile ≤768px) ───────────────────────────────────────

export function ClinicalBottomNav() {
  const pathname = usePathname()
  const institution = useInstitution()
  const { main } = getLinks(institution)

  return (
    <nav className="clinical-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 64, background: '#0f172a',
      borderTop: '1px solid #1e293b',
      display: 'flex', alignItems: 'stretch',
      zIndex: 89,
    }}>
      {main.map(item => {
        const active = isActive(pathname, item.href)
        const color = active ? '#fff' : 'rgba(255,255,255,0.42)'
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              textDecoration: 'none',
              borderTop: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
              background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
              transition: 'all 0.1s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {item.icon(color, 22)}
            <span style={{
              fontSize: 10, fontWeight: active ? 600 : 400,
              color, letterSpacing: '-0.01em',
            }}>
              {item.short}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
