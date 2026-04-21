import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

const TOP_DRUGS = [
  'ibuprofen','acetaminophen','aspirin','naproxen','diclofenac','meloxicam','celecoxib','ketorolac',
  'amoxicillin','azithromycin','ciprofloxacin','doxycycline','metronidazole','clindamycin',
  'trimethoprim','levofloxacin','clarithromycin','cephalexin','amoxicillin-clavulanate',
  'metoprolol','atenolol','bisoprolol','carvedilol','propranolol','lisinopril','enalapril',
  'ramipril','perindopril','captopril','losartan','valsartan','candesartan','amlodipine',
  'nifedipine','diltiazem','verapamil','atorvastatin','simvastatin','rosuvastatin','pravastatin',
  'furosemide','hydrochlorothiazide','spironolactone','digoxin','amiodarone','warfarin',
  'clopidogrel','rivaroxaban','apixaban','dabigatran','heparin','enoxaparin',
  'omeprazole','lansoprazole','pantoprazole','esomeprazole','metoclopramide','ondansetron',
  'metformin','glibenclamide','gliclazide','sitagliptin','empagliflozin','dapagliflozin',
  'liraglutide','insulin','insulin-glargine',
  'sertraline','fluoxetine','paroxetine','citalopram','escitalopram','venlafaxine',
  'duloxetine','mirtazapine','bupropion','amitriptyline','nortriptyline',
  'diazepam','lorazepam','alprazolam','clonazepam','zolpidem','quetiapine','olanzapine',
  'risperidone','haloperidol','aripiprazole','lithium','valproate','lamotrigine',
  'carbamazepine','phenytoin','levetiracetam','gabapentin','pregabalin',
  'donepezil','memantine','tramadol','codeine','morphine','oxycodone','fentanyl',
  'buprenorphine','naloxone','salbutamol','salmeterol','tiotropium','budesonide',
  'fluticasone','montelukast','cetirizine','loratadine','fexofenadine',
  'levothyroxine','prednisone','prednisolone','dexamethasone','hydrocortisone',
  'methylprednisolone','estradiol','progesterone','levonorgestrel',
  'fluconazole','itraconazole','clotrimazole','nystatin','terbinafine',
  'acyclovir','valacyclovir','oseltamivir',
  'vitamin-d','vitamin-b12','folic-acid','iron','calcium','magnesium',
  'methotrexate','hydroxychloroquine','sulfasalazine','colchicine','allopurinol',
  'tamsulosin','finasteride','sildenafil','tadalafil',
  'latanoprost','timolol','tretinoin','betamethasone','clobetasol','mupirocin',
]

const INTERACTION_PAIRS = [
  'ibuprofeno-e-varfarina','metformina-e-alcool','aspirina-e-heparina',
  'sertralina-e-hipericao','atorvastatina-e-claritromicina','digoxina-e-amiodarona',
  'paracetamol-e-codeina','tramadol-e-diazepam','omeprazol-e-clopidogrel',
  'rivaroxabano-e-aspirina','apixabano-e-ibuprofeno','lisinopril-e-potassio',
  'metoprolol-e-amiodarona','varfarina-e-omeprazol','sertralina-e-tramadol',
  'fluoxetina-e-tramadol','lorazepam-e-alcool','claritromicina-e-estatinas',
  'amiodarona-e-varfarina','clopidogrel-e-omeprazol',
  'levotiroxina-e-calcio','metotrexato-e-ibuprofeno','digoxina-e-furosemida',
  'insulina-e-alcool','prednisolona-e-ibuprofeno',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/labs`,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/interactions`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${BASE_URL}/drugs`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/quickcheck`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/safety`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/monograph`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/doses`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.88 },
    { url: `${BASE_URL}/compatibility`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/calculators`,             lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/dilutions`,               lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/study`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/exam`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/cases`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/mymeds`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/ai`,                      lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/strategy`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.88 },
    { url: `${BASE_URL}/protocol`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/med-review`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/briefing`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/pricing`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/checkout`,                lastModified: now, changeFrequency: 'monthly', priority: 0.6 },                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/api-docs`,              lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
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