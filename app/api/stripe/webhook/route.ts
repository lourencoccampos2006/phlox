import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, planUpgradedEmail, paymentFailedEmail } from '@/lib/email'
import { planName } from '@/lib/plans'
import { timingSafeEqualHex } from '@/lib/signDoc'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  // Stripe uses HMAC-SHA256 to sign webhooks
  const encoder = new TextEncoder()
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!timestamp || !v1) return false

  const signedPayload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqualHex(computed, v1)
}

// Marca a redemption pendente (se existir) como upgrade e dá +1 mês de Pro ao
// referrer, empilhando com bónus ainda ativo. Best-effort: nunca falha o
// webhook nem bloqueia o upgrade do próprio pagador.
async function grantReachReward(invoiceeUserId: string) {
  try {
    const db = getSupabase()
    const { data: redemption } = await db.from('invite_redemptions')
      .select('id, referrer_id').eq('invitee_id', invoiceeUserId).eq('upgraded', false).maybeSingle()
    if (!redemption) return
    await db.from('invite_redemptions').update({ upgraded: true, upgraded_at: new Date().toISOString(), reward_status: 'granted' }).eq('id', redemption.id)

    const { data: referrer } = await db.from('profiles').select('reach_bonus_until').eq('id', redemption.referrer_id).maybeSingle()
    const base = referrer?.reach_bonus_until && new Date(referrer.reach_bonus_until).getTime() > Date.now()
      ? new Date(referrer.reach_bonus_until) : new Date()
    base.setMonth(base.getMonth() + 1)
    await db.from('profiles').update({ reach_bonus_until: base.toISOString(), reach_bonus_plan: 'pro' }).eq('id', redemption.referrer_id)
  } catch (e) {
    console.error('[phlox:reach-reward] falhou:', (e as any)?.message || e)
  }
}

export async function POST(req: NextRequest) {
  // Sem a service-role key, um fallback para a chave anon deixaria estas
  // atualizações de plano falhar por RLS de forma confusa (ou, pior, correr
  // sob permissões mais fracas sem avisar). Falha alto e claro em vez disso.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set — refusing to process Stripe webhook')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const valid = await verifyStripeSignature(body, signature, webhookSecret)
  if (!valid) {
    console.error('Invalid Stripe signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: any
  try { event = JSON.parse(body) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const obj = event.data?.object

  switch (event.type) {
    // Payment completed — upgrade user + store Stripe IDs (para cancelar no site)
    case 'checkout.session.completed': {
      const userId = obj.metadata?.user_id
      const plan = obj.metadata?.plan
      if (userId && plan) {
        const { error } = await getSupabase().from('profiles').update({
          plan,
          stripe_customer_id: obj.customer || null,
          stripe_subscription_id: obj.subscription || null,
          plan_status: 'active',
        }).eq('id', userId)
        if (error) {
          console.error(`Failed to upgrade user ${userId} to ${plan}:`, error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        console.log(`Upgraded user ${userId} to ${plan}`)
        // Email de confirmação (best-effort)
        const email = obj.customer_details?.email || obj.customer_email
        if (email) {
          const t = planUpgradedEmail(planName(plan))
          sendEmail({ to: email, subject: t.subject, html: t.html }).catch(() => {})
        }
        // Phlox Reach: se esta conta foi convidada por alguém e ainda não
        // tinha sido marcada como upgrade, concede a recompensa ao referrer
        // agora que pagou. BUG CORRIGIDO 2026-07-28: a redemption na
        // inscrição já funcionava, mas nada marcava upgraded=true nem dava
        // o mês grátis — /reach mostrava sempre "0 amigos a fazer upgrade".
        await grantReachReward(userId)
      }
      break
    }

    // Subscription active/updated — ensure plan + renewal + (un)cancel state
    case 'customer.subscription.updated': {
      const userId = obj.metadata?.user_id
      const plan = obj.metadata?.plan
      const status = obj.status
      if (userId) {
        const patch: any = {
          stripe_subscription_id: obj.id,
          plan_status: obj.cancel_at_period_end ? 'canceling' : (status === 'active' ? 'active' : status),
          plan_renews_at: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        }
        if (plan && status === 'active' && !obj.cancel_at_period_end) patch.plan = plan
        const { error } = await getSupabase().from('profiles').update(patch).eq('id', userId)
        if (error) {
          console.error(`Failed to update subscription for user ${userId}:`, error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
      }
      break
    }

    // Subscription cancelled — downgrade to free
    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.user_id
      if (userId) {
        const { error } = await getSupabase().from('profiles').update({ plan: 'free', plan_status: 'canceled', stripe_subscription_id: null }).eq('id', userId)
        if (error) {
          console.error(`Failed to downgrade user ${userId} to free:`, error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        console.log(`Downgraded user ${userId} to free`)
      }
      break
    }

    // Payment failed — notify (optional: send email)
    case 'invoice.payment_failed': {
      const userId = obj.subscription_details?.metadata?.user_id
      console.warn(`Payment failed for user ${userId}`)
      const email = obj.customer_email
      if (email) {
        const t = paymentFailedEmail()
        sendEmail({ to: email, subject: t.subject, html: t.html }).catch(() => {})
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

// Webhook endpoint — verificação de assinatura Stripe via Web Crypto API (compatível com Cloudflare Workers)