import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'


const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6h


// PT/EU brand/generic names → FDA English names
const PT_TO_FDA: Record<string, string> = {
  // Common PT brand names
  'brufen': 'ibuprofen', 'voltaren': 'diclofenac', 'benuron': 'acetaminophen',
  'ben-u-ron': 'acetaminophen', 'panadol': 'acetaminophen', 'nurofen': 'ibuprofen',
  'advil': 'ibuprofen', 'aspirina': 'aspirin', 'aspegic': 'aspirin',
  'xarelto': 'rivaroxaban', 'eliquis': 'apixaban', 'pradaxa': 'dabigatran',
  'plavix': 'clopidogrel', 'iscover': 'clopidogrel', 'coumadin': 'warfarin',
  'sintrom': 'acenocoumarol', 'losec': 'omeprazole', 'prilosec': 'omeprazole',
  'nexium': 'esomeprazole', 'pantozol': 'pantoprazole', 'controloc': 'pantoprazole',
  'lipitor': 'atorvastatin', 'crestor': 'rosuvastatin', 'zocor': 'simvastatin',
  'glucophage': 'metformin', 'metformina': 'metformin', 'metformín': 'metformin',
  'lantus': 'insulin glargine', 'novorapid': 'insulin aspart', 'humalog': 'insulin lispro',
  'ozempic': 'semaglutide', 'wegovy': 'semaglutide', 'victoza': 'liraglutide',
  'jardiance': 'empagliflozin', 'forxiga': 'dapagliflozin',
  'januvia': 'sitagliptin', 'galvus': 'vildagliptin',
  'concor': 'bisoprolol', 'bisoprolol': 'bisoprolol', 'zestril': 'lisinopril',
  'lisinopril': 'lisinopril', 'tritace': 'ramipril', 'ramipril': 'ramipril',
  'renitec': 'enalapril', 'enalapril': 'enalapril', 'coversyl': 'perindopril',
  'cozaar': 'losartan', 'losartan': 'losartan', 'diovan': 'valsartan',
  'micardis': 'telmisartan', 'atacand': 'candesartan', 'norvasc': 'amlodipine',
  'amlodipina': 'amlodipine', 'istin': 'amlodipine', 'adalat': 'nifedipine',
  'lasix': 'furosemide', 'furosemida': 'furosemide', 'aldactone': 'spironolactone',
  'espironolactona': 'spironolactone', 'lanoxin': 'digoxin', 'digoxina': 'digoxin',
  'cordarone': 'amiodarone', 'amiodarona': 'amiodarone',
  'seloken': 'metoprolol', 'betaloc': 'metoprolol', 'metoprolol': 'metoprolol',
  'tenormin': 'atenolol', 'atenolol': 'atenolol', 'inderal': 'propranolol',
  'propranolol': 'propranolol', 'kredex': 'carvedilol', 'carvedilol': 'carvedilol',
  'zithromax': 'azithromycin', 'azitromicina': 'azithromycin',
  'augmentin': 'amoxicillin', 'amoxicilina': 'amoxicillin', 'amoxil': 'amoxicillin',
  'clamoxyl': 'amoxicillin', 'ciproxin': 'ciprofloxacin', 'ciprofloxacina': 'ciprofloxacin',
  'klacid': 'clarithromycin', 'claritromicina': 'clarithromycin',
  'flagyl': 'metronidazole', 'metronidazol': 'metronidazole',
  'vibramycin': 'doxycycline', 'doxiciclina': 'doxycycline',
  'zinnat': 'cefuroxime', 'rocephin': 'ceftriaxone', 'ceftriaxona': 'ceftriaxone',
  'tavanic': 'levofloxacin', 'levofloxacina': 'levofloxacin',
  'prozac': 'fluoxetine', 'fluoxetina': 'fluoxetine',
  'zoloft': 'sertraline', 'lustral': 'sertraline', 'sertralina': 'sertraline',
  'seroxat': 'paroxetine', 'paroxetina': 'paroxetine',
  'cipralex': 'escitalopram', 'lexapro': 'escitalopram', 'escitalopram': 'escitalopram',
  'seropram': 'citalopram', 'citalopram': 'citalopram',
  'efexor': 'venlafaxine', 'effexor': 'venlafaxine', 'venlafaxina': 'venlafaxine',
  'cymbalta': 'duloxetine', 'duloxetina': 'duloxetine',
  'remeron': 'mirtazapine', 'mirtazapina': 'mirtazapine',
  'risperdal': 'risperidone', 'risperidona': 'risperidone',
  'zyprexa': 'olanzapine', 'olanzapina': 'olanzapine',
  'seroquel': 'quetiapine', 'quetiapina': 'quetiapine',
  'abilify': 'aripiprazole', 'aripiprazol': 'aripiprazole',
  'haldol': 'haloperidol', 'haloperidol': 'haloperidol',
  'depakine': 'valproate', 'valproato': 'valproate',
  'tegretol': 'carbamazepine', 'carbamazepina': 'carbamazepine',
  'lamictal': 'lamotrigine', 'lamotrigina': 'lamotrigine',
  'keppra': 'levetiracetam', 'levetiracetam': 'levetiracetam',
  'lyrica': 'pregabalin', 'pregabalina': 'pregabalin',
  'neurontin': 'gabapentin', 'gabapentina': 'gabapentin',
  'rivotril': 'clonazepam', 'clonazepam': 'clonazepam',
  'valium': 'diazepam', 'diazepam': 'diazepam',
  'xanax': 'alprazolam', 'alprazolam': 'alprazolam',
  'ativan': 'lorazepam', 'lorazepam': 'lorazepam',
  'stilnox': 'zolpidem', 'zolpidem': 'zolpidem',
  'aricept': 'donepezil', 'donepezilo': 'donepezil',
  'ebixa': 'memantine', 'memantina': 'memantine',
  'levotiroxina': 'levothyroxine', 'euthyrox': 'levothyroxine', 'synthroid': 'levothyroxine',
  'singulair': 'montelukast', 'montelucaste': 'montelukast',
  'ventolin': 'albuterol', 'salbutamol': 'albuterol',
  'spiriva': 'tiotropium', 'tiotrópio': 'tiotropium',
  'diflucan': 'fluconazole', 'fluconazol': 'fluconazole',
  'zovirax': 'acyclovir', 'aciclovir': 'acyclovir',
  'valtrex': 'valacyclovir', 'valaciclovir': 'valacyclovir',
  'tamiflu': 'oseltamivir', 'oseltamivir': 'oseltamivir',
  'zyloric': 'allopurinol', 'alopurinol': 'allopurinol',
  'medrol': 'methylprednisolone', 'metilprednisolona': 'methylprednisolone',
  'prednisolona': 'prednisolone', 'prednisona': 'prednisone',
  'tramal': 'tramadol', 'tramadol': 'tramadol',
  'ibuprofeno': 'ibuprofen', 'paracetamol': 'acetaminophen', 'ácido acetilsalicílico': 'aspirin',
  'diclofenac': 'diclofenac', 'naproxeno': 'naproxen', 'meloxicam': 'meloxicam',
  'atorvastatina': 'atorvastatin', 'sinvastatina': 'simvastatin', 'rosuvastatina': 'rosuvastatin',
  'omeprazol': 'omeprazole', 'esomeprazol': 'esomeprazole', 'pantoprazol': 'pantoprazole',
  'domperidona': 'domperidone', 'motilium': 'domperidone',
  'ondansetrom': 'ondansetron', 'zofran': 'ondansetron',
  'loratadina': 'loratadine', 'claritine': 'loratadine', 'cetirizina': 'cetirizine',
  'zyrtec': 'cetirizine', 'levocetirizina': 'levocetirizine',
  'varfarina': 'warfarin', 'rivaroxabano': 'rivaroxaban', 'apixabano': 'apixaban',
  'dabigatrano': 'dabigatran', 'clopidogrel': 'clopidogrel',
  'empagliflozina': 'empagliflozin', 'dapagliflozina': 'dapagliflozin',
}

