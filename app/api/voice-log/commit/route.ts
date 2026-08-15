// app/api/voice-log/commit/route.ts
// Passo 3 de 3 do "Regista falando": grava só as ações que o utilizador
// confirmou explicitamente uma a uma (o cliente só envia as aprovadas).
// Cada domínio grava exatamente como a ferramenta manual equivalente
// (/refeicoes, /care-log, /apoio-servicos, /atividades) — nunca um caminho
// paralelo. nutrition e vitals fazem merge-safe upsert na MESMA linha de
// care_records (lê a linha existente antes de gravar, nunca substitui o que
// já lá estava nesse turno) — o loop é sequencial, por isso processar as
// duas no mesmo commit não perde nenhuma, cada uma vê o que a anterior já
// gravou.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'

export const runtime = 'nodejs'

type Shift = 'manha' | 'tarde' | 'noite'
interface Action { domain: 'nutrition' | 'health_checkin' | 'support_service' | 'medication' | 'vitals' | 'activity' | 'medication_prep' | 'recurring_service' | 'dietary_reinforcement' | 'transport_service'; payload: Record<string, any> }

function startOfWeekStr(): string {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
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
        recorded_by_id: userId,
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

    if (action.domain === 'vitals') {
      const { data: existing } = await db.from('care_records').select('*')
        .eq('patient_id', patientId).eq('date', date).eq('shift', shift).maybeSingle()
      const prev = existing?.vitals || {}
      const p = action.payload || {}
      const { error } = await db.from('care_records').upsert({
        ...(existing ? { nutrition: existing.nutrition, continence: existing.continence, mood: existing.mood, skin: existing.skin, notes: existing.notes } : {}),
        user_id: userId,
        org_id: patient.org_id || null,
        recorded_by_id: userId,
        patient_id: patientId,
        date, shift,
        vitals: {
          bp_sys: p.bp_sys ?? prev.bp_sys ?? null,
          bp_dia: p.bp_dia ?? prev.bp_dia ?? null,
          hr: p.hr ?? prev.hr ?? null,
          temp: p.temp ?? prev.temp ?? null,
          spo2: p.spo2 ?? prev.spo2 ?? null,
          glucose: p.glucose ?? prev.glucose ?? null,
          weight: p.weight ?? prev.weight ?? null,
        },
      }, { onConflict: 'patient_id,date,shift' })
      results.push({ domain: 'vitals', ok: !error, error: error?.message })
      continue
    }

    if (action.domain === 'activity') {
      const p = action.payload || {}
      const activityId = String(p.activity_id || '')
      if (!activityId) { results.push({ domain: 'activity', ok: false, error: 'Dados incompletos.' }); continue }
      // Reconfirma que a atividade é mesmo de hoje — nunca confia só no id vindo do cliente.
      const { data: act } = await db.from('activities').select('id').eq('id', activityId).eq('date', date).maybeSingle()
      if (!act) { results.push({ domain: 'activity', ok: false, error: 'Atividade não encontrada.' }); continue }
      const { error } = await db.from('activity_participations').upsert({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId, activity_id: activityId,
        attended: p.attended !== false, notes: p.notes || null, recorded_by_id: userId,
      }, { onConflict: 'activity_id,patient_id' })
      results.push({ domain: 'activity', ok: !error, error: error?.message })
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

    if (action.domain === 'medication') {
      const p = action.payload || {}
      const status = ['administered', 'refused', 'held'].includes(p.status) ? p.status : null
      const medId = String(p.med_id || '')
      if (!status || !medId) { results.push({ domain: 'medication', ok: false, error: 'Dados incompletos.' }); continue }
      // Reconfirma que este medicamento é mesmo desta pessoa e está ativo —
      // nunca confia só no med_id que veio do cliente (o mesmo cuidado já
      // aplicado noutras rotas desta sessão, ex. family-share/med).
      const { data: med } = await db.from('patient_meds').select('id').eq('id', medId).eq('patient_id', patientId).eq('active', true).maybeSingle()
      if (!med) { results.push({ domain: 'medication', ok: false, error: 'Medicamento não encontrado ou inativo.' }); continue }
      const { error } = await db.from('mar_records').upsert({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId, med_id: medId,
        date, shift, status, source: 'centro', recorded_by: '', recorded_by_id: userId,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'patient_id,med_id,date,shift' })
      results.push({ domain: 'medication', ok: !error, error: error?.message })
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

    // Preparação em unidoses — "já preparei a medicação da semana": marca a
    // semana ATUAL inteira como preparada, para todos os turnos que esta
    // pessoa realmente usa (mesma lógica de app/preparacao-medicacao/page.tsx
    // shiftsFor) — é assim que se diz na sala, não "preparei terça de tarde".
    if (action.domain === 'medication_prep') {
      const { data: meds } = await db.from('patient_meds').select('shifts').eq('patient_id', patientId).eq('active', true)
      const list = (meds || []) as any[]
      const allShifts = ['manha', 'tarde', 'noite']
      const shifts = list.some(m => !m.shifts || m.shifts.length === 0)
        ? allShifts
        : allShifts.filter(s => list.some(m => (m.shifts || []).includes(s)))
      const weekStart = startOfWeekStr()
      const rows: any[] = []
      for (let wd = 0; wd < 7; wd++) for (const s of shifts) rows.push({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId,
        week_start: weekStart, weekday: wd, shift: s, packed: true, packed_by_id: userId, packed_at: new Date().toISOString(),
      })
      const { error } = rows.length
        ? await db.from('medication_prep_logs').upsert(rows, { onConflict: 'patient_id,week_start,weekday,shift' })
        : { error: null }
      results.push({ domain: 'medication_prep', ok: !error, error: error?.message })
      continue
    }

    // Serviço recorrente cumprido hoje (transporte/roupa/complementar) — o
    // domínio já só chega aqui se o "kind" bateu com um agendamento ATIVO
    // desta pessoa para hoje (confirmado em voice-log/extract); aqui volta a
    // confirmar-se antes de gravar, nunca confia só no que veio do cliente.
    if (action.domain === 'recurring_service') {
      const kind = String(action.payload?.kind || '')
      const todayWeekday = new Date().getDay()
      const { data: scheds } = await db.from('support_recurring_services').select('id,weekdays').eq('patient_id', patientId).eq('kind', kind).eq('active', true)
      const matches = ((scheds || []) as any[]).filter(s => !s.weekdays || s.weekdays.includes(todayWeekday))
      if (!matches.length) { results.push({ domain: 'recurring_service', ok: false, error: 'Sem agendamento ativo para hoje.' }); continue }
      const { error } = await db.from('support_recurring_logs').upsert(
        matches.map(s => ({ schedule_id: s.id, patient_id: patientId, date, done: true, done_by_id: userId, done_at: new Date().toISOString() })),
        { onConflict: 'schedule_id,date' }
      )
      results.push({ domain: 'recurring_service', ok: !error, error: error?.message })
      continue
    }

    // Transporte agendado cumprido hoje — tabela própria (support_transport_
    // schedules/logs, sprint126), separada de support_recurring_services por
    // ser texto livre (label) em vez de um kind fixo. Mesma reconfirmação
    // server-side: nunca confia só no schedule_id que veio do cliente.
    if (action.domain === 'transport_service') {
      const scheduleId = String(action.payload?.schedule_id || '')
      const todayWeekday = new Date().getDay()
      const { data: sched } = await db.from('support_transport_schedules').select('id,weekdays').eq('id', scheduleId).eq('patient_id', patientId).eq('active', true).maybeSingle()
      if (!sched || (sched.weekdays && !sched.weekdays.includes(todayWeekday))) { results.push({ domain: 'transport_service', ok: false, error: 'Sem transporte agendado para hoje.' }); continue }
      const { error } = await db.from('support_transport_logs').upsert({
        user_id: userId, org_id: patient.org_id || null, schedule_id: scheduleId, patient_id: patientId,
        date, done: true, done_by_id: userId, done_at: new Date().toISOString(), recorded_by_id: userId,
      }, { onConflict: 'schedule_id,date' })
      results.push({ domain: 'transport_service', ok: !error, error: error?.message })
      continue
    }

    // Reforço alimentar (diabéticos) — turno atual, mesma heurística de hora
    // usada no resto do site para decidir manhã/tarde/noite.
    if (action.domain === 'dietary_reinforcement') {
      const { error } = await db.from('dietary_reinforcements').upsert({
        user_id: userId, org_id: patient.org_id || null, patient_id: patientId,
        date, shift, given: true, recorded_by_id: userId,
      }, { onConflict: 'patient_id,date,shift' })
      results.push({ domain: 'dietary_reinforcement', ok: !error, error: error?.message })
      continue
    }
  }

  return NextResponse.json({ results })
}
