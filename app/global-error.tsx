'use client'

// global-error.tsx — apanha erros no PRÓPRIO layout raiz (o app/error.tsx só
// apanha erros dentro das páginas). Tem de trazer <html>/<body> próprios porque
// substitui o layout raiz. Fallback caloroso, nunca ecrã branco. (Ronda 1.)
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Global error:', error) }, [error])
  return (
    <html lang="pt-PT">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#fbfaf8' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: '#fee2e2', border: '1.5px solid #fca5a5', marginBottom: 20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h1 style={{ fontSize: 24, color: '#0b1120', fontWeight: 600, margin: '0 0 12px' }}>Algo correu mal</h1>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, margin: '0 auto 26px', maxWidth: 320 }}>
              Ocorreu um erro inesperado. Tenta novamente — os teus dados estão a salvo.
              {error.digest && <span style={{ display: 'block', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Código: {error.digest}</span>}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={reset} style={{ background: '#0b1120', color: 'white', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
              <a href="/" style={{ background: 'white', color: '#334155', textDecoration: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0' }}>Página inicial</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
