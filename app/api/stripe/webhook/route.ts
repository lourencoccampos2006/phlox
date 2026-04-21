import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase admin client (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role — NOT the anon key
)

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
  return computed === v1
}

export async function POST(req: NextRequest) {
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
    // Payment completed — upgrade user
    case 'checkout.session.completed': {
      const userId = obj.metadata?.user_id
      const plan = obj.metadata?.plan
      if (userId && plan) {
        await supabase.from('profiles').update({ plan }).eq('id', userId)
        console.log(`Upgraded user ${userId} to ${plan}`)
      }
      break
    }

    // Subscription active — ensure plan is set
    case 'customer.subscription.updated': {
      const userId = obj.metadata?.user_id
      const plan = obj.metadata?.plan
      const status = obj.status
      if (userId && plan && status === 'active') {
        await supabase.from('profiles').update({ plan }).eq('id', userId)
      }
      break
    }

    // Subscription cancelled — downgrade to free
    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.user_id
      if (userId) {
        await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId)
        console.log(`Downgraded user ${userId} to free`)
      }
      break
    }

    // Payment failed — notify (optional: send email)
    case 'invoice.payment_failed': {
      const userId = obj.subscription_details?.metadata?.user_id
      console.warn(`Payment failed for user ${userId}`)
      break
    }
  }

  return NextResponse.json({ received: true })
}

// Webhook endpoint — verificação de assinatura Stripe via Web Crypto API (compatível com Cloudflare Workers)