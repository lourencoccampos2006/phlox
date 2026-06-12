'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { type ExperienceMode } from '../lib/experienceMode'
import { type InstitutionType } from '../lib/useClinicPrefs'

// ─── Nav structure per mode ───────────────────────────────────────────────────

type NavItem = { href: string; icon: string; label: string; badge?: string }

const NAV_NON_CLINICAL: Record<Exclude<ExperienceMode, 'clinical'>, NavItem[][]> = {
  personal: [
    [
      { href: '/inicio', icon: '⬛', label: 'Início' },
      { href: '/mymeds',    icon: '💊', label: 'Medicamentos', badge: 'principal' },
      { href: '/vitals',    icon: '📊', label: 'Sinais Vitais' },
      { href: '/sintomas',     icon: '📝', label: 'Diário' },
    ],
    [
      { href: '/ai',           icon: '🤖', label: 'Phlox AI' },
      { href: '/interactions', icon: '🔍', label: 'Interações',        badge: 'grátis' },
      { href: '/food-drug',    icon: '🍊', label: 'Fármaco-Alimento',  badge: 'grátis' },
      { href: '/oracle',       icon: '🔮', label: 'Farmacêutico AI' },
      { href: '/schedule',     icon: '⏰', label: 'Horário Inteligente' },
    ],
    [
      { href: '/passport',  icon: '🪪', label: 'Passaporte' },
      { href: '/link',      icon: '🔗', label: 'Phlox Link' },
      { href: '/relatorio', icon: '📋', label: 'Relatório' },
      { href: '/objetivos', icon: '🎯', label: 'Objetivos' },
    ],
  ],
  caregiver: [
    [
      { href: '/inicio', icon: '⬛', label: 'Início' },
      { href: '/mymeds',    icon: '💊', label: 'Medicamentos', badge: 'principal' },
      { href: '/vitals',    icon: '📊', label: 'Sinais Vitais' },
      { href: '/perfis',    icon: '👨‍👩‍👧', label: 'Família' },
    ],
    [
      { href: '/interactions',  icon: '🔍', label: 'Interações',       badge: 'grátis' },
      { href: '/dose-crianca',  icon: '👶', label: 'Dose Pediátrica',  badge: 'grátis' },
      { href: '/food-drug',     icon: '🍊', label: 'Fármaco-Alimento' },
      { href: '/schedule',      icon: '⏰', label: 'Horário Inteligente' },
    ],
    [
      { href: '/passport',    icon: '🪪', label: 'Passaporte' },
      { href: '/link',        icon: '🔗', label: 'Phlox Link' },
      { href: '/prescription', icon: '📄', label: 'Perceber a Receita' },
    ],
  ],
  student: [
    [
      { href: '/inicio', icon: '⬛', label: 'Início' },
      { href: '/arena',     icon: '🏆', label: 'Arena',    badge: 'principal' },
      { href: '/simulador', icon: '🎮', label: 'Simulador' },
      { href: '/osce',      icon: '🎭', label: 'OSCE' },
    ],
    [
      { href: '/study',    icon: '📚', label: 'Flashcards' },
      { href: '/tutor',    icon: '👨‍🏫', label: 'AI Tutor' },
      { href: '/cases',    icon: '🩺', label: 'Casos Clínicos' },
      { href: '/progresso',icon: '📈', label: 'Progresso' },
    ],
    [
      { href: '/interactions', icon: '🔍', label: 'Interações' },
      { href: '/oracle',       icon: '🔮', label: 'Oracle AI' },
      { href: '/calculators',  icon: '🧮', label: 'Calculadoras' },
    ],
  ],
}

