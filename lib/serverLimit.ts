// lib/serverLimit.ts
// Enforcement de limites diários NO SERVIDOR (bullet-proof). A contagem
// client-side (useUsageLimit) continua a dar feedback imediato na UI, mas a
// verdade está aqui: contadores persistidos em usage_counters (sprint88) e
// incrementados atomicamente via RPC. Mesmo que alguém limpe o localStorage ou
// chame a API diretamente, o limite mantém-se.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from './planGate'
import { limitFor } from './plans'

export interface LimitResult {
  ok: boolean
  userId: string | null
  plan: string
  /** Resposta 429 pronta a devolver quando ok === false. */
  response?: NextResponse
}

// Verifica e (se houver margem) consome 1 uso da ferramenta `key` para o dia.
// - Utilizadores sem sessão: tratados como 'free' mas SEM userId → não há onde
//   contar de forma fiável; nesse caso só o rate-limit por IP os protege.
//   (As ferramentas que chamam isto exigem sessão para guardar dados na maioria
//    dos casos; para as anónimas, devolvemos ok=true e deixamos o rate-limit por IP.)
// - Pro/Institucional: ilimitado → ok=true sem tocar na BD.
export async function enforceDailyLimit(req: NextRequest, key: string): Promise<LimitResult> {
  const { userId, plan } = await getUserPlan(req)

  const limit = limitFor(plan, key)
  if (!isFinite(limit)) return { ok: true, userId, plan }       // Pro/clinic ou chave sem limite
  if (!userId) return { ok: true, userId, plan }                // anónimo → fica ao cargo do rate-limit por IP

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await sb.rpc('increment_usage', { p_user: userId, p_key: key })
    if (error) {
      // Se a tabela/RPC ainda não existir (migração por correr), NÃO bloquear o
      // utilizador — degradar com elegância e deixar passar.
      return { ok: true, userId, plan }
    }
    const used = Number(data) || 0
    if (used > limit) {
      return {
        ok: false, userId, plan,
        response: NextResponse.json({
          error: `Limite diário atingido (${limit}/dia no plano ${plan === 'free' ? 'Base' : plan === 'student' ? 'Plus' : plan}). Faz upgrade para continuar sem limites.`,
          limit_reached: true, daily_limit: limit, used, current_plan: plan,
          upgrade_required: true, upgrade_url: '/pricing',
        }, { status: 429 }),
      }
    }
    return { ok: true, userId, plan }
  } catch {
    return { ok: true, userId, plan }   // nunca bloquear por erro de infra
  }
}
