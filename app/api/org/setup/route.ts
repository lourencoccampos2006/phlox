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

// Adota os dados antigos do dono (org_id null) para a organização — resolve os
// "utentes fantasma" que apareciam só em algumas ferramentas. Tolerante a tabelas/
// colunas que não existam nesta BD.
async function backfillOrg(a: any, userId: string, orgId: string) {
  const TABLES = [
    'patients', 'care_records', 'mar_records', 'activities', 'activity_participations',
    'incidents', 'assessments', 'family_messages', 'family_thread_messages',
    'visit_requests', 'resident_contacts', 'vitals', 'wounds', 'patient_meds',
  ]
  for (const t of TABLES) {
    try { await a.from(t).update({ org_id: orgId }).eq('user_id', userId).is('org_id', null) } catch { /* tabela/coluna em falta → ignora */ }
  }
}

export async function GET(req: NextRequest) {
  if (!hasServiceKey()) return NextResponse.json({ org: null, noServiceKey: true })
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const a = admin()
  const { data: prof } = await a.from('profiles').select('active_org_id, org_id, org_role').eq('id', user.id).single()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ org: null })
  // tenta trazer os campos da página pública; se as colunas não existirem, recai no básico
  let org: any = null
  const full = await a.from('organizations').select('id, name, kind, slug, public, tagline, about, capacity, monthly_fee').eq('id', orgId).maybeSingle()
  if (full.error) { const basic = await a.from('organizations').select('id, name, kind').eq('id', orgId).maybeSingle(); org = basic.data }
  else org = full.data
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
    let { data: org, error } = await a.from('organizations').insert({ name, kind }).select('id').single()
    // Se o check do 'kind' ainda não inclui day_care (falta sprint94), cria com um
    // tipo aceite e avisa — para o utilizador nunca ficar bloqueado.
    if (error && /organizations_kind_check/.test(error.message)) {
      const retry = await a.from('organizations').insert({ name, kind: 'nursing_home' }).select('id').single()
      org = retry.data; error = retry.error
      if (org) {
        await a.from('org_members').upsert({ org_id: org.id, user_id: user.id, role: 'owner', active: true }, { onConflict: 'org_id,user_id' })
        await a.from('profiles').update({ org_id: org.id, active_org_id: org.id, org_role: 'owner', plan: 'clinic', experience_mode: 'clinical', institution_type: kind }).eq('id', user.id)
        await backfillOrg(a, user.id, org.id)
        return NextResponse.json({ ok: true, org_id: org.id, kind, kindConstraintOutdated: true })
      }
    }
    if (error || !org) return NextResponse.json({ error: error?.message || 'Falhou a criar a organização.' }, { status: 400 })
    orgId = org.id
    // garante o membro owner (o trigger SQL também o faz, mas o trigger usa
    // auth.uid() que aqui é o service-role — por isso inserimos explicitamente)
    await a.from('org_members').upsert({ org_id: orgId, user_id: user.id, role: 'owner', active: true }, { onConflict: 'org_id,user_id' })
  } else {
    const patch: any = { name, kind }
    // campos opcionais da página pública (só se vierem no body)
    if (typeof body.slug === 'string') patch.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || null
    if (typeof body.public === 'boolean') patch.public = body.public
    if (typeof body.tagline === 'string') patch.tagline = body.tagline.trim().slice(0, 160) || null
    if (typeof body.about === 'string') patch.about = body.about.trim().slice(0, 600) || null
    if (body.capacity !== undefined) patch.capacity = body.capacity ? Math.max(0, parseInt(body.capacity)) : null
    if (body.monthlyFee !== undefined) patch.monthly_fee = body.monthlyFee ? Math.max(0, parseFloat(body.monthlyFee)) : null
    const { error: upErr } = await a.from('organizations').update(patch).eq('id', orgId)
    if (upErr && /organizations_kind_check/.test(upErr.message)) {
      // check do kind desatualizado (falta sprint94): guarda tudo MENOS o kind
      const { kind: _drop, ...rest } = patch
      await a.from('organizations').update(rest).eq('id', orgId)
      await a.from('profiles').update({ org_id: orgId, active_org_id: orgId, org_role: 'owner', plan: 'clinic', experience_mode: 'clinical', institution_type: kind }).eq('id', user.id)
      await backfillOrg(a, user.id, orgId)
      return NextResponse.json({ ok: true, org_id: orgId, kind, kindConstraintOutdated: true })
    }
    if (upErr && /slug|public|tagline|about|capacity|monthly_fee/.test(upErr.message)) {
      // colunas da página pública ainda não existem (sprint93) → atualiza só nome/tipo
      const safe: any = { name }
      if (KINDS.includes(kind)) safe.kind = kind
      const { error: e2 } = await a.from('organizations').update(safe).eq('id', orgId)
      if (e2 && /organizations_kind_check/.test(e2.message)) await a.from('organizations').update({ name }).eq('id', orgId)
      return NextResponse.json({ ok: true, org_id: orgId, kind, publicColumnsMissing: true })
    }
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
  }

  await a.from('profiles').update({
    org_id: orgId, active_org_id: orgId, org_role: 'owner',
    plan: 'clinic', experience_mode: 'clinical', institution_type: kind,
  }).eq('id', user.id)

  // BACKFILL: utentes/registos criados ANTES de existir a organização ficaram com
  // org_id null → apareciam nuns sítios e noutros não. Ao criar/reclamar a org,
  // adotamos todos os dados do dono (org_id null → org_id) para ficar coerente.
  await backfillOrg(a, user.id, orgId)

  return NextResponse.json({ ok: true, org_id: orgId, kind })
}
