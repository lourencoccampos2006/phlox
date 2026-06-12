'use client'

// OrgSwitcher — dropdown no header para alternar entre organizações.
// Aparece quando o utilizador tem >= 1 membership. Esconde-se em utilizadores
// sem org (estudantes, pessoais, cuidadores que só usam o seu próprio espaço).

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useMemberships, setActiveOrgId } from '@/lib/orgContext'
import { ROLE_META } from '@/lib/capabilities'

const KIND_LABELS: Record<string, string> = {
  hospital: 'Hospital',
  clinic: 'Clínica',
  nursing_home: 'Lar / ERPI',
  day_care: 'Centro de Dia',
  pharmacy_community: 'Farmácia comunitária',
  pharmacy_hospital: 'Farmácia hospitalar',
  health_center: 'Centro de saúde',
  solo: 'Profissional individual',
  other: 'Outro',
}

export default function OrgSwitcher({ compact = false }: { compact?: boolean }) {
  const { memberships, active, loading } = useMemberships()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  if (loading) return null
  if (memberships.length === 0) return null

  const initial = (active?.org.short_name || active?.org.name || '?').charAt(0).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title={active?.org.name || 'Trocar organização'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: compact ? '5px 10px' : '7px 12px',
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          background: active?.org.accent_color || '#0d6e42',
          color: 'white', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{initial}</span>
        {!compact && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active?.org.short_name || active?.org.name || 'Sem organização'}
          </span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: 60, right: 12, left: 'auto', zIndex: 9999,
          width: 'min(320px, calc(100vw - 24px))',
          background: 'white', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 14px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-3)', background: '#f8fafc' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Organizações</div>
          </div>
          {memberships.map(m => {
            const isActive = active?.org.id === m.org.id
            const role = ROLE_META[m.role] || ROLE_META.viewer
            return (
              <button key={m.org.id}
                onClick={() => { setActiveOrgId(m.org.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', textAlign: 'left',
                  background: isActive ? '#f0fdf4' : 'white',
                  border: 'none', borderBottom: '1px solid var(--bg-3)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: m.org.accent_color || '#0d6e42', color: 'white',
                  fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{(m.org.short_name || m.org.name).charAt(0).toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.org.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: role.color, fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                    {role.label} · {KIND_LABELS[m.org.kind] || m.org.kind}
                  </span>
                </span>
                {isActive && <span style={{ color: '#0d6e42', fontWeight: 800 }}>✓</span>}
              </button>
            )
          })}
          <div style={{ padding: '8px 12px', background: '#f8fafc', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Link href="/organizacao" onClick={() => setOpen(false)}
              style={{ textAlign: 'center', padding: '8px', background: '#0d6e42', color: 'white', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              🏥 Abrir hub
            </Link>
            <Link href="/settings?tab=organizacoes" onClick={() => setOpen(false)}
              style={{ textAlign: 'center', padding: '8px', background: 'white', color: '#475569', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              Gerir
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
