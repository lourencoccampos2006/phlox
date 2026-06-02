// app/api/lab/integrations/[id]/route.ts
// PATCH (ativar/desativar/renomear) · DELETE · POST rotate (regenera token)
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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  const updates: any = {}
  if (typeof body?.name === 'string') updates.name = body.name.slice(0, 80)
  if (typeof body?.active === 'boolean') updates.active = body.active
  if (typeof body?.notes === 'string') updates.notes = body.notes
  if (typeof body?.identifier_system === 'string') updates.identifier_system = body.identifier_system

  const db = sb(req)
  const { data, error } = await db.from('lab_integrations').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ integration: data })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const db = sb(req)
  const { error } = await db.from('lab_integrations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Rotate token
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const db = sb(req)
  const newToken = crypto.randomBytes(32).toString('base64url')
  const { data, error } = await db.from('lab_integrations').update({ webhook_token: newToken }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  return NextResponse.json({ integration: data, webhook_url: `${baseUrl}/api/lab/webhook/${newToken}` })
}
