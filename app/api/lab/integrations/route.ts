// app/api/lab/integrations/route.ts
// GET  → lista integrações da org ativa
// POST → cria nova integração (gera webhook_token)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const orgId = req.headers.get('x-org-id') || req.nextUrl.searchParams.get('org_id')
  const db = sb(req)
  let q = db.from('lab_integrations').select('*').order('created_at', { ascending: false })
  if (orgId) q = q.eq('org_id', orgId)
  const { data, error } = await q
  if (error) {
    if (/relation .*lab_integrations.* does not exist/i.test(error.message)) return NextResponse.json({ integrations: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ integrations: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.org_id) return NextResponse.json({ error: 'name e org_id obrigatórios' }, { status: 400 })

  const webhookToken = crypto.randomBytes(32).toString('base64url')
  const db = sb(req)
  const { data, error } = await db.from('lab_integrations').insert({
    org_id: body.org_id,
    name: String(body.name).slice(0, 80),
    kind: body.kind || 'lab',
    webhook_token: webhookToken,
    identifier_system: body.identifier_system || null,
    notes: body.notes || null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  return NextResponse.json({
    integration: data,
    webhook_url: `${baseUrl}/api/lab/webhook/${webhookToken}`,
  })
}
