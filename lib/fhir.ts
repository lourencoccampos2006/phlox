// lib/fhir.ts
// Phlox — Mapeamento bidirecional Phlox ↔ FHIR R4.
//
// O Phlox modela dados clínicos em tabelas próprias (patients, patient_meds,
// mar_records, vital_signs, lab_results, allergies, vaccine_records, etc.).
// Para interoperabilidade, exportamos estes dados como resources FHIR R4
// e aceitamos resources FHIR para importação (lab webhooks, SPMS, RSE).
//
// Implementa um SUBSET pragmático de FHIR R4 (não cobre o standard inteiro):
//   • Patient
//   • Practitioner
//   • Organization
//   • Encounter (= episode)
//   • Observation (vital_signs + lab_results + assessments)
//   • MedicationRequest (= prescription_items)
//   • MedicationStatement (= patient_meds atuais, sem ato de prescrição)
//   • AllergyIntolerance
//   • Immunization (= vaccine_records)
//   • DiagnosticReport
//
// URL system identifiers:
//   • SNS  → http://saude.gov.pt/sns
//   • NIF  → http://saude.gov.pt/nif
//   • DCI  → http://infomed.infarmed.pt/dci
//   • EAN  → urn:oid:1.3.160 (GS1)
//   • ICD-10 → http://hl7.org/fhir/sid/icd-10
//   • SNOMED CT → http://snomed.info/sct
//   • LOINC → http://loinc.org

// ─── Sistemas (Identifier.system) ──────────────────────────────────────────
export const FHIR_SYSTEMS = {
  sns:     'http://saude.gov.pt/sns',
  nif:     'http://saude.gov.pt/nif',
  dci:     'http://infomed.infarmed.pt/dci',
  ean:     'urn:oid:1.3.160',
  icd10:   'http://hl7.org/fhir/sid/icd-10',
  snomed:  'http://snomed.info/sct',
  loinc:   'http://loinc.org',
  phlox:   'https://phloxclinical.com/fhir',
} as const

