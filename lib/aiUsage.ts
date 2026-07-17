// lib/aiUsage.ts
// Orçamento de custo de IA por utilizador (item D17 da auditoria 2026-07-17).
// aiJSON/aiComplete (lib/ai.ts) não têm acesso a userId — são chamadas de
// dezenas de rotas diferentes, cada uma já com o userId disponível — por isso
// o guard entra nas rotas Pro de maior custo (as que geram planos/relatórios
// por IA), não dentro do cliente de IA em si. Limites generosos: o objetivo é
// apanhar abuso/bug num loop, não incomodar uso real de ninguém.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const MONTHLY_CAP: Record<string, number> = { pro: 300, clinic: 1000 }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function checkAIBudget(userId: string, plan: string): Promise<{ ok: boolean; used: number; cap: number }> {
  const cap = MONTHLY_CAP[plan] ?? 50
  try {
    const since = new Date()
    since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
    const { count } = await db().from('ai_usage_log').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since.toISOString())
    return { ok: (count || 0) < cap, used: count || 0, cap }
  } catch {
    // Falha a verificar o orçamento não deve bloquear o utilizador — degrada a permitir.
    return { ok: true, used: 0, cap }
  }
}

export async function recordAIUsage(userId: string, feature: string): Promise<void> {
  try { await db().from('ai_usage_log').insert({ user_id: userId, feature }) } catch { /* best-effort */ }
}

export function aiBudgetResponse(used: number, cap: number) {
  return NextResponse.json(
    { error: `Atingiste o limite de ${cap} gerações por IA este mês (${used} usadas). O limite reinicia no início do próximo mês — contacta-nos se precisares de mais.` },
    { status: 429 },
  )
}
