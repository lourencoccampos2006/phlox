// app/api/pharmacy/suppliers/route.ts
// GET  → lista fornecedores da org (com KPIs opcionais)
// POST → cria novo fornecedor
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

const NO_TABLE = (m: string) => /relation .*(suppliers|supplier_kpis).* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const withKpis = req.nextUrl.searchParams.get('with_kpis') === '1'
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  const { data: suppliers, error } = await db
    .from('suppliers')
    .select('id, name, short_name, kind, vat_number, infarmed_code, edi_code, contact_name, email, phone, payment_terms, discount_pct, lead_time_days, min_order_value, cutoff_time, active, city')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('name')

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ suppliers: [], kpis: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let kpis: any[] = []
  if (withKpis) {
    const { data } = await db.from('supplier_kpis').select('*').eq('org_id', orgId)
    kpis = data || []
  }
  return NextResponse.json({ suppliers: suppliers || [], kpis })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.name) {
    return NextResponse.json({ error: 'org_id e name obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('suppliers').insert({
    org_id: body.org_id,
    name: body.name,
    short_name: body.short_name || null,
    kind: body.kind || 'wholesaler',
    vat_number: body.vat_number || null,
    infarmed_code: body.infarmed_code || null,
    edi_code: body.edi_code || null,
    contact_name: body.contact_name || null,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    postal_code: body.postal_code || null,
    city: body.city || null,
    payment_terms: body.payment_terms || null,
    discount_pct: body.discount_pct ?? 0,
    lead_time_days: body.lead_time_days ?? 1,
    min_order_value: body.min_order_value ?? null,
    cutoff_time: body.cutoff_time || null,
    notes: body.notes || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ supplier: data })
}
