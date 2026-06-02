// app/api/lab/webhook/[token]/route.ts
// Recebe um FHIR Bundle de um laboratório externo. O token identifica a
// integração ativa (e dispensa Authorization header — o token é o segredo).
//
// Processa cada Observation/Patient/DiagnosticReport do bundle:
//  • cria Patient se SNS/NIF conhecido não existir
//  • insere Observations em vital_signs ou lab_results
//  • regista o evento em fhir_inbound_log

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { fromFhirObservation, fromFhirPatient, FHIR_SYSTEMS, operationOutcome } from '@/lib/fhir'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function fhirJson(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Content-Type': 'application/fhir+json' } })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fhirJson(operationOutcome('error', 'Server not configured'), 503)
  }
  const { token } = await ctx.params
  const body = await req.text()  // como texto para hash
  let payload: any
  try { payload = JSON.parse(body) } catch { return fhirJson(operationOutcome('error', 'Invalid JSON'), 400) }
  if (payload?.resourceType !== 'Bundle') {
    return fhirJson(operationOutcome('error', 'Body must be a Bundle'), 400)
  }

  const db = adminClient()
  const { data: integration } = await db.from('lab_integrations').select('*').eq('webhook_token', token).eq('active', true).maybeSingle()
  if (!integration) return fhirJson(operationOutcome('error', 'Invalid or inactive webhook token'), 401)

  const orgId = integration.org_id
  const rawHash = crypto.createHash('sha256').update(body).digest('hex')

  // ── Processa cada entry ─────────────────────────────────────────────────
  const entries: any[] = Array.isArray(payload.entry) ? payload.entry : []
  let patientMatches = 0, obsCreated = 0
  const errors: string[] = []

  // Cache: fullUrl → patientId resolvido
  const patientResolved: Record<string, string> = {}

  // 1ª passagem: Patients
  for (const e of entries) {
    const r = e.resource
    if (r?.resourceType !== 'Patient') continue
    const phlox = fromFhirPatient(r)
    if (!phlox.name) continue

    let existing: any = null
    if (phlox.sns_number) {
      const { data } = await db.from('patients').select('id').eq('sns_number', phlox.sns_number).maybeSingle()
      existing = data
    }
    if (!existing && phlox.nif) {
      const { data } = await db.from('patients').select('id').eq('nif', phlox.nif).maybeSingle()
      existing = data
    }
    if (!existing) {
      // Cria novo patient (associado à org da integração)
      const { data: created, error: cErr } = await db.from('patients').insert({
        org_id: orgId,
        user_id: integration.created_by,    // owner do registo
        ...phlox,
      }).select('id').single()
      if (cErr) { errors.push(`Patient create: ${cErr.message}`); continue }
      existing = created
    }
    patientMatches++
    if (e.fullUrl) patientResolved[e.fullUrl] = existing.id
    if (r.id) patientResolved[`Patient/${r.id}`] = existing.id
  }

  // 2ª passagem: Observations
  for (const e of entries) {
    const r = e.resource
    if (r?.resourceType !== 'Observation') continue
    const o = fromFhirObservation(r)

    // Resolve subject → patient_id Phlox
    let patientId: string | null = null
    if (r.subject?.reference) {
      const refStr = String(r.subject.reference)
      // fullUrl
      if (patientResolved[refStr]) patientId = patientResolved[refStr]
      else {
        // procura por SNS/NIF se houver identifier inline no subject
        const ident = r.subject?.identifier
        if (ident) {
          let q = db.from('patients').select('id').limit(1)
          if (ident.system === FHIR_SYSTEMS.sns) q = q.eq('sns_number', ident.value)
          else if (ident.system === FHIR_SYSTEMS.nif) q = q.eq('nif', ident.value)
          const { data } = await q.maybeSingle()
          if (data) patientId = data.id
        }
      }
    }
    if (!patientId && o.patient_id) patientId = o.patient_id
    if (!patientId) { errors.push('Observation without resolvable patient'); continue }

    // Insere em lab_results (default) ou vital_signs
    if (o.category === 'vital-signs') {
      const col = ({
        '8480-6': 'systolic', '8462-4': 'diastolic', '8867-4': 'pulse',
        '29463-7': 'weight', '59408-5': 'spo2', '8310-5': 'temperature',
        '15074-8': 'glucose',
      } as Record<string, string>)[o.code || '']
      if (col) {
        const insert: any = { user_id: patientId, patient_id: patientId, measured_at: o.effective_at }
        insert[col] = o.value
        await db.from('vital_signs').insert(insert)
        obsCreated++
      }
    } else {
      const { error } = await db.from('lab_results').insert({
        user_id: patientId,
        test_code: o.code,
        test_label: o.code_display || o.code,
        value: o.value, unit: o.unit || '',
        ref_low: o.ref_low, ref_high: o.ref_high,
        measured_at: o.effective_at?.slice(0, 10),
        source: `fhir:${integration.name}`,
      })
      if (error) errors.push(`Observation insert: ${error.message}`)
      else obsCreated++
    }
  }

  // ── Audit log ───────────────────────────────────────────────────────────
  await db.from('fhir_inbound_log').insert({
    integration_id: integration.id,
    org_id: orgId,
    bundle_id: payload.id,
    resource_count: entries.length,
    patient_matches: patientMatches,
    observations_created: obsCreated,
    status: errors.length === 0 ? 'processed' : 'partial',
    error_detail: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
    raw_hash: rawHash,
  })

  await db.from('lab_integrations').update({
    last_received_at: new Date().toISOString(),
    total_received: (integration.total_received || 0) + 1,
  }).eq('id', integration.id)

  return fhirJson({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: errors.length === 0 ? 'information' : 'warning',
      code: 'informational',
      diagnostics: `Bundle processed. Patients matched: ${patientMatches}. Observations created: ${obsCreated}. Errors: ${errors.length}`,
    }],
  }, errors.length === 0 ? 200 : 207)
}
