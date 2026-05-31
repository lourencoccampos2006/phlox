'use client'

// ToolUseTracker — regista a página atual no contador local (lib/userPersona).
// Alimenta o componente MyTopTools no /inicio. Sem analytics externos, sem rede.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackToolUse } from '@/lib/userPersona'

// Páginas que NÃO queremos contar (administrativas, públicas, transitórias).
const SKIP = ['/', '/login', '/logout', '/inicio', '/checkout', '/checkout/success', '/dashboard', '/settings', '/changelog', '/status', '/trust', '/privacy', '/terms', '/about']

export default function ToolUseTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (SKIP.includes(pathname)) return
    // Ignora subpáginas dinâmicas profundas (ex: /patients/123 — conta como /patients)
    const parts = pathname.split('/').filter(Boolean)
    const top = '/' + (parts[0] || '')
    if (SKIP.includes(top)) return
    trackToolUse(top)
  }, [pathname])

  return null
}
