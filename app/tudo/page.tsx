'use client'

// /tudo — REMOVIDA 2026-07-21 a pedido do Fernando: já não existe como página
// nem como vista à parte. "Explorar" é agora só a parte de baixo de /inicio,
// sempre visível, sem toggle. Mantido como redirect para não partir
// marcadores/links antigos.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TudoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inicio#explorar') }, [router])
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
      A redirecionar…
    </div>
  )
}
