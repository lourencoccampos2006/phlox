import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    const { priceId: priceKey } = body

    // Get user from token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!priceKey) {
      return NextResponse.json({ error: 'Dados inválidos: priceId obrigatório.' }, { status: 400 })
    }

    // SEGURANÇA: userId/email vêm SEMPRE do token validado, nunca do corpo do
    // pedido. Aceitar body.userId/body.email como identidade permitia a
    // qualquer pessoa (sem sessão nenhuma) associar a SUA compra Stripe à
    // conta de outra pessoa à escolha (bastava enviar o uuid dela) — o
    // webhook confia nesse user_id para atualizar o plano de quem quer que
    // seja essa conta.
    if (!token) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    const userId = user.id
    const email = user.email
    if (!userId || !email) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY não está definida. Vai ao Vercel Dashboard → Settings → Environment Variables e adiciona STRIPE_SECRET_KEY.'
      }, { status: 503 })
    }

    // Resolve price ID server-side. O PLANO também vem SÓ daqui (nunca do body)
    // — BUG DE SEGURANÇA CORRIGIDO 2026-07-28: metadata[plan] usava
    // body.plan diretamente, sem cruzar com o priceId escolhido. Isso deixava
    // pagar o preço mais barato (ex: student_monthly) e pedir metadata.plan=
    // 'clinic' no corpo do pedido — o webhook confia cegamente nesse campo
    // para dar o plano (ver app/api/stripe/webhook/route.ts), por isso
    // qualquer pessoa conseguia o plano Institucional (€149/mês) pagando o
    // preço de estudante. O body.plan deixou de ser lido — o plano guardado
    // é sempre o que corresponde ao priceId validado nesta tabela.
    const PRICE_MAP: Record<string, { priceId: string | undefined; plan: string }> = {
      student_monthly: { priceId: process.env.STRIPE_STUDENT_MONTHLY, plan: 'student' },
      student_annual:  { priceId: process.env.STRIPE_STUDENT_ANNUAL,  plan: 'student' },
      pro_monthly:     { priceId: process.env.STRIPE_PRO_MONTHLY,     plan: 'pro' },
      pro_annual:      { priceId: process.env.STRIPE_PRO_ANNUAL,      plan: 'pro' },
      clinic_monthly:  { priceId: process.env.STRIPE_CLINIC_MONTHLY,  plan: 'clinic' },
      clinic_annual:   { priceId: process.env.STRIPE_CLINIC_ANNUAL,   plan: 'clinic' },
    }

    const priceEntry = PRICE_MAP[priceKey]
    const priceId = priceEntry?.priceId
    const trustedPlan = priceEntry?.plan
    if (!priceId || !trustedPlan) {
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
      'metadata[plan]': trustedPlan,
      'subscription_data[metadata][user_id]': userId,
      'subscription_data[metadata][plan]': trustedPlan,
      success_url: `${BASE_URL}/checkout/success?plan=${trustedPlan}`,
      cancel_url: `${BASE_URL}/checkout?plan=${trustedPlan}`,
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