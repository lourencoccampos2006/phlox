'use client'

// Rodapé global do Phlox (lado público / pessoal).
// Inclui indicador de estado em direto (consulta /api/status) e sinais de confiança.
// Não aparece no shell clínico — esse tem o seu próprio chrome.

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
  const dotLabel = status === 'operational' ? 'Operacional' : status === 'degraded' ? 'Degradado' : 'A verificar…'

  const year = new Date().getFullYear()

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'white', marginTop: 60, fontFamily: 'var(--font-sans)' }}>
      <div className="page-container" style={{ padding: '28px 0 24px' }}>

        {/* Linha de selos de confiança */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          {[
            'Hospedado na UE',
            'TLS 1.3 · AES-256',
            'Stripe (subscrições)',
            'Supabase (Postgres)',
            'SAF-T (PT) · ATCUD',
          ].map(b => (
            <span key={b} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 6, letterSpacing: '0.02em' }}>{b}</span>
          ))}
        </div>

        {/* Grid de links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20, marginBottom: 22 }}>
          <FootCol title="Plataforma" links={[
            ['Planos', '/pricing'],
            ['Para instituições', '/organizacao'],
            ['Inicia sessão', '/login'],
          ]} />
          <FootCol title="Confiança" links={[
            ['Trust Center', '/trust'],
            ['Estado', '/status'],
            ['Segurança', '/seguranca'],
            ['Changelog', '/changelog'],
          ]} />
          <FootCol title="Recursos" links={[
            ['Sobre', '/about'],
            ['API', '/api-docs'],
            ['Integrações', '/webhooks'],
          ]} />
          <FootCol title="Legal" links={[
            ['Termos', '/terms'],
            ['Privacidade', '/privacy'],
          ]} />
        </div>

        {/* Linha inferior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 16, borderTop: '1px solid var(--bg-2)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>© {year} Phlox · Lisboa</div>
          <Link href="/status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-2)', textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: `0 0 0 3px ${dotColor}22` }} />
            <span>{dotLabel}</span>
          </Link>
        </div>
      </div>
    </footer>
  )
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {links.map(([label, href]) => (
          <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
        ))}
      </div>
    </div>
  )
}
