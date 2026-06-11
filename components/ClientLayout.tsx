'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ClinicalLayout from '@/components/ClinicalLayout'
import PlanGate from '@/components/PlanGate'
import ToolUseTracker from '@/components/ToolUseTracker'
import { planForRoute } from '@/lib/planRoutes'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Overlays que só aparecem quando o utilizador os abre (Copilot, ⌘K, paleta).
// Carregam à parte, depois da página estar interativa — não pesam no bundle
// inicial de TODAS as páginas. ssr:false porque só fazem sentido no cliente.
const PhloxCopilot = dynamic(() => import('@/components/PhloxCopilot'), { ssr: false })
const UniversalSearch = dynamic(() => import('@/components/UniversalSearch'), { ssr: false })
const ClinicalCommandPalette = dynamic(() => import('@/components/ClinicalCommandPalette'), { ssr: false })

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
  '/hospital',
  '/farmacia',
  '/bi', '/automacoes',
  '/crm', '/telemedicina', '/traduzir',
  '/organizacao',
  '/aprender', '/study', '/estagio',
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

  // Sidebar clínico SÓ aparece em modo clinical + rota clínica.
  // Não impomos a barra a estudantes/cuidadores/uso pessoal mesmo que tenham org.
  const isClinical = mode === 'clinical' &&
    CLINICAL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Bloqueio de acesso por plano — a página paga só renderiza se o plano chegar.
  // (A contenção de erros de render é feita pelo app/error.tsx do Next, que já
  //  apanha crashes da página sem deitar abaixo o layout/header.)
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
        <PhloxCopilot />
        <UniversalSearch />
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
      <PhloxCopilot />
      <UniversalSearch />
      <ScrollToTop />
    </>
  )
}
