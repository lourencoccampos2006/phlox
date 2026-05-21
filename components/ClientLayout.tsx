'use client'

import Header from '@/components/Header'
import { ClinicalSideNav, ClinicalBottomNav } from '@/components/ClinicalNav'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'

const CLINICAL_PREFIXES = [
  '/cockpit', '/patients', '/rounds', '/mar', '/team',
  '/connect', '/drug-intelligence', '/quality', '/prescription-queue',
  '/assessments', '/care-log', '/residentes', '/handover', '/incidents',
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
        position: 'fixed', bottom: 84, right: 16, zIndex: 200,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--ink)', color: 'white',
        border: 'none', cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        opacity: 0.85,
      }}
    >↑</button>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth() as any
  const mode = user?.experience_mode
  const isClinical = mode === 'clinical' &&
    CLINICAL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <>
      <Header />
      {isClinical && <ClinicalSideNav />}
      <div id="app-main" className={isClinical ? 'clinical-layout' : ''}>
        {children}
      </div>
      {isClinical && <ClinicalBottomNav />}
      <ScrollToTop />
      <style>{`
        /* Clinical layout: bottom nav on mobile, sidebar on desktop */
        .clinical-layout {
          padding-bottom: 64px;
        }
        @media (min-width: 769px) {
          .clinical-layout {
            padding-left: 220px;
            padding-bottom: 0;
          }
          .clinical-bottom-nav {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .clinical-side-nav {
            display: none !important;
          }
          .hdr-clinical-context {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
