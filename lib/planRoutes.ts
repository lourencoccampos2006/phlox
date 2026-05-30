// lib/planRoutes.ts
// Mapa de ROTAS → plano mínimo necessário. Usado pelo ClientLayout para bloquear o
// acesso a ferramentas pagas (não basta esconder o botão — a página tem de bloquear).
// Mantém-se conservador: só ferramentas claramente pagas entram aqui.

import type { PlanId } from './plans'

export interface PlanRoute { prefix: string; min: PlanId; tool: string; note?: string }

// Ordenado do mais específico para o mais genérico (o 1º match ganha).
export const PLAN_ROUTES: PlanRoute[] = [
  // ── Pro (individual avançado) ──
  { prefix: '/reconciliacao', min: 'pro', tool: 'Reconciliação Terapêutica', note: 'Reconciliação de medicação na transição de cuidados.' },
  { prefix: '/simulador', min: 'pro', tool: 'Simulador Clínico & OSCE', note: 'Casos clínicos e OSCE com avaliação.' },
  { prefix: '/med-review', min: 'pro', tool: 'Revisão da Medicação', note: 'Revisão farmacoterapêutica avançada.' },
  { prefix: '/tpn', min: 'pro', tool: 'Nutrição Parentérica (TPN)', note: 'Cálculo e validação de TPN.' },
  { prefix: '/stopp-start', min: 'pro', tool: 'STOPP/START', note: 'Critérios de prescrição potencialmente inapropriada.' },
  { prefix: '/labs', min: 'student', tool: 'Interpretação de Análises', note: 'Leitura guiada de análises.' },

  // ── Estudo (Plus) ──
  { prefix: '/simulador', min: 'pro', tool: 'Simulador Clínico' },
  { prefix: '/arena', min: 'student', tool: 'Arena de Estudo' },
  { prefix: '/tutor', min: 'student', tool: 'AI Tutor' },
  { prefix: '/exam', min: 'student', tool: 'Modo Exame' },
]

export function planForRoute(pathname: string): PlanRoute | null {
  for (const r of PLAN_ROUTES) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) return r
  }
  return null
}
