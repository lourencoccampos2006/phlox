// app/api/hospital/beds/[id]/route.ts
// PATCH  → admitir (associar episódio + doente), libertar, alterar estado, notas
// DELETE → desativa (soft delete)
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

const ALLOWED_STATUS = ['free','occupied','cleaning','maintenance','reserved','blocked'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: 'admit' | 'discharge' | 'set_status' | 'update'
    episode_id?: string
    patient_id?: string
    episode_kind?: string
    primary_complaint?: string
    status?: string
    notes?: string
    label?: string
    bed_type?: string
  } | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const update: Record<string, any> = {}

  if (body.action === 'admit') {
    if (!body.patient_id) {
      return NextResponse.json({ error: 'patient_id obrigatório para admitir' }, { status: 400 })
    }
    const db0 = sb(req)
    let episodeId = body.episode_id as string | undefined

    // Se não foi passado um episode_id, cria automaticamente um episódio aberto
    // do tipo escolhido (default: internamento) para o doente.
    if (!episodeId) {
      // Vai buscar org_id da cama (já garantida via RLS)
      const { data: bedRow } = await db0.from('beds').select('org_id').eq('id', id).single()
      if (!bedRow?.org_id) return NextResponse.json({ error: 'Cama sem org associada' }, { status: 400 })
      const { data: ep, error: epErr } = await db0.from('episodes').insert({
        org_id: bedRow.org_id,
        patient_id: body.patient_id,
        kind: body.episode_kind || 'internamento',
        status: 'open',
        attending_user_id: userId,
        primary_complaint: body.primary_complaint || null,
        bed_id: id,
        created_by: userId,
      }).select('id').single()
      if (epErr) return NextResponse.json({ error: 'Falha ao criar episódio: ' + epErr.message }, { status: 500 })
      episodeId = ep.id
    }
    update.current_episode_id = episodeId
    update.current_patient_id = body.patient_id
    // trigger SQL define status=occupied + occupied_since
  } else if (body.action === 'discharge') {
    update.current_episode_id = null
    // trigger SQL muda para cleaning automaticamente
  } else if (body.action === 'set_status') {
    if (!body.status || !ALLOWED_STATUS.includes(body.status as any)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    update.status = body.status
    if (body.status === 'free') {
      update.current_episode_id = null
      update.current_patient_id = null
      update.occupied_since = null
    }
  } else if (body.action === 'update') {
    if (body.label) update.label = body.label
    if (body.bed_type) update.bed_type = body.bed_type
    if (typeof body.notes === 'string') update.notes = body.notes
  } else {
    return NextResponse.json({ error: 'action obrigatório (admit|discharge|set_status|update)' }, { status: 400 })
  }

  if (typeof body.notes === 'string' && body.action !== 'update') update.notes = body.notes

  const db = sb(req)
  const { data, error } = await db.from('beds').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ bed: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { error } = await db.from('beds').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
