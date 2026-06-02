'use client'

// /hospital — Índice dos módulos hospitalares
// Atalho para mapa de camas, triagem Manchester e bloco operatório.

import Link from 'next/link'
import { useActiveOrg } from '@/lib/orgContext'

const ACCENT = '#0d6e42'

const MODULES = [
  {
    href: '/hospital/camas',
    title: 'Mapa de Camas',
    desc: 'Estado em tempo real por ala. Admissões, transferências, altas.',
    cap: 'beds.read',
  },
  {
    href: '/hospital/triagem',
    title: 'Triagem Manchester',
    desc: 'Fila de urgência com 5 prioridades e tempos-alvo automáticos.',
    cap: 'triage.read',
  },
  {
    href: '/hospital/bloco',
    title: 'Bloco Operatório',
    desc: 'Agenda do bloco, transições do circuito, checklist OMS de cirurgia segura.',
    cap: 'surgery.read',
  },
]

export default function HospitalIndexPage() {
  const { org, caps, loading } = useActiveOrg()

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Hospital</h1>
        <p style={{ color: '#6b7280' }}>Seleciona uma organização hospitalar para aceder aos módulos.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Hospital</h1>
      <p style={{ margin: '4px 0 20px', color: '#6b7280', fontSize: 14 }}>{org.name}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {MODULES.map(m => {
          const granted = caps.includes(m.cap)
          const Inner = (
            <div style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18,
              opacity: granted ? 1 : 0.6, cursor: granted ? 'pointer' : 'default',
              transition: 'border-color 0.12s',
            }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>{m.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{m.desc}</p>
              {!granted && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                  Sem permissão ({m.cap})
                </div>
              )}
              {granted && (
                <div style={{ marginTop: 12, fontSize: 13, color: ACCENT, fontWeight: 600 }}>
                  Abrir →
                </div>
              )}
            </div>
          )
          return granted ? (
            <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>{Inner}</Link>
          ) : (
            <div key={m.href}>{Inner}</div>
          )
        })}
      </div>
    </main>
  )
}
