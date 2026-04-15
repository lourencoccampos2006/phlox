import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const limit = searchParams.get('limit') || '10'

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Busca informação do medicamento na OpenFDA
    const [labelRes, adverseRes] = await Promise.all([
      fetch(
        `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(query)}"&limit=${limit}`
      ),
      fetch(
        `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(query)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`
      )
    ])

    const labelData = labelRes.ok ? await labelRes.json() : null
    const adverseData = adverseRes.ok ? await adverseRes.json() : null

    const drug = labelData?.results?.[0]

    if (!drug) {
      return NextResponse.json({ error: 'Drug not found' }, { status: 404 })
    }

    return NextResponse.json({
      name: query,
      brand_names: drug.openfda?.brand_name || [],
      generic_name: drug.openfda?.generic_name?.[0] || query,
      manufacturer: drug.openfda?.manufacturer_name?.[0] || 'Unknown',
      indications: drug.indications_and_usage?.[0] || null,
      warnings: drug.warnings?.[0] || null,
      dosage: drug.dosage_and_administration?.[0] || null,
      contraindications: drug.contraindications?.[0] || null,
      adverse_reactions: drug.adverse_reactions?.[0] || null,
      top_adverse_events: adverseData?.results?.slice(0, 10) || [],
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch drug data' }, { status: 500 })
  }
}