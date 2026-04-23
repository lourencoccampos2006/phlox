// Base de dados de nomes comerciais → DCI (Denominação Comum Internacional)
// Mercado português + espanhol (medicamentos mais comuns)

export const BRAND_TO_DCI: Record<string, string> = {
  // Anti-inflamatórios / Analgésicos
  'brufen': 'ibuprofeno',
  'advil': 'ibuprofeno',
  'nurofen': 'ibuprofeno',
  'ibuprom': 'ibuprofeno',
  'moment': 'ibuprofeno',
  'spedifen': 'ibuprofeno',
  'benflogin': 'ibuprofeno',
  'ben-u-ron': 'paracetamol',
  'panadol': 'paracetamol',
  'tylenol': 'paracetamol',
  'efferalgan': 'paracetamol',
  'doliprane': 'paracetamol',
  'dafalgan': 'paracetamol',
  'voltaren': 'diclofenac',
  'cataflam': 'diclofenac',
  'flector': 'diclofenac',
  'arcoxia': 'etoricoxib',
  'celebrex': 'celecoxib',
  'mobic': 'meloxicam',
  'xefo': 'lornoxicam',
  'aspegic': 'aspirina',
  'cardiovaspin': 'aspirina',
  'cartia': 'aspirina',
  'alka-seltzer': 'aspirina',
  'feldene': 'piroxicam',
  'orudis': 'cetoprofeno',
  'fastum': 'cetoprofeno',
  'toradol': 'cetorolac',
  'tramal': 'tramadol',
  'zaldiar': 'tramadol',
  'ultracet': 'tramadol',
  'contramal': 'tramadol',

  // Antibióticos
  'amoxil': 'amoxicilina',
  'clamoxyl': 'amoxicilina',
  'flemoxin': 'amoxicilina',
  'augmentin': 'amoxicilina+clavulanato',
  'clavamox': 'amoxicilina+clavulanato',
  'betamox': 'amoxicilina',
  'zithromax': 'azitromicina',
  'azitrocin': 'azitromicina',
  'sumamed': 'azitromicina',
  'ciprofloxacina': 'ciprofloxacina',
  'ciproxin': 'ciprofloxacina',
  'cipro': 'ciprofloxacina',
  'baycip': 'ciprofloxacina',
  'vibramycin': 'doxiciclina',
  'oraxyl': 'doxiciclina',
  'flagyl': 'metronidazol',
  'zidoval': 'metronidazol',
  'cleocin': 'clindamicina',
  'dalacin': 'clindamicina',
  'keflex': 'cefalexina',
  'zinnat': 'cefuroxima',
  'klacid': 'claritromicina',
  'biaxin': 'claritromicina',
  'klaricid': 'claritromicina',
  'tavanic': 'levofloxacina',
  'levaquin': 'levofloxacina',
  'avelox': 'moxifloxacina',
  'rocephin': 'ceftriaxona',
  'tazocin': 'piperacilina+tazobactam',
  'meronem': 'meropenem',
  'vancocin': 'vancomicina',
  'bactrim': 'trimetoprim+sulfametoxazol',
  'septrin': 'trimetoprim+sulfametoxazol',
  'rifadin': 'rifampicina',
  'isoniazida': 'isoniazida',
  'macrobid': 'nitrofurantoina',

  // Cardiovascular — Anti-hipertensores
  'crestol': 'rosuvastatina',
  'crestor': 'rosuvastatina',
  'lipitor': 'atorvastatina',
  'sortis': 'atorvastatina',
  'torvast': 'atorvastatina',
  'zocor': 'sinvastatina',
  'pravachol': 'pravastatina',
  'lescol': 'fluvastatina',
  'lisinopril': 'lisinopril',
  'zestril': 'lisinopril',
  'prinivil': 'lisinopril',
  'tritace': 'ramipril',
  'altace': 'ramipril',
  'coversyl': 'perindopril',
  'acertil': 'perindopril',
  'renitec': 'enalapril',
  'vasotec': 'enalapril',
  'cozaar': 'losartan',
  'hyzaar': 'losartan',
  'diovan': 'valsartan',
  'micardis': 'telmisartan',
  'atacand': 'candesartan',
  'norvasc': 'amlodipina',
  'istin': 'amlodipina',
  'adalat': 'nifedipina',
  'cordium': 'diltiazem',
  'tildiem': 'diltiazem',
  'isoptin': 'verapamil',
  'concor': 'bisoprolol',
  'bisocor': 'bisoprolol',
  'seloken': 'metoprolol',
  'betaloc': 'metoprolol',
  'lopresor': 'metoprolol',
  'tenormin': 'atenolol',
  'carvedilol': 'carvedilol',
  'kredex': 'carvedilol',
  'inderal': 'propranolol',
  'lasix': 'furosemida',
  'frusemida': 'furosemida',
  'aldactone': 'espironolactona',
  'natrilix': 'indapamida',
  'coumadin': 'varfarina',
  'warfarin': 'varfarina',
  'sintrom': 'acenocumarol',
  'plavix': 'clopidogrel',
  'iscover': 'clopidogrel',
  'brilique': 'ticagrelor',
  'efient': 'prasugrel',
  'xarelto': 'rivaroxabano',
  'eliquis': 'apixabano',
  'pradaxa': 'dabigatrano',
  'lixiana': 'edoxabano',
  'digoxina': 'digoxina',
  'lanoxin': 'digoxina',
  'cordarone': 'amiodarona',
  'nexterone': 'amiodarona',
  'nitroglicerina': 'nitroglicerina',
  'nitromint': 'nitroglicerina',
  'monocordil': 'mononitrato de isossorbido',
  'imdur': 'mononitrato de isossorbido',

  // Gastrointestinal
  'losec': 'omeprazol',
  'prilosec': 'omeprazol',
  'nexium': 'esomeprazol',
  'esomeprazol': 'esomeprazol',
  'pantozol': 'pantoprazol',
  'controloc': 'pantoprazol',
  'protonix': 'pantoprazol',
  'prevacid': 'lansoprazol',
  'lanzor': 'lansoprazol',
  'zantac': 'ranitidina',
  'tagamet': 'cimetidina',
  'motilium': 'domperidona',
  'zofran': 'ondansetrom',
  'primperan': 'metoclopramida',
  'questran': 'colestiramina',
  'imodium': 'loperamida',
  'mucofalk': 'psyllium',

  // Diabetes
  'glucophage': 'metformina',
  'riomet': 'metformina',
  'diamicron': 'gliclazida',
  'daonil': 'glibenclamida',
  'amaryl': 'glimepirida',
  'januvia': 'sitagliptina',
  'galvus': 'vildagliptina',
  'onglyza': 'saxagliptina',
  'jardiance': 'empagliflozina',
  'forxiga': 'dapagliflozina',
  'invokana': 'canagliflozina',
  'victoza': 'liraglutido',
  'trulicity': 'dulaglutido',
  'ozempic': 'semaglutido',
  'wegovy': 'semaglutido',
  'lantus': 'insulina glargina',
  'levemir': 'insulina detemir',
  'tresiba': 'insulina degludec',
  'novorapid': 'insulina aspart',
  'humalog': 'insulina lispro',
  'apidra': 'insulina glulisina',
  'humulin': 'insulina humana',

  // Sistema Nervoso
  'prozac': 'fluoxetina',
  'zoloft': 'sertralina',
  'lustral': 'sertralina',
  'seroxat': 'paroxetina',
  'cipralex': 'escitalopram',
  'lexapro': 'escitalopram',
  'celexa': 'citalopram',
  'seropram': 'citalopram',
  'effexor': 'venlafaxina',
  'efexor': 'venlafaxina',
  'cymbalta': 'duloxetina',
  'ariclaim': 'duloxetina',
  'remeron': 'mirtazapina',
  'zispin': 'mirtazapina',
  'tryptanol': 'amitriptilina',
  'laroxyl': 'amitriptilina',
  'anafranil': 'clomipramina',
  'valdoxan': 'agomelatina',
  'wellbutrin': 'bupropiona',
  'zyban': 'bupropiona',
  'champix': 'vareniclina',
  'risperdal': 'risperidona',
  'zyprexa': 'olanzapina',
  'seroquel': 'quetiapina',
  'abilify': 'aripiprazol',
  'solian': 'amisulprida',
  'haldol': 'haloperidol',
  'largactil': 'clorpromazina',
  'depakine': 'valproato',
  'epilim': 'valproato',
  'tegretol': 'carbamazepina',
  'lamictal': 'lamotrigina',
  'keppra': 'levetiracetam',
  'neurontin': 'gabapentina',
  'lyrica': 'pregabalina',
  'dilantin': 'fenitoina',
  'rivotril': 'clonazepam',
  'valium': 'diazepam',
  'xanax': 'alprazolam',
  'ativan': 'lorazepam',
  'dormicum': 'midazolam',
  'imovane': 'zopiclona',
  'stilnox': 'zolpidem',
  'benestad': 'zolpidem',
  'aricept': 'donepezilo',
  'reminyl': 'galantamina',
  'exelon': 'rivastigmina',
  'ebixa': 'memantina',
  'parlodel': 'bromocriptina',
  'sinemet': 'levodopa+carbidopa',
  'madopar': 'levodopa+benserazida',
  'requip': 'ropinirol',
  'mirapexin': 'pramipexol',
  'imigran': 'sumatriptano',
  'maxalt': 'rizatriptano',

  // Respiratório
  'ventolin': 'salbutamol',
  'bricanyl': 'terbutalina',
  'serevent': 'salmeterol',
  'symbicort': 'budesonido+formoterol',
  'seretide': 'fluticasona+salmeterol',
  'foster': 'beclometasona+formoterol',
  'pulmicort': 'budesonido',
  'flixotide': 'fluticasona',
  'qvar': 'beclometasona',
  'spiriva': 'tiotrópio',
  'incruse': 'umeclidínio',
  'bretaris': 'aclidínio',
  'striverdi': 'olodaterol',
  'roaccutane': 'isotretinoina',
  'singulair': 'montelucaste',
  'atrovent': 'ipratrópio',
  'berotec': 'fenoterol',
  'daktarin': 'miconazol',

  // Alergias / Antialérgicos
  'claritine': 'loratadina',
  'claritin': 'loratadina',
  'aerius': 'desloratadina',
  'telfast': 'fexofenadina',
  'allegra': 'fexofenadina',
  'zyrtec': 'cetirizina',
  'zirtec': 'cetirizina',
  'reactine': 'cetirizina',
  'xyzal': 'levocetirizina',
  'polaramine': 'dexclorfeniramina',
  'fenistil': 'dimetindeno',
  'benadryl': 'difenidramina',

  // Tiróide
  'synthroid': 'levotiroxina',
  'euthyrox': 'levotiroxina',
  'letter': 'levotiroxina',
  'neotiroidin': 'levotiroxina',
  'strumazol': 'tiamazol',
  'thyrozol': 'tiamazol',

  // Corticosteroides
  'medrol': 'metilprednisolona',
  'solu-medrol': 'metilprednisolona',
  'decadron': 'dexametasona',
  'fortecortin': 'dexametasona',
  'bactiderm': 'mupirocina',
  'dermovate': 'clobetasol',
  'betnovate': 'betametasona',
  'advantan': 'metilprednisolona aceponato',
  'locoid': 'hidrocortisona',
  'hydrocortisone': 'hidrocortisona',
  'predsol': 'prednisolona',

  // Antifúngicos
  'diflucan': 'fluconazol',
  'sporanox': 'itraconazol',
  'lamisil': 'terbinafina',
  'nystatin': 'nistatina',
  'mycostatin': 'nistatina',

  // Antivirais
  'zovirax': 'aciclovir',
  'valtrex': 'valaciclovir',
  'famvir': 'famciclovir',
  'tamiflu': 'oseltamivir',
  'relenza': 'zanamivir',

  // Urologia / Próstata
  'flomax': 'tamsulosina',
  'omnic': 'tamsulosina',
  'proscar': 'finasterida',
  'propecia': 'finasterida',
  'avodart': 'dutasterida',
  'cialis': 'tadalafilo',
  'viagra': 'sildenafilo',
  'levitra': 'vardenafilo',

  // Reumatologia
  'methotrexate': 'metotrexato',
  'plaquenil': 'hidroxicloroquina',
  'colchicine': 'colquicina',
  'zyloric': 'alopurinol',
  'adenuric': 'febuxostat',
  'humira': 'adalimumab',
  'enbrel': 'etanercept',
  'remicade': 'infliximab',

  // Vitaminas / Suplementos
  'vigantol': 'vitamina d3',
  'oleovit': 'vitamina d3',
  'calcium-sandoz': 'cálcio',
  'ferrograd': 'ferro',
  'feroglobin': 'ferro',
  'tardyferon': 'ferro',
  'neutrobion': 'vitamina b12',
  'milgamma': 'vitamina b1+b6+b12',

  // Osteoporose
  'fosamax': 'alendronato',
  'actonel': 'risedronato',
  'bonviva': 'ibandronato',
  'prolia': 'denosumab',

  // Oncologia / Imunologia (mais comuns)
  'herceptin': 'trastuzumab',
  'gleevec': 'imatinib',
  'glivec': 'imatinib',

  // Hormonal
  'yasmin': 'etinilestradiol+drospirenona',
  'diane': 'etinilestradiol+acetato de ciproterona',
  'microgynon': 'etinilestradiol+levonorgestrel',
  'nuvaring': 'etinilestradiol+etonogestrel',
  'mirena': 'levonorgestrel',
  'norlevo': 'levonorgestrel',
  'ellaone': 'ulipristal',
  'estrofem': 'estradiol',
  'duphaston': 'didrogesterona',
  'utrogestan': 'progesterona',
}

