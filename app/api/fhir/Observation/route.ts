// app/api/fhir/Observation/route.ts
// GET  → search por patient + date + code
// POST → criar observação (vital ou lab)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, fromFhirObservation, operationOutcome, toFhirObservation, PhloxObservation } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

// Phlox guarda observações em 2 tabelas:
//  • vital_signs (TA, FC, peso, SpO2, …)
//  • lab_results (HbA1c, LDL, eGFR, …)
// O search une as duas.
async function searchAll(db: any, patientId?: string, fromDate?: string, code?: string): Promise<PhloxObservation[]> {
  const out: PhloxObservation[] = []

  // Vitals
  let qv = db.from('vital_signs').select('*').order('measured_at', { ascending: false }).limit(200)
  if (patientId) qv = qv.or(`patient_id.eq.${patientId},user_id.eq.${patientId}`)
  if (fromDate) qv = qv.gte('measured_at', fromDate)
  const { data: vitals } = await qv
  for (const v of (vitals || [])) {
    for (const [key, codeVal, display, unit] of [
      ['systolic', '8480-6', 'Systolic blood pressure', 'mmHg'],
      ['diastolic', '8462-4', 'Diastolic blood pressure', 'mmHg'],
      ['pulse', '8867-4', 'Heart rate', 'bpm'],
      ['weight', '29463-7', 'Body weight', 'kg'],
      ['spo2', '59408-5', 'Oxygen saturation', '%'],
      ['temperature', '8310-5', 'Body temperature', 'Cel'],
      ['glucose', '15074-8', 'Glucose [moles/volume] in blood', 'mg/dL'],
    ] as const) {
      if (v[key] == null) continue
      if (code && code !== codeVal) continue
      out.push({
        id: `${v.id}-${key}`,
        patient_id: v.patient_id || v.user_id,
        category: 'vital-signs',
        code: codeVal, code_display: display,
        value: Number(v[key]), unit,
        effective_at: v.measured_at || v.created_at,
      })
    }
  }

  // Labs
  let ql = db.from('lab_results').select('*').order('measured_at', { ascending: false }).limit(300)
  if (patientId) ql = ql.eq('user_id', patientId)
  if (fromDate) ql = ql.gte('measured_at', fromDate)
  if (code) ql = ql.eq('test_code', code)
  const { data: labs } = await ql
  for (const l of (labs || [])) {
    out.push({
      id: l.id,
      patient_id: l.user_id,
      category: 'laboratory',
      code: l.test_code,
      code_display: l.test_label,
      value: Number(l.value),
      unit: l.unit,
      ref_low: l.ref_low,
      ref_high: l.ref_high,
      effective_at: l.measured_at,
    })
  }

  return out
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)

  const sp = req.nextUrl.searchParams
  const patientRef = sp.get('patient') || sp.get('subject') || null
  const patientId = patientRef ? patientRef.replace(/^Patient\//, '') : null
  const code = sp.get('code') || sp.get('code-system-value') || null
  const date = sp.get('date') || null
  let fromDate: string | null = null
  if (date?.startsWith('ge')) fromDate = date.slice(2)
  else if (date?.startsWith('gt')) fromDate = date.slice(2)
  else if (date) fromDate = date

  const obs = await searchAll(auth.client!, patientId || undefined, fromDate || undefined, code || undefined)
  return fhirJson(bundle(obs.map(toFhirObservation), 'searchset'))
}

export async function POST(req: NextRequest) {
  const auth = await authFhir(req, 'write')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const body = await req.json().catch(() => null)
  if (!body) return fhirJson(operationOutcome('error', 'Empty body'), 400)

  // Aceita 1 Observation ou Bundle de Observations
  const items: any[] = body.resourceType === 'Bundle'
    ? (body.entry || []).map((e: any) => e.resource).filter((r: any) => r?.resourceType === 'Observation')
    : body.resourceType === 'Observation' ? [body] : []
  if (items.length === 0) return fhirJson(operationOutcome('error', 'No Observation in payload'), 400)

  const db = auth.client!
  let created = 0
  for (const r of items) {
    const o = fromFhirObservation(r)
    if (!o.patient_id || !o.code) continue
    if (o.category === 'vital-signs') {
      // Mapear de volta: para sermos pragmáticos, criamos uma linha por observação
      const col = ({
        '8480-6':  'systolic',
        '8462-4':  'diastolic',
        '8867-4':  'pulse',
        '29463-7': 'weight',
        '59408-5': 'spo2',
        '8310-5':  'temperature',
        '15074-8': 'glucose',
      } as Record<string, string>)[o.code || '']
      if (col) {
        const insert: any = { measured_at: o.effective_at, user_id: o.patient_id }
        insert[col] = o.value
        const { error } = await db.from('vital_signs').insert(insert)
        if (!error) created++
      }
    } else {
      const { error } = await db.from('lab_results').insert({
        user_id: o.patient_id,
        test_code: o.code,
        test_label: o.code_display || o.code,
        value: o.value,
        unit: o.unit || '',
        ref_low: o.ref_low,
        ref_high: o.ref_high,
        measured_at: o.effective_at?.slice(0, 10),
        source: 'fhir',
      })
      if (!error) created++
    }
  }
  return fhirJson({ resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: `Created ${created}/${items.length}` }] }, 201)
}
