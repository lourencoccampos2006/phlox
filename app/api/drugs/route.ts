import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 6

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const term = q.trim().toLowerCase()
  const cached = cache.get(term)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const [labelRes, adverseRes] = await Promise.allSettled([
      fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(term)}"&limit=1`, { signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(term)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`, { signal: AbortSignal.timeout(8000) }),
    ])

    const labelData = labelRes.status === 'fulfilled' && labelRes.value.ok ? await labelRes.value.json() : null
    const adverseData = adverseRes.status === 'fulfilled' && adverseRes.value.ok ? await adverseRes.value.json() : null

    const drug = labelData?.results?.[0]
    if (!drug) {
      // Try brand name search
      const brandRes = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(term)}"&limit=1`, { signal: AbortSignal.timeout(8000) })
      const brandData = brandRes.ok ? await brandRes.json() : null
      const brandDrug = brandData?.results?.[0]
      if (!brandDrug) return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })

      const result = formatDrug(brandDrug, adverseData, term)
      cache.set(term, { result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    const result = formatDrug(drug, adverseData, term)
    cache.set(term, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao pesquisar. Tenta novamente.' }, { status: 500 })
  }
}

function formatDrug(drug: any, adverseData: any, term: string) {
  return {
    generic_name: drug.openfda?.generic_name?.[0] || term,
    brand_names: drug.openfda?.brand_name || [],
    manufacturer: drug.openfda?.manufacturer_name?.[0] || '',
    indications: drug.indications_and_usage?.[0] || '',
    dosage: drug.dosage_and_administration?.[0] || '',
    contraindications: drug.contraindications?.[0] || '',
    warnings: drug.warnings?.[0] || drug.warnings_and_cautions?.[0] || '',
    adverse_reactions: drug.adverse_reactions?.[0] || '',
    top_adverse_events: adverseData?.results?.slice(0, 10) || [],
  }
}