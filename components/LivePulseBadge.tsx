'use client'

// Indicador "AO VIVO" para o cockpit. Consome o SSE do /api/pulse e mostra 3 KPIs
// que mudam sem reload. Subtil; cai em silêncio se a ligação falhar.

import { useAuth } from '@/components/AuthContext'
import { useLivePulse } from '@/lib/useLivePulse'

const eur = (v: number) => `${Math.round(v).toLocaleString('pt-PT')}€`

export default function LivePulseBadge() {
  const { supabase } = useAuth() as any
  const { snap, connected } = useLivePulse(supabase)

  if (!snap) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af' }} /> A ligar…
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '7px 14px', borderRadius: 22, background: 'white', border: '1.5px solid #bbf7d0', boxShadow: '0 2px 8px -2px rgba(13,110,66,0.15)', fontFamily: 'var(--font-sans)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: '#0d6e42', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#16a34a' : '#d97706', animation: connected ? 'pulse 2s infinite' : 'none' }} /> Ao vivo
      </span>
      <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}><strong style={{ color: 'var(--ink)' }}>{eur(snap.revenue_today)}</strong> hoje</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}><strong style={{ color: snap.waiting_now > 0 ? '#0d6e42' : 'var(--ink)' }}>{snap.waiting_now}</strong> à espera</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}><strong style={{ color: snap.open_tasks > 0 ? '#d97706' : 'var(--ink)' }}>{snap.open_tasks}</strong> tarefas</span>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
