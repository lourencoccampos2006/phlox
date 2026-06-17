import { NextRequest, NextResponse } from 'next/server'
import { aiJSONVerified } from '@/lib/ai'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

const rateLimitMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 25
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
  'esomeprazol': 'esomeprazole', 'rabeprazol': 'rabeprazole', 'venlafaxina': 'venlafaxine',
  'duloxetina': 'duloxetine', 'paroxetina': 'paroxetine', 'escitalopram': 'escitalopram',
  'citalopram': 'citalopram', 'mirtazapina': 'mirtazapine', 'bupropion': 'bupropion',
  'clonazepam': 'clonazepam', 'zolpidem': 'zolpidem', 'melatonina': 'melatonin',
  'metildopa': 'methyldopa', 'hidralazina': 'hydralazine', 'nifedipina': 'nifedipine',
  'verapamilo': 'verapamil', 'diltiazem': 'diltiazem', 'propranolol': 'propranolol',
  'carvedilol': 'carvedilol', 'nebivolol': 'nebivolol', 'perindopril': 'perindopril',
  'enalapril': 'enalapril', 'losartan': 'losartan', 'valsartan': 'valsartan',
  'telmisartan': 'telmisartan', 'irbesartan': 'irbesartan', 'candesartan': 'candesartan',
  'sacubitril': 'sacubitril', 'empagliflozina': 'empagliflozin', 'dapagliflozina': 'dapagliflozin',
  'sitagliptina': 'sitagliptin', 'liraglutido': 'liraglutide', 'semaglutido': 'semaglutide',
  'glibenclamida': 'glibenclamide', 'glimepirida': 'glimepiride', 'pioglitazona': 'pioglitazone',
  'fenofibrato': 'fenofibrate', 'ezetimibe': 'ezetimibe', 'colestipol': 'colestipol',
  'alopurinol': 'allopurinol', 'febuxostate': 'febuxostat', 'colchicina': 'colchicine',
  'metotrexato': 'methotrexate', 'hidroxicloroquina': 'hydroxychloroquine',
  'leflunomida': 'leflunomide', 'sulfassalazina': 'sulfasalazine',
  'fluconazol': 'fluconazole', 'itraconazol': 'itraconazole', 'voriconazol': 'voriconazole',
  'aciclovir': 'acyclovir', 'valaciclovir': 'valacyclovir', 'oseltamivir': 'oseltamivir',
  'cotrimoxazol': 'trimethoprim-sulfamethoxazole', 'doxiciclina': 'doxycycline',
  'tetraciclina': 'tetracycline', 'clindamicina': 'clindamycin', 'vancomicina': 'vancomycin',
  'gentamicina': 'gentamicin', 'amicacina': 'amikacin', 'linezolide': 'linezolid',
  'meropenem': 'meropenem', 'imipenem': 'imipenem', 'piperacilina': 'piperacillin',
  'ceftriaxona': 'ceftriaxone', 'cefuroxima': 'cefuroxime', 'cefalexina': 'cephalexin',
  'amoxicilina-clavulanato': 'amoxicillin-clavulanate', 'nitrofurantoína': 'nitrofurantoin',
  'fosfomicina': 'fosfomycin', 'rivastignina': 'rivastigmine', 'donepezilo': 'donepezil',
  'memantina': 'memantine', 'levodopa': 'levodopa', 'pramipexole': 'pramipexole',
  'ropinirol': 'ropinirole', 'rasagilina': 'rasagiline', 'selegilina': 'selegiline',
}

function sanitize(s: string): string {
  return s.replace(/[<>'";&\\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)
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
  if (!record || now > record.reset) { rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW }); return true }
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
    } catch (_e: any) { }
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
  } catch (_e: any) { return [] }
}

function mapSev(s: string) {
  const l = s.toLowerCase()
  if (l.includes('high') || l.includes('contraindicated')) return 'GRAVE'
  if (l.includes('moderate')) return 'MODERADA'
  if (l.includes('low') || l.includes('minor')) return 'LIGEIRA'
  return 'SEM_INTERACAO'
}

