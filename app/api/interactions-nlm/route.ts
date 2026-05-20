import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// ─── NLM RxNorm + OpenFDA Drug Interaction API ───────────────────────────────
// Free public APIs, no key required.
// Sources: DrugBank, ONCHigh, NDF-RT, NDFRT, MTHSPL (via NLM)
//
// Usage: POST { drugs: string[] }
// Returns: { interactions, drug_info, sources }

const NLM_BASE = 'https://rxnav.nlm.nih.gov/REST'
const FDA_BASE = 'https://api.fda.gov/drug'

// Resolve drug name → RxCUI (RxNorm Concept Unique Identifier)
async function resolveRxCUI(name: string): Promise<{ rxcui: string; name: string } | null> {
  try {
    const url = `${NLM_BASE}/rxcui.json?name=${encodeURIComponent(name)}&search=1`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const ids = data?.idGroup?.rxnormId
    const resolved_name = data?.idGroup?.name || name
    if (ids && ids.length > 0) return { rxcui: ids[0], name: resolved_name }
    return null
  } catch {
    return null
  }
}

// Fetch interaction data for a list of RxCUIs
async function fetchInteractions(rxcuis: string[]): Promise<any[]> {
  if (rxcuis.length < 2) return []
  try {
    const cuiParam = rxcuis.join('+')
    const url = `${NLM_BASE}/interaction/list.json?rxcuis=${cuiParam}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data?.fullInteractionTypeGroup ?? []
  } catch {
    return []
  }
}

// Fetch OpenFDA adverse events count for a drug (top reported events)
async function fetchFDALabel(drugName: string): Promise<any | null> {
  try {
    const url = `${FDA_BASE}/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.results?.[0]
    if (!result) return null
    return {
      warnings_and_cautions: result.warnings_and_cautions?.[0]?.substring(0, 400),
      contraindications: result.contraindications?.[0]?.substring(0, 300),
      drug_interactions: result.drug_interactions?.[0]?.substring(0, 400),
      pregnancy: result.pregnancy?.[0]?.substring(0, 200),
    }
  } catch {
    return null
  }
}

// Classify severity from NLM source data
function classifySeverity(pair: any): 'grave' | 'moderada' | 'leve' | 'desconhecida' {
  const desc = (pair.description || '').toLowerCase()
  const severity = (pair.severity || '').toLowerCase()
  if (severity.includes('high') || severity.includes('severe') ||
      desc.includes('hemorrhage') || desc.includes('serious') ||
      desc.includes('severe') || desc.includes('fatal') ||
      desc.includes('hemorragia') || desc.includes('grave')) return 'grave'
  if (severity.includes('moderate') || desc.includes('moderate') ||
      desc.includes('significantly') || desc.includes('increase the risk')) return 'moderada'
  if (severity.includes('low') || desc.includes('minor') || desc.includes('mild')) return 'leve'
  return 'desconhecida'
}

// Parse NLM interaction response into structured format
function parseNLMInteractions(groups: any[], resolvedDrugs: { name: string; rxcui: string }[]) {
  const interactions: {
    drug1: string; drug2: string; severity: string
    description: string; mechanism: string; source: string; source_url?: string
  }[] = []

  for (const group of groups) {
    const source = group.sourceName || 'NLM'
    for (const type of (group.fullInteractionType || [])) {
      for (const pair of (type.interactionPair || [])) {
        const concepts = pair.interactionConcept || []
        const drug1_name = concepts[0]?.minConceptItem?.name || concepts[0]?.sourceConceptItem?.name || '—'
        const drug2_name = concepts[1]?.minConceptItem?.name || concepts[1]?.sourceConceptItem?.name || '—'

        const severity = classifySeverity(pair)
        const description = pair.description || ''

        interactions.push({
          drug1: drug1_name,
          drug2: drug2_name,
          severity,
          description: description.substring(0, 500),
          mechanism: type.comment || '',
          source,
        })
      }
    }
  }

  // Deduplicate (NLM sometimes returns duplicates from multiple sources)
  const seen = new Set<string>()
  return interactions.filter(ix => {
    const key = [ix.drug1, ix.drug2].sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => {
    const order = { grave: 0, moderada: 1, leve: 2, desconhecida: 3 }
    return order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order]
  })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const limit = checkRateLimit(ip, 20, 60000)
  if (!limit.allowed) return rateLimitResponse()

  let body: { drugs?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const drugs = body.drugs?.filter(Boolean).slice(0, 20)
  if (!drugs || drugs.length < 1) {
    return NextResponse.json({ error: 'Fornecer pelo menos 1 medicamento' }, { status: 400 })
  }

  // Step 1: Resolve all drug names to RxCUI in parallel
  const resolutions = await Promise.all(drugs.map(d => resolveRxCUI(d)))
  const resolved = resolutions.map((r, i) => ({
    input: drugs[i],
    rxcui: r?.rxcui ?? null,
    name: r?.name ?? drugs[i],
    found: !!r,
  }))

  // Step 2: Fetch interactions for all resolved RxCUIs
  const rxcuis = resolved.filter(r => r.rxcui).map(r => r.rxcui!)
  const [interactionGroups] = await Promise.all([
    drugs.length >= 2 ? fetchInteractions(rxcuis) : Promise.resolve([]),
  ])

  const interactions = parseNLMInteractions(interactionGroups, resolved.filter(r => r.rxcui) as any)

  // Step 3: Fetch FDA label data for each drug (limited, take first 3)
  const fdaData: Record<string, any> = {}
  await Promise.all(
    drugs.slice(0, 4).map(async d => {
      const label = await fetchFDALabel(d)
      if (label) fdaData[d] = label
    })
  )

  return NextResponse.json({
    resolved,
    interactions,
    fda_labels: fdaData,
    sources: [
      { name: 'NLM RxNorm', url: 'https://rxnav.nlm.nih.gov', desc: 'Interações de DrugBank, ONCHigh, NDF-RT via NIH' },
      { name: 'OpenFDA', url: 'https://open.fda.gov', desc: 'Alertas e contraindicações da FDA' },
    ],
    unresolved: resolved.filter(r => !r.rxcui).map(r => r.input),
    interaction_count: interactions.length,
    grave_count: interactions.filter(i => i.severity === 'grave').length,
  })
}
