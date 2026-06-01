'use client'

// /share/[code] — visualizador público de partilha temporária do cofre de saúde.
// O destinatário recebe um código de 8 caracteres e abre esta página sem login.
// Conta a visualização e bloqueia depois de max_views ou da expiração.

import { useEffect, useState, use } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function ShareView({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [status, setStatus] = useState<'loading' | 'expired' | 'not_found' | 'maxed' | 'ok'>('loading')
  const [docs, setDocs] = useState<any[]>([])
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    (async () => {
      // Cliente anónimo para tabela com RLS bypass via política específica seria preciso;
      // como o nosso health_vault_shares só tem RLS de utilizador, fazemos lookup via RPC.
      // Para já: usamos endpoint server que assume role.
      try {
        const r = await fetch(`/api/share/${encodeURIComponent(code)}`)
        const d = await r.json()
        if (d.status) { setStatus(d.status); return }
        setDocs(d.docs || [])
        setRemaining(d.remaining || 0)
        setStatus('ok')
      } catch {
        setStatus('not_found')
      }
    })()
  }, [code])

  if (status === 'loading') return <Center>A verificar o código…</Center>
  if (status === 'expired') return <Center title="Código expirado" desc="Este código já não está válido." color="#dc2626" />
  if (status === 'maxed') return <Center title="Limite de visualizações atingido" desc="O proprietário pode gerar um novo código." color="#dc2626" />
  if (status === 'not_found') return <Center title="Código não encontrado" desc="Verifica se digitaste corretamente." color="#dc2626" />

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container" style={{ maxWidth: 720, paddingTop: 30, paddingBottom: 30 }}>
        <div style={{ background: '#0b1120', color: 'white', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Cofre Phlox · Partilha temporária</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>Documento(s) partilhado(s) consigo</div>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{remaining} visualizações restantes</div>
        </div>

        {docs.map(d => (
          <div key={d.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              {d.category}{d.issued_at ? ` · ${new Date(d.issued_at).toLocaleDateString('pt-PT')}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 8 }}>{d.title}</div>
            {d.notes && <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 10, lineHeight: 1.55 }}>{d.notes}</div>}
            {d.body_url && d.body_url.startsWith('data:application/pdf') && (
              <iframe src={d.body_url} title={d.title} style={{ width: '100%', height: 480, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white' }} />
            )}
            {d.body_url && d.body_url.startsWith('data:image/') && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={d.body_url} alt={d.title} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
            )}
            {d.body_text && (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#0b1120', lineHeight: 1.65, margin: '10px 0 0', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>{d.body_text}</pre>
            )}
          </div>
        ))}

        <div style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>
          Documento partilhado através do Phlox · Esta página expira automaticamente
        </div>
      </div>
    </div>
  )
}

function Center({ children, title, desc, color }: { children?: React.ReactNode; title?: string; desc?: string; color?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', border: `1px solid ${color ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 14, padding: 36, maxWidth: 420, textAlign: 'center' }}>
        {title && <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: color || '#0b1120', marginBottom: 8 }}>{title}</div>}
        {desc && <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{desc}</div>}
        {children}
      </div>
    </div>
  )
}
