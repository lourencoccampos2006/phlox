'use client'
// app/components/CookieBanner.tsx

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('phlox-cookie-consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('phlox-cookie-consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('phlox-cookie-consent', 'essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'white',
      borderTop: '2px solid var(--green)',
      padding: '16px 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      zIndex: 9999,
      boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Privacidade e Cookies — RGPD
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
          Usamos cookies essenciais para o funcionamento da plataforma e, com o teu consentimento,
          analytics anónimos para melhorar a experiência. Não vendemos dados pessoais.{' '}
          <a href="/privacy" style={{ color: 'var(--green-2)', textDecoration: 'none', fontWeight: 500 }}>
            Política de privacidade →
          </a>
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            background: 'none',
            border: '1px solid var(--border-2)',
            borderRadius: 4,
            padding: '9px 18px',
            fontSize: 13,
            color: 'var(--ink-3)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
          }}
        >
          Apenas essenciais
        </button>
        <button
          onClick={accept}
          style={{
            background: 'var(--green)',
            border: 'none',
            borderRadius: 4,
            padding: '9px 20px',
            fontSize: 13,
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
          }}
        >
          Aceitar todos
        </button>
      </div>
    </div>
  )
}