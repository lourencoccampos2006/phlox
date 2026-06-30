'use client'

// /calc foi unificado em /calculos (hub único de calculadoras). Redirect para não
// partir links antigos.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CalcRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/calculos') }, [router])
  return null
}
