// app/api/fhir/metadata/route.ts
// CapabilityStatement (FHIR R4). Endpoint público — não requer auth.
import { NextResponse } from 'next/server'
import { capabilityStatement } from '@/lib/fhir'

export async function GET() {
  return NextResponse.json(capabilityStatement(), {
    headers: { 'Content-Type': 'application/fhir+json' },
  })
}
