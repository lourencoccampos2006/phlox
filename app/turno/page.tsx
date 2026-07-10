'use client'
// /turno — SUBSTITUÍDO pela nova /ronda-guiada (ronda coordenada). As tarefas
// vivem em /team. Redirect para não partir links. (Ronda 13b, limpeza do
// catálogo.) Antes o `?tab=passagem` desviava para /handover, que por sua vez
// redirecionava de volta para aqui — loop de redirect infinito. Ambos apontam
// agora diretamente para o destino real.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function TurnoRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/ronda-guiada') }, [r])
  return null
}
