'use client'

// Estado da plataforma — página pública de uptime e saúde dos componentes.
// Lê /api/status (verificação real à base de dados e ao serviço de autenticação).
// Dá credibilidade: qualquer instituição pode verificar antes de confiar.

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Check { name: string; ok: boolean; ms?: number; detail?: string }
interface Status { status: 'operational' | 'degraded'; checks: Check[]; region: string; runtime: string; timestamp: string; duration_ms: number }

const NAME: Record<string, string> = { database: 'Base de dados', auth: 'Autenticação', edge: 'Edge / CDN' }

export default function StatusPage() {
  const [s, setS] = useState<Status | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/status', { cache: 'no-store' }).then(r => r.json()).then(d => { if (alive) { setS(d); setErr(''); setLoading(false) } })
      .catch(e => { if (alive) { setErr(String(e?.message || e)); setLoading(false) } })
    return () => { alive = false }
  }, [tick])

  // refresh automático a cada 30s
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30_000); return () => clearInterval(id) }, [])

  const overallColor = !s ? '#9ca3af' : s.status === 'operational' ? '#16a34a' : '#d97706'
  const overallLabel = !s ? 'A verificar…' : s.status === 'operational' ? 'Todos os sistemas operacionais' : 'Operação degradada'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Estado</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Estado da plataforma</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>Verificação em tempo real dos componentes. Esta página atualiza-se sozinha.</p>
        </div>

        {/* Overall banner */}
        <div style={{ background: 'white', border: `1.5px solid ${overallColor}33`, borderLeft: `4px solid ${overallColor}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: overallColor, boxShadow: `0 0 0 4px ${overallColor}22`, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{overallLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 2 }}>
              {s ? <>verificado às {new Date(s.timestamp).toLocaleTimeString('pt-PT')} · região {s.region} · resposta {s.duration_ms} ms</> : 'a obter dados…'}
            </div>
          </div>
          <button onClick={() => setTick(t => t + 1)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#374151', fontFamily: 'var(--font-sans)' }}>Verificar agora</button>
        </div>

        {/* Components */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-2)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Componentes</div>
          {loading && !s && [0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 52, margin: '8px 18px', borderRadius: 8 }} />)}
          {err && <div style={{ padding: '16px 18px', fontSize: 13, color: '#dc2626' }}>{err}</div>}
          {s?.checks.map(c => (
            <div key={c.name} style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.ok ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{NAME[c.name] || c.name}</span>
              {c.ms != null && <span style={{ fontSize: 12, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{c.ms} ms</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: c.ok ? '#16a34a' : '#dc2626' }}>{c.ok ? 'Operacional' : 'Falha'}</span>
            </div>
          ))}
        </div>

        {/* Infrastructure transparency */}
        <div style={{ marginTop: 22, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>Infraestrutura</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { l: 'Hosting', v: 'Vercel · UE' },
              { l: 'Base de dados', v: 'Supabase (Postgres) · UE' },
              { l: 'Pagamentos', v: 'Stripe' },
              { l: 'Encriptação', v: 'TLS 1.3 + AES-256 em repouso' },
            ].map(it => (
              <div key={it.l}>
                <div style={{ fontSize: 11, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{it.l}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 3 }}>{it.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/changelog" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver histórico de alterações →</Link>
          <Link href="/seguranca" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Modelo de segurança →</Link>
        </div>
      </div>
    </div>
  )
}
