'use client'
// /aprender — CORTADO (hub de estudo redundante com /tudo e /inicio).
// Redirect para /study. (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function AprenderRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/study') }, [r])
  return null
}
