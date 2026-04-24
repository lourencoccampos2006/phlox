import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

// Persistent cache using module-level Map (survives within same Worker instance)
const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60 * 1000

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
  'dabigatrano': 'dabigatran', 'insulina': 'insulin', 'levotiroxina': 'levothyroxine',
  'carbamazepina': 'carbamazepine', 'fenitoína': 'phenytoin', 'valproato': 'valproate',
  'levetiracetam': 'levetiracetam', 'gabapentina': 'gabapentin', 'pregabalina': 'pregabalin',
  'tramadol': 'tramadol', 'morfina': 'morphine', 'codeína': 'codeine', 'fentanil': 'fentanyl',
  'haloperidol': 'haloperidol', 'olanzapina': 'olanzapine', 'quetiapina': 'quetiapine',
  'risperidona': 'risperidone', 'lítio': 'lithium', 'hipericão': 'hypericum perforatum',
  'erva de são joão': 'hypericum perforatum', 'alho': 'garlic', 'álcool': 'alcohol',
  'cafeína': 'caffeine', 'toranja': 'grapefruit', 'magnésio': 'magnesium',
  'vitamina k': 'vitamin k', 'vitamina d': 'vitamin d',
}

function sanitize(s: string): string {
  return s.replace(/[<>'\";&\\\\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

function translate(drug: string): string {
  return PT_TO_EN[drug.toLowerCase().trim()] || drug
}

function getIP(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW })
    return true
  }
  if (record.count >= RATE_LIMIT) return false
  record.count++
  return true
}

async function normalizeRxNorm(drug: string): Promise<{ rxcui: string; name: string } | null> {
  const name = translate(drug)
  for (const url of [
    `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`,
    `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`,
  ]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      const data = await res.json()
      const rxcui = data?.idGroup?.rxnormId?.[0] || data?.approximateGroup?.candidate?.[0]?.rxcui
      if (rxcui) return { rxcui, name: data?.approximateGroup?.candidate?.[0]?.name || name }
    } catch { }
  }
  return null
}

async function rxnormInteractions(rxcuis: string[]): Promise<any[]> {
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const data = await res.json()
    const out: any[] = []
    for (const g of data?.fullInteractionTypeGroup || [])
      for (const t of g.fullInteractionType || [])
        for (const p of t.interactionPair || [])
          out.push({ severity: p.severity || 'unknown', description: p.description || '' })
    return out
  } catch { return [] }
}

function mapSev(s: string) {
  const l = s.toLowerCase()
  if (l.includes('high') || l.includes('contraindicated')) return 'GRAVE'
  if (l.includes('moderate')) return 'MODERADA'
  if (l.includes('low') || l.includes('minor')) return 'LIGEIRA'
  return 'SEM_INTERACAO'
}

async function aiAnalysis(drugs: string[]): Promise<any> {
  return aiJSON([
    {
      role: 'system',
      content: 'Farmacologista clínico. Responde APENAS com JSON válido sem markdown: {"severity":"GRAVE"|"MODERADA"|"LIGEIRA"|"SEM_INTERACAO","summary":"1-2 frases PT","mechanism":"mecanismo PT","consequences":"consequências PT","recommendation":"recomendação PT","monitor":["param"],"onset":"início esperado"}',
    },
    {
      role: 'user',
      content: `Interações entre: ${drugs.join(', ')}`,
    },
  ], { maxTokens: 700, temperature: 0.1 })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.drugs || !Array.isArray(body.drugs)) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const drugs = body.drugs.map(sanitize).filter(Boolean)
  if (drugs.length < 2 || drugs.length > 10) {
    return NextResponse.json({ error: 'Entre 2 e 10 substâncias' }, { status: 400 })
  }

  const key = [...drugs].sort().join('|').toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cached.result, cached: true })
  }

  try {
    const normalized = (await Promise.allSettled(drugs.map(normalizeRxNorm)))
      .filter(r => r.status === 'fulfilled' && r.value).map(r => (r as any).value)
    const rxcuis = normalized.map((d: any) => d.rxcui)

    let interactions: any[] = []
    if (rxcuis.length >= 2) interactions = await rxnormInteractions(rxcuis)

    let result: any

    if (interactions.length > 0) {
      const order = ['GRAVE', 'MODERADA', 'LIGEIRA', 'SEM_INTERACAO']
      const worst = interactions.reduce((p, c) =>
        order.indexOf(mapSev(c.severity)) < order.indexOf(mapSev(p.severity)) ? c : p
      )
      const severity = mapSev(worst.severity)
      result = {
        severity,
        summary: worst.description,
        mechanism: `Interação identificada pela base de dados RxNorm/NIH. ${interactions.length} par(es) encontrado(s).`,
        consequences: interactions.slice(0, 2).map((i: any) => i.description).join(' '),
        recommendation: severity === 'GRAVE'
          ? 'Combinação potencialmente perigosa. Consulte um médico ou farmacêutico antes de usar.'
          : severity === 'MODERADA'
          ? 'Use com precaução. Monitorize sintomas e consulte um profissional de saúde.'
          : 'Interação de baixo risco. Informe sempre o seu médico sobre toda a medicação.',
        monitor: drugs,
        source: 'rxnorm',
        interactions_count: interactions.length,
        drugs_normalized: normalized.map((d: any) => d.name),
      }
    } else {
      result = await aiAnalysis(drugs)
      result.source = 'ai'
      result.drugs_normalized = normalized.map((d: any) => d.name)
    }

    cache.set(key, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Interactions error:', err?.message)
    if (err?.status === 429) return NextResponse.json({ error: 'Serviço temporariamente indisponível. Tenta em breve.' }, { status: 503 })
    return NextResponse.json({ error: err.message || 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}