// app/api/pharmacy/suppliers/[id]/route.ts
// GET    → ficha do fornecedor com encomendas recentes
// PATCH  → actualizar
// DELETE → soft delete
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
  const { data: supplier, error } = await db.from('suppliers').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: orders } = await db.from('purchase_orders')
    .select('id, number, status, ordered_at, expected_at, received_at, total_amount, total_lines')
    .eq('supplier_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ supplier, orders: orders || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, any> | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const allowed: (keyof typeof body)[] = [
    'name','short_name','kind','vat_number','infarmed_code','edi_code',
    'contact_name','email','phone','address','postal_code','city',
    'payment_terms','discount_pct','lead_time_days','min_order_value','cutoff_time','notes',
  ]
  const update: Record<string, any> = {}
  for (const k of allowed) if (k in body) update[k as string] = body[k]
  const db = sb(req)
  const { data, error } = await db.from('suppliers').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ supplier: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { error } = await db.from('suppliers').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
