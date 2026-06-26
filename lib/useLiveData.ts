'use client'

import { useEffect, useRef } from 'react'

// ─── Phlox live-data hook ────────────────────────────────────────────────────
// Mantém os registos sempre frescos em toda a plataforma:
//  1) Supabase Realtime — atualiza no instante quando outro utilizador/aparelho
//     altera dados (se a replicação estiver ativa na tabela).
//  2) Fallback robusto — refaz a query quando a janela volta a ficar visível
//     ou ganha foco (funciona sempre, mesmo sem replicação ativa).
// Debounced para evitar refetches em rajada. Transversal a qualquer instituição.

interface Opts {
  supabase: any
  table: string | string[]
  userId?: string | null
  onChange: () => void
  enabled?: boolean
  // Coluna/valor de filtro do realtime. Por defeito user_id=userId (conta
  // individual). Numa organização, passar filterColumn='org_id' + filterValue=orgId
  // faz o realtime disparar quando QUALQUER membro da equipa altera dados.
  filterColumn?: 'user_id' | 'org_id'
  filterValue?: string | null
}

export function useLiveData({ supabase, table, userId, onChange, enabled = true, filterColumn, filterValue }: Opts) {
  const cb = useRef(onChange)
  cb.current = onChange
  const tables = Array.isArray(table) ? table : [table]
  const key = tables.join(',')
  const col = filterColumn || 'user_id'
  const val = filterValue ?? userId

  useEffect(() => {
    if (!enabled || !val || !supabase) return
    let timer: ReturnType<typeof setTimeout>
    let lastRun = 0
    const fire = (immediate = false) => {
      clearTimeout(timer)
      const run = () => { lastRun = Date.now(); cb.current() }
      if (immediate) run()
      else timer = setTimeout(run, 300)
    }

    // 1) Realtime channel (no-op gracioso se a replicação não estiver ativa)
    let channel: any = null
    try {
      channel = supabase.channel(`live:${key}:${col}:${val}`)
      tables.forEach(t => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `${col}=eq.${val}` }, () => fire())
      })
      channel.subscribe()
    } catch { /* realtime indisponível — fallback abaixo trata */ }

    // 2) Fallback: refetch ao voltar à app (troca de aba/app no telemóvel)
    const onFocus = () => { if (Date.now() - lastRun > 4000) fire(true) }
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - lastRun > 4000) fire(true) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clearTimeout(timer)
      try { if (channel) supabase.removeChannel(channel) } catch { /* ignore */ }
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [supabase, val, col, enabled, key])
}
