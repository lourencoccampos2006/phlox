'use client'

// /v/[id] — página pública de verificação de documento assinado pelo Phlox.
// Não requer login. Mostra estado da assinatura, metadados e payload (se público).

import { useEffect, useState, use } from 'react'
import Link from 'next/link'

interface Verify {
  ok: boolean
  status: 'valid' | 'tampered' | 'revoked' | 'not_found' | 'invalid_id' | 'server_not_ready'
  id?: string; title?: string; kind?: string
  signed_at?: string; revoked_at?: string; signer_name?: string
  payload?: any; fingerprint?: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  valid:      { label: 'Documento autêntico', color: '#15803d', bg: '#f0fdf4', icon: '✓' },
  tampered:   { label: 'Documento adulterado', color: '#991b1b', bg: '#fef2f2', icon: '✗' },
  revoked:    { label: 'Documento revogado', color: '#92400e', bg: '#fffbeb', icon: '⊘' },
  not_found:  { label: 'Documento não encontrado', color: '#7c2d12', bg: '#fef2f2', icon: '?' },
  invalid_id: { label: 'Identificador inválido', color: '#7c2d12', bg: '#fef2f2', icon: '?' },
  server_not_ready: { label: 'Servidor não preparado', color: '#7c2d12', bg: '#fef2f2', icon: '!' },
}

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [r, setR] = useState<Verify | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v/${id}`, { cache: 'no-store' }).then(res => res.json()).then(j => setR(j)).finally(() => setLoading(false))
  }, [id])

  const meta = r ? STATUS_META[r.status] : null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 22px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
          </span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#0b1120', fontWeight: 400 }}>Phlox</span>
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <div style={{ width: 'min(560px, 100%)' }}>
          {loading || !r ? (
            <div style={{ height: 200, borderRadius: 16, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />
          ) : (
            <>
              {/* Banner */}
              {meta && (
                <div style={{ background: meta.bg, border: `1.5px solid ${meta.color}22`, borderLeft: `5px solid ${meta.color}`, borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'white', border: `1.5px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: meta.color, flexShrink: 0 }}>{meta.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}>Verificação</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0b1120', marginTop: 2 }}>{meta.label}</div>
                    </div>
                  </div>
                </div>
              )}

              {r.title && (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 22px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'ui-monospace, monospace' }}>{r.kind || 'documento'}</div>
                  <h1 style={{ fontSize: 22, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#0b1120', letterSpacing: '-0.015em', margin: '0 0 14px' }}>{r.title}</h1>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px 14px', fontSize: 13, color: '#374151' }}>
                    {r.signer_name && (<><span style={{ color: '#9ca3af' }}>Signatário</span><span>{r.signer_name}</span></>)}
                    {r.signed_at && (<><span style={{ color: '#9ca3af' }}>Assinado em</span><span>{new Date(r.signed_at).toLocaleString('pt-PT')}</span></>)}
                    {r.revoked_at && (<><span style={{ color: '#9ca3af' }}>Revogado em</span><span>{new Date(r.revoked_at).toLocaleString('pt-PT')}</span></>)}
                    {r.fingerprint && (<><span style={{ color: '#9ca3af' }}>Impressão</span><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#475569' }}>{r.fingerprint}…</span></>)}
                    {r.id && (<><span style={{ color: '#9ca3af' }}>ID</span><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#475569', wordBreak: 'break-all' }}>{r.id}</span></>)}
                  </div>

                  {r.payload?.data && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'ui-monospace, monospace' }}>Conteúdo</div>
                      <pre style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 9, padding: '12px 14px', fontSize: 11.5, color: '#0b1120', overflow: 'auto', margin: 0, lineHeight: 1.5 }}>{JSON.stringify(r.payload.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 11.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.55 }}>
                Verificação efetuada pelo servidor do Phlox com HMAC-SHA256. <Link href="/trust" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Saber mais →</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
