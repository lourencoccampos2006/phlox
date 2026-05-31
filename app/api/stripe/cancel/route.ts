import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordAudit } from '@/lib/auditServer'

// Cancela a subscrição do utilizador no site (sem email). Por defeito, cancela no
// FIM do período pago (mantém o acesso até lá). `immediate: true` cancela já.
// Reativar: `resume: true` remove o cancelamento agendado.

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe não configurado.' }, { status: 503 })

  const sbUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await sbUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: profile } = await admin.from('profiles').select('stripe_subscription_id, stripe_customer_id').eq('id', user.id).maybeSingle()
  let subId = profile?.stripe_subscription_id

  // Sem ID guardado → tenta encontrar pela conta (por customer) no Stripe
  if (!subId && profile?.stripe_customer_id) {
    const r = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${profile.stripe_customer_id}&status=active&limit=1`, { headers: { Authorization: `Bearer ${stripeKey}` } })
    const j = await r.json().catch(() => ({}))
    subId = j?.data?.[0]?.id
  }
  if (!subId) return NextResponse.json({ error: 'Sem subscrição ativa encontrada.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  try {
    if (body?.resume) {
      // reativar: remover cancelamento agendado
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'cancel_at_period_end=false',
      })
      if (!r.ok) throw new Error((await r.json())?.error?.message || 'Falha ao reativar')
      await admin.from('profiles').update({ plan_status: 'active' }).eq('id', user.id)
      return NextResponse.json({ ok: true, resumed: true })
    }

    if (body?.immediate) {
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${stripeKey}` } })
      if (!r.ok) throw new Error((await r.json())?.error?.message || 'Falha ao cancelar')
      await admin.from('profiles').update({ plan: 'free', plan_status: 'canceled', stripe_subscription_id: null }).eq('id', user.id)
      return NextResponse.json({ ok: true, immediate: true })
    }

    // cancelar no fim do período (mantém acesso até à renovação)
    const r = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'cancel_at_period_end=true',
    })
    if (!r.ok) throw new Error((await r.json())?.error?.message || 'Falha ao agendar cancelamento')
    await admin.from('profiles').update({ plan_status: 'canceling' }).eq('id', user.id)
    recordAudit({ user_id: user.id, action: 'plan.changed', category: 'settings', detail: { type: 'cancel_at_period_end', sub: subId } }).catch(() => {})
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 502 })
  }
}
