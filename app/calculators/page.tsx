'use client'

// /calculators foi unificado em /calculos (hub único de calculadoras + escalas).
// As escalas (CURB-65, MEWS, CHA2DS2-VASc, etc.) estão agora lá. Redirect para não
// partir links antigos.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CalculatorsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/calculos') }, [router])
  return null
}