function resolveToFDA(term: string): string {
  const lower = term.toLowerCase().trim()
  return PT_TO_FDA[lower] || lower
}


export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const term = resolveToFDA(q.trim().toLowerCase())
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

    let drug = labelData?.results?.[0]

    if (!drug) {
      // Fallback: pesquisa por nome comercial
      const brandRes = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(term)}"&limit=1`, { signal: AbortSignal.timeout(8000) })
      const brandData = brandRes.ok ? await brandRes.json() : null
      drug = brandData?.results?.[0]
      if (!drug) return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })
    }

    const raw = formatDrug(drug, adverseData, term)

    // Traduz as secções clínicas para português
    const translated = await translateToPortuguese(raw)

    cache.set(term, { result: translated, timestamp: Date.now() })
    return NextResponse.json(translated)

  } catch (error: any) {
    console.error('Drugs route error:', error?.message)
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

function truncateForTranslation(text: string, maxChars = 1200): string {
  if (!text || text.length <= maxChars) return text
  // Corta no último ponto antes do limite para não cortar a meio de uma frase
  const cut = text.slice(0, maxChars)
  const lastDot = cut.lastIndexOf('.')
  return lastDot > maxChars * 0.7 ? cut.slice(0, lastDot + 1) + ' [...]' : cut + ' [...]'
}

async function translateToPortuguese(drug: any): Promise<any> {
  // Campos a traduzir (só os que têm conteúdo)
  const toTranslate: Record<string, string> = {}
  for (const key of ['indications', 'dosage', 'contraindications', 'warnings', 'adverse_reactions']) {
    if (drug[key]) toTranslate[key] = truncateForTranslation(drug[key])
  }

  if (Object.keys(toTranslate).length === 0) return drug

  try {
    const prompt = Object.entries(toTranslate)
      .map(([k, v]) => `### ${k}\n${v}`)
      .join('\n\n')

    const translations = await aiJSON<Record<string, string>>([
      {
        role: 'system',
        content: 'És um tradutor técnico médico-farmacêutico inglês→português europeu (PT-PT). Traduz o texto clínico mantendo rigor técnico. Usa terminologia farmacêutica portuguesa correcta. Responde APENAS com JSON válido sem markdown, com exactamente as mesmas chaves que recebes: {"indications":"...","dosage":"...","contraindications":"...","warnings":"...","adverse_reactions":"..."}. Inclui apenas as chaves que existem no input. Nunca omitas informação clínica importante.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], { maxTokens: 3000, temperature: 0.1, preferFast: true })

    return {
      ...drug,
      ...translations,
      _translated: true,
    }
  } catch (e: any) {
    // Se a tradução falhar, retorna o original em inglês sem quebrar
    console.warn('Translation failed, returning English:', e?.message)
    return { ...drug, _translated: false }
  }
}