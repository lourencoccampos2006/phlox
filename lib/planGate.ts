// lib/planGate.ts
// Verifica o plano do utilizador nas API routes
// Supabase guarda o token em cookies com o nome sb-<project-ref>-auth-token

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type Plan = 'free' | 'student' | 'pro' | 'clinic'

export function planGateResponse(feature: string, currentPlan: Plan | string): NextResponse {
  const isPro = feature === 'protocol'
  return NextResponse.json({
    error: isPro
      ? 'Esta funcionalidade requer o plano Pro (12,99€/mês).'
      : 'Esta funcionalidade requer o plano Student (3,99€/mês).',
    upgrade_required: true,
    required_plan: isPro ? 'pro' : 'student',
    current_plan: currentPlan,
    upgrade_url: '/pricing',
  }, { status: 403 })
}

export function limitReachedResponse(feature: string, limit: number, plan: string): NextResponse {
  return NextResponse.json({
    error: `Limite diário atingido (${limit}/dia no plano ${plan === 'free' ? 'Gratuito' : plan}). Faz upgrade para continuar.`,
    limit_reached: true,
    daily_limit: limit,
    current_plan: plan,
    upgrade_url: '/pricing',
  }, { status: 429 })
}

function extractToken(req: NextRequest): string | null {
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
      } catch { }
    }
  }
  return null
}

export async function getUserPlan(req: NextRequest): Promise<{ userId: string | null; plan: Plan }> {
  try {
    const token = extractToken(req)
    if (!token) return { userId: null, plan: 'free' }

    const parts = token.split('.')
    if (parts.length !== 3) return { userId: null, plan: 'free' }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const userId = payload.sub
    if (!userId) return { userId: null, plan: 'free' }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { userId: null, plan: 'free' }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

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