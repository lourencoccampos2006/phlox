import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

const TOP_DRUGS = [
  // Analgésicos e Anti-inflamatórios
  'ibuprofen', 'acetaminophen', 'aspirin', 'naproxen', 'diclofenac',
  'meloxicam', 'celecoxib', 'indomethacin', 'ketorolac', 'piroxicam',
  // Antibióticos
  'amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline', 'metronidazole',
  'clindamycin', 'trimethoprim', 'levofloxacin', 'clarithromycin', 'cephalexin',
  'amoxicillin-clavulanate', 'penicillin', 'ampicillin', 'erythromycin', 'nitrofurantoin',
  // Cardiovascular
  'metoprolol', 'atenolol', 'bisoprolol', 'carvedilol', 'propranolol',
  'lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril',
  'losartan', 'valsartan', 'candesartan', 'irbesartan', 'telmisartan',
  'amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine',
  'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'fluvastatin',
  'furosemide', 'hydrochlorothiazide', 'spironolactone', 'chlorthalidone',
  'digoxin', 'amiodarone', 'warfarin', 'clopidogrel',
  'rivaroxaban', 'apixaban', 'dabigatran', 'heparin', 'enoxaparin',
  // Digestivo
  'omeprazole', 'lansoprazole', 'pantoprazole', 'esomeprazole', 'rabeprazole',
  'ranitidine', 'famotidine', 'metoclopramide', 'ondansetron', 'domperidone',
  'loperamide', 'bisacodyl', 'lactulose', 'senna', 'macrogol',
  // Diabetes
  'metformin', 'glibenclamide', 'gliclazide', 'glipizide', 'sitagliptin',
  'empagliflozin', 'dapagliflozin', 'liraglutide', 'insulin', 'insulin-glargine',
  // Sistema Nervoso Central
  'sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram',
  'venlafaxine', 'duloxetine', 'mirtazapine', 'bupropion', 'trazodone',
  'amitriptyline', 'clomipramine', 'imipramine', 'nortriptyline',
  'diazepam', 'lorazepam', 'alprazolam', 'clonazepam', 'oxazepam',
  'zolpidem', 'zopiclone', 'quetiapine', 'olanzapine', 'risperidone',
  'haloperidol', 'clozapine', 'aripiprazole', 'paliperidone',
  'lithium', 'valproate', 'lamotrigine', 'carbamazepine', 'phenytoin',
  'levetiracetam', 'gabapentin', 'pregabalin', 'topiramate',
  'donepezil', 'memantine', 'rivastigmine',
  // Dor e Opióides
  'tramadol', 'codeine', 'morphine', 'oxycodone', 'hydrocodone',
  'fentanyl', 'buprenorphine', 'naloxone', 'naltrexone',
  // Respiratório
  'salbutamol', 'salmeterol', 'formoterol', 'tiotropium', 'ipratropium',
  'budesonide', 'fluticasone', 'beclomethasone', 'montelukast',
  'cetirizine', 'loratadine', 'fexofenadine', 'desloratadine',
  // Endócrino
  'levothyroxine', 'methimazole', 'propylthiouracil',
  'prednisone', 'prednisolone', 'dexamethasone', 'hydrocortisone',
  'methylprednisolone', 'testosterone', 'estradiol', 'progesterone',
  'levonorgestrel', 'ethinylestradiol', 'medroxyprogesterone',
  // Antifúngicos e Antivirais
  'fluconazole', 'itraconazole', 'voriconazole', 'clotrimazole', 'nystatin',
  'terbinafine', 'acyclovir', 'valacyclovir', 'oseltamivir',
  // Vitaminas e Suplementos
  'vitamin-d', 'vitamin-b12', 'folic-acid', 'iron', 'calcium',
  'magnesium', 'omega-3', 'zinc', 'vitamin-c',
  // Reumatologia
  'methotrexate', 'hydroxychloroquine', 'sulfasalazine', 'leflunomide',
  'colchicine', 'allopurinol', 'febuxostat',
  // Urologia
  'tamsulosin', 'finasteride', 'dutasteride', 'sildenafil', 'tadalafil',
  'oxybutynin', 'solifenacin',
  // Oftalmologia
  'latanoprost', 'timolol', 'brimonidine', 'dorzolamide',
  // Dermatologia
  'tretinoin', 'benzoyl-peroxide', 'clindamycin-gel', 'hydrocortisone-cream',
  'betamethasone', 'clobetasol', 'mupirocin',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/quickcheck`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE_URL}/dilutions`,           lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/ai`,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/interactions`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE_URL}/drugs`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/monograph`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/doses`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/compatibility`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/calculators`,         lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/exam`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/mymeds`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/cases`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/protocol`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/safety`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/study`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/pricing`,             lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`,             lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`,               lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const interactionPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/interactions/ibuprofeno-e-varfarina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/metformina-e-alcool`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/aspirina-e-heparina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/sertralina-e-hipericao`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/atorvastatina-e-claritromicina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/digoxina-e-amiodarona`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/paracetamol-e-codeina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/tramadol-e-diazepam`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/omeprazol-e-clopidogrel`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/rivaroxabano-e-aspirina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/lorazepam-e-alcool`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/varfarina-e-omeprazol`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/sertralina-e-tramadol`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/claritromicina-e-estatinas`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/amiodarona-e-varfarina`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
    { url: `${BASE_URL}/interactions/clopidogrel-e-omeprazol`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
  ]

  const drugPages: MetadataRoute.Sitemap = TOP_DRUGS.map(drug => ({
    url: `${BASE_URL}/drugs/${drug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...interactionPages, ...drugPages]
}