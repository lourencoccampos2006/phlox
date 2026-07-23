'use client'

// /painel — o NOVO cockpit institucional (reformulação 2026-06-12).
// Monta-se a partir do blueprint do tipo de instituição. O /cockpit antigo fica
// preservado no git mas passa a redirecionar para cá.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import PainelCockpit from './PainelCockpit'

export default function PainelPage() {
  const { user, loading } = useAuth() as any
  const router = useRouter()
  const mode = user?.experience_mode

  // O painel é a área institucional. Quem está em modo pessoal/cuidador/estudante
  // não o deve ver com o cabeçalho pessoal à volta (fuga entre modos) — levamo-lo
  // para a sua página inicial. Só decidimos depois de o modo estar carregado.
  const wrongMode = !loading && !!mode && mode !== 'clinical'
  useEffect(() => { if (wrongMode) router.replace('/inicio') }, [wrongMode, router])

  if (wrongMode) return null
  return <PainelCockpit />
}
