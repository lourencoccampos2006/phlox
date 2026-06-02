// app/api/fhir/Immunization/route.ts
// GET → search · POST → registar vacina (escreve em vaccine_records)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, fromFhirImmunization, operationOutcome, toFhirImmunization } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const sp = req.nextUrl.searchParams
  const patientRef = sp.get('patient') || sp.get('subject')
  const patientId = patientRef ? patientRef.replace(/^Patient\//, '') : null

  const db = auth.client!
  let q = db.from('vaccine_records').select('*').order('given_at', { ascending: false }).limit(100)
  if (patientId) q = q.or(`patient_id.eq.${patientId},user_id.eq.${patientId}`)
  const { data, error } = await q
  if (error && /relation .*vaccine_records.* does not exist/i.test(error.message)) {
    return fhirJson(bundle([], 'searchset'))
  }
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  return fhirJson(bundle((data || []).map((v: any) => toFhirImmunization({
    id: v.id,
    patient_id: v.patient_id,
    for_user_id: v.user_id,
    vaccine_code: v.vaccine_code || v.vaccine_id,
    vaccine_name: v.vaccine_name,
    given_at: v.given_at,
    lot_number: v.lot_number,
    site: v.site,
    route: v.route,
  })), 'searchset'))
}

export async function POST(req: NextRequest) {
  const auth = await authFhir(req, 'write')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const body = await req.json().catch(() => null)
  if (!body) return fhirJson(operationOutcome('error', 'Empty body'), 400)

  const items: any[] = body.resourceType === 'Bundle'
    ? (body.entry || []).map((e: any) => e.resource).filter((r: any) => r?.resourceType === 'Immunization')
    : body.resourceType === 'Immunization' ? [body] : []
  if (items.length === 0) return fhirJson(operationOutcome('error', 'No Immunization in payload'), 400)

  const db = auth.client!
  let created = 0
  for (const r of items) {
    const v = fromFhirImmunization(r)
    if (!v.given_at || !v.vaccine_code) continue
    const userId = v.patient_id || auth.user_id
    const payload: any = {
      user_id: userId,
      patient_id: v.patient_id,
      vaccine_id: v.vaccine_code,
      vaccine_code: v.vaccine_code,
      vaccine_name: v.vaccine_name,
      given_at: v.given_at.slice(0, 10),
      lot_number: v.lot_number,
    }
    const { error } = await db.from('vaccine_records').insert(payload)
    if (!error) created++
  }
  return fhirJson({ resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: `Created ${created}/${items.length}` }] }, 201)
}
