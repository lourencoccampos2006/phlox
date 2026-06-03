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
// "Could not find the 'X' column of 'organizations' in the schema cache"
const MISSING_COLUMN = (m: string) => /Could not find the '([^']+)' column/i.exec(m)?.[1]

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
    // Se faltar uma coluna no esquema antigo, recai numa selecção mais simples.
    if (MISSING_COLUMN(error.message)) {
      const { data: fallback, error: fbErr } = await db
        .from('org_members')
        .select('role, capabilities, department, organizations(id, name, kind)')
        .eq('user_id', userId)
        .eq('active', true)
      if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 })
      return NextResponse.json({ memberships: fallback || [] })
    }
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
  // Constrói o payload com todos os campos opcionais; se uma coluna não existir
  // (esquema antigo), repete a inserção apenas com os campos garantidos.
  const fullPayload: Record<string, any> = {
    name: String(body.name).slice(0, 120).trim(),
    short_name: body.short_name ? String(body.short_name).slice(0, 40).trim() : null,
    kind: body.kind,
    city: body.city ? String(body.city).slice(0, 80) : null,
    vat_number: body.vat_number ? String(body.vat_number).slice(0, 20) : null,
    accent_color: body.accent_color || '#0d6e42',
  }

  let { data, error } = await db.from('organizations').insert(fullPayload).select().single()

  // Retry sem colunas em falta (esquema antigo) — preserva sempre name+kind.
  let retries = 0
  while (error && retries < 5) {
    const missing = MISSING_COLUMN(error.message)
    if (!missing) break
    delete fullPayload[missing]
    retries++
    const r = await db.from('organizations').insert(fullPayload).select().single()
    data = r.data; error = r.error
  }

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ error: 'Aplicar sprint49_organizations.sql' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ org: data })
}
