// app/api/fhir/AllergyIntolerance/route.ts
// GET → lista alergias do utente (campo livre em patients.allergies por agora)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, operationOutcome, toFhirAllergy } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const sp = req.nextUrl.searchParams
  const patientRef = sp.get('patient') || sp.get('subject')
  const patientId = patientRef ? patientRef.replace(/^Patient\//, '') : null

  if (!patientId) return fhirJson(bundle([], 'searchset'))

  const db = auth.client!
  const { data: p } = await db.from('patients').select('id, allergies').eq('id', patientId).maybeSingle()
  if (!p) return fhirJson(bundle([], 'searchset'))

  const out: any[] = []
  if (p.allergies) {
    const list = String(p.allergies).split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
    list.forEach((substance: string, idx: number) => {
      out.push(toFhirAllergy({
        id: `${p.id}-${idx}`,
        patient_id: p.id,
        substance,
      }))
    })
  }
  return fhirJson(bundle(out, 'searchset'))
}
