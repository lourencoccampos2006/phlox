'use client'

// /farmacia — Índice ERP da farmácia
import Link from 'next/link'
import { useActiveOrg } from '@/lib/orgContext'

const ACCENT = '#0d6e42'

const MODULES = [
  { href: '/farmacia/fornecedores', title: 'Fornecedores', desc: 'Laboratórios, armazenistas, condições comerciais e KPIs.', cap: 'suppliers.read' },
  { href: '/farmacia/compras',      title: 'Compras',      desc: 'Encomendas, envio ao fornecedor e recepção com lote/validade.', cap: 'stock.read' },
  { href: '/farmacia/fidelizacao',  title: 'Fidelização',  desc: 'Programa de cartão, pontos, recompensas e histórico.', cap: 'loyalty.read' },
  { href: '/stock',                 title: 'Stock & Validades', desc: 'Inventário, validades, mínimos. Visível em todos os modos.', cap: 'stock.read' },
]

export default function FarmaciaIndex() {
  const { org, caps, loading } = useActiveOrg()
  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Farmácia</h1><p>Seleciona uma organização.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Farmácia</h1>
      <p style={{ margin: '4px 0 20px', color: '#6b7280', fontSize: 14 }}>{org.name}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {MODULES.map(m => {
          const granted = caps.includes(m.cap)
          const Inner = (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, opacity: granted ? 1 : 0.6, cursor: granted ? 'pointer' : 'default' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>{m.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{m.desc}</p>
              {!granted && <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>Sem permissão ({m.cap})</div>}
              {granted && <div style={{ marginTop: 12, fontSize: 13, color: ACCENT, fontWeight: 600 }}>Abrir →</div>}
            </div>
          )
          return granted ? <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>{Inner}</Link> : <div key={m.href}>{Inner}</div>
        })}
      </div>
    </main>
  )
}
