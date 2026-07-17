// app/api/prescriptions/route.ts
// GET  → lista de prescrições do utente / org ativa
// POST → cria nova prescrição (com items)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { sb } from '@/lib/orgAuth'

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const patientId = sp.get('patient_id')

  const db = sb(req)
  let q = db.from('prescriptions')
    .select('*, prescription_items(*)')
    .order('issued_at', { ascending: false })
    .limit(100)
  if (patientId) q = q.or(`patient_id.eq.${patientId},for_user_id.eq.${patientId}`)
  else q = q.eq('for_user_id', userId)

  const { data, error } = await q
  if (error) {
    if (/relation .*prescriptions.* does not exist/i.test(error.message)) return NextResponse.json({ prescriptions: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ prescriptions: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items obrigatórios' }, { status: 400 })
  }

  const db = sb(req)

  // Confia no org_id do cliente só depois de confirmar que o utilizador é
  // mesmo membro ativo dessa organização — a RLS já protege isto (RLS
  // `prescriptions_write`), mas uma auditoria encontrou este padrão repetido
  // sem verificação própria na rota; falhar aqui dá um 403 claro em vez de
  // depender só da RLS para bloquear silenciosamente.
  if (body.org_id) {
    const { data: membership } = await db.from('org_members')
      .select('id').eq('org_id', body.org_id).eq('user_id', userId).eq('active', true).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Sem acesso a esta instituição.' }, { status: 403 })
  }

  const { data: rx, error: rxErr } = await db.from('prescriptions').insert({
    org_id: body.org_id || null,
    patient_id: body.patient_id || null,
    family_profile_id: body.family_profile_id || null,
    for_user_id: body.patient_id ? null : userId,
    episode_id: body.episode_id || null,
    prescriber_id: userId,
    prescriber_name: body.prescriber_name || null,
    prescriber_license: body.prescriber_license || null,
    diagnosis_codes: body.diagnosis_codes || null,
    diagnosis_text: body.diagnosis_text || null,
    notes: body.notes || null,
    validity_days: body.validity_days || 30,
    status: body.status === 'signed' ? 'signed' : 'draft',
  }).select().single()
  if (rxErr) return NextResponse.json({ error: rxErr.message }, { status: 500 })

  // Items
  const items = body.items.map((it: any) => ({
    prescription_id: rx.id,
    dci: String(it.dci || '').slice(0, 120),
    brand_name: it.brand_name || null,
    dose_text: it.dose_text || null,
    pack_size: it.pack_size || null,
    ean_code: it.ean_code || null,
    posology_json: it.posology_json || {},
    generic_allowed: it.generic_allowed !== false,
    rationale: it.rationale || null,
    prescription_type: it.prescription_type || null,
    reimbursement: it.reimbursement || null,
  }))
  const { data: createdItems, error: itemsErr } = await db.from('prescription_items').insert(items).select()
  if (itemsErr) {
    await db.from('prescriptions').delete().eq('id', rx.id)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  return NextResponse.json({ prescription: { ...rx, prescription_items: createdItems } }, { status: 201 })
}
