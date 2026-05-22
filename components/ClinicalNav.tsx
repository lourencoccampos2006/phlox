'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

type InstType = 'hospital' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'clinic' | 'health_center'

interface NavItem {
  href: string
  label: string
  short: string
  icon: (active: boolean, size?: number) => React.ReactNode
  badge?: () => React.ReactNode
}

interface NavSection {
  title?: string
  items: NavItem[]
}

// ─── SVG helper ───────────────────────────────────────────────────────────────

function I({ children, a, s = 18 }: { children: React.ReactNode; a: boolean; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke={a ? '#fff' : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
      {children}
    </svg>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS = {
  cockpit:    (a: boolean, s?: number) => <I a={a} s={s}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></I>,
  patients:   (a: boolean, s?: number) => <I a={a} s={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></I>,
  home:       (a: boolean, s?: number) => <I a={a} s={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></I>,
  mar:        (a: boolean, s?: number) => <I a={a} s={s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></I>,
  carelog:    (a: boolean, s?: number) => <I a={a} s={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></I>,
  handover:   (a: boolean, s?: number) => <I a={a} s={s}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></I>,
  assess:     (a: boolean, s?: number) => <I a={a} s={s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 11l3 3 5-5"/><line x1="9" y1="7" x2="15" y2="7"/></I>,
  careplan:   (a: boolean, s?: number) => <I a={a} s={s}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></I>,
  incidents:  (a: boolean, s?: number) => <I a={a} s={s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></I>,
  quality:    (a: boolean, s?: number) => <I a={a} s={s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></I>,
  team:       (a: boolean, s?: number) => <I a={a} s={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></I>,
  schedule:   (a: boolean, s?: number) => <I a={a} s={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/></I>,
  census:     (a: boolean, s?: number) => <I a={a} s={s}><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></I>,
  roi:        (a: boolean, s?: number) => <I a={a} s={s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></I>,
  rounds:     (a: boolean, s?: number) => <I a={a} s={s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></I>,
  drug:       (a: boolean, s?: number) => <I a={a} s={s}><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/><path d="M15.5 18h5M18 15.5v5"/></I>,
  connect:    (a: boolean, s?: number) => <I a={a} s={s}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></I>,
  activities: (a: boolean, s?: number) => <I a={a} s={s}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h1"/><path d="M15 12h1"/><path d="M12 8v1"/></I>,
  family:     (a: boolean, s?: number) => <I a={a} s={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></I>,
}

// ─── Nav structure builder ────────────────────────────────────────────────────

function getStructure(inst: InstType): { sections: NavSection[]; bottomItems: NavItem[] } {
  const label = inst === 'nursing_home' ? 'Residentes' : inst === 'pharmacy_community' ? 'Clientes' : inst === 'health_center' ? 'Utentes' : 'Doentes'

  if (inst === 'nursing_home') {
    return {
      sections: [
        {
          title: 'Hoje',
          items: [
            { href: '/cockpit',   label: 'Cockpit',        short: 'Cockpit',  icon: ICONS.cockpit },
            { href: '/care-log',  label: 'Reg. Diários',   short: 'Diários',  icon: ICONS.carelog },
            { href: '/mar',       label: 'MAR',            short: 'MAR',      icon: ICONS.mar },
            { href: '/handover',  label: 'Passa-turno',    short: 'Turno',    icon: ICONS.handover },
          ],
        },
        {
          title: 'Residentes',
          items: [
            { href: '/patients',    label: 'Residentes',     short: 'Resid.',   icon: ICONS.home },
            { href: '/assessments', label: 'Avaliações',        short: 'Aval.',    icon: ICONS.assess },
            { href: '/care-plans',  label: 'Planos de Cuidado', short: 'Planos',   icon: ICONS.careplan },
            { href: '/incidents',   label: 'Ocorrências',       short: 'Occur.',   icon: ICONS.incidents },
            { href: '/activities',  label: 'Atividades',        short: 'Ativid.',  icon: ICONS.activities },
          ],
        },
        {
          title: 'Gestão',
          items: [
            { href: '/census',    label: 'Ocupação',       short: 'Ocup.',    icon: ICONS.census },
            { href: '/schedule',  label: 'Escalas',        short: 'Escalas',  icon: ICONS.schedule },
            { href: '/family',    label: 'Famílias',       short: 'Família',  icon: ICONS.family },
            { href: '/team',      label: 'Equipa',         short: 'Equipa',   icon: ICONS.team },
            { href: '/roi',       label: 'Poupança',       short: 'ROI',      icon: ICONS.roi },
          ],
        },
        {
          title: 'Clínico',
          items: [
            { href: '/residentes', label: 'Rev. Farmacot.', short: 'Rev.',     icon: ICONS.drug },
            { href: '/rounds',     label: 'Ronda',          short: 'Ronda',    icon: ICONS.rounds },
            { href: '/quality',    label: 'Qualidade',      short: 'Qual.',    icon: ICONS.quality },
            { href: '/connect',    label: 'Connect',        short: 'Connect',  icon: ICONS.connect },
          ],
        },
      ],
      bottomItems: [
        { href: '/cockpit',   label: 'Cockpit',   short: 'Cockpit', icon: ICONS.cockpit },
        { href: '/patients',  label: 'Residentes',short: 'Resid.',  icon: ICONS.home },
        { href: '/mar',       label: 'MAR',       short: 'MAR',     icon: ICONS.mar },
        { href: '/care-log',  label: 'Diários',   short: 'Diários', icon: ICONS.carelog },
        { href: '/handover',  label: 'Turno',     short: 'Turno',   icon: ICONS.handover },
      ],
    }
  }

  if (inst === 'pharmacy_hospital') {
    const items: NavItem[] = [
      { href: '/cockpit',           label: 'Cockpit',        short: 'Cockpit', icon: ICONS.cockpit },
      { href: '/patients',          label: label,            short: 'Doentes', icon: ICONS.patients },
      { href: '/prescription-queue',label: 'Validação',      short: 'Valid.',  icon: ICONS.mar },
      { href: '/drug-intelligence', label: 'Farmacoterapia', short: 'Farma',   icon: ICONS.drug },
      { href: '/team',              label: 'Equipa',         short: 'Equipa',  icon: ICONS.team },
    ]
    return { sections: [{ items }], bottomItems: items }
  }

  if (inst === 'pharmacy_community') {
    const items: NavItem[] = [
      { href: '/cockpit',           label: 'Cockpit',        short: 'Cockpit',  icon: ICONS.cockpit },
      { href: '/patients',          label: label,            short: 'Clientes', icon: ICONS.patients },
      { href: '/interactions',      label: 'Interações',     short: 'Inter.',   icon: ICONS.connect },
      { href: '/drug-intelligence', label: 'Farmacoterapia', short: 'Farma',    icon: ICONS.drug },
      { href: '/team',              label: 'Equipa',         short: 'Equipa',   icon: ICONS.team },
    ]
    return { sections: [{ items }], bottomItems: items }
  }

  // Default: hospital / clinic / health_center
  const mainItems: NavItem[] = [
    { href: '/cockpit',  label: 'Cockpit', short: 'Cockpit', icon: ICONS.cockpit },
    { href: '/patients', label: label,     short: label,     icon: ICONS.patients },
    { href: '/mar',      label: 'MAR',     short: 'MAR',     icon: ICONS.mar },
    { href: '/rounds',   label: 'Ronda',   short: 'Ronda',   icon: ICONS.rounds },
    { href: '/team',     label: 'Equipa',  short: 'Equipa',  icon: ICONS.team },
  ]
  const secItems: NavItem[] = [
    { href: '/quality',         label: 'Qualidade',     short: 'Qual.',   icon: ICONS.quality },
    { href: '/drug-intelligence',label: 'Farmacoterapia',short: 'Farma',  icon: ICONS.drug },
    { href: '/connect',         label: 'Connect',       short: 'Connect', icon: ICONS.connect },
  ]
  return {
    sections: [{ items: mainItems }, { items: secItems }],
    bottomItems: mainItems,
  }
}

// ─── Active check ─────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  if (href === '/cockpit') return pathname === '/cockpit'
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Institution hook ─────────────────────────────────────────────────────────

function useInstitution(): InstType {
  const [inst, setInst] = useState<InstType>('hospital')
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

// ─── Side Navigation (desktop ≥769px) ────────────────────────────────────────

export function ClinicalSideNav() {
  const pathname = usePathname()
  const inst = useInstitution()
  const { sections } = getStructure(inst)

  return (
    <nav className="clinical-side-nav" style={{
      position: 'fixed', left: 0, top: 56, bottom: 0, width: 220,
      background: '#0b1120',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 89, overflowY: 'auto',
    }}>
      <div style={{ padding: '10px 8px 24px', flex: 1 }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: si < sections.length - 1 ? 4 : 0 }}>
            {section.title && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                padding: `${si === 0 ? 10 : 18}px 12px 6px`,
                userSelect: 'none',
              }}>
                {section.title}
              </div>
            )}
            {section.items.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px 8px 12px',
                  borderRadius: 8, marginBottom: 1,
                  textDecoration: 'none',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'background 0.12s',
                  position: 'relative',
                }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  {active && (
                    <div style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 3, borderRadius: '0 2px 2px 0',
                      background: '#3b82f6',
                    }} />
                  )}
                  {item.icon(active, 16)}
                  <span style={{
                    fontSize: 13, letterSpacing: '-0.01em', lineHeight: 1,
                    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontWeight: active ? 500 : 400,
                    transition: 'color 0.12s',
                  }}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}

// ─── Bottom Navigation (mobile ≤768px) ───────────────────────────────────────

export function ClinicalBottomNav() {
  const pathname = usePathname()
  const inst = useInstitution()
  const { bottomItems } = getStructure(inst)

  return (
    <nav className="clinical-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 60,
      background: '#0b1120',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 89,
    }}>
      {bottomItems.map(item => {
        const active = isActive(pathname, item.href)
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            textDecoration: 'none',
            background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
            WebkitTapHighlightColor: 'transparent',
            position: 'relative',
            transition: 'background 0.1s',
          }}>
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '25%', right: '25%',
                height: 2, borderRadius: '0 0 2px 2px',
                background: '#3b82f6',
              }} />
            )}
            {item.icon(active, 21)}
            <span style={{
              fontSize: 9.5, letterSpacing: '0.01em',
              color: active ? '#fff' : 'rgba(255,255,255,0.38)',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.12s',
            }}>
              {item.short}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
