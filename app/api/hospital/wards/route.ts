// app/api/hospital/wards/route.ts
// GET  → lista alas da org ativa (com ocupação)
// POST → cria nova ala (requer beds.write)
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

const NO_TABLE = (m: string) => /relation .*(wards|ward_occupancy).* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  const { data: wards, error } = await db
    .from('wards')
    .select('id, name, code, kind, floor, capacity, active')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('name')

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ wards: [], occupancy: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: occupancy } = await db
    .from('ward_occupancy')
    .select('ward_id, total_beds, occupied, free, cleaning, out_of_service, occupancy_pct')
    .eq('org_id', orgId)

  return NextResponse.json({ wards: wards || [], occupancy: occupancy || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { org_id?: string; name?: string; code?: string; kind?: string; floor?: string; capacity?: number } | null
  if (!body?.org_id || !body.name || !body.kind) {
    return NextResponse.json({ error: 'org_id, name e kind obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db
    .from('wards')
    .insert({
      org_id: body.org_id, name: body.name, code: body.code || null,
      kind: body.kind, floor: body.floor || null, capacity: body.capacity || 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ward: data })
}