// Institution-specific clinical nav — 2 clean groups per institution
const CLINICAL_NAV: Record<InstitutionType, NavItem[][]> = {
  hospital: [
    [
      { href: '/cockpit',            icon: '🎛️', label: 'Cockpit',    badge: 'principal' },
      { href: '/patients',           icon: '🗂️', label: 'Doentes' },
      { href: '/turno',              icon: '🏥', label: 'Turno' },
      { href: '/rounds',             icon: '🔬', label: 'Ronda' },
      { href: '/mar',                icon: '📋', label: 'MAR' },
      { href: '/prescription-queue', icon: '📬', label: 'Validação' },
    ],
    [
      { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intel.' },
      { href: '/quality',           icon: '📊', label: 'Qualidade' },
      { href: '/team',              icon: '👥', label: 'Equipa' },
      { href: '/calculos',          icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',           icon: '🔗', label: 'Connect' },
    ],
  ],
  pharmacy_hospital: [
    [
      { href: '/cockpit',            icon: '🎛️', label: 'Cockpit',    badge: 'principal' },
      { href: '/patients',           icon: '🗂️', label: 'Doentes' },
      { href: '/prescription-queue', icon: '📬', label: 'Validação' },
      { href: '/rounds',             icon: '🔬', label: 'Ronda' },
      { href: '/mar',                icon: '📋', label: 'MAR' },
      { href: '/turno',              icon: '🏥', label: 'Turno' },
    ],
    [
      { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intel.' },
      { href: '/quality',           icon: '📊', label: 'Qualidade' },
      { href: '/team',              icon: '👥', label: 'Equipa' },
      { href: '/calculos',          icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',           icon: '🔗', label: 'Connect' },
    ],
  ],
  pharmacy_community: [
    [
      { href: '/cockpit',      icon: '🎛️', label: 'Cockpit',         badge: 'principal' },
      { href: '/patients',     icon: '🗂️', label: 'Clientes' },
      { href: '/interactions', icon: '🔍', label: 'Interações' },
      { href: '/counseling',   icon: '📋', label: 'Aconselhamento' },
      { href: '/drug-info',    icon: '💊', label: 'Info Fármaco' },
    ],
    [
      { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intel.' },
      { href: '/quality',           icon: '📊', label: 'Qualidade' },
      { href: '/team',              icon: '👥', label: 'Equipa' },
      { href: '/calculos',          icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',           icon: '🔗', label: 'Connect' },
    ],
  ],
  nursing_home: [
    [
      { href: '/cockpit',      icon: '🎛️', label: 'Cockpit',    badge: 'principal' },
      { href: '/patients',     icon: '🤝', label: 'Residentes' },
      { href: '/mar',          icon: '📋', label: 'MAR' },
      { href: '/rounds',       icon: '🔬', label: 'Ronda' },
      { href: '/stopp-start',  icon: '🛑', label: 'STOPP/START' },
      { href: '/polypharmacy', icon: '⚕️', label: 'Polimedicação' },
    ],
    [
      { href: '/quality',  icon: '📊', label: 'Qualidade' },
      { href: '/team',     icon: '👥', label: 'Equipa' },
      { href: '/calculos', icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',  icon: '🔗', label: 'Connect' },
    ],
  ],
  // Centro de Dia: o utente vem de dia e volta a casa. Foco no dia (atividades,
  // almoço, a toma do horário do dia) e na ponte com a família, que o vê todos
  // os dias. Sem turno da noite nem "residente".
  day_care: [
    [
      { href: '/cockpit',      icon: '☀️', label: 'O dia',       badge: 'principal' },
      { href: '/patients',     icon: '🧑‍🤝‍🧑', label: 'Utentes' },
      { href: '/mar',          icon: '📋', label: 'Medicação do dia' },
      { href: '/activities',   icon: '🎯', label: 'Atividades' },
      { href: '/interactions', icon: '🔍', label: 'Interações' },
    ],
    [
      { href: '/family',   icon: '👨‍👩‍👧', label: 'Famílias' },
      { href: '/quality',  icon: '📊', label: 'Qualidade' },
      { href: '/team',     icon: '👥', label: 'Equipa' },
      { href: '/calculos', icon: '🧮', label: 'Calculadoras' },
    ],
  ],
  clinic: [
    [
      { href: '/cockpit',       icon: '🎛️', label: 'Cockpit',    badge: 'principal' },
      { href: '/patients',      icon: '🗂️', label: 'Doentes' },
      { href: '/rounds',        icon: '🔬', label: 'Ronda' },
      { href: '/mar',           icon: '📋', label: 'MAR' },
      { href: '/interactions',  icon: '🔍', label: 'Interações' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação' },
    ],
    [
      { href: '/quality',           icon: '📊', label: 'Qualidade' },
      { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intel.' },
      { href: '/team',              icon: '👥', label: 'Equipa' },
      { href: '/calculos',          icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',           icon: '🔗', label: 'Connect' },
    ],
  ],
  health_center: [
    [
      { href: '/cockpit',       icon: '🎛️', label: 'Cockpit',    badge: 'principal' },
      { href: '/patients',      icon: '🗂️', label: 'Utentes' },
      { href: '/rounds',        icon: '🔬', label: 'Ronda' },
      { href: '/mar',           icon: '📋', label: 'MAR' },
      { href: '/interactions',  icon: '🔍', label: 'Interações' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação' },
    ],
    [
      { href: '/quality',           icon: '📊', label: 'Qualidade' },
      { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intel.' },
      { href: '/team',              icon: '👥', label: 'Equipa' },
      { href: '/calculos',          icon: '🧮', label: 'Calculadoras' },
      { href: '/connect',           icon: '🔗', label: 'Connect' },
    ],
  ],
}

// Mobile bottom tabs per institution
const CLINICAL_BOTTOM: Record<InstitutionType, { href: string; icon: string; label: string }[]> = {
  hospital:           [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🗂️', label: 'Doentes' }, { href: '/rounds', icon: '🔬', label: 'Ronda' }, { href: '/mar', icon: '📋', label: 'MAR' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
  pharmacy_hospital:  [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🗂️', label: 'Doentes' }, { href: '/prescription-queue', icon: '📬', label: 'Validação' }, { href: '/drug-intelligence', icon: '🧬', label: 'Drug' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
  pharmacy_community: [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🗂️', label: 'Clientes' }, { href: '/interactions', icon: '🔍', label: 'Interações' }, { href: '/counseling', icon: '📋', label: 'Consult.' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
  nursing_home:       [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🤝', label: 'Resid.' }, { href: '/mar', icon: '📋', label: 'MAR' }, { href: '/stopp-start', icon: '🛑', label: 'STOPP' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
  day_care:           [{ href: '/cockpit', icon: '☀️', label: 'O dia' }, { href: '/patients', icon: '🧑‍🤝‍🧑', label: 'Utentes' }, { href: '/mar', icon: '📋', label: 'Medicação' }, { href: '/activities', icon: '🎯', label: 'Atividades' }, { href: '/family', icon: '👨‍👩‍👧', label: 'Famílias' }],
  clinic:             [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🗂️', label: 'Doentes' }, { href: '/rounds', icon: '🔬', label: 'Ronda' }, { href: '/interactions', icon: '🔍', label: 'Interações' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
  health_center:      [{ href: '/cockpit', icon: '🎛️', label: 'Cockpit' }, { href: '/patients', icon: '🗂️', label: 'Utentes' }, { href: '/rounds', icon: '🔬', label: 'Ronda' }, { href: '/interactions', icon: '🔍', label: 'Interações' }, { href: '/connect', icon: '🔗', label: 'Connect' }],
}

const MODE_LABEL: Record<ExperienceMode, string> = {
  personal: 'Pessoal',
  caregiver: 'Cuidador',
  clinical: 'Clínico',
  student: 'Estudante',
}

const MODE_COLOR: Record<ExperienceMode, string> = {
  personal: '#0d6e42',
  caregiver: '#b45309',
  clinical: '#1d4ed8',
  student: '#7c3aed',
}

// Bottom tab items (mobile) for non-clinical modes
const BOTTOM_TABS_NON_CLINICAL: Record<Exclude<ExperienceMode, 'clinical'>, { href: string; icon: string; label: string }[]> = {
  personal: [
    { href: '/inicio',   icon: '⬛', label: 'Início' },
    { href: '/mymeds',      icon: '💊', label: 'Meds' },
    { href: '/ai',          icon: '🤖', label: 'AI' },
    { href: '/vitals',      icon: '📊', label: 'Vitais' },
    { href: '/inicio', icon: '🗺️', label: 'Tudo' },
  ],
  caregiver: [
    { href: '/inicio',    icon: '⬛', label: 'Início' },
    { href: '/mymeds',       icon: '💊', label: 'Meds' },
    { href: '/perfis',       icon: '👨‍👩‍👧', label: 'Família' },
    { href: '/interactions', icon: '🔍', label: 'Interações' },
    { href: '/inicio',  icon: '🗺️', label: 'Tudo' },
  ],
  student: [
    { href: '/inicio',   icon: '⬛', label: 'Início' },
    { href: '/arena',       icon: '🏆', label: 'Arena' },
    { href: '/simulador',   icon: '🎮', label: 'Simular' },
    { href: '/study',       icon: '📚', label: 'Estudar' },
    { href: '/inicio', icon: '🗺️', label: 'Tudo' },
  ],
}

export default function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [clinicInstitution, setClinicInstitution] = useState<InstitutionType>('hospital')

  useEffect(() => {
    const pref = localStorage.getItem('phlox-sidebar-collapsed')
    const isCollapsed = pref === 'true'
    if (pref !== null) setCollapsed(isCollapsed)
    document.documentElement.style.setProperty('--phlox-sb', isCollapsed ? '56px' : '220px')

    const inst = localStorage.getItem('phlox-clinic-institution') as InstitutionType | null
    if (inst) setClinicInstitution(inst)

    // Re-sync when institution changes (e.g. cockpit selector)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'phlox-clinic-institution' && e.newValue) {
        setClinicInstitution(e.newValue as InstitutionType)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!user) return null

  const mode: ExperienceMode = (user.experience_mode as ExperienceMode) || 'personal'
  const isClinical = mode === 'clinical'
  const groups: NavItem[][] = isClinical
    ? CLINICAL_NAV[clinicInstitution]
    : NAV_NON_CLINICAL[mode as Exclude<ExperienceMode, 'clinical'>]
  const accentColor = MODE_COLOR[mode]
  const bottomTabs = isClinical
    ? CLINICAL_BOTTOM[clinicInstitution]
    : BOTTOM_TABS_NON_CLINICAL[mode as Exclude<ExperienceMode, 'clinical'>]

  const isActive = (href: string) => pathname === href || (href !== '/inicio' && pathname.startsWith(href))

  const toggleCollapse = () => {
    setCollapsed(p => {
      const next = !p
      localStorage.setItem('phlox-sidebar-collapsed', String(next))
      document.documentElement.style.setProperty('--phlox-sb', next ? '56px' : '220px')
      return next
    })
  }

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside
        style={{
          position: 'fixed', top: 56, left: 0, bottom: 0,
          width: collapsed ? 56 : 220,
          background: '#0f172a',
          borderRight: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column',
          zIndex: 200,
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
        className="phlox-sidebar"
      >
        {/* Mode badge + collapse toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: collapsed ? '12px 0' : '12px 14px',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              background: `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              borderRadius: 6,
              padding: '5px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {MODE_LABEL[mode]}
                </span>
              </div>
              {isClinical && (
                <span style={{ fontSize: 9, color: `${accentColor}cc`, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', paddingLeft: 13 }}>
                  {(() => {
                    const m: Record<string, string> = { hospital:'Hospital', pharmacy_hospital:'Farm. Hosp.', pharmacy_community:'Farm. Com.', nursing_home:'Lar/ERPI', day_care:'C. Dia', clinic:'Clínica', health_center:'CSP' }
                    return m[clinicInstitution] ?? clinicInstitution
                  })()}
                </span>
              )}
            </div>
          )}
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#475569',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed
                ? <path d="M9 18l6-6-6-6" />
                : <path d="M15 18l-6-6 6-6" />
              }
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: collapsed ? '8px 4px' : '8px 8px', overflowY: 'auto' }}>
          {groups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 12 }}>
              {group.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '9px 0' : '8px 10px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      background: active ? `${accentColor}22` : 'transparent',
                      borderLeft: active ? `2px solid ${accentColor}` : '2px solid transparent',
                      marginBottom: 2,
                      transition: 'background 0.1s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e293b' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={{
                          fontSize: 13, fontWeight: active ? 700 : 400,
                          color: active ? 'white' : '#94a3b8',
                          flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          {item.label}
                        </span>
                        {item.badge === 'principal' && (
                          <span style={{ fontSize: 8, background: accentColor, color: 'white', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                            ★
                          </span>
                        )}
                        {item.badge === 'grátis' && (
                          <span style={{ fontSize: 8, background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                            FREE
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
              {gi < groups.length - 1 && (
                <div style={{ height: 1, background: '#1e293b', margin: '4px 0 8px' }} />
              )}
            </div>
          ))}
        </nav>

        {/* Footer: all tools link */}
        {!collapsed && (
          <div style={{ padding: '12px 8px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
            <Link
              href="/inicio"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                background: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>🗺️</span>
              <span style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--font-sans)' }}>Todas as ferramentas</span>
            </Link>
            <Link
              href="/settings"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>⚙️</span>
              <span style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--font-sans)' }}>Definições</span>
            </Link>
          </div>
        )}
      </aside>

      {/* ─── Mobile bottom tab bar ─── */}
      <nav
        className="phlox-bottom-bar"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#0f172a',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          zIndex: 200,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {bottomTabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 4px 6px',
                textDecoration: 'none',
                color: active ? 'white' : '#475569',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, marginBottom: 3 }}>{tab.icon}</span>
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: active ? 700 : 400,
                letterSpacing: '0.04em', color: active ? accentColor : '#475569',
              }}>
                {tab.label.toUpperCase()}
              </span>
              {active && (
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: accentColor, marginTop: 2,
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .phlox-sidebar { display: none !important; }
          .phlox-bottom-bar { display: flex !important; }
          .phlox-content-offset { margin-left: 0 !important; padding-bottom: 72px !important; }
        }
        @media (min-width: 769px) {
          .phlox-bottom-bar { display: none !important; }
        }
      `}</style>
    </>
  )
}