// ─── AI Analysis — muito mais rica que antes ─────────────────────────────────
async function aiAnalysis(drugs: string[]): Promise<any> {
  return aiJSONVerified([
    {
      role: 'system',
      content: `És um farmacologista clínico especialista em interações medicamentosas. Analisas combinações de fármacos com rigor clínico e respondes em português europeu (PT-PT).

Responde APENAS com JSON válido sem markdown:
{
  "severity": "GRAVE"|"MODERADA"|"LIGEIRA"|"SEM_INTERACAO",
  "summary": "descrição clara da interação principal em 1-2 frases",
  "mechanism": "mecanismo farmacológico detalhado (ex: inibição do CYP3A4, efeito aditivo sobre QT, competição de ligação à albumina)",
  "cyp450": {
    "involved": true|false,
    "enzymes": ["CYP3A4", "CYP2C9"],
    "type": "inibição"|"indução"|"substrato"|null,
    "clinical_relevance": "descrição clínica se envolvido"
  },
  "consequences": "consequências clínicas concretas — o que pode acontecer ao doente",
  "onset": "início esperado da interação (ex: 'Imediata', '2-5 dias', '1-2 semanas')",
  "risk_factors": ["factor que aumenta o risco (ex: 'Insuficiência renal', 'Idade > 65 anos', 'Dose elevada')"],
  "recommendation": "recomendação clínica concreta e accionável",
  "alternatives": ["alternativa terapêutica segura se aplicável"],
  "monitor": ["parâmetro a monitorizar (ex: 'INR semanalmente', 'Creatinina', 'ECG — intervalo QTc')"],
  "patient_info": "explicação simples para o doente em linguagem acessível (sem jargão técnico)",
  "references": ["guideline ou fonte de suporte (ex: 'FDA Drug Interaction Database', 'INFARMED', 'Lexicomp')"]
}

Regras:
- GRAVE: combinações que causam toxicidade séria, morte, ou são contra-indicadas (ex: ISRS + IMAO, varfarina + AINEs, estatinas + fibratos)
- MODERADA: requerem monitorização apertada ou ajuste de dose
- LIGEIRA: relevância clínica baixa mas documentada
- SEM_INTERACAO: não há interação clinicamente relevante conhecida
- Cita mecanismos CYP450 quando relevantes (é o que os profissionais mais precisam)
- Alternativas devem ser concretas (nome do fármaco)
- patient_info deve ser em linguagem simples mesmo para GRAVE`,
    },
    {
      role: 'user',
      content: `Analisa as interações medicamentosas entre: ${drugs.join(', ')}`,
    },
  ], 'És farmacologista clínico. Reconcilia duas análises de interação medicamentosa no mesmo esquema JSON (severity, summary, mechanism, cyp450, consequences, onset, risk_factors, recommendation, alternatives, monitor, patient_info, references). Em divergência de gravidade, escolhe a MAIS conservadora (mais segura para o doente). PT-PT.', { maxTokens: 1400, temperature: 0.05 })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um minuto.' }, { status: 429 })
  }
  // Limite diário server-side por utilizador (Base/Plus). Pro/Institucional = ilimitado.
  const { enforceDailyLimit } = await import('@/lib/serverLimit')
  const gate = await enforceDailyLimit(req, 'interactions')
  if (!gate.ok) return gate.response!

  const body = await req.json().catch(() => null)

  // ── IMAGE MODE: identify drugs from photo ────────────────────────────────
  if (body?.image) {
    try {
      const { callGeminiVisionJSON } = await import('@/lib/ai')
      const parsed = await callGeminiVisionJSON<{ drugs?: string[] }>(
        'List all medication names visible in this image. Return ONLY a JSON object, no markdown: {"drugs": ["name1", "name2"]}. Use INN/generic names in Portuguese when possible.',
        body.image,
        body.mimeType || 'image/jpeg',
        { maxTokens: 300 }
      )
      return NextResponse.json({ identified_drugs: parsed.drugs || [] })
    } catch (e: any) {
      return NextResponse.json({ error: `Erro ao analisar imagem: ${e.message}` }, { status: 500 })
    }
  }

  // ── TEXT MODE ──────────────────────────────────────────────────────────────
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
    // Corre RxNorm + AI em paralelo para velocidade
    const [normalizedResult, aiResult] = await Promise.allSettled([
      Promise.allSettled(drugs.map(normalizeRxNorm)),
      aiAnalysis(drugs),
    ])

    let rxnormData: any[] = []
    if (normalizedResult.status === 'fulfilled') {
      const normalized = normalizedResult.value.filter(r => r.status === 'fulfilled' && r.value).map(r => (r as any).value)
      const rxcuis = normalized.map((d: any) => d.rxcui)
      if (rxcuis.length >= 2) {
        rxnormData = await rxnormInteractions(rxcuis).catch(() => [])
      }
    }

    let result: any

    if (aiResult.status === 'fulfilled' && aiResult.value) {
      // AI resultado é a base principal — mais rico e em PT
      const ai = aiResult.value

      // Se RxNorm encontrou interações graves, usa a severidade mais alta
      if (rxnormData.length > 0) {
        const order = ['GRAVE', 'MODERADA', 'LIGEIRA', 'SEM_INTERACAO']
        const rxSev = rxnormData.reduce((p: any, c: any) => order.indexOf(mapSev(c.severity)) < order.indexOf(mapSev(p.severity)) ? c : p, rxnormData[0])
        const rxSeverity = mapSev(rxSev.severity)
        // Usa a severidade mais conservadora (maior risco) das duas fontes
        if (order.indexOf(rxSeverity) < order.indexOf(ai.severity || 'SEM_INTERACAO')) {
          ai.severity = rxSeverity
          ai.rxnorm_note = rxSev.description
        }
      }

      result = {
        severity: ai.severity || 'SEM_INTERACAO',
        summary: ai.summary || '',
        mechanism: ai.mechanism || '',
        cyp450: ai.cyp450 || null,
        consequences: ai.consequences || '',
        onset: ai.onset || '',
        risk_factors: ai.risk_factors || [],
        recommendation: ai.recommendation || '',
        alternatives: ai.alternatives || [],
        monitor: ai.monitor || [],
        patient_info: ai.patient_info || '',
        references: ai.references || [],
        source: 'ai_enhanced',
        drugs,
      }
    } else if (rxnormData.length > 0) {
      // Fallback: só RxNorm
      const order = ['GRAVE', 'MODERADA', 'LIGEIRA', 'SEM_INTERACAO']
      const worst = rxnormData.reduce((p, c) => order.indexOf(mapSev(c.severity)) < order.indexOf(mapSev(p.severity)) ? c : p)
      const severity = mapSev(worst.severity)
      result = {
        severity,
        summary: worst.description,
        mechanism: `Interação identificada pela base de dados RxNorm/NIH. ${rxnormData.length} par(es) identificado(s).`,
        consequences: rxnormData.slice(0, 2).map((i: any) => i.description).join(' '),
        recommendation: severity === 'GRAVE'
          ? 'Combinação potencialmente perigosa. Consulta um médico ou farmacêutico antes de usar.'
          : severity === 'MODERADA'
          ? 'Usa com precaução. Monitoriza sintomas e consulta um profissional de saúde.'
          : 'Interação de baixo risco. Informa sempre o teu médico sobre toda a medicação.',
        monitor: drugs,
        source: 'rxnorm',
        drugs,
      }
    } else {
      // Nenhuma interação encontrada
      result = {
        severity: 'SEM_INTERACAO',
        summary: 'Não foram encontradas interações clinicamente significativas conhecidas entre estes medicamentos.',
        mechanism: 'Sem mecanismo de interação documentado nas bases de dados consultadas.',
        recommendation: 'Continua a informar sempre o médico e farmacêutico sobre toda a tua medicação, incluindo suplementos e plantas medicinais.',
        patient_info: 'Não encontrámos interações entre estes medicamentos. Isso não significa que a combinação seja segura para o teu caso específico — o teu farmacêutico ou médico é a melhor fonte de informação.',
        monitor: [],
        alternatives: [],
        references: ['RxNorm/NIH', 'Groq AI Analysis'],
        source: 'none_found',
        drugs,
      }
    }

    // Cache o resultado
    cache.set(key, { result, timestamp: Date.now() })
    if (cache.size > 500) { const first = cache.keys().next().value; if (first) cache.delete(first) }

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Interactions error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar interações. Tenta novamente.' }, { status: 500 })
  }
}