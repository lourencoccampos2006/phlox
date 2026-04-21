import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

const TOP_DRUGS = [
  'ibuprofen','acetaminophen','aspirin','naproxen','diclofenac','meloxicam',
  'amoxicillin','azithromycin','ciprofloxacin','doxycycline','metronidazole',
  'metoprolol','atenolol','bisoprolol','carvedilol','lisinopril','enalapril',
  'ramipril','losartan','valsartan','amlodipine','atorvastatin','simvastatin',
  'rosuvastatin','furosemide','spironolactone','digoxin','amiodarone','warfarin',
  'clopidogrel','rivaroxaban','apixaban','dabigatran','omeprazole','pantoprazole',
  'metformin','sitagliptin','empagliflozin','dapagliflozin','liraglutide','insulin',
  'sertraline','fluoxetine','escitalopram','venlafaxine','duloxetine','mirtazapine',
  'diazepam','lorazepam','alprazolam','zolpidem','quetiapine','olanzapine',
  'risperidone','aripiprazole','valproate','lamotrigine','levetiracetam','pregabalin',
  'levothyroxine','prednisone','prednisolone','dexamethasone','salbutamol',
  'budesonide','fluticasone','montelukast','cetirizine','loratadine',
  'fluconazole','acyclovir','vitamin-d','folic-acid','iron','allopurinol',
  'methotrexate','hydroxychloroquine','colchicine','tamsulosin','sildenafil',
]

const INTERACTION_PAIRS = [
  'ibuprofeno-e-varfarina','metformina-e-alcool','aspirina-e-heparina',
  'sertralina-e-hipericao','atorvastatina-e-claritromicina','digoxina-e-amiodarona',
  'omeprazol-e-clopidogrel','rivaroxabano-e-aspirina','lisinopril-e-potassio',
  'metoprolol-e-amiodarona','sertralina-e-tramadol','lorazepam-e-alcool',
  'amiodarona-e-varfarina','levotiroxina-e-calcio','prednisolona-e-ibuprofeno',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                  lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/labs`,                        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/interactions`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE_URL}/ai`,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/drugs`,                       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/quickcheck`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/safety`,                      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/monograph`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/doses`,                       lastModified: now, changeFrequency: 'weekly',  priority: 0.88 },
    { url: `${BASE_URL}/compatibility`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/calculators`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/dilutions`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/study`,                       lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/exam`,                        lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/cases`,                       lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/mymeds`,                      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/strategy`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.88 },
    { url: `${BASE_URL}/protocol`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/med-review`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/briefing`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/pricing`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/checkout`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/api-docs`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`,                     lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/blog/ibuprofeno-varfarina`,  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/about`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const interactionPages: MetadataRoute.Sitemap = INTERACTION_PAIRS.map(pair => ({
    url: `${BASE_URL}/interactions/${pair}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }))

  const drugPages: MetadataRoute.Sitemap = TOP_DRUGS.map(drug => ({
    url: `${BASE_URL}/drugs/${drug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...interactionPages, ...drugPages]
}