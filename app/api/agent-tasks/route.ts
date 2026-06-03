// app/api/agent-tasks/route.ts
// GET  → inbox de tarefas de agentes para a org (filtro: status, agent)
// POST → cria tarefa manualmente (geralmente cria-se por automação)
// PATCH → resolução (acknowledge/done/dismiss)
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

const NO_TABLE = (m: string) => /relation .*agent_tasks.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const status = req.nextUrl.searchParams.get('status')
  const agent = req.nextUrl.searchParams.get('agent')
  if (!orgId) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = sb(req)
  let q = db.from('agent_tasks')
    .select('*')
    .eq('org_id', orgId)
    .order('priority')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) q = q.eq('status', status)
  if (agent) q = q.eq('agent_name', agent)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ tasks: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ tasks: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.agent_name || !body.kind || !body.title) {
    return NextResponse.json({ error: 'org_id, agent_name, kind e title obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('agent_tasks').insert({
    org_id: body.org_id,
    agent_name: body.agent_name,
    kind: body.kind,
    title: body.title,
    reason: body.reason || null,
    payload: body.payload || {},
    priority: body.priority ?? 3,
    due_at: body.due_at || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ task: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    id?: string
    action?: 'acknowledge' | 'done' | 'dismiss'
    resolution?: string
  } | null
  if (!body?.id || !body.action) return NextResponse.json({ error: 'id e action obrigatórios' }, { status: 400 })
  const STATUS_MAP = { acknowledge: 'acknowledged', done: 'done', dismiss: 'dismissed' } as const
  const newStatus = STATUS_MAP[body.action]
  if (!newStatus) return NextResponse.json({ error: 'action inválido' }, { status: 400 })

  const db = sb(req)
  const update: Record<string, any> = { status: newStatus }
  if (body.action === 'done' || body.action === 'dismiss') {
    update.resolved_by = userId
    update.resolved_at = new Date().toISOString()
    if (body.resolution) update.resolution = body.resolution
  }
  const { data, error } = await db.from('agent_tasks').update(update).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ task: data })
}
