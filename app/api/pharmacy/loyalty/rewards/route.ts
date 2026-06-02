// app/api/pharmacy/loyalty/rewards/route.ts
// GET  → catálogo de recompensas activas (filtrar por program_id)
// POST → cria recompensa (requer org.admin)
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

const NO_TABLE = (m: string) => /relation .*loyalty_rewards.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const programId = req.nextUrl.searchParams.get('program_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('loyalty_rewards').select('*').eq('org_id', orgId).eq('active', true).order('points_cost')
  if (programId) q = q.eq('program_id', programId)
  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ rewards: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rewards: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.program_id || !body.name || body.points_cost == null) {
    return NextResponse.json({ error: 'org_id, program_id, name e points_cost obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('loyalty_rewards').insert({
    org_id: body.org_id,
    program_id: body.program_id,
    name: body.name,
    description: body.description || null,
    points_cost: body.points_cost,
    stock: body.stock ?? null,
    image_url: body.image_url || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ reward: data })
}
