import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/adminAuth'

export const runtime = 'nodejs'

// GET /api/admin/costs — custos reais que dá para consultar por API (Twilio,
// via Usage Records) + custos fixos que o Fernando introduz à mão (hosting,
// Supabase, domínio — sem API de billing acessível daqui). Nunca inventa um
// número para IA/hosting/etc. — só mostra o que é mesmo verificável ou o que
// o próprio Fernando escreveu, claramente separado um do outro.
async function fetchTwilioSpend(): Promise<{ configured: boolean; spend_month: number; currency: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return { configured: false, spend_month: 0, currency: 'usd' }

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const end = now.toISOString().slice(0, 10)
  const params = new URLSearchParams({ StartDate: start, EndDate: end, PageSize: '1000' })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records.json?${params.toString()}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
  })
  const j = await res.json().catch(() => null)
  if (!res.ok || !j) return { configured: true, spend_month: 0, currency: 'usd' }
  let total = 0
  let currency = 'usd'
  for (const rec of j.usage_records || []) {
    total += Math.abs(parseFloat(rec.price || '0'))
    if (rec.price_unit) currency = rec.price_unit
  }
  return { configured: true, spend_month: Math.round(total * 100) / 100, currency }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const db = adminDb()
  const [twilio, fixedRes] = await Promise.all([
    fetchTwilioSpend().catch(() => ({ configured: false, spend_month: 0, currency: 'usd' })),
    db.from('platform_costs').select('id, label, amount_monthly, note').order('amount_monthly', { ascending: false })
      .then((r: any) => r, () => ({ data: [] as any[] })),
  ])
  const fixedCosts = fixedRes.data || []
  const fixedTotal = fixedCosts.reduce((s: number, c: any) => s + Number(c.amount_monthly || 0), 0)

  return NextResponse.json({
    twilio,
    fixed_costs: fixedCosts,
    fixed_total: Math.round(fixedTotal * 100) / 100,
    total_estimated: Math.round((fixedTotal + (twilio.configured ? twilio.spend_month : 0)) * 100) / 100,
  })
}

// POST — gerir custos fixos manuais. { action:'upsert', id?, label, amount_monthly, note }
// ou { action:'delete', id }.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const db = adminDb()

  if (body?.action === 'delete') {
    const id = String(body?.id || '')
    if (!id) return NextResponse.json({ error: 'Falta id.' }, { status: 400 })
    const { error } = await db.from('platform_costs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const label = String(body?.label || '').trim().slice(0, 120)
  const amount = Number(body?.amount_monthly)
  const note = body?.note ? String(body.note).trim().slice(0, 300) : null
  if (!label || !Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Indica um nome e um valor mensal válido.' }, { status: 400 })

  const row = { label, amount_monthly: amount, note, updated_at: new Date().toISOString() }
  const id = body?.id ? String(body.id) : undefined
  const { data, error } = id
    ? await db.from('platform_costs').update(row).eq('id', id).select().maybeSingle()
    : await db.from('platform_costs').insert(row).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cost: data })
}