// ─── Tipos mínimos ──────────────────────────────────────────────────────────
export interface FHIRIdentifier { system?: string; value: string; use?: string }
export interface FHIRCodeableConcept { coding?: { system?: string; code?: string; display?: string }[]; text?: string }
export interface FHIRReference { reference?: string; display?: string; identifier?: FHIRIdentifier }
export interface FHIRBundle { resourceType: 'Bundle'; id?: string; type: string; entry?: { resource: any; fullUrl?: string }[]; total?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────
export function ref(resourceType: string, id: string): FHIRReference {
  return { reference: `${resourceType}/${id}` }
}

export function code(system: string, code: string, display?: string): FHIRCodeableConcept {
  return { coding: [{ system, code, display }], text: display || code }
}

export function bundle(entries: any[], type: 'searchset' | 'collection' | 'transaction' = 'searchset', total?: number): FHIRBundle {
  return {
    resourceType: 'Bundle',
    type,
    total: total ?? entries.length,
    entry: entries.map(r => ({ resource: r, fullUrl: r.id ? `${r.resourceType}/${r.id}` : undefined })),
  }
}

// ─── Patient ────────────────────────────────────────────────────────────────
export interface PhloxPatient {
  id: string
  fhir_id?: string | null
  name: string
  sns_number?: string | null
  nif?: string | null
  birth_date?: string | null
  age?: number | null
  sex?: 'M' | 'F' | 'outro' | null
  phone?: string | null
  email?: string | null
  conditions?: string | null
  allergies?: string | null
  active?: boolean
}

export function toFhirPatient(p: PhloxPatient): any {
  const identifiers: FHIRIdentifier[] = []
  if (p.sns_number) identifiers.push({ system: FHIR_SYSTEMS.sns, value: p.sns_number, use: 'official' })
  if (p.nif)        identifiers.push({ system: FHIR_SYSTEMS.nif, value: p.nif, use: 'usual' })
  identifiers.push({ system: FHIR_SYSTEMS.phlox + '/Patient', value: p.id })

  // Separa nome em given/family (heurística simples)
  const parts = (p.name || '').trim().split(/\s+/)
  const family = parts.length > 1 ? parts[parts.length - 1] : ''
  const given  = parts.length > 1 ? parts.slice(0, -1) : parts

  return {
    resourceType: 'Patient',
    id: p.fhir_id || p.id,
    identifier: identifiers,
    active: p.active !== false,
    name: [{ use: 'official', family, given, text: p.name }],
    telecom: [
      p.phone ? { system: 'phone', value: p.phone, use: 'mobile' } : null,
      p.email ? { system: 'email', value: p.email, use: 'home' } : null,
    ].filter(Boolean),
    gender: p.sex === 'M' ? 'male' : p.sex === 'F' ? 'female' : p.sex === 'outro' ? 'other' : 'unknown',
    birthDate: p.birth_date || undefined,
  }
}

/** Aceita FHIR Patient e devolve dados normalizados Phlox (para upsert). */
export function fromFhirPatient(r: any): Partial<PhloxPatient> {
  const out: Partial<PhloxPatient> = {}
  const nameObj = (r.name || [])[0] || {}
  out.name = nameObj.text || [...(nameObj.given || []), nameObj.family].filter(Boolean).join(' ').trim()

  for (const i of (r.identifier || [])) {
    if (i.system === FHIR_SYSTEMS.sns) out.sns_number = i.value
    if (i.system === FHIR_SYSTEMS.nif) out.nif = i.value
  }
  if (r.birthDate) out.birth_date = r.birthDate
  out.sex = r.gender === 'male' ? 'M' : r.gender === 'female' ? 'F' : r.gender === 'other' ? 'outro' : null
  out.phone = (r.telecom || []).find((t: any) => t.system === 'phone')?.value || null
  out.email = (r.telecom || []).find((t: any) => t.system === 'email')?.value || null
  out.active = r.active !== false
  return out
}

// ─── Observation (vital_signs + lab_results) ────────────────────────────────
export interface PhloxObservation {
  id: string
  patient_id: string
  category: 'vital-signs' | 'laboratory' | 'survey'
  code: string
  code_display?: string
  system?: string                                   // LOINC ou interno
  value?: number
  unit?: string
  ref_low?: number
  ref_high?: number
  interpretation?: 'N' | 'L' | 'H' | 'A'           // Normal/Low/High/Abnormal
  effective_at: string
  notes?: string
}

export function toFhirObservation(o: PhloxObservation): any {
  const value = o.value != null
    ? { valueQuantity: { value: o.value, unit: o.unit, system: 'http://unitsofmeasure.org', code: o.unit } }
    : {}
  const refRange = (o.ref_low != null || o.ref_high != null) ? {
    referenceRange: [{
      low:  o.ref_low  != null ? { value: o.ref_low,  unit: o.unit } : undefined,
      high: o.ref_high != null ? { value: o.ref_high, unit: o.unit } : undefined,
    }],
  } : {}
  return {
    resourceType: 'Observation',
    id: o.id,
    status: 'final',
    category: [code('http://terminology.hl7.org/CodeSystem/observation-category', o.category)],
    code: code(o.system || FHIR_SYSTEMS.loinc, o.code, o.code_display),
    subject: ref('Patient', o.patient_id),
    effectiveDateTime: o.effective_at,
    ...value,
    ...refRange,
    interpretation: o.interpretation ? [code('http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', o.interpretation)] : undefined,
    note: o.notes ? [{ text: o.notes }] : undefined,
  }
}

export function fromFhirObservation(r: any): Partial<PhloxObservation> {
  const out: Partial<PhloxObservation> = { id: r.id }
  const cat = (r.category || [])[0]?.coding?.[0]?.code
  out.category = (cat === 'vital-signs' || cat === 'laboratory' || cat === 'survey') ? cat : 'laboratory'
  const codeObj = r.code?.coding?.[0]
  if (codeObj) {
    out.code = codeObj.code
    out.code_display = codeObj.display
    out.system = codeObj.system
  }
  if (r.subject?.reference) {
    const m = String(r.subject.reference).match(/Patient\/(.+)/)
    if (m) out.patient_id = m[1]
  }
  if (r.valueQuantity) { out.value = r.valueQuantity.value; out.unit = r.valueQuantity.unit }
  const rr = (r.referenceRange || [])[0]
  if (rr) { out.ref_low = rr.low?.value; out.ref_high = rr.high?.value }
  out.interpretation = (r.interpretation || [])[0]?.coding?.[0]?.code
  out.effective_at = r.effectiveDateTime || r.issued || new Date().toISOString()
  out.notes = (r.note || [])[0]?.text
  return out
}

// ─── MedicationRequest ──────────────────────────────────────────────────────
export interface PhloxMedRequest {
  id: string
  patient_id?: string | null
  for_user_id?: string | null
  status: 'draft' | 'signed' | 'dispensed' | 'cancelled' | 'expired'
  dci: string
  brand_name?: string | null
  dose_text?: string | null
  ean_code?: string | null
  posology_json: any
  issued_at: string
  prescriber_id?: string | null
  prescriber_name?: string | null
  generic_allowed?: boolean
  prescription_type?: string | null
}

const MED_REQ_STATUS_MAP: Record<string, string> = {
  draft: 'draft', signed: 'active', dispensed: 'completed', cancelled: 'cancelled', expired: 'stopped',
}

export function toFhirMedicationRequest(m: PhloxMedRequest): any {
  const ids: FHIRIdentifier[] = []
  if (m.ean_code) ids.push({ system: FHIR_SYSTEMS.ean, value: m.ean_code })
  ids.push({ system: FHIR_SYSTEMS.phlox + '/MedicationRequest', value: m.id })

  const subject = m.patient_id ? ref('Patient', m.patient_id)
    : m.for_user_id ? { reference: `Patient/${m.for_user_id}`, display: 'Próprio' }
    : undefined

  // Dosage from posology_json
  const pos = m.posology_json || {}
  const dosage: any = {}
  if (pos.frequency_per_day && pos.schedule_times) {
    dosage.timing = {
      repeat: {
        frequency: pos.frequency_per_day,
        period: 1, periodUnit: 'd',
        timeOfDay: pos.schedule_times,
        duration: pos.duration_days || undefined,
        durationUnit: pos.duration_days ? 'd' : undefined,
      },
    }
  }
  if (pos.dose_amount && pos.dose_unit) {
    dosage.doseAndRate = [{
      doseQuantity: { value: pos.dose_amount, unit: pos.dose_unit },
    }]
  }
  if (pos.route) dosage.route = code(FHIR_SYSTEMS.snomed, pos.route, pos.route)
  if (pos.prn) dosage.asNeededBoolean = true
  if (pos.with_food === true) dosage.text = (dosage.text ? dosage.text + ' · ' : '') + 'Com comida'

  return {
    resourceType: 'MedicationRequest',
    id: m.id,
    identifier: ids,
    status: MED_REQ_STATUS_MAP[m.status] || 'unknown',
    intent: 'order',
    medicationCodeableConcept: code(FHIR_SYSTEMS.dci, m.dci, m.brand_name || m.dci),
    subject,
    authoredOn: m.issued_at,
    requester: m.prescriber_id ? { reference: `Practitioner/${m.prescriber_id}`, display: m.prescriber_name || undefined } : undefined,
    dosageInstruction: Object.keys(dosage).length > 0 ? [dosage] : undefined,
    substitution: { allowedBoolean: m.generic_allowed !== false },
  }
}

// ─── AllergyIntolerance ─────────────────────────────────────────────────────
export interface PhloxAllergy {
  id?: string
  patient_id?: string | null
  for_user_id?: string | null
  substance: string                                  // texto do alergeno
  criticality?: 'low' | 'high' | 'unable-to-assess'
  reaction?: string
  onset_date?: string
}

export function toFhirAllergy(a: PhloxAllergy): any {
  return {
    resourceType: 'AllergyIntolerance',
    id: a.id,
    clinicalStatus: code('http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', 'active'),
    verificationStatus: code('http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', 'unconfirmed'),
    type: 'allergy',
    code: { text: a.substance },
    patient: a.patient_id ? ref('Patient', a.patient_id) : a.for_user_id ? ref('Patient', a.for_user_id) : undefined,
    criticality: a.criticality || 'unable-to-assess',
    onsetDateTime: a.onset_date,
    reaction: a.reaction ? [{ description: a.reaction }] : undefined,
  }
}

// ─── Immunization ───────────────────────────────────────────────────────────
export interface PhloxImmunization {
  id?: string
  patient_id?: string | null
  for_user_id?: string | null
  vaccine_code: string                               // ex: 'gripe', 'tdap', 'covid'
  vaccine_name?: string
  given_at: string
  lot_number?: string
  site?: string
  route?: string
}

const PHLOX_VAX_TO_SNOMED: Record<string, { code: string; display: string }> = {
  gripe:    { code: '46233009',  display: 'Influenza vaccination' },
  tdap:     { code: '414003006', display: 'Tetanus, diphtheria and pertussis vaccination' },
  covid:    { code: '840534001', display: 'COVID-19 vaccination' },
  pneumo23: { code: '76668005',  display: 'Pneumococcal vaccination' },
  herpes_zoster: { code: '871762004', display: 'Herpes zoster vaccination' },
  hpv:      { code: '870592002', display: 'HPV vaccination' },
}

export function toFhirImmunization(i: PhloxImmunization): any {
  const mapped = PHLOX_VAX_TO_SNOMED[i.vaccine_code]
  return {
    resourceType: 'Immunization',
    id: i.id,
    status: 'completed',
    vaccineCode: mapped
      ? code(FHIR_SYSTEMS.snomed, mapped.code, mapped.display)
      : { text: i.vaccine_name || i.vaccine_code },
    patient: i.patient_id ? ref('Patient', i.patient_id) : i.for_user_id ? ref('Patient', i.for_user_id) : undefined,
    occurrenceDateTime: i.given_at,
    lotNumber: i.lot_number,
    site: i.site ? { text: i.site } : undefined,
    route: i.route ? { text: i.route } : undefined,
  }
}

export function fromFhirImmunization(r: any): Partial<PhloxImmunization> {
  const out: Partial<PhloxImmunization> = { id: r.id }
  // Procura mapeamento inverso a partir do code SNOMED
  const codeStr = (r.vaccineCode?.coding || []).find((c: any) => c.system === FHIR_SYSTEMS.snomed)?.code
  if (codeStr) {
    for (const [phlox, snomed] of Object.entries(PHLOX_VAX_TO_SNOMED)) {
      if (snomed.code === codeStr) { out.vaccine_code = phlox; break }
    }
  }
  out.vaccine_name = r.vaccineCode?.text || (r.vaccineCode?.coding || [])[0]?.display
  out.given_at = r.occurrenceDateTime || new Date().toISOString()
  out.lot_number = r.lotNumber
  if (r.patient?.reference) {
    const m = String(r.patient.reference).match(/Patient\/(.+)/)
    if (m) out.patient_id = m[1]
  }
  return out
}

// ─── Encounter (= episode) ──────────────────────────────────────────────────
export interface PhloxEncounter {
  id: string
  patient_id?: string | null
  kind: 'ambulatorio' | 'internamento' | 'urgencia' | 'tele' | 'domiciliario' | 'outro'
  start_at: string
  end_at?: string | null
  status: 'open' | 'closed' | 'cancelled'
  primary_complaint?: string | null
  diagnosis_codes?: string[] | null
}

const ENC_KIND_TO_CLASS: Record<string, string> = {
  ambulatorio: 'AMB', internamento: 'IMP', urgencia: 'EMER',
  tele: 'VR', domiciliario: 'HH', outro: 'AMB',
}

export function toFhirEncounter(e: PhloxEncounter): any {
  return {
    resourceType: 'Encounter',
    id: e.id,
    status: e.status === 'open' ? 'in-progress' : e.status === 'closed' ? 'finished' : 'cancelled',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: ENC_KIND_TO_CLASS[e.kind] || 'AMB' },
    subject: e.patient_id ? ref('Patient', e.patient_id) : undefined,
    period: { start: e.start_at, end: e.end_at || undefined },
    reasonCode: e.primary_complaint ? [{ text: e.primary_complaint }] : undefined,
    diagnosis: (e.diagnosis_codes || []).map(c => ({ condition: { display: c }, use: code('http://terminology.hl7.org/CodeSystem/diagnosis-role', 'CC') })),
  }
}

