// app/api/prescriptions/[id]/sign/route.ts
// Assina a prescrição (status draft → signed) e marca expires_at.
// Suporta: 'manual' (assinatura local), 'pem' (placeholder para SPMS PEM),
// 'cmd' (placeholder para Chave Móvel Digital). O backend real depende do
// integrador escolhido — aqui guardamos o payload no campo signature_payload.
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const method = body?.method || 'manual'

  const db = sb(req)
  const { data: rx } = await db.from('prescriptions').select('*, prescription_items(*)').eq('id', id).maybeSingle()
  if (!rx) return NextResponse.json({ error: 'Prescrição não encontrada' }, { status: 404 })
  if (rx.status !== 'draft') return NextResponse.json({ error: `Já assinada (status=${rx.status})` }, { status: 409 })

  // Calcula hash assinável (canonicalização leve do conteúdo)
  const canonical = JSON.stringify({
    patient: rx.patient_id || rx.for_user_id,
    items: (rx.prescription_items || []).map((it: any) => ({
      dci: it.dci, dose: it.dose_text, posology: it.posology_json,
    })),
    issued_at: rx.issued_at,
    prescriber: rx.prescriber_id,
  })
  const hash = crypto.createHash('sha256').update(canonical).digest('hex')

  // Para PEM real, aqui chamaríamos SPMS. Por enquanto guardamos o método +
  // hash + número PEM se fornecido.
  const signature_payload: any = { method, hash, signed_by: userId, signed_at: new Date().toISOString() }
  if (body?.pem_number) signature_payload.pem_number = body.pem_number

  const updates: any = {
    status: 'signed',
    signed_method: method,
    signature_payload,
  }
  if (body?.pem_number) updates.prescription_no = body.pem_number

  const { data, error } = await db.from('prescriptions').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prescription: data })
}
