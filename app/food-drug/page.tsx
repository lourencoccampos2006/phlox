'use client'
// /food-drug — JUNTADO em /interactions (o mesmo tema: o que não misturar).
// Mantido como redirect para não partir links antigos. (Ronda 13b, limpeza.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function FoodDrugRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/interactions') }, [r])
  return null
}
