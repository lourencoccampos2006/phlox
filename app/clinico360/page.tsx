'use client'

// /clinico360 foi fundido no novo /painel: o Pulse do turno e o ranking de risco
// estão agora no painel institucional (montado por tipo). O Stewardship e o Audit
// vivem na Central de Qualidade (/quality). Redirect para não partir links antigos.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Clinico360Redirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/painel') }, [r])
  return null
}
