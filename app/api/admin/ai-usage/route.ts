import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractToken } from '@/lib/planGate'

// GET /api/admin/ai-usage — visibilidade de custo de IA (item D17/sugestão 7 da
// auditoria 2026-07-17/21). Antes só 4 rotas Pro tinham contador agregado
// (lib/aiUsage.ts, ai_usage_log); as rotas gratuitas de maior volume (scan, ai,
// interações, visão) já eram contadas — só noutra tabela (usage_counters,
// sprint88, para aplicar limites diários), nunca somadas nem mostradas. Não
// bloqueia ninguém — é só visibilidade para o Fernando (só a conta admin lê isto).

const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']

export async function GET(req: NextRequest) {
  const token = extractToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: auth, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !auth?.user || !ADMIN_EMAILS.includes(auth.user.email || '')) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const dayStr = monthStart.toISOString().slice(0, 10)

  const [{ data: counters }, { data: proUsage }] = await Promise.all([
    db.from('usage_counters').select('tool_key, count, day').gte('day', dayStr),
    db.from('ai_usage_log').select('feature, created_at').gte('created_at', monthStart.toISOString()),
  ])

  // Ferramentas gratuitas/limitadas (usage_counters) — soma por tool_key este mês.
  const byTool: Record<string, number> = {}
  ;(counters || []).forEach((c: any) => { byTool[c.tool_key] = (byTool[c.tool_key] || 0) + (c.count || 0) })

  // Rotas Pro com orçamento próprio (ai_usage_log) — soma por feature este mês.
  const byFeature: Record<string, number> = {}
  ;(proUsage || []).forEach((u: any) => { byFeature[u.feature] = (byFeature[u.feature] || 0) + 1 })

  const freeTier = Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }))
  const proTier = Object.entries(byFeature).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }))
  const totalCalls = freeTier.reduce((s, x) => s + x.count, 0) + proTier.reduce((s, x) => s + x.count, 0)

  return NextResponse.json({ month: dayStr.slice(0, 7), free_tier: freeTier, pro_tier: proTier, total_calls: totalCalls })
}