// ─── CapabilityStatement ────────────────────────────────────────────────────
export function capabilityStatement(): any {
  const supported = ['Patient','Practitioner','Organization','Encounter','Observation','MedicationRequest','MedicationStatement','AllergyIntolerance','Immunization','DiagnosticReport']
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'Phlox Clinical',
    kind: 'instance',
    software: { name: 'Phlox', version: '2026.06' },
    implementation: { description: 'Phlox FHIR R4 endpoint', url: (process.env.NEXT_PUBLIC_BASE_URL || '') + '/api/fhir' },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'application/json'],
    rest: [{
      mode: 'server',
      security: { service: [code('http://terminology.hl7.org/CodeSystem/restful-security-service', 'OAuth')] },
      resource: supported.map(t => ({
        type: t,
        interaction: [
          { code: 'read' },
          { code: 'search-type' },
          ...(t === 'Observation' || t === 'Patient' ? [{ code: 'create' }, { code: 'update' }] : []),
        ],
        searchParam: t === 'Patient'
          ? [
              { name: 'identifier', type: 'token' },
              { name: 'name',       type: 'string' },
              { name: 'birthdate',  type: 'date' },
            ]
          : t === 'Observation' ? [
              { name: 'patient', type: 'reference' },
              { name: 'code',    type: 'token' },
              { name: 'date',    type: 'date' },
            ]
          : [{ name: 'patient', type: 'reference' }],
      })),
    }],
  }
}

// ─── Erro OperationOutcome ──────────────────────────────────────────────────
export function operationOutcome(severity: 'fatal' | 'error' | 'warning' | 'information', diagnostics: string, code = 'processing'): any {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  }
}
