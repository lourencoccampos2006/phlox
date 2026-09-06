import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/adminAuth'

// GET /api/admin/ai-usage — visibilidade de custo de IA (item D17/sugestão 7 da
// auditoria 2026-07-17/21). Antes só 4 rotas Pro tinham contador agregado
// (lib/aiUsage.ts, ai_usage_log); as rotas gratuitas de maior volume (scan, ai,
// interações, visão) já eram contadas — só noutra tabela (usage_counters,
// sprint88, para aplicar limites diários), nunca somadas nem mostradas. Não
// bloqueia ninguém — é só visibilidade para o Fernando (só a conta admin lê isto).

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const db = adminDb()
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const dayStr = monthStart.toISOString().slice(0, 10)

  const [{ data: counters }, { data: proUsage }] = await Promise.all([
    db.from('usage_counters').select('tool_key, count, day').gte('day', dayStr),
    db.from('ai_usage_log').select('feature, created_at, provider, model, tokens_in, tokens_out, cost_usd, ok').gte('created_at', monthStart.toISOString()),
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

  // ── Custo real ───────────────────────────────────────────────────────────
  // Passou a haver: lib/ai.ts regista TODAS as chamadas com modelo e tokens,
  // e lib/aiCusto.ts sabe o preço de cada modelo. Antes isto era 0 € porque
  // só quatro rotas em 101 registavam alguma coisa.
  const porModelo: Record<string, { chamadas: number; usd: number; tokens: number; semPreco: boolean }> = {}
  let custoUsdTotal = 0, semPreco = 0, falhas = 0
  ;(proUsage || []).forEach((u: any) => {
    const m = u.model || 'desconhecido'
    porModelo[m] ||= { chamadas: 0, usd: 0, tokens: 0, semPreco: false }
    porModelo[m].chamadas++
    porModelo[m].tokens += (u.tokens_in || 0) + (u.tokens_out || 0)
    if (u.cost_usd == null) { porModelo[m].semPreco = true; semPreco++ }
    else { porModelo[m].usd += Number(u.cost_usd); custoUsdTotal += Number(u.cost_usd) }
    if (u.ok === false) falhas++
  })

  return NextResponse.json({
    month: dayStr.slice(0, 7),
    free_tier: freeTier, pro_tier: proTier, total_calls: totalCalls,
    custo: {
      usd: Number(custoUsdTotal.toFixed(4)),
      // Taxa fixa e assumida: isto é uma ordem de grandeza para decidir, não
      // contabilidade. O valor exato vem da fatura de cada fornecedor.
      eur: Number((custoUsdTotal * 0.92).toFixed(4)),
      chamadas: (proUsage || []).length,
      semPreco, falhas,
      porModelo: Object.entries(porModelo).sort((a, b) => b[1].usd - a[1].usd)
        .map(([modelo, v]) => ({ modelo, ...v, usd: Number(v.usd.toFixed(4)) })),
    },
  })
}
