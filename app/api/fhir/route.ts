// app/api/fhir/route.ts
// Raiz do servidor FHIR. Não é um recurso FHIR em si — devolve uma "porta de
// entrada" legível que explica o que isto é e aponta para os endpoints reais.
// (Antes dava 404 ao abrir /api/fhir no browser, o que confundia.)
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const base = `${req.nextUrl.origin}/api/fhir`
  return NextResponse.json({
    server: 'Phlox FHIR R4',
    fhirVersion: '4.0.1',
    description: 'Endpoint FHIR R4 do Phlox para integração com laboratórios, hospitais e sistemas de saúde (SPMS, SClínico).',
    como_usar: 'Isto é uma API para sistemas falarem entre si — não é uma página para abrir no browser. Os sistemas autenticam com Bearer JWT ou API key (scope fhir:read / fhir:write) e fazem pedidos aos endpoints abaixo.',
    capabilityStatement: `${base}/metadata`,
    resources: {
      Patient: `${base}/Patient`,
      Observation: `${base}/Observation`,
      MedicationRequest: `${base}/MedicationRequest`,
      AllergyIntolerance: `${base}/AllergyIntolerance`,
      Immunization: `${base}/Immunization`,
      Encounter: `${base}/Encounter`,
    },
    documentacao: `${req.nextUrl.origin}/api-docs`,
  }, { headers: { 'Content-Type': 'application/json' } })
}
