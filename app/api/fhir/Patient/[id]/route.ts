// app/api/fhir/Patient/[id]/route.ts
// GET → read · PUT → update
import { NextRequest, NextResponse } from 'next/server'
import { authFhir } from '@/lib/fhirAuth'
import { fromFhirPatient, operationOutcome, toFhirPatient } from '@/lib/fhir'

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authFhir(req, 'read')
  if (!auth.ok) return fhirJson(operationOutcome('error', auth.error || 'Unauthorized'), auth.status || 401)
  const { id } = await ctx.params
  const db = auth.client!
  const { data, error } = await db.from('patients').select('*').or(`id.eq.${id},fhir_id.eq.${id}`).maybeSingle()
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

  const db = auth.client!
  const phlox = fromFhirPatient(body)
  const { data, error } = await db.from('patients').update(phlox).or(`id.eq.${id},fhir_id.eq.${id}`).select().single()
  if (error) return fhirJson(operationOutcome('error', error.message), 500)
  return fhirJson(toFhirPatient(data))
}
