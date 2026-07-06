'use client'
// /turno — SUBSTITUÍDO pela nova /ronda-guiada (ronda coordenada). As tarefas
// vivem em /team e a passagem em /handover. Redirect para não partir links.
// (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function TurnoRedirect() {
  const r = useRouter()
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    r.replace(tab === 'passagem' ? '/handover' : '/ronda-guiada')
  }, [r])
  return null
}
