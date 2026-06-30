'use client'

import { useState, useEffect } from 'react'
import { getConsent, setConsent } from '@/lib/consent'

// Banner de consentimento de cookies (RGPD / ePrivacy). Só aparece enquanto o
// utilizador não tiver decidido. A escolha controla MESMO o carregamento dos
// cookies de publicidade (ver components/AdScript + lib/consent) — não é cosmético.

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (getConsent() === 'unset') setVisible(true) }, 400)
    return () => clearTimeout(t)
  }, [])

  const choose = (state: 'accepted' | 'declined') => { setConsent(state); setVisible(false) }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'white', borderTop: '1px solid var(--border)',
      padding: '16px clamp(16px,4vw,32px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 20, zIndex: 9999, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>
          PRIVACIDADE E COOKIES
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
          Usamos cookies essenciais para o site funcionar. Com o seu consentimento, usamos também
          cookies de <strong>publicidade</strong> (Google AdSense). Os cookies de publicidade só são
          ativados se aceitar. Não vendemos dados pessoais.{' '}
          <a href="/cookies" style={{ color: 'var(--green-2)', textDecoration: 'none', fontWeight: 600 }}>Definições e detalhes</a>.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => choose('declined')} style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 6, padding: '9px 16px', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Apenas essenciais
        </button>
        <button onClick={() => choose('accepted')} style={{ background: 'var(--green)', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Aceitar
        </button>
      </div>
    </div>
  )
}
