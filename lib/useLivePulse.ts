'use client'

// useLivePulse — consome o stream SSE de /api/pulse e devolve o último snapshot
// ao componente. Reconexão automática e cleanup correto. Apenas no browser.

import { useEffect, useState } from 'react'

export interface PulseSnapshot {
  revenue_today: number
  sales_count_today: number
  waiting_now: number
  in_service_now: number
  open_incidents: number
  open_tasks: number
  at: string
}

export function useLivePulse(supabase: any, enabled: boolean = true) {
  const [snap, setSnap] = useState<PulseSnapshot | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !supabase) return
    let es: EventSource | null = null
    let cancelled = false
    let backoff = 2000

    async function connect() {
      try {
        const t = (await supabase.auth.getSession()).data.session?.access_token
        if (!t || cancelled) return
        es = new EventSource(`/api/pulse?token=${encodeURIComponent(t)}`)
        es.addEventListener('open', () => { setConnected(true); backoff = 2000 })
        es.addEventListener('snapshot', (ev: MessageEvent) => {
          try { setSnap(JSON.parse(ev.data)) } catch { /* ignora */ }
        })
        es.addEventListener('error', () => {
          setConnected(false)
          es?.close(); es = null
          if (!cancelled) setTimeout(connect, backoff)
          backoff = Math.min(60_000, backoff * 2)
        })
      } catch {
        if (!cancelled) setTimeout(connect, backoff)
        backoff = Math.min(60_000, backoff * 2)
      }
    }

    connect()
    return () => { cancelled = true; setConnected(false); es?.close() }
  }, [enabled, supabase])

  return { snap, connected }
}
