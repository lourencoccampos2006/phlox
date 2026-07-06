'use client'
// /study360 — CORTADO (meta-hub thin; o "onde focar" vai para o /inicio do
// estudante). Redirect para /study. (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function Study360Redirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/study') }, [r])
  return null
}
