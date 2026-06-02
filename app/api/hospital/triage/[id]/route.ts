// app/api/hospital/triage/[id]/route.ts
// PATCH → marcar como visto (seen_at, seen_by) ou actualizar prioridade/notas
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: 'see' | 'update'
    priority?: number
    notes?: string
  } | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const update: Record<string, any> = {}
  if (body.action === 'see') {
    update.seen_at = new Date().toISOString()
    update.seen_by = userId
  } else if (body.action === 'update') {
    if (body.priority && body.priority >= 1 && body.priority <= 5) update.priority = body.priority
    if (typeof body.notes === 'string') update.notes = body.notes
  } else {
    return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
  }

  const db = sb(req)
  const { data, error } = await db.from('triage_assessments').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ triage: data })
}
