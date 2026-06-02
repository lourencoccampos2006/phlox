// app/api/pharmacy/purchase-orders/route.ts
// GET  → encomendas (filtros: org_id, status, supplier_id)
// POST → cria nova encomenda (draft) com linhas opcionais
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

const NO_TABLE = (m: string) => /relation .*purchase_orders.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const status = req.nextUrl.searchParams.get('status')
  const supplierId = req.nextUrl.searchParams.get('supplier_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('purchase_orders')
    .select(`
      id, number, status, ordered_at, expected_at, received_at,
      total_qty, total_lines, total_amount, notes, created_at,
      supplier_id, supplier:supplier_id ( id, name, short_name )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  if (supplierId) q = q.eq('supplier_id', supplierId)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ orders: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ orders: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    org_id?: string
    supplier_id?: string
    expected_at?: string
    notes?: string
    items?: { product_name: string; qty: number; unit_price?: number; ean?: string; cnpem?: string; discount_pct?: number; vat_rate?: number; drug_id?: string }[]
  } | null
  if (!body?.org_id || !body.supplier_id) {
    return NextResponse.json({ error: 'org_id e supplier_id obrigatórios' }, { status: 400 })
  }

  const db = sb(req)
  const { data: order, error } = await db.from('purchase_orders').insert({
    org_id: body.org_id,
    supplier_id: body.supplier_id,
    expected_at: body.expected_at || null,
    notes: body.notes || null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })

  // Linhas (opcionais)
  if (body.items && body.items.length > 0) {
    const rows = body.items.map(it => ({
      purchase_order_id: order.id,
      product_name: it.product_name,
      qty: it.qty,
      unit_price: it.unit_price ?? 0,
      ean: it.ean || null,
      cnpem: it.cnpem || null,
      discount_pct: it.discount_pct ?? 0,
      vat_rate: it.vat_rate ?? 6,
      drug_id: it.drug_id || null,
    }))
    const { error: itemsErr } = await db.from('purchase_order_items').insert(rows)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message, order }, { status: 403 })
  }

  return NextResponse.json({ order })
}
