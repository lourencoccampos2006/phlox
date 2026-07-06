'use client'
// /quality — MELHORADO e MOVIDO para o /painel-dono (aba "Qualidade"), com
// indicadores reais calculados dos registos. Redirect. (Ronda 13b, limpeza.)
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function QualityRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/painel-dono?tab=qualidade') }, [r])
  return null
}
