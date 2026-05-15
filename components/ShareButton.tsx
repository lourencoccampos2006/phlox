'use client'

// components/ShareButton.tsx — Phlox Partilhar
// Cria URL pública partilhável via /api/share, com fallback para URL atual.
// Compatível com todas as ferramentas de resultado.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Props {
  title: string
  text: string
  resultType?: 'interaction' | 'labs' | 'care_plan' | 'arena_result' | 'medication_review'
  resultData?: any
  url?: string
  compact?: boolean
}

export default function ShareButton({ title, text, resultType, resultData, url, compact = false }: Props) {
  const { supabase } = useAuth()
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'shared'>('idle')
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const getOrCreateUrl = async (): Promise<string> => {
    if (shareUrl) return shareUrl
    if (!resultType || !resultData) {
      return url || (typeof window !== 'undefined' ? window.location.href : '')
    }
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: resultType, data: resultData, title }),
      })
      const data = await res.json()
      if (data.url) { setShareUrl(data.url); return data.url }
    } catch (_e: any) {}
    return url || (typeof window !== 'undefined' ? window.location.href : '')
  }

  const handleShare = async () => {
    setState('loading')
    const finalUrl = await getOrCreateUrl()
    const shareText = `${title}\n\n${text}\n\nVerificado em Phlox Clinical`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: finalUrl })
        setState('shared')
        setTimeout(() => setState('idle'), 2000)
        return
      } catch { /* user cancelled */ }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(finalUrl)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch { setState('idle') }
  }

  const label = state === 'loading' ? '...' : state === 'copied' ? 'Link copiado!' : state === 'shared' ? 'Partilhado!' : 'Partilhar'
  const iconColor = state === 'copied' || state === 'shared' ? 'var(--green)' : 'var(--ink-4)'

  if (compact) return (
    <button onClick={handleShare} disabled={state === 'loading'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: iconColor, fontFamily: 'var(--font-mono)', fontWeight: state === 'copied' || state === 'shared' ? 700 : 400, transition: 'color 0.15s', padding: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {state === 'copied' || state === 'shared'
          ? <path d="M20 6L9 17l-5-5"/>
          : <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>}
      </svg>
      {label}
    </button>
  )

  return (
    <button onClick={handleShare} disabled={state === 'loading'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px',
        background: state === 'copied' || state === 'shared' ? 'var(--green-light)' : 'white',
        border: `1px solid ${state === 'copied' || state === 'shared' ? 'var(--green-mid)' : 'var(--border)'}`,
        borderRadius: 7,
        cursor: state === 'loading' ? 'wait' : 'pointer',
        fontSize: 12, fontWeight: 600,
        color: state === 'copied' || state === 'shared' ? 'var(--green)' : 'var(--ink-3)',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s',
      }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {state === 'copied' || state === 'shared'
          ? <path d="M20 6L9 17l-5-5"/>
          : <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>}
      </svg>
      {label}
    </button>
  )
}