// Resolve nome → DCI
// Retorna { dci, brand } ou null se não encontrado
export function resolveDrugName(input: string): { dci: string; brand: string } | null {
  const normalized = input.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9+]/g, '') // só letras, números e +

  // Tenta match exacto
  if (BRAND_TO_DCI[normalized]) {
    return { dci: BRAND_TO_DCI[normalized], brand: input }
  }

  // Tenta match parcial (ex: "brufen retard" → "brufen")
  for (const [brand, dci] of Object.entries(BRAND_TO_DCI)) {
    const normalizedBrand = brand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+]/g, '')
    if (normalized.startsWith(normalizedBrand) || normalizedBrand.startsWith(normalized)) {
      return { dci, brand: input }
    }
  }

  return null
}

// Sugere completions para autocomplete
export function suggestDrugs(input: string, limit = 6): { display: string; dci: string; isBrand: boolean }[] {
  if (input.length < 2) return []
  
  const normalized = input.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const results: { display: string; dci: string; isBrand: boolean; score: number }[] = []

  // Search brand names
  for (const [brand, dci] of Object.entries(BRAND_TO_DCI)) {
    const normalizedBrand = brand.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalizedBrand.startsWith(normalized)) {
      results.push({ 
        display: brand.charAt(0).toUpperCase() + brand.slice(1),
        dci,
        isBrand: true,
        score: normalizedBrand === normalized ? 2 : 1
      })
    }
  }

  // Search DCIs directly
  const dcis = new Set(Object.values(BRAND_TO_DCI))
  for (const dci of dcis) {
    const normalizedDci = dci.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalizedDci.startsWith(normalized)) {
      results.push({ display: dci, dci, isBrand: false, score: normalizedDci === normalized ? 3 : 1 })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ display, dci, isBrand }) => ({ display, dci, isBrand }))
}