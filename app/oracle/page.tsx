'use client'
// /oracle — JUNTADO no Phlox Copilot (✦), que já faz consulta IA / notas.
// Redirect para /ai. (Ronda 13b, limpeza do catálogo.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function OracleRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/ai') }, [r])
  return null
}
