'use client'

// /tudo — REMOVIDA 2026-07-17 a pedido do Fernando: já não existe como página
// à parte. "Tudo o que o Phlox faz" passou a ser uma VISTA dentro de /inicio
// (botão "Tudo o que o Phlox faz", ao lado de "Para ti"), para não haver uma
// segunda página a navegar — tudo fica num sítio só. Mantido como redirect
// para não partir marcadores/links antigos.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TudoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inicio?ver=tudo') }, [router])
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
      A redirecionar…
    </div>
  )
}
