import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { makeMBReference, validPhonePT } from '@/lib/payments'

// Inicia um pagamento para uma venda. Conforme o provedor configurado:
//   • mb_referencia → gera Entidade+Referência+Montante (algoritmo 991), localmente
//   • mbway / sibs / easypay → cria pedido via gateway (precisa de api_key)
//   • manual → apenas marca o método
// Atualiza pay_provider/pay_ref/pay_entity/pay_status na venda. Server-side (chaves).

function authClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 60, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const saleId: string | undefined = body?.saleId
  const phone: string = (body?.phone || '').replace(/\s/g, '')
  if (!saleId) return NextResponse.json({ error: 'saleId em falta' }, { status: 400 })

  const sb = authClient(req)
  const { data: sale } = await sb.from('sales').select('*').eq('id', saleId).eq('user_id', userId).maybeSingle()
  if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  const amount = Math.max(0, (Number(sale.gross) || 0) - (Number(sale.discount) || 0))

  const { data: cfg } = await sb.from('payment_settings').select('*').eq('user_id', userId).maybeSingle()
  const provider = body?.provider || cfg?.provider || 'manual'

  let patch: any = { pay_provider: provider }

  try {
    if (provider === 'mb_referencia' || (provider === 'sibs' && !cfg?.api_key)) {
      if (!cfg?.entity) return NextResponse.json({ error: 'Configura a Entidade Multibanco em Pagamentos.', needsSetup: true }, { status: 409 })
      const seq = (sale.seq || Math.floor(Math.random() * 9_000_000) + 1)
      const ref = makeMBReference(cfg.entity, seq, amount)
      patch = { ...patch, pay_provider: 'mb_referencia', pay_entity: ref.entity, pay_ref: ref.reference, pay_status: 'pendente' }
      await sb.from('sales').update(patch).eq('id', saleId).eq('user_id', userId)
      return NextResponse.json({ ok: true, provider: 'mb_referencia', entity: ref.entity, reference: ref.reference, amount: ref.amount, demo: !cfg.api_key })
    }

    if (provider === 'mbway') {
      if (!validPhonePT(phone)) return NextResponse.json({ error: 'Número de telemóvel inválido.' }, { status: 400 })
      if (!cfg?.api_key) {
        // Sem gateway: regista a intenção (pagamento confirmado manualmente no app MB WAY)
        patch = { ...patch, mbway_phone: phone, pay_status: 'pendente', pay_ref: `MBWAY-${Date.now().toString().slice(-8)}` }
        await sb.from('sales').update(patch).eq('id', saleId).eq('user_id', userId)
        return NextResponse.json({ ok: true, provider: 'mbway', phone, pending: true, manual: true, ref: patch.pay_ref })
      }
      // Com gateway Easypay (exemplo de conector real)
      if (cfg.provider === 'easypay') {
        const r = await fetch('https://api.prod.easypay.pt/2.0/single', {
          method: 'POST', headers: { 'Content-Type': 'application/json', AccountId: cfg.sub_entity || '', ApiKey: cfg.api_key },
          body: JSON.stringify({ type: 'sale', method: 'mbw', value: Number(amount.toFixed(2)), customer: { phone, key: phone }, key: saleId }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.message || `Easypay ${r.status}`)
        patch = { ...patch, mbway_phone: phone, pay_status: 'pendente', pay_ref: String(j?.id || '') }
        await sb.from('sales').update(patch).eq('id', saleId).eq('user_id', userId)
        return NextResponse.json({ ok: true, provider: 'easypay', phone, ref: patch.pay_ref })
      }
      return NextResponse.json({ error: 'Gateway MB WAY não suportado para este provedor.' }, { status: 400 })
    }

    // manual / outros → só regista o método
    patch.pay_status = 'pago'
    await sb.from('sales').update(patch).eq('id', saleId).eq('user_id', userId)
    return NextResponse.json({ ok: true, provider, manual: true })
  } catch (e: any) {
    return NextResponse.json({ error: `Falha no pagamento: ${String(e?.message || e).slice(0, 200)}` }, { status: 502 })
  }
}
