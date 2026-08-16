import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/adminAuth'

// POST /api/admin/institution-create { email, name, kind } — atalho para o
// Fernando criar a instituição diretamente, em vez de esperar que a pessoa
// passe por /comecar-instituicao ela própria. Mesma lógica essencial de
// app/api/org/setup (owner + plan clinic + backfill), simplificada (sem os
// campos opcionais da página pública — slug/tagline/about/etc., que o dono
// pode preencher depois em /painel-dono) e sem o bloqueio de
// institution_signup_approved, porque é o próprio admin a decidir.
// Idempotente: se a pessoa já é dona de uma org ativa, atualiza-a em vez de
// duplicar.

const KINDS = ['day_care', 'nursing_home'] as const

const BACKFILL_TABLES = [
  'patients', 'care_records', 'mar_records', 'activities', 'activity_participations',
  'incidents', 'assessments', 'family_messages', 'family_thread_messages',
  'visit_requests', 'resident_contacts', 'vitals', 'wounds', 'patient_meds',
]
async function backfillOrg(db: ReturnType<typeof adminDb>, userId: string, orgId: string) {
  for (const t of BACKFILL_TABLES) {
    try { await db.from(t).update({ org_id: orgId }).eq('user_id', userId).is('org_id', null) } catch { /* tabela/coluna em falta → ignora */ }
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  const name = String(body?.name || '').trim()
  const kind = (KINDS as readonly string[]).includes(body?.kind) ? body.kind : 'nursing_home'
  if (!email) return NextResponse.json({ error: 'Indica o email da pessoa.' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Indica o nome da instituição.' }, { status: 400 })

  const db = adminDb()
  const { data: target, error: findErr } = await db.from('profiles').select('id, email, active_org_id, org_id').ilike('email', email).maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'Não encontrei nenhuma conta com este email. A pessoa precisa de criar conta grátis primeiro.' }, { status: 404 })

  let orgId: string | null = target.active_org_id || target.org_id || null
  if (orgId) {
    const { data: membership } = await db.from('org_members').select('role').eq('org_id', orgId).eq('user_id', target.id).eq('active', true).maybeSingle()
    if (membership?.role !== 'owner') orgId = null
  }

  if (orgId) {
    const { error: upErr } = await db.from('organizations').update({ name, kind }).eq('id', orgId)
    if (upErr && !/organizations_kind_check/.test(upErr.message)) return NextResponse.json({ error: upErr.message }, { status: 500 })
  } else {
    let { data: org, error } = await db.from('organizations').insert({ name, kind }).select('id').single()
    // Fallback defensivo (mesmo padrão de app/api/org/setup): se o check do
    // 'kind' ainda não aceitar day_care, cria com nursing_home para nunca bloquear.
    if (error && /organizations_kind_check/.test(error.message)) {
      const retry = await db.from('organizations').insert({ name, kind: 'nursing_home' }).select('id').single()
      org = retry.data; error = retry.error
    }
    if (error || !org) return NextResponse.json({ error: error?.message || 'Falhou a criar a organização.' }, { status: 500 })
    orgId = org.id
  }

  const { error: memErr } = await db.from('org_members').upsert({ org_id: orgId, user_id: target.id, role: 'owner', active: true }, { onConflict: 'org_id,user_id' })
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  await db.from('profiles').update({
    org_id: orgId, active_org_id: orgId, org_role: 'owner',
    plan: 'clinic', experience_mode: 'clinical', institution_type: kind,
    institution_signup_approved: true,
  }).eq('id', target.id)

  await backfillOrg(db, target.id, orgId!)

  return NextResponse.json({ ok: true, org_id: orgId, kind })
}
