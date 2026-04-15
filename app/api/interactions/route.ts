import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24

const PT_TO_EN: Record<string, string> = {
  'ibuprofeno': 'ibuprofen',
  'paracetamol': 'acetaminophen',
  'aspirina': 'aspirin',
  'ácido acetilsalicílico': 'aspirin',
  'varfarina': 'warfarin',
  'metformina': 'metformin',
  'atorvastatina': 'atorvastatin',
  'omeprazol': 'omeprazole',
  'amoxicilina': 'amoxicillin',
  'sertralina': 'sertraline',
  'fluoxetina': 'fluoxetine',
  'diazepam': 'diazepam',
  'lorazepam': 'lorazepam',
  'alprazolam': 'alprazolam',
  'ramipril': 'ramipril',
  'lisinopril': 'lisinopril',
  'amlodipina': 'amlodipine',
  'bisoprolol': 'bisoprolol',
  'metoprolol': 'metoprolol',
  'atenolol': 'atenolol',
  'furosemida': 'furosemide',
  'espironolactona': 'spironolactone',
  'digoxina': 'digoxin',
  'amiodarona': 'amiodarone',
  'clopidogrel': 'clopidogrel',
  'sinvastatina': 'simvastatin',
  'rosuvastatina': 'rosuvastatin',
  'pantoprazol': 'pantoprazole',
  'lansoprazol': 'lansoprazole',
  'metoclopramida': 'metoclopramide',
  'ondansetrom': 'ondansetron',
  'dexametasona': 'dexamethasone',
  'prednisolona': 'prednisolone',
  'prednisona': 'prednisone',
  'hidrocortisona': 'hydrocortisone',
  'azitromicina': 'azithromycin',
  'claritromicina': 'clarithromycin',
  'ciprofloxacina': 'ciprofloxacin',
  'levofloxacina': 'levofloxacin',
  'heparina': 'heparin',
  'enoxaparina': 'enoxaparin',
  'rivaroxabano': 'rivaroxaban',
  'apixabano': 'apixaban',
  'dabigatrano': 'dabigatran',
  'insulina': 'insulin',
  'glibenclamida': 'glibenclamide',
  'sitagliptina': 'sitagliptin',
  'levotiroxina': 'levothyroxine',
  'carbamazepina': 'carbamazepine',
  'fenitoína': 'phenytoin',
  'valproato': 'valproate',
  'levetiracetam': 'levetiracetam',
  'gabapentina': 'gabapentin',
  'pregabalina': 'pregabalin',
  'tramadol': 'tramadol',
  'morfina': 'morphine',
  'codeína': 'codeine',
  'fentanil': 'fentanyl',
  'haloperidol': 'haloperidol',
  'olanzapina': 'olanzapine',
  'quetiapina': 'quetiapine',
  'risperidona': 'risperidone',
  'lítio': 'lithium',
  'hipericão': 'hypericum perforatum',
  'erva de são joão': 'hypericum perforatum',
  'ginkgo biloba': 'ginkgo biloba',
  'equinácea': 'echinacea',
  'alho': 'garlic',
  'ginseng': 'ginseng',
  'ómega-3': 'omega-3 fatty acids',
  'vitamina k': 'vitamin k',
  'vitamina d': 'vitamin d',
  'magnésio': 'magnesium',
  'cálcio': 'calcium',
  'ferro': 'iron',
  'álcool': 'alcohol',
  'cafeína': 'caffeine',
  'toranja': 'grapefruit',
}

function translateDrug(drug: string): string {
  return PT_TO_EN[drug.toLowerCase().trim()] || drug
}

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>'";&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

async function normalizeWithRxNorm(drug: string): Promise<{ rxcui: string; name: string } | null> {
  const englishName = translateDrug(drug)

  try {
    const res = await fetchWithTimeout(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(englishName)}&search=1`
    )
    const data = await res.json()
    const rxcui = data?.idGroup?.rxnormId?.[0]
    if (rxcui) return { rxcui, name: englishName }
  } catch { }

  try {
    const res = await fetchWithTimeout(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(englishName)}&maxEntries=1`
    )
    const data = await res.json()
    const candidate = data?.approximateGroup?.candidate?.[0]
    if (candidate?.rxcui) return { rxcui: candidate.rxcui, name: candidate.name || englishName }
  } catch { }

  return null
}

async function checkRxNormInteractions(rxcuis: string[]): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(
      `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`
    )
    if (!res.ok) return []
    const data = await res.json()
    const interactions: any[] = []

    for (const group of data?.fullInteractionTypeGroup || []) {
      for (const type of group.fullInteractionType || []) {
        for (const pair of type.interactionPair || []) {
          interactions.push({
            severity: pair.severity || 'unknown',
            description: pair.description || '',
            drugs: pair.interactionConcept?.map((c: any) => c.minConceptItem?.name).filter(Boolean) || [],
          })
        }
      }
    }

    return interactions
  } catch {
    return []
  }
}

