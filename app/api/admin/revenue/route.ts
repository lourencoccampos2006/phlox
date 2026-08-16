import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export const runtime = 'nodejs'

// GET /api/admin/revenue — MRR real a partir das subscrições ATIVAS no Stripe
// (não uma estimativa por contagem de planos como o antigo mrr_estimate em
// /admin — esse continua a existir para quando o Stripe não está configurado).
// Normaliza subscrições anuais para o equivalente mensal. plan vem de
// subscription.metadata.plan, gravado por app/api/stripe/checkout — nunca do
// price_id, para não ter de manter dois mapeamentos.
interface SubRow { plan: string; interval: string; amount: number; quantity: number }

async function fetchAllActiveSubs(secretKey: string): Promise<SubRow[]> {
  const rows: SubRow[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ status: 'active', limit: '100' })
    params.append('expand[]', 'data.items.data.price')
    if (startingAfter) params.set('starting_after', startingAfter)
    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error?.message || 'Erro Stripe')
    for (const sub of j.data || []) {
      const plan = sub.metadata?.plan || 'desconhecido'
      for (const item of sub.items?.data || []) {
        const price = item.price
        if (!price) continue
        rows.push({
          plan, interval: price.recurring?.interval || 'month',
          amount: (price.unit_amount || 0) / 100, quantity: item.quantity || 1,
        })
      }
    }
    if (!j.has_more) break
    startingAfter = j.data?.[j.data.length - 1]?.id
    if (!startingAfter) break
  }
  return rows
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ configured: false, mrr_total: 0, by_plan: {}, subscriber_count: 0 })

  try {
    const rows = await fetchAllActiveSubs(secretKey)
    const byPlan: Record<string, { subscribers: number; mrr: number }> = {}
    let mrrTotal = 0
    for (const r of rows) {
      const monthly = r.interval === 'year' ? (r.amount * r.quantity) / 12 : r.amount * r.quantity
      byPlan[r.plan] = byPlan[r.plan] || { subscribers: 0, mrr: 0 }
      byPlan[r.plan].subscribers += 1
      byPlan[r.plan].mrr += monthly
      mrrTotal += monthly
    }
    return NextResponse.json({
      configured: true,
      mrr_total: Math.round(mrrTotal * 100) / 100,
      subscriber_count: rows.length,
      by_plan: byPlan,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao consultar o Stripe.' }, { status: 502 })
  }
}
