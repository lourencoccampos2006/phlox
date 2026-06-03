// app/api/orgs/[id]/route.ts
// GET    → org + membros
// PATCH  → atualizar identidade (só admins)
// DELETE → desativar (só owner)
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const db = sb(req)

  const [orgRes, membersRes, invitesRes] = await Promise.all([
    db.from('organizations').select('*').eq('id', id).maybeSingle(),
    db.from('org_members').select('id, user_id, role, capabilities, department, active, joined_at').eq('org_id', id).order('joined_at', { ascending: true }),
    db.from('org_invites').select('id, email, role, department, expires_at, accepted_at, revoked, created_at, token').eq('org_id', id).order('created_at', { ascending: false }),
  ])
  if (orgRes.error || !orgRes.data) return NextResponse.json({ error: 'Org não encontrada' }, { status: 404 })

  return NextResponse.json({
    org: orgRes.data,
    members: membersRes.data || [],
    invites: invitesRes.data || [],
  })
}

const MISSING_COLUMN = (m: string) => /Could not find the '([^']+)' column/i.exec(m)?.[1]

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const updates: Record<string, any> = {}
  for (const k of ['name','short_name','vat_number','logo_url','accent_color','address','postal_code','city','phone','email','director']) {
    if (typeof body[k] === 'string') updates[k] = body[k]
  }
  if (body.total_beds === null || typeof body.total_beds === 'number') updates.total_beds = body.total_beds

  const db = sb(req)
  let { data, error } = await db.from('organizations').update(updates).eq('id', id).select().single()
  // Esquema antigo? Remove a coluna em falta e tenta de novo.
  let retries = 0
  while (error && retries < 5) {
    const missing = MISSING_COLUMN(error.message)
    if (!missing) break
    delete updates[missing]
    retries++
    const r = await db.from('organizations').update(updates).eq('id', id).select().single()
    data = r.data; error = r.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ org: data })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const db = sb(req)
  const { error } = await db.from('organizations').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
