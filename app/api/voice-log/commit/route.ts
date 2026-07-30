// app/api/voice-log/commit/route.ts
// Passo 3 de 3 do "Regista falando": grava só as ações que o utilizador
// confirmou explicitamente uma a uma (o cliente só envia as aprovadas).
// Cada domínio grava exatamente como a ferramenta manual equivalente
// (/refeicoes, aba "Saúde & Apoio", /apoio-servicos) — nunca um caminho
// paralelo. nutrition faz merge-safe upsert (lê a linha existente antes de
// gravar, nunca substitui vitais/humor/pele já registados nesse turno).
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'

export const runtime = 'nodejs'

type Shift = 'manha' | 'tarde' | 'noite'
interface Action { domain: 'nutrition' | 'health_checkin' | 'support_service'; payload: Record<string, any> }
interface Result { domain: string; ok: boolean; error?: string }

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Registo por voz')

  const body = await req.json().catch(() => null) as any
  const patientId = String(body?.patient_id || '')
  const date = String(body?.date || '')
  const shift = (['manha', 'tarde', 'noite'].includes(body?.shift) ? body.shift : 'manha') as Shift
  const actions: Action[] = Array.isArray(body?.actions) ? body.actions.slice(0, 6) : []
  if (!patientId || !date) return NextResponse.json({ error: 'patient_id e date obrigatórios.' }, { status: 400 })
  if (!actions.length) return NextResponse.json({ error: 'Nada para gravar.' }, { status: 400 })

  const db = sb(req)
  const { data: patient } = await db.from('patients').select('id,org_id').eq('id', patientId).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Sem acesso a esta pessoa.' }, { status: 403 })

  const results: Result[] = []

  for (const action of actions) {
    if (action.domain === 'nutrition') {
      const { data: existing } = await db.from('care_records').select('*')
        .eq('patient_id', patientId).eq('date', date).eq('shift', shift).maybeSingle()
      const prev = existing?.nutrition || {}
      const p = action.payload || {}
      const { error } = await db.from('care_records').upsert({
        ...(existing ? { vitals: existing.vitals, continence: existing.continence, mood: existing.mood, skin: existing.skin, notes: existing.notes } : {}),
        user_id: userId,
        org_id: patient.org_id || null,
        patient_id: patientId,
        date, shift,
        nutrition: {
          breakfast: p.breakfast ?? prev.breakfast ?? null,
          lunch: p.lunch ?? prev.lunch ?? null,
          dinner: p.dinner ?? prev.dinner ?? null,
          fluid_ml: p.fluid_ml ?? prev.fluid_ml ?? null,
          appetite: p.appetite ?? prev.appetite ?? null,
        },
      }, { onConflict: 'patient_id,date,shift' })
      results.push({ domain: 'nutrition', ok: !error, error: error?.message })
      continue
    }

    if (action.domain === 'health_checkin') {
      const p = action.payload || {}
      const kind = p.kind === 'enfermagem' ? 'enfermagem' : 'acompanhamento'
      const notes = String(p.notes || '').trim().slice(0, 500)
      if (!notes) { results.push({ domain: 'health_checkin', ok: false, error: 'Sem nota.' }); continue }
      const { error } = await db.from('health_checkins').insert({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId,
        kind, date, notes,
        duration_min: p.duration_min ? parseInt(p.duration_min) : null,
        recorded_by_id: userId,
      })
      results.push({ domain: 'health_checkin', ok: !error, error: error?.message })
      continue
    }

    if (action.domain === 'support_service') {
      const p = action.payload || {}
      const kind = ['roupa', 'transporte', 'outro'].includes(p.kind) ? p.kind : 'outro'
      const { error } = await db.from('support_services').insert({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId,
        kind, date, status: 'pedido',
        notes: p.notes ? String(p.notes).trim().slice(0, 500) : null,
        requested_by_id: userId,
      })
      results.push({ domain: 'support_service', ok: !error, error: error?.message })
      continue
    }
  }

  return NextResponse.json({ results })
}
