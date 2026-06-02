// app/api/orgs/route.ts
// GET    → orgs do utilizador autenticado
// POST   → cria nova org (utilizador vira owner pelo trigger SQL)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*organizations.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data, error } = await db
    .from('org_members')
    .select('role, capabilities, department, organizations(id, name, short_name, kind, accent_color, city)')
    .eq('user_id', userId)
    .eq('active', true)
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ memberships: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ memberships: data || [] })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 5, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.kind) {
    return NextResponse.json({ error: 'Nome e tipo obrigatórios' }, { status: 400 })
  }
  const KINDS = ['hospital','clinic','nursing_home','pharmacy_community','pharmacy_hospital','health_center','solo','other']
  if (!KINDS.includes(body.kind)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const db = sb(req)
  const { data, error } = await db.from('organizations').insert({
    name: String(body.name).slice(0, 120).trim(),
    short_name: body.short_name ? String(body.short_name).slice(0, 40).trim() : null,
    kind: body.kind,
    city: body.city ? String(body.city).slice(0, 80) : null,
    vat_number: body.vat_number ? String(body.vat_number).slice(0, 20) : null,
    accent_color: body.accent_color || '#0d6e42',
  }).select().single()
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ error: 'Aplicar sprint49_organizations.sql' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ org: data })
}
