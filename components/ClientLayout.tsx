'use client'

import Header from '@/components/Header'
import ClinicalLayout from '@/components/ClinicalLayout'
import ClinicalCommandPalette from '@/components/ClinicalCommandPalette'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'

const CLINICAL_PREFIXES = [
  '/cockpit', '/patients', '/rounds', '/mar', '/team', '/turno', '/hoje', '/painel', '/ronda-guiada',
  '/connect', '/drug-intelligence', '/quality', '/prescription-queue',
  '/assessments', '/care-log', '/residentes', '/handover', '/incidents', '/care-plans',
  '/schedule', '/census', '/roi', '/activities', '/family', '/feridas', '/gestao', '/protocolos', '/nutricao', '/agenda', '/hidratacao', '/faturacao', '/documentos',
  '/indicacao', '/soap', '/rastreios', '/atendimentos',
  '/sala-espera', '/tarefas-equipa', '/conformidade', '/consentimentos', '/stock',
]

function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      style={{
        position: 'fixed', bottom: 20, right: 16, zIndex: 70,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--ink)', color: 'white',
        border: 'none', cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', opacity: 0.8,
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

  if (isClinical) {
    return (
      <>
        <ClinicalLayout>{children}</ClinicalLayout>
        <ClinicalCommandPalette />
        <ScrollToTop />
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
