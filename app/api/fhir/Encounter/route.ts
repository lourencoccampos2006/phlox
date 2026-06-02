// app/api/fhir/Encounter/route.ts
// GET → search por patient (mapeia para `episodes`)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, operationOutcome, toFhirEncounter } from '@/lib/fhir'

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
  let q = db.from('episodes').select('*').order('start_at', { ascending: false }).limit(100)
  if (patientId) q = q.eq('patient_id', patientId)
  const { data, error } = await q
  if (error && /relation .*episodes.* does not exist/i.test(error.message)) {
    return fhirJson(bundle([], 'searchset'))
  }
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  return fhirJson(bundle((data || []).map((e: any) => toFhirEncounter(e)), 'searchset'))
}
