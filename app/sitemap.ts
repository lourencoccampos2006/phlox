// app/sitemap.ts
// Este ficheiro vai para: app/sitemap.ts
// Gera automaticamente /sitemap.xml com todas as páginas do site
// O Google usa isto para descobrir e indexar todas as nossas páginas
// Quanto mais páginas indexadas, mais tráfego orgânico

import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

// Top 200 medicamentos mais pesquisados mundialmente
// Cada um gera uma página /drugs/[nome] indexada pelo Google
// São potencialmente milhões de pesquisas mensais capturadas
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
  'digoxin', 'amiodarone', 'warfarin', 'clopidogrel', 'aspirin',
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

  // Endócrino e Metabólico
  'levothyroxine', 'methimazole', 'propylthiouracil',
  'prednisone', 'prednisolone', 'dexamethasone', 'hydrocortisone',
  'methylprednisolone', 'testosterone', 'estradiol', 'progesterone',
  'levonorgestrel', 'ethinylestradiol', 'medroxyprogesterone',

  // Antifúngicos e Antivirais
  'fluconazole', 'itraconazole', 'voriconazole', 'clotrimazole', 'nystatin',
  'terbinafine', 'acyclovir', 'valacyclovir', 'oseltamivir',

  // Vitaminas e Suplementos comuns
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

  // Páginas estáticas — alta prioridade
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/interactions`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/drugs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/study`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Páginas de medicamentos — motor de SEO
  // Cada uma captura pesquisas como "ibuprofen efeitos adversos", "metformin para que serve"
  const drugPages: MetadataRoute.Sitemap = TOP_DRUGS.map(drug => ({
    url: `${BASE_URL}/drugs/${drug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...drugPages]
}