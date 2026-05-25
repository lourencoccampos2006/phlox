'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { limitFor } from '@/lib/plans'

// Limite de uso diário por ferramenta (por utilizador, por dia). Cliente-side,
// reset automático à meia-noite. Pro/Institucional = ilimitado.

export function useUsageLimit(key: string) {
  const { user } = useAuth() as any
  const plan = user?.plan || 'free'
  const limit = limitFor(plan, key)
  const unlimited = !isFinite(limit)
  const today = new Date().toISOString().slice(0, 10)
  const storeKey = `phlox-usage-${key}-${today}`
  const [used, setUsed] = useState(0)

  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(storeKey) || '0')
      setUsed(isNaN(v) ? 0 : v)
      // limpar contadores de dias anteriores
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`phlox-usage-${key}-`) && k !== storeKey) localStorage.removeItem(k)
      }
    } catch { /* ignore */ }
  }, [storeKey, key])

  const remaining = unlimited ? Infinity : Math.max(0, limit - used)
  const allowed = unlimited || used < limit

  const increment = useCallback(() => {
    if (unlimited) return
    setUsed(u => {
      const n = u + 1
      try { localStorage.setItem(storeKey, String(n)) } catch { /* ignore */ }
      return n
    })
  }, [storeKey, unlimited])

  return { plan, limit, used, remaining, allowed, unlimited, hit: !allowed, increment }
}
