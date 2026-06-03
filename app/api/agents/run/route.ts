// app/api/agents/run/route.ts
// Endpoint para correr agentes autónomos da org. Pode ser invocado por:
//   1) Cron externo (Cloudflare scheduled trigger)
//   2) Manualmente do painel /automacoes
//
// Cada agente analisa um sub-domínio e propõe `agent_tasks` (humano valida).
// Os agentes nunca tomam acções irreversíveis sem aprovação.

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

const AGENTS = ['stock-watch', 'triage-helper', 'rounds-flag', 'expiry-watch']

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { org_id?: string; agent?: string } | null
  if (!body?.org_id) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })

  const db = sb(req)
  const orgId = body.org_id
  const agent = body.agent || 'all'
  const targets = agent === 'all' ? AGENTS : [agent]

  const created: { agent: string; count: number; tasks: any[] }[] = []

  for (const a of targets) {
    try {
      if (a === 'stock-watch') {
        const tasks = await stockWatch(db, orgId)
        created.push({ agent: a, count: tasks.length, tasks })
      } else if (a === 'expiry-watch') {
        const tasks = await expiryWatch(db, orgId)
        created.push({ agent: a, count: tasks.length, tasks })
      } else if (a === 'triage-helper') {
        const tasks = await triageHelper(db, orgId)
        created.push({ agent: a, count: tasks.length, tasks })
      } else if (a === 'rounds-flag') {
        const tasks = await roundsFlag(db, orgId)
        created.push({ agent: a, count: tasks.length, tasks })
      }
    } catch (e: any) {
      created.push({ agent: a, count: 0, tasks: [] })
    }
  }

  return NextResponse.json({ agents: created })
}

// ─── stock-watch: encomenda quando stock < min_quantity ──────────────────
async function stockWatch(db: any, orgId: string) {
  const { data: items } = await db.from('stock_items')
    .select('id, name, quantity, min_quantity')
    .gt('min_quantity', 0)
    .lte('quantity', 0)
  const out: any[] = []
  for (const it of (items || [])) {
    if (Number(it.quantity) >= Number(it.min_quantity)) continue
    const { data: existing } = await db.from('agent_tasks')
      .select('id').eq('org_id', orgId).eq('agent_name', 'stock-watch').eq('kind', 'reorder')
      .contains('payload', { item_id: it.id }).eq('status', 'open').maybeSingle()
    if (existing) continue
    const { data: task } = await db.from('agent_tasks').insert({
      org_id: orgId, agent_name: 'stock-watch', kind: 'reorder',
      title: `Repor ${it.name}`,
      reason: `Stock actual ${it.quantity} ≤ mínimo ${it.min_quantity}.`,
      payload: { item_id: it.id, item_name: it.name, current_qty: it.quantity, min_qty: it.min_quantity },
      priority: 3,
    }).select().single()
    if (task) out.push(task)
  }
  return out
}

// ─── expiry-watch: alertas de validade < 30 dias ─────────────────────────
async function expiryWatch(db: any, orgId: string) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: items } = await db.from('stock_items')
    .select('id, name, expiry_date, quantity')
    .gte('expiry_date', todayStr)
    .lte('expiry_date', cutoffStr)
    .gt('quantity', 0)
  const out: any[] = []
  for (const it of (items || [])) {
    const { data: existing } = await db.from('agent_tasks')
      .select('id').eq('org_id', orgId).eq('agent_name', 'expiry-watch').eq('kind', 'expiring')
      .contains('payload', { item_id: it.id }).eq('status', 'open').maybeSingle()
    if (existing) continue
    const daysLeft = Math.ceil((new Date(it.expiry_date).getTime() - Date.now()) / 86400000)
    const { data: task } = await db.from('agent_tasks').insert({
      org_id: orgId, agent_name: 'expiry-watch', kind: 'expiring',
      title: `${it.name} expira em ${daysLeft} dias`,
      reason: `Validade ${it.expiry_date}. Quantidade ${it.quantity}.`,
      payload: { item_id: it.id, item_name: it.name, expiry_date: it.expiry_date, qty: it.quantity },
      priority: daysLeft <= 7 ? 2 : 3,
    }).select().single()
    if (task) out.push(task)
  }
  return out
}

// ─── triage-helper: doentes em triagem há mais que o target sem visto ────
async function triageHelper(db: any, orgId: string) {
  const { data: pending } = await db.from('triage_assessments')
    .select('id, priority, reason, target_minutes, created_at, patient_id, patient:patient_id ( name )')
    .eq('org_id', orgId).is('seen_at', null)
  const out: any[] = []
  const now = Date.now()
  for (const t of (pending || []) as any[]) {
    const waitMin = (now - new Date(t.created_at).getTime()) / 60000
    if (waitMin <= t.target_minutes) continue
    const { data: existing } = await db.from('agent_tasks')
      .select('id').eq('org_id', orgId).eq('agent_name', 'triage-helper').eq('kind', 'overdue')
      .contains('payload', { triage_id: t.id }).eq('status', 'open').maybeSingle()
    if (existing) continue
    const { data: task } = await db.from('agent_tasks').insert({
      org_id: orgId, agent_name: 'triage-helper', kind: 'overdue',
      title: `Tempo de triagem excedido (${t.patient?.name || 'doente'})`,
      reason: `Prioridade ${t.priority} aguarda há ${Math.round(waitMin)}min (alvo ${t.target_minutes}min). Motivo: ${t.reason}`,
      payload: { triage_id: t.id, patient_id: t.patient_id, wait_min: Math.round(waitMin), priority: t.priority },
      priority: t.priority,
    }).select().single()
    if (task) out.push(task)
  }
  return out
}

// ─── rounds-flag: polimedicação ≥ 8 fármacos não revisto há > 14 dias ────
async function roundsFlag(db: any, orgId: string) {
  // Heurística simples — sem ML. Conta meds por doente activo.
  const { data: patients } = await db.from('patients')
    .select('id, name, last_review, patient_meds(count)')
    .limit(500)
  const out: any[] = []
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14)
  for (const p of (patients || []) as any[]) {
    const medCount = p.patient_meds?.[0]?.count || 0
    if (medCount < 8) continue
    if (p.last_review && new Date(p.last_review) > cutoff) continue
    const { data: existing } = await db.from('agent_tasks')
      .select('id').eq('org_id', orgId).eq('agent_name', 'rounds-flag').eq('kind', 'polypharmacy_review')
      .contains('payload', { patient_id: p.id }).eq('status', 'open').maybeSingle()
    if (existing) continue
    const { data: task } = await db.from('agent_tasks').insert({
      org_id: orgId, agent_name: 'rounds-flag', kind: 'polypharmacy_review',
      title: `Rever ${p.name} — ${medCount} medicamentos`,
      reason: `Polimedicação (≥8 fármacos) sem revisão há mais de 14 dias.`,
      payload: { patient_id: p.id, patient_name: p.name, med_count: medCount, last_review: p.last_review },
      priority: 3,
    }).select().single()
    if (task) out.push(task)
  }
  return out
}
