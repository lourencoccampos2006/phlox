'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ClinicalLayout from '@/components/ClinicalLayout'
import ClinicalCommandPalette from '@/components/ClinicalCommandPalette'
import PlanGate from '@/components/PlanGate'
import ToolUseTracker from '@/components/ToolUseTracker'
import { planForRoute } from '@/lib/planRoutes'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'

const CLINICAL_PREFIXES = [
  '/cockpit', '/patients', '/rounds', '/mar', '/team', '/turno', '/hoje', '/painel', '/ronda-guiada',
  '/connect', '/drug-intelligence', '/quality', '/prescription-queue',
  '/assessments', '/care-log', '/residentes', '/handover', '/incidents', '/care-plans',
  '/schedule', '/census', '/roi', '/activities', '/family', '/feridas', '/gestao', '/protocolos', '/nutricao', '/agenda', '/hidratacao', '/faturacao', '/documentos',
  '/indicacao', '/soap', '/rastreios', '/atendimentos',
  '/sala-espera', '/tarefas-equipa', '/conformidade', '/consentimentos', '/stock', '/vendas', '/faturacao-config', '/webhooks', '/auditoria', '/motor-clinico', '/api-keys', '/sso-config',
  '/insights', '/copiloto', '/reach', '/brief', '/calc', '/codes',
  '/guardados', '/calendario',
  '/clinico360',
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

  // Bloqueio de acesso por plano — a página paga só renderiza se o plano chegar.
  const gate = planForRoute(pathname)
  const gated = (node: React.ReactNode) => gate
    ? <PlanGate min={gate.min} tool={gate.tool} note={gate.note}>{node}</PlanGate>
    : node

  if (isClinical) {
    return (
      <>
        <ToolUseTracker />
        <ClinicalLayout>{gated(children)}</ClinicalLayout>
        <ClinicalCommandPalette />
        <ScrollToTop />
      </>
    )
  }

  // O rodapé só aparece em páginas públicas / institucionais — nunca em ferramentas.
  // Em ferramentas (dashboard, mymeds, ai, family, etc.) é distrativo e desformata.
  const SHOW_FOOTER_ON = [
    '/about', '/pricing', '/trust', '/seguranca', '/status', '/changelog',
    '/terms', '/privacy', '/api-docs', '/institucional', '/organizacao',
    '/blog', '/contato',
  ]
  const showFooter = SHOW_FOOTER_ON.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <>
      <ToolUseTracker />
      <Header />
      <div id="app-main">{gated(children)}</div>
      {showFooter && <Footer />}
      <ScrollToTop />
    </>
  )
}
