'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('App error:', error) }, [error])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 480 }}>

        {/* Error indicator */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: '#fee2e2', border: '1.5px solid #fca5a5', marginBottom: 20 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
          Erro inesperado
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 12, letterSpacing: '-0.01em' }}>
          Algo correu mal
        </h1>

        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 340, margin: '0 auto 28px' }}>
          Ocorreu um erro inesperado. Podes tentar novamente ou voltar ao início.
          {error.digest && (
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', marginTop: 8 }}>
              Código: {error.digest}
            </span>
          )}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset}
            style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 'var(--r)', padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--green)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ink)')}>
            Tentar novamente
          </button>
          <Link href="/"
            style={{ background: 'white', color: 'var(--ink-2)', textDecoration: 'none', borderRadius: 'var(--r)', padding: '11px 22px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', border: '1px solid var(--border)' }}>
            Página inicial
          </Link>
        </div>
      </div>
    </div>
  )
}
