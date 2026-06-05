'use client'

// /progresso — fundido em /study360 (separador "Progresso").
// Mantido como redirect para não partir links existentes.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProgressoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/study360?tab=stats') }, [router])
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
      A redirecionar para Estudo 360°…
    </div>
  )
}
