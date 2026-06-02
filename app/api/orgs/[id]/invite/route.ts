// app/api/orgs/[id]/invite/route.ts
// Cria convite para um email; gera token; devolve link aceitar.
// (Envio de email a cargo de integração futura — Resend/Postmark.)
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

const ROLES = ['admin','clinician','pharmacist','nurse','assistant','accountant','viewer']

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id: orgId } = await ctx.params
  const body = await req.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  const role  = String(body?.role || '').trim()
  const department = body?.department ? String(body.department).slice(0, 80) : null

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Role inválido' }, { status: 400 })

  // Token URL-safe (32 bytes base64url)
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 14 * 86400 * 1000).toISOString()

  const db = sb(req)
  const { data, error } = await db.from('org_invites').insert({
    org_id: orgId, email, role, department, token,
    expires_at: expiresAt, invited_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const link = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/convite/${token}`
  return NextResponse.json({ invite: data, link })
}
