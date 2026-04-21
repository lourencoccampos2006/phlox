import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { priceId, planKey, userId, email } = await req.json().catch(() => ({}))

  if (!priceId || !userId || !email) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe não configurado. Contacta hello@phlox.health' }, { status: 503 })
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        customer_email: email,
        'metadata[user_id]': userId,
        'metadata[plan]': planKey,
        'subscription_data[metadata][user_id]': userId,
        'subscription_data[metadata][plan]': planKey,
        success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=${planKey}`,
        cancel_url: `${BASE_URL}/checkout?plan=${planKey}`,
        allow_promotion_codes: 'true',
        'payment_method_types[0]': 'card',
        locale: 'pt',
      }).toString(),
    })

    const session = await res.json()
    if (!res.ok) throw new Error(session.error?.message || 'Erro Stripe')

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}