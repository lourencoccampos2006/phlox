import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

// Benchmarks anonimizados: compara métricas da instituição contra um POOL
// de instituições do mesmo tipo. Devolve apenas AGREGADOS (n, mediana,
// p25, p75, p90 e a minha posição) — nunca valores individuais.
// Privacidade: pool < 5 instituições → recusa (k-anonymity).

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * (p / 100)
  const lo = Math.floor(i), hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

const myPercentile = (xs: number[], v: number) => {
  if (xs.length === 0) return null
  const lower = xs.filter(x => x < v).length
  return Math.round((lower / xs.length) * 100)
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sb = admin()
  // tipo de instituição do utilizador
  const { data: prof } = await sb.from('profiles').select('institution_type').eq('id', userId).maybeSingle()
  const institutionType = prof?.institution_type
  if (!institutionType) return NextResponse.json({ error: 'institution_type não definido na tua conta' }, { status: 400 })

  // pool: utilizadores do mesmo tipo, ATIVOS, plano pro/clinic
  const { data: pool } = await sb.from('profiles').select('id').eq('institution_type', institutionType).in('plan', ['pro', 'clinic'])
  const poolIds: string[] = (pool || []).map((p: any) => p.id).filter((id: string) => id !== userId)

  if (poolIds.length < 5) {
    return NextResponse.json({
      institution_type: institutionType,
      pool_size: poolIds.length,
      blocked: 'Pool < 5 instituições. Benchmarks ativam-se quando houver pelo menos 5 pares.',
    })
  }

  // janela: últimos 30 dias
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  // ── métricas por utilizador (incluindo eu) ─────────────────────────────────
  async function metricsFor(uid: string) {
    const [salesRes, encRes, ptsRes, incRes] = await Promise.all([
      sb.from('sales').select('gross,discount,at').eq('user_id', uid).gte('at', since30),
      sb.from('encounters').select('at').eq('user_id', uid).gte('at', since30),
      sb.from('patients').select('id,active').eq('user_id', uid),
      sb.from('incidents').select('date').eq('user_id', uid).gte('date', since30.slice(0, 10)),
    ])
    const sales = salesRes.data || []
    const revenue = sales.reduce((a: number, s: any) => a + Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0)), 0)
    const txs = sales.length
    const avg_ticket = txs > 0 ? revenue / txs : 0
    const encounters = (encRes.data || []).length
    const active_patients = (ptsRes.data || []).filter((p: any) => p.active !== false).length
    const incidents = (incRes.data || []).length
    return { revenue_30d: revenue, transactions_30d: txs, avg_ticket, encounters_30d: encounters, active_patients, incidents_30d: incidents }
  }

  const meMetrics = await metricsFor(userId)
  const peers = await Promise.all(poolIds.slice(0, 200).map(metricsFor)) // cap em 200 pares para custo

  const KEYS: { key: keyof typeof meMetrics; label: string; unit: string; betterHigh: boolean }[] = [
    { key: 'revenue_30d', label: 'Receita (30 dias)', unit: '€', betterHigh: true },
    { key: 'transactions_30d', label: 'Movimentos (30 dias)', unit: '', betterHigh: true },
    { key: 'avg_ticket', label: 'Ticket médio', unit: '€', betterHigh: true },
    { key: 'encounters_30d', label: 'Atendimentos (30 dias)', unit: '', betterHigh: true },
    { key: 'active_patients', label: 'Utentes ativos', unit: '', betterHigh: true },
    { key: 'incidents_30d', label: 'Ocorrências (30 dias)', unit: '', betterHigh: false },
  ]

  const metrics = KEYS.map(k => {
    const xs = peers.map(p => p[k.key] as number).filter(v => isFinite(v))
    return {
      key: k.key, label: k.label, unit: k.unit, better_high: k.betterHigh,
      me: meMetrics[k.key],
      p25: percentile(xs, 25),
      median: percentile(xs, 50),
      p75: percentile(xs, 75),
      p90: percentile(xs, 90),
      my_percentile: myPercentile(xs, meMetrics[k.key] as number),
    }
  })

  return NextResponse.json({
    institution_type: institutionType,
    pool_size: peers.length,
    window: '30 days',
    metrics,
  })
}
