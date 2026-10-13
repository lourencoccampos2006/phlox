// lib/dciParaIngles.ts
// ═══════════════════════════════════════════════════════════════════════════
// O NOME PORTUGUÊS DO MEDICAMENTO, EM INGLÊS
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE ISTO TEVE DE EXISTIR ──────────────────────────────────────
// A consulta ao rótulo (OpenFDA, via /api/drug-reference) indexa pelo nome
// INN em inglês. Numa casa portuguesa, todos os nomes escritos nas fichas são
// portugueses. Testei e a diferença é total:
//
//     warfarin   → ficha completa, com aviso de hemorragia e tudo
//     varfarina  → «Sem ficha de referência FDA para este termo»
//
// Sem esta ponte, a ficha do medicamento e o cruzamento com as ocorrências
// devolviam «não encontrado» para TODOS os medicamentos de TODAS as casas — e
// pareceriam a funcionar, porque «não encontrado» é uma resposta válida.
//
// ── DUAS CAMADAS, E PORQUÊ ─────────────────────────────────────────────────
//
//  1. UMA TABELA para os irregulares e para os que uma casa portuguesa usa
//     todos os dias. `varfarina → warfarin` e `paracetamol → acetaminophen`
//     não saem de regra nenhuma: o primeiro muda a raiz, o segundo é outro
//     nome. Estes têm de estar escritos.
//
//  2. REGRAS MORFOLÓGICAS para o resto. A maior parte dos INN seguem a mesma
//     correspondência entre as duas línguas (`-ina → -ine`, `-azol → -azole`,
//     `-ida → -ide`), e escrever duzentos nomes à mão seria uma lista que
//     envelhece. A regra cobre o que a tabela não previu.
//
// ── O QUE ACONTECE QUANDO ERRA ─────────────────────────────────────────────
// Devolve um palpite que o OpenFDA não conhece, e a consulta diz «não
// encontrado» — exactamente como dizia antes. Um palpite errado não inventa
// uma bula: só não encontra nenhuma. É por isso que a regra pode ser
// generosa.

/** Os que nenhuma regra acerta, e os que mais se usam cá. */
const TABELA: Record<string, string> = {
  // ── Irregulares ──────────────────────────────────────────────────────────
  'paracetamol': 'acetaminophen',
  'varfarina': 'warfarin',
  'adrenalina': 'epinephrine',
  'noradrenalina': 'norepinephrine',
  'acido acetilsalicilico': 'aspirin',
  'aas': 'aspirin',
  'dipirona': 'metamizole',
  'bicarbonato de sodio': 'sodium bicarbonate',
  'soro fisiologico': 'sodium chloride',
  'vitamina d': 'cholecalciferol',
  'vitamina b12': 'cyanocobalamin',
  'acido folico': 'folic acid',
  'ferro': 'ferrous sulfate',
  'calcio': 'calcium carbonate',
  'insulina': 'insulin',
  'heparina': 'heparin',
  'morfina': 'morphine',
  'codeina': 'codeine',
  'cafeina': 'caffeine',
  'teofilina': 'theophylline',
  'digoxina': 'digoxin',
  'amiodarona': 'amiodarone',
  'atropina': 'atropine',
  'penicilina': 'penicillin',
  'amoxicilina': 'amoxicillin',
  'ampicilina': 'ampicillin',
  'flucloxacilina': 'flucloxacillin',
  'gentamicina': 'gentamicin',
  'vancomicina': 'vancomycin',
  'claritromicina': 'clarithromycin',
  'azitromicina': 'azithromycin',
  'eritromicina': 'erythromycin',
  'clindamicina': 'clindamycin',
  'doxiciclina': 'doxycycline',
  'tetraciclina': 'tetracycline',
  'rifampicina': 'rifampin',
  'isoniazida': 'isoniazid',
  'metronidazol': 'metronidazole',
  'nitrofurantoina': 'nitrofurantoin',
  'fosfomicina': 'fosfomycin',
  'cefalexina': 'cephalexin',
  'cefuroxima': 'cefuroxime',
  'ceftriaxona': 'ceftriaxone',
  'levofloxacina': 'levofloxacin',
  'ciprofloxacina': 'ciprofloxacin',

  // ── Os do dia a dia de um lar ────────────────────────────────────────────
  'furosemida': 'furosemide',
  'espironolactona': 'spironolactone',
  'hidroclorotiazida': 'hydrochlorothiazide',
  'indapamida': 'indapamide',
  'ramipril': 'ramipril',
  'lisinopril': 'lisinopril',
  'enalapril': 'enalapril',
  'perindopril': 'perindopril',
  'losartan': 'losartan',
  'valsartan': 'valsartan',
  'irbesartan': 'irbesartan',
  'amlodipina': 'amlodipine',
  'nifedipina': 'nifedipine',
  'diltiazem': 'diltiazem',
  'bisoprolol': 'bisoprolol',
  'carvedilol': 'carvedilol',
  'atenolol': 'atenolol',
  'metformina': 'metformin',
  'gliclazida': 'gliclazide',
  'glicazida': 'gliclazide',
  'sitagliptina': 'sitagliptin',
  'empagliflozina': 'empagliflozin',
  'dapagliflozina': 'dapagliflozin',
  'sinvastatina': 'simvastatin',
  'atorvastatina': 'atorvastatin',
  'rosuvastatina': 'rosuvastatin',
  'pravastatina': 'pravastatin',
  'omeprazol': 'omeprazole',
  'pantoprazol': 'pantoprazole',
  'esomeprazol': 'esomeprazole',
  'lansoprazol': 'lansoprazole',
  'levotiroxina': 'levothyroxine',
  'alendronato': 'alendronate',
  'risedronato': 'risedronate',
  'tansulosina': 'tamsulosin',
  'tamsulosina': 'tamsulosin',
  'finasterida': 'finasteride',
  'sildenafilo': 'sildenafil',
  'alopurinol': 'allopurinol',
  'colchicina': 'colchicine',
  'prednisolona': 'prednisolone',
  'dexametasona': 'dexamethasone',
  'hidrocortisona': 'hydrocortisone',
  'salbutamol': 'albuterol',
  'budesonida': 'budesonide',
  'formoterol': 'formoterol',
  'tiotropio': 'tiotropium',
  'ipratropio': 'ipratropium',
  'montelucaste': 'montelukast',

  // ── Sistema nervoso — os que mais pesam numa queda ───────────────────────
  'sertralina': 'sertraline',
  'fluoxetina': 'fluoxetine',
  'paroxetina': 'paroxetine',
  'escitalopram': 'escitalopram',
  'citalopram': 'citalopram',
  'venlafaxina': 'venlafaxine',
  'duloxetina': 'duloxetine',
  'mirtazapina': 'mirtazapine',
  'trazodona': 'trazodone',
  'amitriptilina': 'amitriptyline',
  'quetiapina': 'quetiapine',
  'risperidona': 'risperidone',
  'olanzapina': 'olanzapine',
  'haloperidol': 'haloperidol',
  'lorazepam': 'lorazepam',
  'diazepam': 'diazepam',
  'alprazolam': 'alprazolam',
  'bromazepam': 'bromazepam',
  'oxazepam': 'oxazepam',
  'zolpidem': 'zolpidem',
  'donepezilo': 'donepezil',
  'memantina': 'memantine',
  'rivastigmina': 'rivastigmine',
  'levodopa': 'levodopa',
  'carbidopa': 'carbidopa',
  'pramipexol': 'pramipexole',
  'gabapentina': 'gabapentin',
  'pregabalina': 'pregabalin',
  'carbamazepina': 'carbamazepine',
  'valproato': 'valproate',
  'levetiracetam': 'levetiracetam',
  'fenitoina': 'phenytoin',
  'tramadol': 'tramadol',
  'ibuprofeno': 'ibuprofen',
  'naproxeno': 'naproxen',
  'diclofenac': 'diclofenac',
  'metamizol': 'metamizole',

  // ── Anticoagulação e plaquetas ───────────────────────────────────────────
  'clopidogrel': 'clopidogrel',
  'apixabano': 'apixaban',
  'rivaroxabano': 'rivaroxaban',
  'edoxabano': 'edoxaban',
  'dabigatrano': 'dabigatran',
  'enoxaparina': 'enoxaparin',
}

