// app/api/crm/contacts/route.ts
// GET  → lista contactos (filtros: org_id, stage, q, owner)
// POST → cria contacto
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

const NO_TABLE = (m: string) => /relation .*crm_contacts.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const stage = req.nextUrl.searchParams.get('stage')
  const q = req.nextUrl.searchParams.get('q')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let qb = db.from('crm_contacts')
    .select('id, name, email, phone, company, kind, stage, value_eur, expected_close, tags, source, owner_user_id, last_contact_at, next_followup_at, created_at')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (stage) qb = qb.eq('stage', stage)
  if (q) qb = qb.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)

  const { data, error } = await qb
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ contacts: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: pipeline } = await db.from('crm_pipeline').select('*').eq('org_id', orgId)
  return NextResponse.json({ contacts: data || [], pipeline: pipeline || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.name) return NextResponse.json({ error: 'org_id e name obrigatórios' }, { status: 400 })

  const db = sb(req)
  const { data, error } = await db.from('crm_contacts').insert({
    org_id: body.org_id,
    kind: body.kind || 'lead',
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    company: body.company || null,
    job_title: body.job_title || null,
    vat_number: body.vat_number || null,
    city: body.city || null,
    source: body.source || null,
    stage: body.stage || 'new',
    value_eur: body.value_eur || null,
    expected_close: body.expected_close || null,
    tags: body.tags || null,
    notes: body.notes || null,
    consent_marketing: !!body.consent_marketing,
    consent_data_share: !!body.consent_data_share,
    owner_user_id: body.owner_user_id || userId,
    next_followup_at: body.next_followup_at || null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ contact: data })
}
