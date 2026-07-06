'use client'
// /saude360 — CORTADO (redundante: medicação/análises/vitais já vivem em
// /timeline e /mymeds). Redirect para /timeline. (Ronda 13b, limpeza.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function Saude360Redirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/timeline') }, [r])
  return null
}
