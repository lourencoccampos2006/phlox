// app/api/fhir/Immunization/route.ts
// GET → search · POST → registar vacina (escreve em vaccine_records)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir, resolveOwnedPatient } from '@/lib/fhirAuth'
import { bundle, fromFhirImmunization, operationOutcome, toFhirImmunization } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const sp = req.nextUrl.searchParams
  const patientRef = sp.get('patient') || sp.get('subject')
  // Anti-IDOR: exigir doente e confirmar que pertence ao dono da chave.
  if (!patientRef) return fhirJson(operationOutcome('error', 'Parameter "patient" is required'), 400)
  const owned = await resolveOwnedPatient(auth, patientRef)
  if (!owned) return fhirJson(bundle([], 'searchset'))

  const db = auth.client!
  let q = db.from('vaccine_records').select('*').order('given_at', { ascending: false }).limit(100)
  q = q.or(`patient_id.eq.${owned.patientId},user_id.eq.${owned.userId}`)
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
  const ownedCache = new Map<string, { patientId: string; userId: string } | null>()
  const resolve = async (pid?: string | null) => {
    // Sem doente indicado → o próprio dono da chave.
    if (!pid) return { patientId: auth.user_id!, userId: auth.user_id! }
    if (ownedCache.has(pid)) return ownedCache.get(pid)!
    const owned = await resolveOwnedPatient(auth, pid)
    ownedCache.set(pid, owned)
    return owned
  }
  let created = 0, denied = 0
  for (const r of items) {
    const v = fromFhirImmunization(r)
    if (!v.given_at || !v.vaccine_code) continue
    // Anti-IDOR: só escrever em doentes que pertencem ao dono da chave.
    const owned = await resolve(v.patient_id)
    if (!owned) { denied++; continue }
    const payload: any = {
      user_id: owned.userId,
      patient_id: v.patient_id ? owned.patientId : null,
      vaccine_id: v.vaccine_code,
      vaccine_code: v.vaccine_code,
      vaccine_name: v.vaccine_name,
      given_at: v.given_at.slice(0, 10),
      lot_number: v.lot_number,
    }
    const { error } = await db.from('vaccine_records').insert(payload)
    if (!error) created++
  }
  const diag = `Created ${created}/${items.length}` + (denied ? ` (${denied} denied: patient not owned)` : '')
  return fhirJson({ resourceType: 'OperationOutcome', issue: [{ severity: denied ? 'warning' : 'information', code: 'informational', diagnostics: diag }] }, 201)
}
