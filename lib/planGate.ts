// lib/planGate.ts
// Verifica o plano do utilizador e aplica limites nas API routes
// Usa o JWT do Supabase para identificar o utilizador sem chamada extra à DB

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type Plan = 'free' | 'student' | 'pro' | 'clinic'

export interface PlanCheck {
  allowed: boolean
  plan: Plan
  reason?: string
  upgradeUrl?: string
}

// Limites diários por plano (por tipo de pesquisa)
export const PLAN_LIMITS: Record<Plan, Record<string, number>> = {
  free:    { interactions: 10, drugs: 15, doses: 5,  monograph: 5,  compatibility: 5,  safety: 5,  cases: 0,  protocol: 0  },
  student: { interactions: -1, drugs: -1, doses: -1, monograph: -1, compatibility: -1, safety: -1, cases: -1, protocol: 0  },
  pro:     { interactions: -1, drugs: -1, doses: -1, monograph: -1, compatibility: -1, safety: -1, cases: -1, protocol: -1 },
  clinic:  { interactions: -1, drugs: -1, doses: -1, monograph: -1, compatibility: -1, safety: -1, cases: -1, protocol: -1 },
}

// Que plano mínimo é necessário para cada feature
export const FEATURE_PLAN: Record<string, Plan> = {
  cases:    'student',
  protocol: 'pro',
  export:   'pro',
}

export function planGateResponse(feature: string, currentPlan: Plan): NextResponse {
  const requiredPlan = FEATURE_PLAN[feature] || 'student'
  const messages: Record<Plan, string> = {
    student: 'Esta funcionalidade requer o plano Student (3,99€/mês).',
    pro:     'Esta funcionalidade requer o plano Pro (12,99€/mês).',
    clinic:  'Esta funcionalidade requer o plano Clinic.',
    free:    '',
  }
  return NextResponse.json({
    error: messages[requiredPlan],
    upgrade_required: true,
    required_plan: requiredPlan,
    current_plan: currentPlan,
    upgrade_url: '/pricing',
  }, { status: 403 })
}

export function limitReachedResponse(feature: string, limit: number, plan: Plan): NextResponse {
  const nextPlan = plan === 'free' ? 'student' : 'pro'
  return NextResponse.json({
    error: `Limite diário atingido (${limit} ${feature}/dia no plano ${plan === 'free' ? 'Gratuito' : plan}). Faz upgrade para continuar.`,
    limit_reached: true,
    daily_limit: limit,
    current_plan: plan,
    upgrade_url: '/pricing',
  }, { status: 429 })
}

// Obtém o plano do utilizador a partir do JWT (sem chamada extra à DB)
export async function getUserPlan(req: NextRequest): Promise<{ userId: string | null; plan: Plan }> {
  try {
    const authHeader = req.headers.get('authorization')
    const cookieHeader = req.headers.get('cookie') || ''

    // Tenta obter o token do header ou do cookie
    let token: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else {
      // Supabase guarda em cookie sb-<project>-auth-token
      const match = cookieHeader.match(/phlox-auth[^=]*=([^;]+)/)
      if (match) {
        try {
          const parsed = JSON.parse(decodeURIComponent(match[1]))
          token = parsed?.access_token || null
        } catch { }
      }
    }

    if (!token) return { userId: null, plan: 'free' }

    // Decode JWT payload (sem verificação — confiamos no Supabase para isso)
    const payload = JSON.parse(atob(token.split('.')[1]))
    const userId = payload.sub

    if (!userId) return { userId: null, plan: 'free' }

    // Busca o plano na base de dados
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()

    return {
      userId,
      plan: (data?.plan as Plan) || 'free',
    }
  } catch {
    return { userId: null, plan: 'free' }
  }
}