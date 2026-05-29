'use client'

// Painel de Gestão — ESPECÍFICO por tipo de instituição.
//  • lar/ERPI → painel clínico-operacional rico (ocupação, MAR, feridas, turnos)
//  • restantes → painel construído dos sinais reais (vendas/atos, fluxo, stock, risco)

import { useClinicPrefs } from '@/lib/useClinicPrefs'
import NursingHomeGestao from './NursingHomeGestao'
import OpsGestao from './OpsGestao'

export default function GestaoPage() {
  const { institution } = useClinicPrefs()
  if (institution === 'nursing_home') return <NursingHomeGestao />
  return <OpsGestao institution={institution} />
}
