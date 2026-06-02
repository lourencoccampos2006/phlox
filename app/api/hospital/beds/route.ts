// app/api/hospital/beds/route.ts
// GET  → lista camas (filtra por ward_id ou org_id)
// POST → cria nova cama
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

const NO_TABLE = (m: string) => /relation .*beds.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const wardId = req.nextUrl.searchParams.get('ward_id')
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!wardId && !orgId) return NextResponse.json({ error: 'ward_id ou org_id obrigatório' }, { status: 400 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('beds').select(`
    id, label, bed_type, status, occupied_since, notes,
    ward_id, current_episode_id, current_patient_id,
    patient:current_patient_id ( id, name )
  `).eq('active', true).order('label')
  if (wardId) q = q.eq('ward_id', wardId)
  if (orgId)  q = q.eq('org_id', orgId)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ beds: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ beds: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { org_id?: string; ward_id?: string; label?: string; bed_type?: string } | null
  if (!body?.org_id || !body.ward_id || !body.label) {
    return NextResponse.json({ error: 'org_id, ward_id e label obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db
    .from('beds')
    .insert({
      org_id: body.org_id, ward_id: body.ward_id, label: body.label,
      bed_type: body.bed_type || 'standard',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ bed: data })
}
