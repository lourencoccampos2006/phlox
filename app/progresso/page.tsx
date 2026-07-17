'use client'

// /progresso — o conteúdo real de progresso (XP, streak, liga) vive em /arena.
// Mantido como redirect para não partir links existentes.
// BUG CORRIGIDO 2026-07-17: apontava para /study360?tab=stats — /study360 é um
// redirect incondicional para /study (Ronda 13b) que ignora qualquer query
// string, por isso "?tab=stats" nunca chegava a lado nenhum. /arena é onde o
// progresso (XP/streak/liga) realmente vive.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProgressoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/arena') }, [router])
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
      A redirecionar para a Arena…
    </div>
  )
}
