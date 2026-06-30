'use client'

// A ferramenta standalone "/copiloto" foi removida (era redundante e de baixa
// qualidade). O assistente do Phlox é agora o Copilot flutuante, disponível em
// todas as páginas pelo botão ✦. Esta rota redireciona para não partir links antigos.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CopilotoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inicio') }, [router])
  return null
}
