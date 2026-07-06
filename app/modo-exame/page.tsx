'use client'
// /modo-exame — JUNTADO em /study (plano por exame vive no estudo).
// Redirect para não partir links antigos. (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function ModoExameRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/study') }, [r])
  return null
}