function mapSeverity(s: string): string {
  const lower = (s || '').toLowerCase()
  if (lower.includes('high') || lower.includes('contraindicated')) return 'GRAVE'
  if (lower.includes('moderate') || lower.includes('medium')) return 'MODERADA'
  if (lower.includes('low') || lower.includes('minor')) return 'LIGEIRA'
  return 'SEM_INTERACAO'
}

async function checkWithAI(drugs: string[], context: any[]): Promise<any> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `És um farmacologista clínico sénior. Responde APENAS com JSON válido:
{
  "severity": "GRAVE" ou "MODERADA" ou "LIGEIRA" ou "SEM_INTERACAO",
  "summary": "resumo clínico em português, 1-2 frases",
  "mechanism": "mecanismo farmacológico detalhado em português",
  "consequences": "consequências clínicas em português",
  "recommendation": "recomendação clara em português",
  "monitor": ["parâmetro1", "parâmetro2"],
  "onset": "início esperado da interação",
  "severity_rationale": "justificação da gravidade"
}`
      },
      {
        role: 'user',
        content: `Analisa interações entre: ${drugs.join(', ')}${context.length > 0 ? `\nContexto RxNorm: ${JSON.stringify(context)}` : ''}`
      }
    ],
    temperature: 0.1,
    max_tokens: 1000,
  })

  const text = completion.choices[0]?.message?.content || ''
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

    const { drugs } = body
    if (!Array.isArray(drugs) || drugs.length < 2 || drugs.length > 10) {
      return NextResponse.json({ error: 'Entre 2 e 10 substâncias são necessárias' }, { status: 400 })
    }

    const sanitized = drugs.map(sanitizeInput).filter(Boolean)
    if (sanitized.length < 2) {
      return NextResponse.json({ error: 'Nomes de substâncias inválidos' }, { status: 400 })
    }

    const cacheKey = [...sanitized].sort().join('|').toLowerCase()
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cached.result, cached: true })
    }

    // Step 1: Normalize via RxNorm
    const normalized = await Promise.allSettled(sanitized.map(normalizeWithRxNorm))
    const validDrugs = normalized
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => (r as PromiseFulfilledResult<any>).value)
    const rxcuis = validDrugs.map((d: any) => d.rxcui)

    // Step 2: RxNorm interactions
    let rxnormInteractions: any[] = []
    if (rxcuis.length >= 2) {
      rxnormInteractions = await checkRxNormInteractions(rxcuis)
    }

    // Step 3: Use RxNorm data if available
    if (rxnormInteractions.length > 0) {
      const severityOrder = ['GRAVE', 'MODERADA', 'LIGEIRA', 'SEM_INTERACAO']
      const mostSevere = rxnormInteractions.reduce((prev, curr) =>
        severityOrder.indexOf(mapSeverity(curr.severity)) < severityOrder.indexOf(mapSeverity(prev.severity)) ? curr : prev
      )

      const severity = mapSeverity(mostSevere.severity)
      const result = {
        severity,
        summary: mostSevere.description,
        mechanism: `Interação identificada pela base de dados RxNorm (NIH). ${rxnormInteractions.length > 1 ? `${rxnormInteractions.length} pares de interação encontrados.` : ''}`,
        consequences: rxnormInteractions.slice(0, 3).map((i: any) => i.description).join(' '),
        recommendation: severity === 'GRAVE'
          ? 'Combinação potencialmente perigosa. Consulte o médico ou farmacêutico antes de usar.'
          : severity === 'MODERADA'
            ? 'Use com precaução. Monitorize sintomas e consulte um profissional de saúde.'
            : 'Interação de baixo risco. Informe o seu médico sobre todos os medicamentos que toma.',
        monitor: sanitized,
        source: 'rxnorm',
        interactions_count: rxnormInteractions.length,
        drugs_normalized: validDrugs.map((d: any) => d.name),
      }

      cache.set(cacheKey, { result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    // Step 4: AI fallback
    const result = await checkWithAI(sanitized, rxnormInteractions)
    result.source = 'ai'
    result.drugs_normalized = validDrugs.map((d: any) => d.name)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Interactions error:', error?.message)

    // User-friendly error messages
    if (error?.message?.includes('429')) {
      return NextResponse.json({ error: 'Serviço temporariamente sobrecarregado. Tenta em alguns segundos.' }, { status: 503 })
    }
    if (error?.message?.includes('fetch')) {
      return NextResponse.json({ error: 'Erro de ligação. Verifica a tua internet e tenta novamente.' }, { status: 503 })
    }

    return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}