// app/api/automations/route.ts
// GET  → lista regras + runs recentes
// POST → cria nova regra
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

const NO_TABLE = (m: string) => /relation .*automations.* does not exist/i.test(m)

const VALID_TRIGGERS = ['cron', 'event', 'threshold', 'schedule']

const ACTION_KINDS = ['create_agent_task', 'send_notification', 'flag_record', 'send_email']

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  const { data: automations, error } = await db.from('automations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ automations: [], runs: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: runs } = await db.from('automation_runs')
    .select('id, automation_id, status, matched_count, error, duration_ms, started_at')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ automations: automations || [], runs: runs || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.name || !body.trigger_kind || !body.trigger_expr || !body.actions) {
    return NextResponse.json({ error: 'org_id, name, trigger_kind, trigger_expr e actions obrigatórios' }, { status: 400 })
  }
  if (!VALID_TRIGGERS.includes(body.trigger_kind)) {
    return NextResponse.json({ error: 'trigger_kind inválido' }, { status: 400 })
  }
  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return NextResponse.json({ error: 'actions deve ser array não vazio' }, { status: 400 })
  }
  for (const a of body.actions) {
    if (!ACTION_KINDS.includes(a.kind)) {
      return NextResponse.json({ error: `Tipo de acção inválido: ${a.kind}` }, { status: 400 })
    }
  }

  const db = sb(req)
  const { data, error } = await db.from('automations').insert({
    org_id: body.org_id,
    name: body.name,
    description: body.description || null,
    trigger_kind: body.trigger_kind,
    trigger_expr: body.trigger_expr,
    condition: body.condition || {},
    actions: body.actions,
    enabled: body.enabled !== false,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ automation: data })
}
