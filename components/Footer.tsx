'use client'

// Rodapé minimal — só aparece em páginas públicas/institucionais (Trust, About,
// Pricing, Segurança, etc.). Em ferramentas é distrativo e foi removido.

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Footer() {
  const [status, setStatus] = useState<'unknown' | 'operational' | 'degraded'>('unknown')

  useEffect(() => {
    let alive = true
    fetch('/api/status', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d?.status) setStatus(d.status) })
      .catch(() => { /* silencioso */ })
    return () => { alive = false }
  }, [])

  const dotColor = status === 'operational' ? '#16a34a' : status === 'degraded' ? '#d97706' : '#9ca3af'
  const dotLabel = status === 'operational' ? 'Todos os sistemas' : status === 'degraded' ? 'Degradado' : 'A verificar'
  const year = new Date().getFullYear()

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'white', marginTop: 80, fontFamily: 'var(--font-sans)' }}>
      <div className="page-container" style={{ padding: '32px 0 28px' }}>

        {/* Linha única — marca + links + estado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>

          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
            </span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>Phlox</span>
          </Link>

          <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['Planos', '/pricing'],
              ['Trust', '/trust'],
              ['Estado', '/status'],
              ['Termos', '/terms'],
              ['Privacidade', '/privacy'],
            ].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
            ))}
            <a href="mailto:suporte@phloxclinical.com" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 500 }}>Suporte</a>
            <a href="mailto:info@phloxclinical.com" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 500 }}>Contacto</a>
          </nav>

          <Link href="/status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: `0 0 0 3px ${dotColor}22` }} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{dotLabel}</span>
          </Link>
        </div>

        {/* Sub-rodapé */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>© {year} Phlox · Hospedado na UE</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>
            <a href="mailto:suporte@phloxclinical.com" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>suporte@phloxclinical.com</a>
            {' · '}
            <a href="mailto:info@phloxclinical.com" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>info@phloxclinical.com</a>
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>TLS 1.3 · AES-256 · RGPD</span>
        </div>
      </div>
    </footer>
  )
}
