import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { priceId: priceKey, planKey, userId, email } = body

    if (!priceKey || !userId || !email) {
      return NextResponse.json({ error: 'Dados inválidos: faltam campos obrigatórios.' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY não está definida nas variáveis de ambiente do Cloudflare. Vai a Workers & Pages → Phlox → Settings → Variables e adiciona-a.'
      }, { status: 503 })
    }

    // Resolve price ID server-side
    const PRICE_MAP: Record<string, string | undefined> = {
      student_monthly: process.env.STRIPE_STUDENT_MONTHLY,
      student_annual:  process.env.STRIPE_STUDENT_ANNUAL,
      pro_monthly:     process.env.STRIPE_PRO_MONTHLY,
      pro_annual:      process.env.STRIPE_PRO_ANNUAL,
    }

    const priceId = PRICE_MAP[priceKey]
    if (!priceId) {
      return NextResponse.json({
        error: `Price ID não encontrado para "${priceKey}". Certifica-te que adicionaste STRIPE_STUDENT_MONTHLY e STRIPE_PRO_MONTHLY ao Cloudflare Variables (sem NEXT_PUBLIC_).`
      }, { status: 400 })
    }

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      customer_email: email,
      'metadata[user_id]': userId,
      'metadata[plan]': planKey,
      'subscription_data[metadata][user_id]': userId,
      'subscription_data[metadata][plan]': planKey,
      success_url: `${BASE_URL}/checkout/success?plan=${planKey}`,
      cancel_url: `${BASE_URL}/checkout?plan=${planKey}`,
      allow_promotion_codes: 'true',
      locale: 'pt',
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        error: `Erro Stripe: ${session.error?.message || JSON.stringify(session.error)}`
      }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    return NextResponse.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 })
  }
}