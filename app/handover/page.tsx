'use client'

// /handover — SUBSTITUÍDO pela /ronda-guiada (ronda coordenada), tal como o
// /turno antigo (ver PROPOSTA_LIMPEZA_CATALOGO.md). Redirect para não partir
// links antigos. Antes apontava para /turno?tab=passagem, que por sua vez
// redirecionava de volta para aqui — um loop de redirect infinito, corrigido
// ao apontar os dois diretamente para o destino real.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function HandoverRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/ronda-guiada') }, [r])
  return null
}
