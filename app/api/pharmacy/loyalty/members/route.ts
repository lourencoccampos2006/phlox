// app/api/pharmacy/loyalty/members/route.ts
// GET  → lista membros (search por nome, cartão, telefone)
// POST → inscreve novo membro
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

const NO_TABLE = (m: string) => /relation .*loyalty_members.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const search = req.nextUrl.searchParams.get('q')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('loyalty_members')
    .select('id, card_number, name, phone, email, points_balance, total_earned, total_redeemed, total_spent, last_visit_at, joined_at')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (search) {
    q = q.or(`name.ilike.%${search}%,card_number.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ members: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ members: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.program_id || !body.name) {
    return NextResponse.json({ error: 'org_id, program_id e name obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('loyalty_members').insert({
    org_id: body.org_id,
    program_id: body.program_id,
    card_number: body.card_number || null,
    name: body.name,
    phone: body.phone || null,
    email: body.email || null,
    birth_date: body.birth_date || null,
    vat_number: body.vat_number || null,
    consent_marketing: !!body.consent_marketing,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ member: data })
}
