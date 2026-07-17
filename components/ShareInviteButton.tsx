'use client'

// ShareInviteButton — Convite de Visualização (Pro, item B9 da auditoria). O
// dono de um perfil de família gera um código de acesso só-leitura para outra
// conta Phlox (ex: um irmão a co-cuidar da mãe) — sem migração de esquema,
// sem se tornar co-dono. Ver sprint112_family_profile_shares.sql.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Share { id: string; code: string; created_at: string; redeemed_at: string | null; revoked_at: string | null }

export default function ShareInviteButton({ profileId, name }: { profileId: string; name: string }) {
  const { supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<Share[] | null>(null)
  const [newCode, setNewCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function auth() { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || '' }

  async function load() {
    const res = await fetch(`/api/family-share/list?profile_id=${profileId}`, { headers: { Authorization: `Bearer ${await auth()}` } })
    if (res.ok) { const j = await res.json(); setShares(j.shares || []) }
  }

  async function create() {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/family-share/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({ profile_id: profileId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setNewCode(j.share.code)
      load()
    } catch (e: any) { setErr(e.message || 'Não foi possível gerar o convite.') }
    finally { setLoading(false) }
  }

  async function revoke(shareId: string) {
    await fetch('/api/family-share/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ share_id: shareId }) })
    load()
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); load() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
        🔗 Convidar alguém a ver
      </button>
    )
  }

  const active = (shares || []).filter(s => !s.revoked_at)

  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8' }}>🔗 Ver {name.split(' ')[0]}, sem editar</span>
        <button onClick={() => setOpen(false)} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
      </div>
      <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 10, lineHeight: 1.5 }}>
        Dá a outra pessoa (ex: outro familiar) acesso de só-leitura a este perfil — medicação, vitais e sintomas. Ela precisa de uma conta Phlox e do código abaixo, em <strong>Partilhado comigo</strong>.
      </div>

      {newCode && (
        <div style={{ background: 'white', border: '1.5px solid #1d4ed8', borderRadius: 8, padding: '10px 12px', marginBottom: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Código do convite</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.1em' }}>{newCode}</div>
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{err}</div>}
      <button onClick={create} disabled={loading} style={{ width: '100%', padding: '9px 14px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', marginBottom: 10 }}>
        {loading ? 'A gerar…' : '+ Gerar novo código'}
      </button>

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>Convites ativos</div>
          {active.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #dbeafe', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>{s.code}</span>
              <span style={{ fontSize: 11, color: s.redeemed_at ? '#15803d' : '#94a3b8' }}>{s.redeemed_at ? '✓ Resgatado' : 'Por resgatar'}</span>
              <button onClick={() => revoke(s.id)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Revogar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
