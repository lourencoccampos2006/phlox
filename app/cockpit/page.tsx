'use client'

// O cockpit institucional foi refeito de raiz em /painel (montado a partir do
// blueprint de cada tipo de instituição). Esta rota redireciona para lá para
// manter os links antigos a funcionar. A versão antiga ficou em /cockpit-legacy.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CockpitRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/painel') }, [r])
  return null
}
