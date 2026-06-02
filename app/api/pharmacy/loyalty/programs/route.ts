// app/api/pharmacy/loyalty/programs/route.ts
// GET  → programas activos da org
// POST → cria programa (requer org.admin)
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

const NO_TABLE = (m: string) => /relation .*loyalty_programs.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  const { data, error } = await db.from('loyalty_programs')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('created_at')
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ programs: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ programs: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.name) return NextResponse.json({ error: 'org_id e name obrigatórios' }, { status: 400 })
  const db = sb(req)
  const { data, error } = await db.from('loyalty_programs').insert({
    org_id: body.org_id,
    name: body.name,
    description: body.description || null,
    points_per_euro: body.points_per_euro ?? 1,
    euro_per_point: body.euro_per_point ?? 0.01,
    min_redeem_pts: body.min_redeem_pts ?? 100,
    expiry_months: body.expiry_months ?? 12,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ program: data })
}
