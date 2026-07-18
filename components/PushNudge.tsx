'use client'

// PushNudge — item nº2 das sugestões extra (2026-07-17). A vigilância proativa
// (Índice de Risco, alertas de família, burnout) já existia e já funcionava,
// mas dependia inteiramente de push_subscriptions — e não havia NENHUM momento
// em que se pedisse ao utilizador para ativar notificações fora de Definições.
// Aparece só depois de um sinal real de que vale a pena (ex: já tens um
// familiar adicionado), nunca ao calhas, e nunca mais que 1x por sessão.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { activatePush, pushSupportedAndNotGranted } from '@/lib/pushActivation'

const DISMISS_KEY = 'phlox-push-nudge-dismissed'

export default function PushNudge({ text }: { text: string }) {
  const { supabase } = useAuth() as any
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
      if (pushSupportedAndNotGranted()) setShow(true)
    } catch {}
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setShow(false)
  }

  async function activate() {
    setBusy(true); setErr('')
    const r = await activatePush(supabase)
    if (r.ok) { setDone(true); setTimeout(dismiss, 1800) }
    else setErr(r.error)
    setBusy(false)
  }

  if (!show) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '11px 14px', marginBottom: 14 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#1e3a8a' }}>
        {done ? 'Notificações ativadas ✓' : text}
        {err && <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3 }}>{err}</div>}
      </div>
      {!done && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={activate} disabled={busy} style={{ fontSize: 12, fontWeight: 700, color: 'white', background: '#1d4ed8', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? '…' : 'Ativar'}
          </button>
          <button onClick={dismiss} style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Agora não</button>
        </div>
      )}
    </div>
  )
}
