'use client'

import Header from '@/components/Header'
import { ClinicalSidebar, ClinicalTopBar, ClinicalMobileNav } from '@/components/ClinicalShell'
import ClinicalCommandPalette from '@/components/ClinicalCommandPalette'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'

const CLINICAL_PREFIXES = [
  '/cockpit', '/patients', '/rounds', '/mar', '/team', '/hoje', '/painel', '/ronda-guiada',
  '/connect', '/drug-intelligence', '/quality', '/prescription-queue',
  '/assessments', '/care-log', '/residentes', '/handover', '/incidents', '/care-plans',
  '/schedule', '/census', '/roi', '/activities', '/family',
]

function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      style={{
        position: 'fixed', bottom: 132, right: 16, zIndex: 70,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--ink)', color: 'white',
        border: 'none', cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', opacity: 0.85,
      }}
    >↑</button>
  )
}

function CommandTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('phlox:cmdk'))}
      aria-label="Pesquisar e navegar"
      className="cmd-trigger"
      style={{
        position: 'fixed', bottom: 76, right: 16, zIndex: 70,
        width: 46, height: 46, borderRadius: '50%',
        background: '#0d6e42', color: 'white', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 20px rgba(13,110,66,0.4)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
    </button>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth() as any
  const mode = user?.experience_mode
  const isClinical = mode === 'clinical' &&
    CLINICAL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isClinical) {
    return (
      <>
        <ClinicalSidebar />
        <div className="clinical-shell">
          <ClinicalTopBar />
          <div id="app-main">{children}</div>
        </div>
        <ClinicalMobileNav />
        <ClinicalCommandPalette />
        <CommandTrigger />
        <ScrollToTop />
        <style>{`
          .clinical-shell { min-height: 100vh; padding-bottom: 60px; }
          @media (min-width: 769px) {
            .clinical-shell { padding-left: 232px; padding-bottom: 0; }
            .cs-mobilenav { display: none !important; }
            .cmd-trigger { display: none !important; }
            .cs-topbar-brand { display: none !important; }
          }
          @media (max-width: 768px) {
            .cs-sidebar { display: none !important; }
            .cs-topbar-brand { display: flex !important; }
            .cs-shift-hours { display: none !important; }
            .cs-add-label { display: none !important; }
            .cs-crumb { display: none !important; }
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      <Header />
      <div id="app-main">{children}</div>
      <ScrollToTop />
    </>
  )
}
