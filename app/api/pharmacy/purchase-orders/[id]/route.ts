// app/api/pharmacy/purchase-orders/[id]/route.ts
// GET   → detalhe + linhas
// PATCH → enviar (sent), cancelar, alterar notas/data prevista
// DELETE → apaga (só draft)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data: order, error } = await db.from('purchase_orders')
    .select(`*, supplier:supplier_id ( id, name, short_name, email, phone, payment_terms, lead_time_days )`)
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: items } = await db.from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', id)
    .order('created_at')

  return NextResponse.json({ order, items: items || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: 'send' | 'cancel' | 'update' | 'add_item' | 'remove_item' | 'update_item'
    expected_at?: string
    notes?: string
    item?: { id?: string; product_name?: string; qty?: number; unit_price?: number; ean?: string; cnpem?: string; discount_pct?: number; vat_rate?: number }
  } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const db = sb(req)

  if (body.action === 'add_item') {
    if (!body.item?.product_name || !body.item.qty) {
      return NextResponse.json({ error: 'product_name e qty obrigatórios' }, { status: 400 })
    }
    const { data, error } = await db.from('purchase_order_items').insert({
      purchase_order_id: id,
      product_name: body.item.product_name,
      qty: body.item.qty,
      unit_price: body.item.unit_price ?? 0,
      ean: body.item.ean || null,
      cnpem: body.item.cnpem || null,
      discount_pct: body.item.discount_pct ?? 0,
      vat_rate: body.item.vat_rate ?? 6,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ item: data })
  }

  if (body.action === 'remove_item') {
    if (!body.item?.id) return NextResponse.json({ error: 'item.id obrigatório' }, { status: 400 })
    const { error } = await db.from('purchase_order_items').delete().eq('id', body.item.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update_item') {
    if (!body.item?.id) return NextResponse.json({ error: 'item.id obrigatório' }, { status: 400 })
    const u: Record<string, any> = {}
    for (const k of ['product_name','qty','unit_price','ean','cnpem','discount_pct','vat_rate'] as const) {
      if (body.item[k] !== undefined) u[k] = body.item[k]
    }
    const { data, error } = await db.from('purchase_order_items').update(u).eq('id', body.item.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ item: data })
  }

  const update: Record<string, any> = {}
  if (body.action === 'send') {
    update.status = 'sent'
    update.ordered_at = new Date().toISOString()
  } else if (body.action === 'cancel') {
    update.status = 'cancelled'
  } else if (body.action === 'update') {
    if (body.expected_at) update.expected_at = body.expected_at
    if (typeof body.notes === 'string') update.notes = body.notes
  } else {
    return NextResponse.json({ error: 'action inválido' }, { status: 400 })
  }
  const { data, error } = await db.from('purchase_orders').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ order: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  // Só apaga drafts
  const { error } = await db.from('purchase_orders').delete().eq('id', id).eq('status', 'draft')
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
