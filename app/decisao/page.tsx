'use client'

// /decisao foi SUBSTITUÍDO pelo /simulador (modo "Caso Evolutivo"). Mantemos este
// redirect para não partir links antigos.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DecisaoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/simulador?mode=decision') }, [router])
  return null
}
