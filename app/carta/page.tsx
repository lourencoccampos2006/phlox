'use client'
// /carta — CORTADO (carta de alta é hospitalar, fora do foco lar/centro de dia).
// Redirect para /inicio. Código mantido no git. (Ronda 13b, limpeza.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function CartaRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/inicio') }, [r])
  return null
}
