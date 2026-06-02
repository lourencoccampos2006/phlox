// app/api/fhir/MedicationRequest/route.ts
// GET → search por patient
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, operationOutcome, toFhirMedicationRequest } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const sp = req.nextUrl.searchParams
  const patientRef = sp.get('patient') || sp.get('subject') || null
  const patientId = patientRef ? patientRef.replace(/^Patient\//, '') : null

  const db = auth.client!

  // 1) Vai à tabela prescriptions + prescription_items
  let rxQuery = db.from('prescriptions')
    .select(`
      id, status, issued_at, prescriber_id, prescriber_name,
      patient_id, for_user_id,
      prescription_items(id, dci, brand_name, dose_text, ean_code, posology_json, generic_allowed, prescription_type)
    `)
    .order('issued_at', { ascending: false })
    .limit(200)
  if (patientId) rxQuery = rxQuery.or(`patient_id.eq.${patientId},for_user_id.eq.${patientId}`)
  const { data: rxs, error } = await rxQuery
  if (error) console.error('[fhir MR] prescriptions:', error)

  const out: any[] = []
  for (const rx of (rxs || [])) {
    for (const it of ((rx as any).prescription_items || [])) {
      out.push(toFhirMedicationRequest({
        id: it.id,
        patient_id: (rx as any).patient_id,
        for_user_id: (rx as any).for_user_id,
        status: (rx as any).status,
        dci: it.dci,
        brand_name: it.brand_name,
        dose_text: it.dose_text,
        ean_code: it.ean_code,
        posology_json: it.posology_json,
        issued_at: (rx as any).issued_at,
        prescriber_id: (rx as any).prescriber_id,
        prescriber_name: (rx as any).prescriber_name,
        generic_allowed: it.generic_allowed,
        prescription_type: it.prescription_type,
      }))
    }
  }

  // 2) Compatibilidade: também devolve patient_meds / personal_meds como
  //    MedicationStatement (status=active) — sem ato de prescrição registado.
  if (patientId) {
    const { data: pm } = await db.from('patient_meds').select('id, name, dose, frequency, posology_json, active').eq('patient_id', patientId)
    for (const m of (pm || [])) {
      if (m.active === false) continue
      out.push({
        resourceType: 'MedicationStatement',
        id: m.id,
        status: 'active',
        medicationCodeableConcept: { text: m.name },
        subject: { reference: `Patient/${patientId}` },
        dosage: m.posology_json ? [{
          text: [m.dose, m.frequency].filter(Boolean).join(' · ') || undefined,
        }] : undefined,
      })
    }
  }

  return fhirJson(bundle(out, 'searchset'))
}
