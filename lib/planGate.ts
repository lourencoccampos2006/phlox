// lib/planGate.ts
// Verifica o plano do utilizador nas API routes

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type Plan = 'free' | 'student' | 'pro' | 'clinic'

// ─── Mensagens de upgrade por plano requerido ─────────────────────────────────
const UPGRADE_MESSAGES: Record<Plan, string> = {
  free:    'Disponível no plano Base.',
  student: 'Esta funcionalidade requer o plano Plus (3,99€/mês).',
  pro:     'Esta funcionalidade requer o plano Pro (12,99€/mês).',
  clinic:  'Esta funcionalidade requer o plano Institucional.',
}

// ─── planGateResponse ─────────────────────────────────────────────────────────
// requiredPlan: plano mínimo necessário para aceder à feature
// featureName: nome legível da feature (para a mensagem de erro)
export function planGateResponse(requiredPlan: Plan, featureName: string): NextResponse {
  return NextResponse.json({
    error: `${featureName} requer o plano ${
      requiredPlan === 'student' ? 'Plus (3,99€/mês)' :
      requiredPlan === 'pro'     ? 'Pro (12,99€/mês)' :
      requiredPlan === 'clinic'  ? 'Institucional (149€/mês)' :
      'Base'
    }.`,
    upgrade_required: true,
    required_plan: requiredPlan,
    upgrade_url: '/pricing',
  }, { status: 403 })
}

// ─── limitReachedResponse ─────────────────────────────────────────────────────
export function limitReachedResponse(feature: string, limit: number, plan: string): NextResponse {
  return NextResponse.json({
    error: `Limite diário atingido (${limit}/dia no plano ${
      plan === 'free' ? 'Gratuito' : plan.charAt(0).toUpperCase() + plan.slice(1)
    }). Faz upgrade para continuar sem limites.`,
    limit_reached: true,
    daily_limit: limit,
    current_plan: plan,
    upgrade_url: '/pricing',
  }, { status: 429 })
}

// ─── extractToken ─────────────────────────────────────────────────────────────
export function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  const cookieHeader = req.headers.get('cookie') || ''
  if (!cookieHeader) return null

  const patterns = [
    /sb-[^=]+-auth-token=([^;]+)/,
    /supabase-auth-token=([^;]+)/,
    /sb-access-token=([^;]+)/,
  ]

  for (const pattern of patterns) {
    const match = cookieHeader.match(pattern)
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1])
        if (decoded.split('.').length === 3) return decoded
        const parsed = JSON.parse(decoded)
        if (Array.isArray(parsed) && parsed[0]) return parsed[0]
        if (parsed?.access_token) return parsed.access_token
      } catch (_e: any) { /* continue */ }
    }
  }
  return null
}

// ─── getUserPlan ──────────────────────────────────────────────────────────────
export async function getUserPlan(req: NextRequest): Promise<{ userId: string | null; plan: Plan }> {
  try {
    const token = extractToken(req)
    if (!token) return { userId: null, plan: 'free' }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    // CRÍTICO: validar o token JUNTO do Supabase Auth (verifica assinatura +
    // expiração). NUNCA derivar o userId do payload descodificado localmente —
    // um JWT é base64 e pode ser forjado. Várias rotas usam este userId com a
    // service-role key (que ignora RLS), por isso confiar no payload permitiria
    // a um atacante ler/escrever dados de qualquer conta.
    const { data: auth, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !auth?.user) return { userId: null, plan: 'free' }
    const userId = auth.user.id

    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()

    if (error || !data) return { userId, plan: 'free' }
    return { userId, plan: (data.plan as Plan) || 'free' }

  } catch (err) {
    console.error('getUserPlan error:', err)
    return { userId: null, plan: 'free' }
  }
}

// ─── isPlanSufficient ─────────────────────────────────────────────────────────
// Verifica se o plano actual é suficiente para o plano requerido
const PLAN_RANK: Record<Plan, number> = { free: 0, student: 1, pro: 2, clinic: 3 }

export function isPlanSufficient(currentPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan]
}
