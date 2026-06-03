// app/api/crm/activities/route.ts
// POST → cria interacção
// PATCH → marca como done
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

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as any
  if (!body?.org_id || !body.contact_id || !body.kind) {
    return NextResponse.json({ error: 'org_id, contact_id e kind obrigatórios' }, { status: 400 })
  }
  const db = sb(req)
  const { data, error } = await db.from('crm_activities').insert({
    org_id: body.org_id,
    contact_id: body.contact_id,
    kind: body.kind,
    subject: body.subject || null,
    body: body.body || null,
    due_at: body.due_at || null,
    done: !!body.done,
    done_at: body.done ? new Date().toISOString() : null,
    done_by: body.done ? userId : null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })

  // Marca o contacto como tendo sido contactado agora (se done=true)
  if (body.done && body.kind !== 'task' && body.kind !== 'note') {
    await db.from('crm_contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', body.contact_id)
  }
  return NextResponse.json({ activity: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { id?: string; done?: boolean } | null
  if (!body?.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const db = sb(req)
  const u: Record<string, any> = {}
  if (typeof body.done === 'boolean') {
    u.done = body.done
    u.done_at = body.done ? new Date().toISOString() : null
    u.done_by = body.done ? userId : null
  }
  const { data, error } = await db.from('crm_activities').update(u).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ activity: data })
}
