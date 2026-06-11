// app/api/fhir/Patient/route.ts
// GET  → search Patient por identifier|name|birthdate
// POST → criar Patient (precisa scope fhir:write)
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { bundle, fromFhirPatient, operationOutcome, toFhirPatient, FHIR_SYSTEMS } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)

  const sp = req.nextUrl.searchParams
  const identifier = sp.get('identifier')                    // "system|value" ou "value"
  const name = sp.get('name')
  const birthdate = sp.get('birthdate')                      // YYYY-MM-DD

  const db = auth.client!
  // Anti-IDOR: a pesquisa só pode devolver doentes do dono da chave. Sem este
  // filtro, qualquer chave listaria/encontraria doentes de todas as clínicas.
  let q = db.from('patients').select('*').eq('user_id', auth.user_id!).limit(50)

  if (identifier) {
    let val = identifier
    let system: string | null = null
    if (identifier.includes('|')) {
      const [s, v] = identifier.split('|')
      system = s; val = v
    }
    if (system === FHIR_SYSTEMS.sns) q = q.eq('sns_number', val)
    else if (system === FHIR_SYSTEMS.nif) q = q.eq('nif', val)
    else q = q.or(`sns_number.eq.${val},nif.eq.${val},id.eq.${val}`)
  }
  if (name) q = q.ilike('name', `%${name}%`)
  if (birthdate) q = q.eq('birth_date', birthdate)

  const { data, error } = await q
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  return fhirJson(bundle((data || []).map(toFhirPatient)))
}

export async function POST(req: NextRequest) {
  const auth = await authFhir(req, 'write')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)

  const body = await req.json().catch(() => null)
  if (!body || body.resourceType !== 'Patient') {
    return fhirJson(operationOutcome('error', 'Body must be a Patient resource'), 400)
  }

  const phlox = fromFhirPatient(body)
  if (!phlox.name) return fhirJson(operationOutcome('error', 'Patient.name is required'), 400)

  // Upsert por SNS/NIF — SEMPRE limitado aos doentes do dono da chave, senão um
  // POST com o SNS de outra pessoa reescreveria o registo dela (IDOR de escrita).
  const db = auth.client!
  let existing: any = null
  if (phlox.sns_number) {
    const { data } = await db.from('patients').select('*').eq('sns_number', phlox.sns_number).eq('user_id', auth.user_id!).maybeSingle()
    existing = data
  }
  if (!existing && phlox.nif) {
    const { data } = await db.from('patients').select('*').eq('nif', phlox.nif).eq('user_id', auth.user_id!).maybeSingle()
    existing = data
  }

  if (existing) {
    // Nunca deixar o body mudar o dono do registo.
    const upd: any = { ...phlox }; delete upd.user_id
    const { data, error } = await db.from('patients').update(upd).eq('id', existing.id).eq('user_id', auth.user_id!).select().single()
    if (error) return fhirJson(operationOutcome('error', error.message), 500)
    return fhirJson(toFhirPatient(data), 200)
  } else {
    const userId = auth.user_id
    const insertPayload: any = { ...phlox }
    if (auth.mode === 'api_key' && auth.org_id) insertPayload.org_id = auth.org_id
    if (userId) insertPayload.user_id = userId
    const { data, error } = await db.from('patients').insert(insertPayload).select().single()
    if (error) return fhirJson(operationOutcome('error', error.message), 500)
    return fhirJson(toFhirPatient(data), 201)
  }
}
