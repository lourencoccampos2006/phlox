'use client'

// WelcomeTour v3 — 2026-06-24. O Fernando disse que o tour (modal com overlay e
// passos) era feio e CONFUNDIA mais do que ajudar. Substituído por uma faixa
// gentil e opcional no topo do /inicio: uma frase de orientação que a pessoa lê
// num segundo e fecha. Sem overlay, sem passos forçados, sem prender o ecrã.
// Nunca reaparece depois de fechada.

import { useEffect, useState } from 'react'
import { modeTheme } from '@/lib/modeTheme'

const SEEN_KEY = 'phlox-welcome-hint-v1'

export default function WelcomeTour({ mode = 'personal' }: { mode?: string }) {
  const [show, setShow] = useState(false)
  const t = modeTheme(mode)

  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setShow(true) } catch {}
  }, [])

  function close() {
    try { localStorage.setItem(SEEN_KEY, '1') } catch {}
    setShow(false)
  }

  if (!show) return null

  const line = mode === 'student'
    ? 'No topo mostro-lhe sempre o melhor passo seguinte. Em baixo tem a barra para voltar aqui a qualquer momento.'
    : 'No topo mostro-lhe o que precisa agora. Em baixo tem a barra para voltar a este ecrã sempre que quiser.'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: t.accentSoft, border: `1px solid ${t.accent}33`, borderRadius: t.radius,
      padding: '13px 14px', marginBottom: 16,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2 }}>👋</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: t.accentInk, marginBottom: 2 }}>Bem-vindo. É simples:</div>
        <div style={{ fontSize: 13, color: t.accentInk, opacity: 0.92, lineHeight: 1.5 }}>{line}</div>
      </div>
      <button onClick={close} aria-label="Fechar" style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: 'none',
        background: 'rgba(0,0,0,0.06)', color: t.accentInk, cursor: 'pointer', fontSize: 15, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>×</button>
    </div>
  )
}
