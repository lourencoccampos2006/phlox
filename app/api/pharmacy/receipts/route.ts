// app/api/pharmacy/receipts/route.ts
// GET  → recepções (filtros: org_id, supplier_id, purchase_order_id)
// POST → cria nova recepção com linhas
//        (cada linha actualiza qty_received e estado do PO via trigger SQL)
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

const NO_TABLE = (m: string) => /relation .*goods_receipts.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const supplierId = req.nextUrl.searchParams.get('supplier_id')
  const poId = req.nextUrl.searchParams.get('purchase_order_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('goods_receipts')
    .select(`
      id, number, invoice_number, invoice_date, received_at, status,
      total_amount, total_lines, notes,
      supplier_id, purchase_order_id,
      supplier:supplier_id ( id, name ),
      po:purchase_order_id ( id, number )
    `)
    .eq('org_id', orgId)
    .order('received_at', { ascending: false })

  if (supplierId) q = q.eq('supplier_id', supplierId)
  if (poId) q = q.eq('purchase_order_id', poId)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ receipts: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ receipts: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    org_id?: string
    supplier_id?: string
    purchase_order_id?: string
    invoice_number?: string
    invoice_date?: string
    notes?: string
    items?: { product_name: string; qty: number; unit_price?: number; ean?: string; batch_number?: string; expiry_date?: string; purchase_order_item_id?: string }[]
  } | null
  if (!body?.org_id || !body.supplier_id) {
    return NextResponse.json({ error: 'org_id e supplier_id obrigatórios' }, { status: 400 })
  }

  const db = sb(req)
  const { data: receipt, error } = await db.from('goods_receipts').insert({
    org_id: body.org_id,
    supplier_id: body.supplier_id,
    purchase_order_id: body.purchase_order_id || null,
    invoice_number: body.invoice_number || null,
    invoice_date: body.invoice_date || null,
    notes: body.notes || null,
    received_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })

  if (body.items && body.items.length > 0) {
    const rows = body.items.map(it => ({
      goods_receipt_id: receipt.id,
      product_name: it.product_name,
      qty: it.qty,
      unit_price: it.unit_price ?? 0,
      ean: it.ean || null,
      batch_number: it.batch_number || null,
      expiry_date: it.expiry_date || null,
      purchase_order_item_id: it.purchase_order_item_id || null,
    }))
    const { error: itemsErr } = await db.from('goods_receipt_items').insert(rows)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message, receipt }, { status: 403 })
  }
  return NextResponse.json({ receipt })
}
