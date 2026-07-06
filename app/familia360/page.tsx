'use client'
// /familia360 — JUNTADO em /familia (o centro de cuidado do cuidador).
// Redirect para não partir links. (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function Familia360Redirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/familia') }, [r])
  return null
}
