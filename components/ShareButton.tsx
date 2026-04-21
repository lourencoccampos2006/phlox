'use client'

import { useState } from 'react'

interface Props {
  title: string       // ex: "ibuprofeno + varfarina — GRAVE"
  text: string        // ex: "Interação grave: risco hemorrágico..."
  url?: string        // defaults to current page
}

export default function ShareButton({ title, text, url }: Props) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareText = `${title}\n\n${text}\n\nVerificado em Phlox Clinical`

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url: shareUrl })
    } catch { /* user cancelled */ }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank')
  }

  const email = () => {
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`)
  }

  // Mobile: use native share
  if (canNativeShare) {
    return (
      <button
        onClick={nativeShare}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Partilhar
      </button>
    )
  }

  // Desktop: dropdown
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: open ? 'var(--bg-3)' : 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Partilhar
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 9, boxShadow: 'var(--shadow-lg)', minWidth: 180, overflow: 'hidden', zIndex: 50 }}>
          {[
            { icon: '💬', label: 'WhatsApp', action: whatsapp },
            { icon: '📧', label: 'Email', action: email },
            { icon: copied ? '✓' : '🔗', label: copied ? 'Copiado!' : 'Copiar link', action: copyLink },
          ].map(({ icon, label, action }) => (
            <button key={label} onClick={() => { action(); if (label !== 'Copiar link') setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}