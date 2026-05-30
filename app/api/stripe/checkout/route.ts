import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    // Support both old (userId+email in body) and new (token-based) format
    const { priceId: priceKey, plan: planKey, billing } = body
    
    // Get user from token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    
    if (!priceKey) {
      return NextResponse.json({ error: 'Dados inválidos: priceId obrigatório.' }, { status: 400 })
    }
    
    // Get user info from Supabase
    let userId = body.userId
    let email = body.email
    if (!userId && token) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data: { user } } = await sb.auth.getUser()
      userId = user?.id
      email = user?.email
    }
    
    if (!userId || !email) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY não está definida. Vai ao Vercel Dashboard → Settings → Environment Variables e adiciona STRIPE_SECRET_KEY.'
      }, { status: 503 })
    }

    // Resolve price ID server-side
    const PRICE_MAP: Record<string, string | undefined> = {
      student_monthly: process.env.STRIPE_STUDENT_MONTHLY,
      student_annual:  process.env.STRIPE_STUDENT_ANNUAL,
      pro_monthly:     process.env.STRIPE_PRO_MONTHLY,
      pro_annual:      process.env.STRIPE_PRO_ANNUAL,
      clinic_monthly:  process.env.STRIPE_CLINIC_MONTHLY,
      clinic_annual:   process.env.STRIPE_CLINIC_ANNUAL,
    }

    const priceId = PRICE_MAP[priceKey]
    if (!priceId) {
      return NextResponse.json({
        error: `Price ID não encontrado para "${priceKey}". Certifica-te que adicionaste STRIPE_STUDENT_MONTHLY e STRIPE_PRO_MONTHLY ao Cloudflare Variables (sem NEXT_PUBLIC_).`
      }, { status: 400 })
    }

    // Detect base URL from request - works on Vercel, Cloudflare, any platform
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0,3).join('/') || process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-clinical.com'
    const BASE_URL = origin.replace(/\/$/, '')

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