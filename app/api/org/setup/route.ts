// app/api/org/setup/route.ts
// Cria/garante a ORGANIZAÇÃO do utilizador (fase de acordos/testes, sem Stripe).
//
// POST { name, kind } → cria a org, torna o utilizador OWNER, liga o perfil
// (plan=clinic, active_org_id=org). Idempotente: se já é dono de uma org, devolve essa.
//
// GET → devolve a org ativa do utilizador (ou null) + o seu papel.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function hasServiceKey() { return !!process.env.SUPABASE_SERVICE_ROLE_KEY }
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
const NO_KEY = NextResponse.json(
  { error: 'A gestão de equipa precisa da variável SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings → Environment Variables). Sem ela não é possível criar acessos em segurança.' },
  { status: 503 }
)

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null
  const { data: { user } } = await admin().auth.getUser(token)
  return user || null
}

const KINDS = ['day_care', 'nursing_home', 'pharmacy_community', 'clinic', 'health_center']

export async function GET(req: NextRequest) {
  if (!hasServiceKey()) return NextResponse.json({ org: null, noServiceKey: true })
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const a = admin()
  const { data: prof } = await a.from('profiles').select('active_org_id, org_id, org_role').eq('id', user.id).single()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ org: null })
  const { data: org } = await a.from('organizations').select('id, name, kind').eq('id', orgId).maybeSingle()
  const { data: mem } = await a.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
  return NextResponse.json({ org: org || null, role: mem?.role || prof?.org_role || null })
}

export async function POST(req: NextRequest) {
  if (!hasServiceKey()) return NO_KEY
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const a = admin()
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const kind = KINDS.includes(body.kind) ? body.kind : 'day_care'
  if (!name) return NextResponse.json({ error: 'Indica o nome da instituição.' }, { status: 400 })

  // Já é dono de alguma org? Reusa (idempotente).
  const { data: existing } = await a.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('active', true).eq('role', 'owner').limit(1).maybeSingle()
  let orgId = existing?.org_id || null

  if (!orgId) {
    const { data: org, error } = await a.from('organizations').insert({ name, kind }).select('id').single()
    if (error || !org) return NextResponse.json({ error: error?.message || 'Falhou a criar a organização.' }, { status: 400 })
    orgId = org.id
    // garante o membro owner (o trigger SQL também o faz, mas o trigger usa
    // auth.uid() que aqui é o service-role — por isso inserimos explicitamente)
    await a.from('org_members').upsert({ org_id: orgId, user_id: user.id, role: 'owner', active: true }, { onConflict: 'org_id,user_id' })
  } else {
    await a.from('organizations').update({ name, kind }).eq('id', orgId)
  }

  await a.from('profiles').update({
    org_id: orgId, active_org_id: orgId, org_role: 'owner',
    plan: 'clinic', experience_mode: 'clinical', institution_type: kind,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true, org_id: orgId, kind })
}
