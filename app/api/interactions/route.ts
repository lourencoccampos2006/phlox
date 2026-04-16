import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24

const PT_TO_EN: Record<string, string> = {
  'ibuprofeno': 'ibuprofen', 'paracetamol': 'acetaminophen', 'aspirina': 'aspirin',
  'varfarina': 'warfarin', 'metformina': 'metformin', 'atorvastatina': 'atorvastatin',
  'omeprazol': 'omeprazole', 'amoxicilina': 'amoxicillin', 'sertralina': 'sertraline',
  'fluoxetina': 'fluoxetine', 'diazepam': 'diazepam', 'lorazepam': 'lorazepam',
  'alprazolam': 'alprazolam', 'ramipril': 'ramipril', 'lisinopril': 'lisinopril',
  'amlodipina': 'amlodipine', 'bisoprolol': 'bisoprolol', 'metoprolol': 'metoprolol',
  'atenolol': 'atenolol', 'furosemida': 'furosemide', 'espironolactona': 'spironolactone',
  'digoxina': 'digoxin', 'amiodarona': 'amiodarone', 'clopidogrel': 'clopidogrel',
  'sinvastatina': 'simvastatin', 'rosuvastatina': 'rosuvastatin', 'pantoprazol': 'pantoprazole',
  'lansoprazol': 'lansoprazole', 'metoclopramida': 'metoclopramide', 'ondansetrom': 'ondansetron',
  'dexametasona': 'dexamethasone', 'prednisolona': 'prednisolone', 'prednisona': 'prednisone',
  'hidrocortisona': 'hydrocortisone', 'azitromicina': 'azithromycin', 'claritromicina': 'clarithromycin',
  'ciprofloxacina': 'ciprofloxacin', 'levofloxacina': 'levofloxacin', 'heparina': 'heparin',
  'enoxaparina': 'enoxaparin', 'rivaroxabano': 'rivaroxaban', 'apixabano': 'apixaban',
  'dabigatrano': 'dabigatran', 'insulina': 'insulin', 'glibenclamida': 'glibenclamide',
  'sitagliptina': 'sitagliptin', 'levotiroxina': 'levothyroxine', 'carbamazepina': 'carbamazepine',
  'fenitoína': 'phenytoin', 'valproato': 'valproate', 'levetiracetam': 'levetiracetam',
  'gabapentina': 'gabapentin', 'pregabalina': 'pregabalin', 'tramadol': 'tramadol',
  'morfina': 'morphine', 'codeína': 'codeine', 'fentanil': 'fentanyl',
  'haloperidol': 'haloperidol', 'olanzapina': 'olanzapine', 'quetiapina': 'quetiapine',
  'risperidona': 'risperidone', 'lítio': 'lithium', 'hipericão': 'hypericum perforatum',
  'erva de são joão': 'hypericum perforatum', 'ginkgo biloba': 'ginkgo biloba',
  'alho': 'garlic', 'ginseng': 'ginseng', 'álcool': 'alcohol', 'cafeína': 'caffeine',
  'toranja': 'grapefruit', 'magnésio': 'magnesium', 'cálcio': 'calcium', 'ferro': 'iron',
  'vitamina k': 'vitamin k', 'vitamina d': 'vitamin d',
}

function translateDrug(drug: string): string {
  return PT_TO_EN[drug.toLowerCase().trim()] || drug
}

function sanitize(input: string): string {
  return input.replace(/[<>'";&]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

async function normalizeWithRxNorm(drug: string): Promise<{ rxcui: string; name: string } | null> {
  const name = translateDrug(drug)
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const rxcui = data?.idGroup?.rxnormId?.[0]
    if (rxcui) return { rxcui, name }
  } catch { }
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const candidate = data?.approximateGroup?.candidate?.[0]
    if (candidate?.rxcui) return { rxcui: candidate.rxcui, name: candidate.name || name }
  } catch { }
  return null
}

async function checkRxNorm(rxcuis: string[]): Promise<any[]> {
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const data = await res.json()
    const interactions: any[] = []
    for (const group of data?.fullInteractionTypeGroup || []) {
      for (const type of group.fullInteractionType || []) {
        for (const pair of type.interactionPair || []) {
          interactions.push({ severity: pair.severity || 'unknown', description: pair.description || '' })
        }
      }
    }
    return interactions
  } catch { return [] }
}

function mapSeverity(s: string): string {
  const l = (s || '').toLowerCase()
  if (l.includes('high') || l.includes('contraindicated')) return 'GRAVE'
  if (l.includes('moderate') || l.includes('medium')) return 'MODERADA'
  if (l.includes('low') || l.includes('minor')) return 'LIGEIRA'
  return 'SEM_INTERACAO'
}

async function checkWithAI(drugs: string[]): Promise<any> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `És um farmacologista clínico sénior. Responde APENAS com JSON válido sem texto antes ou depois:
{"severity":"GRAVE"|"MODERADA"|"LIGEIRA"|"SEM_INTERACAO","summary":"resumo em português","mechanism":"mecanismo em português","consequences":"consequências em português","recommendation":"recomendação em português","monitor":["param1"],"onset":"início esperado"}`
      },
      { role: 'user', content: `Analisa interações entre: ${drugs.join(', ')}` }
    ],
    temperature: 0.1,
    max_tokens: 800,
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

    const sanitized = drugs.map(sanitize).filter(Boolean)
    if (sanitized.length < 2) return NextResponse.json({ error: 'Nomes inválidos' }, { status: 400 })

    const cacheKey = [...sanitized].sort().join('|').toLowerCase()
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cached.result, cached: true })
    }

    const normalized = await Promise.allSettled(sanitized.map(normalizeWithRxNorm))
    const validDrugs = normalized.filter(r => r.status === 'fulfilled' && r.value).map(r => (r as any).value)
    const rxcuis = validDrugs.map((d: any) => d.rxcui)

    let rxnormInteractions: any[] = []
    if (rxcuis.length >= 2) rxnormInteractions = await checkRxNorm(rxcuis)

    if (rxnormInteractions.length > 0) {
      const severityOrder = ['GRAVE', 'MODERADA', 'LIGEIRA', 'SEM_INTERACAO']
      const mostSevere = rxnormInteractions.reduce((prev, curr) =>
        severityOrder.indexOf(mapSeverity(curr.severity)) < severityOrder.indexOf(mapSeverity(prev.severity)) ? curr : prev
      )
      const severity = mapSeverity(mostSevere.severity)
      const result = {
        severity,
        summary: mostSevere.description,
        mechanism: `Interação identificada pela base de dados RxNorm (NIH). ${rxnormInteractions.length} pares encontrados.`,
        consequences: rxnormInteractions.slice(0, 2).map((i: any) => i.description).join(' '),
        recommendation: severity === 'GRAVE' ? 'Combinação potencialmente perigosa. Consulte um profissional de saúde.'
          : severity === 'MODERADA' ? 'Use com precaução. Monitorize sintomas.'
          : 'Interação de baixo risco. Informe o seu médico.',
        monitor: sanitized,
        source: 'rxnorm',
        interactions_count: rxnormInteractions.length,
        drugs_normalized: validDrugs.map((d: any) => d.name),
      }
      cache.set(cacheKey, { result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    const result = await checkWithAI(sanitized)
    result.source = 'ai'
    result.drugs_normalized = validDrugs.map((d: any) => d.name)
    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Interactions error:', error?.message)
    return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}