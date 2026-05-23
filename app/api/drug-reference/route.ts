import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Free, no-key public reference data:
//  • RxNorm / RxNav (NIH) — normalização do nome do fármaco
//  • OpenFDA drug label — interações, avisos, posologia, RAM (fonte FDA)
// Tudo server-side para evitar CORS. Falha graciosamente.

const TIMEOUT = 7000

async function fetchJSON(url: string): Promise<any | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function clean(arr: unknown, max = 1200): string | null {
  if (!Array.isArray(arr) || !arr.length) return null
  const text = String(arr[0]).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, '') + '…' : text
}

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 2) return NextResponse.json({ error: 'Nome do fármaco obrigatório' }, { status: 400 })

  // 1) Normalize via RxNorm (best-effort)
  let normalized = q
  const rx = await fetchJSON(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(q)}&search=2`)
  const rxcui = rx?.idGroup?.rxnormId?.[0]
  if (rxcui) {
    const props = await fetchJSON(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`)
    const n = props?.propConceptGroup?.propConcept?.[0]?.propValue
    if (n) normalized = n
  }

  // 2) OpenFDA label
  const term = encodeURIComponent(`"${q}"`)
  const fda = await fetchJSON(`https://api.fda.gov/drug/label.json?search=(openfda.generic_name:${term}+OR+openfda.brand_name:${term})&limit=1`)
  const res = fda?.results?.[0]

  if (!res) {
    return NextResponse.json({
      found: false, normalized, rxcui: rxcui || null,
      message: 'Sem ficha de referência FDA para este termo. A informação clínica em PT continua disponível pela análise por IA.',
    })
  }

  const of = res.openfda || {}
  return NextResponse.json({
    found: true,
    normalized,
    rxcui: rxcui || null,
    generic_name: of.generic_name?.[0] || null,
    brand_names: (of.brand_name || []).slice(0, 5),
    manufacturer: of.manufacturer_name?.[0] || null,
    boxed_warning: clean(res.boxed_warning, 800),
    indications: clean(res.indications_and_usage, 900),
    dosage: clean(res.dosage_and_administration, 900),
    warnings: clean(res.warnings || res.warnings_and_cautions, 900),
    interactions: clean(res.drug_interactions, 1100),
    adverse_reactions: clean(res.adverse_reactions, 900),
    contraindications: clean(res.contraindications, 700),
    source: 'OpenFDA (rótulo FDA) · RxNorm (NIH) — em inglês',
  })
}
