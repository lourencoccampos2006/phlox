// app/api/crm/contacts/[id]/route.ts
// GET   → contacto + actividades
// PATCH → actualizar (stage, valor, dados)
// DELETE → eliminar
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data: contact, error } = await db.from('crm_contacts').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const { data: activities } = await db.from('crm_activities')
    .select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ contact, activities: activities || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, any> | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const allowed = [
    'name','email','phone','company','job_title','vat_number','city',
    'kind','stage','value_eur','expected_close','tags','source','notes',
    'consent_marketing','consent_data_share','owner_user_id',
    'last_contact_at','next_followup_at',
  ]
  const u: Record<string, any> = {}
  for (const k of allowed) if (k in body) u[k] = body[k]
  const db = sb(req)
  const { data, error } = await db.from('crm_contacts').update(u).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ contact: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { error } = await db.from('crm_contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
