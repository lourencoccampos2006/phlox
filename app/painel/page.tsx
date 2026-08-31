'use client'

// /painel — o NOVO cockpit institucional (reformulação 2026-06-12).
// Monta-se a partir do blueprint do tipo de instituição. O /cockpit antigo fica
// preservado no git mas passa a redirecionar para cá.

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import PainelCockpit from './PainelCockpit'
import PainelHoje from './PainelHoje'

export default function PainelPage() {
  const { user, loading } = useAuth() as any
  const { institution } = useClinicPrefs()
  const router = useRouter()
  const mode = user?.experience_mode

  // O painel é a área institucional. Quem está em modo pessoal/cuidador/estudante
  // não o deve ver com o cabeçalho pessoal à volta (fuga entre modos) — levamo-lo
  // para a sua página inicial. Só decidimos depois de o modo estar carregado.
  const wrongMode = !loading && !!mode && mode !== 'clinical'
  useEffect(() => { if (wrongMode) router.replace('/inicio') }, [wrongMode, router])

  if (wrongMode) return null

  // O painel novo (docs/designs/Painel Phlox.html) é para o mercado real: lares
  // e centros de dia. Os outros tipos que ainda vivem no blueprint (farmácia,
  // clínica) continuam no cockpit antigo — não foram redesenhados, e mandá-los
  // para um painel pensado para outra coisa dava-lhes um ecrã pior do que o que
  // já tinham.
  const novoPainel = institution === 'day_care' || institution === 'nursing_home'
  if (!novoPainel) return <PainelCockpit />
  // O painel lê ?aba= para saber que vista mostrar; o Next exige a fronteira.
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-14)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar o dia…</div>}>
      <PainelHoje />
    </Suspense>
  )
}
