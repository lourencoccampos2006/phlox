'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function HojeRedirect() {
  const r = useRouter()
  // /turno é ele próprio um redirect (→ /ronda-guiada) — aponta direto para
  // evitar cadeia (apanhado pelo guard de redirect-chains em check-links.mjs).
  useEffect(() => { r.replace('/ronda-guiada') }, [r])
  return null
}