/** As terminações que correspondem entre as duas línguas. Ordem importa. */
const REGRAS: [RegExp, string][] = [
  [/azol$/, 'azole'],      // omeprazol → omeprazole
  [/ciclina$/, 'cycline'],
  [/micina$/, 'mycin'],
  [/cilina$/, 'cillin'],
  [/oxacina$/, 'oxacin'],
  [/sona$/, 'sone'],       // prednisona → prednisone
  [/lona$/, 'lone'],       // prednisolona → prednisolone
  [/ona$/, 'one'],
  [/ida$/, 'ide'],         // furosemida → furosemide
  [/ima$/, 'ime'],         // cefuroxima → cefuroxime
  [/ina$/, 'ine'],         // sertralina → sertraline
  [/ano$/, 'an'],          // apixabano → apixaban
  [/ato$/, 'ate'],
  [/ico$/, 'ic'],
  [/ilo$/, 'il'],          // sildenafilo → sildenafil
  [/eno$/, 'en'],          // ibuprofeno → ibuprofen
  [/oxeno$/, 'oxen'],
  [/io$/, 'ium'],          // tiotrópio → tiotropium
]

const simples = (t: string) => String(t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * O provável nome em inglês. Devolve o original quando já parece inglês ou
 * quando nenhuma regra se aplica — nunca `null`, porque uma tentativa que o
 * OpenFDA não conheça custa o mesmo que não tentar.
 */
export function dciParaIngles(nome: string): string {
  const n = simples(nome)
  if (!n) return nome
  if (TABELA[n]) return TABELA[n]

  // Compostos («levodopa + carbidopa», «amoxicilina e ácido clavulânico»):
  // o rótulo indexa pelo primeiro princípio activo.
  const primeiro = n.split(/\s*(?:\+|\/| e | com )\s*/)[0].trim()
  if (primeiro !== n) {
    if (TABELA[primeiro]) return TABELA[primeiro]
    return dciParaIngles(primeiro)
  }

  for (const [de, para] of REGRAS) {
    if (de.test(n)) return n.replace(de, para)
  }
  return n
}

/**
 * Os nomes a tentar, por ordem. O original fica em primeiro: há medicamentos
 * cujo nome é igual nas duas línguas, e nesses a regra só estragaria.
 */
export function tentativasDeNome(nome: string): string[] {
  const n = simples(nome)
  const en = dciParaIngles(nome)
  return [...new Set([n, en].filter(x => x && x.length > 2))]
}
