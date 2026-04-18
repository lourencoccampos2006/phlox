'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('App error:', error) }, [error])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 400 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Algo correu mal</div>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
          Ocorreu um erro inesperado. Os nossos sistemas foram notificados.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={reset}
            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Tentar novamente
          </button>
          <a href="/" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', textDecoration: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
            Página inicial
          </a>
        </div>
      </div>
    </div>
  )
}