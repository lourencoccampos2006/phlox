// app/api/fhir/Patient/[id]/route.ts
// GET → read · PUT → update
import { NextRequest, NextResponse } from 'next/server'
import { authFhir, resolveOwnedPatient } from '@/lib/fhirAuth'
import { fromFhirPatient, operationOutcome, toFhirPatient } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const { id } = await ctx.params
  // Anti-IDOR: confirmar que o doente pertence ao dono da chave antes de ler.
  const owned = await resolveOwnedPatient(auth, id)
  if (!owned) return fhirJson(operationOutcome('error', `Patient/${id} not found`), 404)
  const db = auth.client!
  const { data, error } = await db.from('patients').select('*').eq('id', owned.patientId).maybeSingle()
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  if (!data) return fhirJson(operationOutcome('error', `Patient/${id} not found`), 404)
  return fhirJson(toFhirPatient(data))
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authFhir(req, 'write')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body || body.resourceType !== 'Patient') return fhirJson(operationOutcome('error', 'Body must be a Patient'), 400)

  // Anti-IDOR: só permitir atualizar um doente que pertence ao dono da chave.
  const owned = await resolveOwnedPatient(auth, id)
  if (!owned) return fhirJson(operationOutcome('error', `Patient/${id} not found`), 404)
  const db = auth.client!
  const phlox = fromFhirPatient(body)
  // Nunca deixar o body reescrever o dono do registo.
  delete (phlox as any).user_id
  const { data, error } = await db.from('patients').update(phlox).eq('id', owned.patientId).select().single()
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  return fhirJson(toFhirPatient(data))
}
