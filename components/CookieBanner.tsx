'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeno delay para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      try {
        const consent = localStorage.getItem('phlox-cookie-consent')
        if (!consent) setVisible(true)
      } catch {
        // localStorage indisponível (modo privado) — não mostra
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const accept = () => {
    try { localStorage.setItem('phlox-cookie-consent', 'accepted') } catch { }
    setVisible(false)
  }

  const decline = () => {
    try { localStorage.setItem('phlox-cookie-consent', 'declined') } catch { }
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
      borderTop: '1px solid var(--border)',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      zIndex: 9999,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>
          PRIVACIDADE E COOKIES — RGPD
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
          Usamos cookies essenciais para o funcionamento da plataforma e, com o teu consentimento, analytics para melhorar a experiência.
          Não vendemos dados pessoais.{' '}
          <a href="/privacy" style={{ color: 'var(--green-2)', textDecoration: 'none' }}>Política de privacidade</a>.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={decline} style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 16px', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Apenas essenciais
        </button>
        <button onClick={accept} style={{ background: 'var(--green)', border: 'none', borderRadius: 4, padding: '8px 20px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Aceitar todos
        </button>
      </div>
    </div>
  )
}