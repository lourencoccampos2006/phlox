// PATCH role/capabilities/department/active de um membro.
// DELETE remove membership.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const ROLES = ['owner','admin','clinician','pharmacist','nurse','assistant','accountant','viewer','student','caregiver','self']

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; memberId: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { memberId } = await ctx.params
  const body = await req.json().catch(() => null)
  const updates: any = {}
  if (typeof body?.role === 'string' && ROLES.includes(body.role)) updates.role = body.role
  if (Array.isArray(body?.capabilities)) updates.capabilities = body.capabilities.map((c: any) => String(c).slice(0, 60))
  if (body?.capabilities === null) updates.capabilities = null
  if (typeof body?.department === 'string') updates.department = body.department
  if (typeof body?.active === 'boolean') updates.active = body.active

  const db = sb(req)
  const { data, error } = await db.from('org_members').update(updates).eq('id', memberId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; memberId: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { memberId } = await ctx.params
  const db = sb(req)
  const { error } = await db.from('org_members').delete().eq('id', memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
