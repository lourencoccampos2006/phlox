'use client'

// PaymentIssueBanner — avisa quando o pagamento Stripe falhou (past_due/unpaid/
// incomplete) e o acesso pago foi por isso suspenso (ver effectivePlan() em
// AuthContext.tsx). Sem isto, alguém que perdesse o Pro por um cartão recusado
// não fazia ideia porquê — parecia a app ter avariado.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const DISMISS_KEY = 'phlox-payment-banner-dismissed'

export default function PaymentIssueBanner() {
  const { user } = useAuth() as any
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  const unhealthy = user && ['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(user.plan_status)
  if (!unhealthy || dismissed) return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, position: 'sticky', top: 0, zIndex: 60 }}>
      <span style={{ color: '#991b1b' }}>⚠️ Não conseguimos cobrar a tua subscrição — as funcionalidades pagas ficaram em pausa até atualizares o método de pagamento.</span>
      <Link href="/pricing" style={{ color: '#991b1b', fontWeight: 800, textDecoration: 'underline' }}>Atualizar pagamento →</Link>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>✕</button>
    </div>
  )
}
