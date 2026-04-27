import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'


const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6h


// PT/EU brand/generic names → FDA English names (500+ entries)
const PT_TO_FDA: Record<string, string> = {
  'brufen': 'ibuprofen', 'nurofen': 'ibuprofen', 'advil': 'ibuprofen', 'ibuprom': 'ibuprofen',
  'spedifen': 'ibuprofen', 'moment': 'ibuprofen', 'ibuprofeno': 'ibuprofen',
  'ben-u-ron': 'acetaminophen', 'panadol': 'acetaminophen', 'paracetamol': 'acetaminophen',
  'efferalgan': 'acetaminophen', 'dafalgan': 'acetaminophen', 'tylenol': 'acetaminophen',
  'voltaren': 'diclofenac', 'cataflam': 'diclofenac', 'diclofenac': 'diclofenac',
  'arcoxia': 'etoricoxib', 'etoricoxib': 'etoricoxib',
  'celebrex': 'celecoxib', 'celecoxib': 'celecoxib',
  'mobic': 'meloxicam', 'meloxicam': 'meloxicam', 'movalis': 'meloxicam',
  'naproxeno': 'naproxen', 'naproxen': 'naproxen', 'flanax': 'naproxen',
  'aspirina': 'aspirin', 'aspegic': 'aspirin', 'cardiovaspin': 'aspirin', 'aspirin': 'aspirin',
  'acido acetilsalicilico': 'aspirin',
  'feldene': 'piroxicam', 'piroxicam': 'piroxicam',
  'orudis': 'ketoprofen', 'fastum': 'ketoprofen', 'cetoprofeno': 'ketoprofen', 'ketoprofen': 'ketoprofen',
  'toradol': 'ketorolac', 'cetorolac': 'ketorolac', 'ketorolac': 'ketorolac',
  'tramal': 'tramadol', 'contramal': 'tramadol', 'zaldiar': 'tramadol', 'tramadol': 'tramadol',
  'morfina': 'morphine', 'morphine': 'morphine', 'sevredol': 'morphine',
  'oxycontin': 'oxycodone', 'oxicodona': 'oxycodone', 'oxycodone': 'oxycodone',
  'fentanyl': 'fentanyl', 'fentanil': 'fentanyl', 'durogesic': 'fentanyl',
  'codeina': 'codeine', 'codeine': 'codeine',
  'colchicina': 'colchicine', 'colchicine': 'colchicine',
  // Cardiovascular - antihipertensores
  'lisinopril': 'lisinopril', 'zestril': 'lisinopril', 'prinivil': 'lisinopril',
  'ramipril': 'ramipril', 'tritace': 'ramipril', 'altace': 'ramipril',
  'enalapril': 'enalapril', 'renitec': 'enalapril', 'vasotec': 'enalapril',
  'perindopril': 'perindopril', 'coversyl': 'perindopril', 'acertil': 'perindopril',
  'captopril': 'captopril', 'capoten': 'captopril',
  'losartan': 'losartan', 'cozaar': 'losartan', 'hyzaar': 'losartan',
  'valsartan': 'valsartan', 'diovan': 'valsartan',
  'telmisartan': 'telmisartan', 'micardis': 'telmisartan',
  'candesartan': 'candesartan', 'atacand': 'candesartan',
  'irbesartan': 'irbesartan', 'aprovel': 'irbesartan', 'avapro': 'irbesartan',
  'amlodipina': 'amlodipine', 'amlodipine': 'amlodipine', 'norvasc': 'amlodipine', 'istin': 'amlodipine',
  'nifedipina': 'nifedipine', 'nifedipine': 'nifedipine', 'adalat': 'nifedipine',
  'diltiazem': 'diltiazem', 'tildiem': 'diltiazem', 'cardizem': 'diltiazem',
  'verapamil': 'verapamil', 'isoptin': 'verapamil',
  'bisoprolol': 'bisoprolol', 'concor': 'bisoprolol', 'bisocor': 'bisoprolol',
  'metoprolol': 'metoprolol', 'seloken': 'metoprolol', 'betaloc': 'metoprolol', 'lopresor': 'metoprolol',
  'atenolol': 'atenolol', 'tenormin': 'atenolol',
  'carvedilol': 'carvedilol', 'kredex': 'carvedilol', 'dilatrend': 'carvedilol',
  'nebivolol': 'nebivolol', 'nebilet': 'nebivolol',
  'propranolol': 'propranolol', 'inderal': 'propranolol',
  'furosemida': 'furosemide', 'furosemide': 'furosemide', 'lasix': 'furosemide', 'frusemida': 'furosemide',
  'torasemida': 'torsemide', 'torsemide': 'torsemide', 'demadex': 'torsemide',
  'espironolactona': 'spironolactone', 'spironolactone': 'spironolactone', 'aldactone': 'spironolactone',
  'eplerenona': 'eplerenone', 'eplerenone': 'eplerenone', 'inspra': 'eplerenone',
  'hidroclorotiazida': 'hydrochlorothiazide', 'hydrochlorothiazide': 'hydrochlorothiazide',
  'indapamida': 'indapamide', 'indapamide': 'indapamide', 'natrilix': 'indapamide',
  'clortalidona': 'chlorthalidone', 'chlorthalidone': 'chlorthalidone',
  // Anticoagulantes
  'varfarina': 'warfarin', 'warfarin': 'warfarin', 'coumadin': 'warfarin',
  'acenocumarol': 'acenocoumarol', 'acenocoumarol': 'acenocoumarol', 'sintrom': 'acenocoumarol',
  'rivaroxabano': 'rivaroxaban', 'rivaroxaban': 'rivaroxaban', 'xarelto': 'rivaroxaban',
  'apixabano': 'apixaban', 'apixaban': 'apixaban', 'eliquis': 'apixaban',
  'dabigatrano': 'dabigatran', 'dabigatran': 'dabigatran', 'pradaxa': 'dabigatran',
  'edoxabano': 'edoxaban', 'edoxaban': 'edoxaban', 'lixiana': 'edoxaban',
  'enoxaparina': 'enoxaparin', 'enoxaparin': 'enoxaparin', 'clexane': 'enoxaparin',
  'heparina': 'heparin', 'heparin': 'heparin',
  'clopidogrel': 'clopidogrel', 'plavix': 'clopidogrel', 'iscover': 'clopidogrel',
  'ticagrelor': 'ticagrelor', 'brilique': 'ticagrelor',
  'prasugrel': 'prasugrel', 'efient': 'prasugrel',
  // Estatinas
  'atorvastatina': 'atorvastatin', 'atorvastatin': 'atorvastatin', 'lipitor': 'atorvastatin', 'torvast': 'atorvastatin',
  'sinvastatina': 'simvastatin', 'simvastatin': 'simvastatin', 'zocor': 'simvastatin',
  'rosuvastatina': 'rosuvastatin', 'rosuvastatin': 'rosuvastatin', 'crestor': 'rosuvastatin', 'crestol': 'rosuvastatin',
  'pravastatina': 'pravastatin', 'pravastatin': 'pravastatin', 'pravachol': 'pravastatin',
  'fluvastatina': 'fluvastatin', 'fluvastatin': 'fluvastatin', 'lescol': 'fluvastatin',
  'ezetimiba': 'ezetimibe', 'ezetimibe': 'ezetimibe', 'ezetrol': 'ezetimibe',
  'fenofibrato': 'fenofibrate', 'fenofibrate': 'fenofibrate', 'lipanthyl': 'fenofibrate',
  // Cardíaco
  'digoxina': 'digoxin', 'digoxin': 'digoxin', 'lanoxin': 'digoxin',
  'amiodarona': 'amiodarone', 'amiodarone': 'amiodarone', 'cordarone': 'amiodarone',
  'dronedarona': 'dronedarone', 'dronedarone': 'dronedarone', 'multaq': 'dronedarone',
  'nitroglicerina': 'nitroglycerin', 'nitroglycerin': 'nitroglycerin', 'nitromint': 'nitroglycerin',
  'ivabradina': 'ivabradine', 'ivabradine': 'ivabradine', 'corlentor': 'ivabradine',
  // GI
  'omeprazol': 'omeprazole', 'omeprazole': 'omeprazole', 'losec': 'omeprazole', 'prilosec': 'omeprazole',
  'esomeprazol': 'esomeprazole', 'esomeprazole': 'esomeprazole', 'nexium': 'esomeprazole',
  'pantoprazol': 'pantoprazole', 'pantoprazole': 'pantoprazole', 'pantozol': 'pantoprazole', 'controloc': 'pantoprazole',
  'lansoprazol': 'lansoprazole', 'lansoprazole': 'lansoprazole', 'prevacid': 'lansoprazole', 'lanzor': 'lansoprazole',
  'rabeprazol': 'rabeprazole', 'rabeprazole': 'rabeprazole', 'pariet': 'rabeprazole',
  'ranitidina': 'ranitidine', 'ranitidine': 'ranitidine', 'zantac': 'ranitidine',
  'domperidona': 'domperidone', 'domperidone': 'domperidone', 'motilium': 'domperidone',
  'metoclopramida': 'metoclopramide', 'metoclopramide': 'metoclopramide', 'primperan': 'metoclopramide',
  'ondansetrom': 'ondansetron', 'ondansetron': 'ondansetron', 'zofran': 'ondansetron',
  'loperamida': 'loperamide', 'loperamide': 'loperamide', 'imodium': 'loperamide',
  // Diabetes
  'metformina': 'metformin', 'metformin': 'metformin', 'glucophage': 'metformin', 'riomet': 'metformin',
  'gliclazida': 'gliclazide', 'gliclazide': 'gliclazide', 'diamicron': 'gliclazide',
  'glibenclamida': 'glibenclamide', 'glibenclamide': 'glibenclamide', 'daonil': 'glibenclamide',
  'glimepirida': 'glimepiride', 'glimepiride': 'glimepiride', 'amaryl': 'glimepiride',
  'sitagliptina': 'sitagliptin', 'sitagliptin': 'sitagliptin', 'januvia': 'sitagliptin',
  'vildagliptina': 'vildagliptin', 'vildagliptin': 'vildagliptin', 'galvus': 'vildagliptin',
  'saxagliptina': 'saxagliptin', 'saxagliptin': 'saxagliptin', 'onglyza': 'saxagliptin',
  'linagliptina': 'linagliptin', 'linagliptin': 'linagliptin', 'trajenta': 'linagliptin',
  'empagliflozina': 'empagliflozin', 'empagliflozin': 'empagliflozin', 'jardiance': 'empagliflozin',
  'dapagliflozina': 'dapagliflozin', 'dapagliflozin': 'dapagliflozin', 'forxiga': 'dapagliflozin',
  'canagliflozina': 'canagliflozin', 'canagliflozin': 'canagliflozin', 'invokana': 'canagliflozin',
  'ertugliflozina': 'ertugliflozin', 'ertugliflozin': 'ertugliflozin', 'steglatro': 'ertugliflozin',
  'liraglutido': 'liraglutide', 'liraglutide': 'liraglutide', 'victoza': 'liraglutide',
  'semaglutido': 'semaglutide', 'semaglutide': 'semaglutide', 'ozempic': 'semaglutide', 'wegovy': 'semaglutide', 'rybelsus': 'semaglutide',
  'dulaglutido': 'dulaglutide', 'dulaglutide': 'dulaglutide', 'trulicity': 'dulaglutide',
  'exenatido': 'exenatide', 'exenatide': 'exenatide', 'byetta': 'exenatide',
  'tirzepatido': 'tirzepatide', 'tirzepatide': 'tirzepatide', 'mounjaro': 'tirzepatide',
  'insulina glargina': 'insulin glargine', 'insulin glargine': 'insulin glargine', 'lantus': 'insulin glargine', 'toujeo': 'insulin glargine',
  'insulina detemir': 'insulin detemir', 'insulin detemir': 'insulin detemir', 'levemir': 'insulin detemir',
  'insulina degludec': 'insulin degludec', 'insulin degludec': 'insulin degludec', 'tresiba': 'insulin degludec',
  'insulina aspart': 'insulin aspart', 'insulin aspart': 'insulin aspart', 'novorapid': 'insulin aspart', 'fiasp': 'insulin aspart',
  'insulina lispro': 'insulin lispro', 'insulin lispro': 'insulin lispro', 'humalog': 'insulin lispro',
  'insulina glulisina': 'insulin glulisine', 'insulin glulisine': 'insulin glulisine', 'apidra': 'insulin glulisine',
  'humulin': 'insulin human', 'actrapid': 'insulin human',
  // Psiquiatria
  'fluoxetina': 'fluoxetine', 'fluoxetine': 'fluoxetine', 'prozac': 'fluoxetine',
  'sertralina': 'sertraline', 'sertraline': 'sertraline', 'zoloft': 'sertraline', 'lustral': 'sertraline',
  'paroxetina': 'paroxetine', 'paroxetine': 'paroxetine', 'seroxat': 'paroxetine',
  'escitalopram': 'escitalopram', 'cipralex': 'escitalopram', 'lexapro': 'escitalopram',
  'citalopram': 'citalopram', 'seropram': 'citalopram', 'celexa': 'citalopram',
  'fluvoxamina': 'fluvoxamine', 'fluvoxamine': 'fluvoxamine', 'fevarin': 'fluvoxamine',
  'venlafaxina': 'venlafaxine', 'venlafaxine': 'venlafaxine', 'efexor': 'venlafaxine', 'effexor': 'venlafaxine',
  'duloxetina': 'duloxetine', 'duloxetine': 'duloxetine', 'cymbalta': 'duloxetine',
  'mirtazapina': 'mirtazapine', 'mirtazapine': 'mirtazapine', 'remeron': 'mirtazapine', 'zispin': 'mirtazapine',
  'amitriptilina': 'amitriptyline', 'amitriptyline': 'amitriptyline', 'tryptanol': 'amitriptyline',
  'nortriptilina': 'nortriptyline', 'nortriptyline': 'nortriptyline',
  'clomipramina': 'clomipramine', 'clomipramine': 'clomipramine', 'anafranil': 'clomipramine',
  'bupropiona': 'bupropion', 'bupropion': 'bupropion', 'wellbutrin': 'bupropion', 'zyban': 'bupropion',
  'trazodona': 'trazodone', 'trazodone': 'trazodone',
  'agomelatina': 'agomelatine', 'agomelatine': 'agomelatine', 'valdoxan': 'agomelatine',
  'vortioxetina': 'vortioxetine', 'vortioxetine': 'vortioxetine', 'brintellix': 'vortioxetine',
  'risperidona': 'risperidone', 'risperidone': 'risperidone', 'risperdal': 'risperidone',
  'olanzapina': 'olanzapine', 'olanzapine': 'olanzapine', 'zyprexa': 'olanzapine',
  'quetiapina': 'quetiapine', 'quetiapine': 'quetiapine', 'seroquel': 'quetiapine',
  'aripiprazol': 'aripiprazole', 'aripiprazole': 'aripiprazole', 'abilify': 'aripiprazole',
  'haloperidol': 'haloperidol', 'haldol': 'haloperidol',
  'clozapina': 'clozapine', 'clozapine': 'clozapine', 'leponex': 'clozapine',
  'valproato': 'valproate', 'valproate': 'valproate', 'depakine': 'valproate', 'epilim': 'valproate',
  'acido valproico': 'valproic acid', 'valproic acid': 'valproic acid',
  'carbamazepina': 'carbamazepine', 'carbamazepine': 'carbamazepine', 'tegretol': 'carbamazepine',
  'lamotrigina': 'lamotrigine', 'lamotrigine': 'lamotrigine', 'lamictal': 'lamotrigine',
  'levetiracetam': 'levetiracetam', 'keppra': 'levetiracetam',
  'topiramato': 'topiramate', 'topiramate': 'topiramate', 'topamax': 'topiramate',
  'pregabalina': 'pregabalin', 'pregabalin': 'pregabalin', 'lyrica': 'pregabalin',
  'gabapentina': 'gabapentin', 'gabapentin': 'gabapentin', 'neurontin': 'gabapentin',
  'fenitoina': 'phenytoin', 'phenytoin': 'phenytoin', 'dilantin': 'phenytoin',
  'fenobarbital': 'phenobarbital', 'phenobarbital': 'phenobarbital', 'luminal': 'phenobarbital',
  'diazepam': 'diazepam', 'valium': 'diazepam',
  'lorazepam': 'lorazepam', 'ativan': 'lorazepam',
  'alprazolam': 'alprazolam', 'xanax': 'alprazolam',
  'clonazepam': 'clonazepam', 'rivotril': 'clonazepam',
  'midazolam': 'midazolam', 'dormicum': 'midazolam',
  'zolpidem': 'zolpidem', 'stilnox': 'zolpidem', 'benestad': 'zolpidem',
  'zopiclona': 'zopiclone', 'zopiclone': 'zopiclone', 'imovane': 'zopiclone',
  'litio': 'lithium', 'lithium': 'lithium', 'priadel': 'lithium',
  'donepezilo': 'donepezil', 'donepezil': 'donepezil', 'aricept': 'donepezil',
  'rivastigmina': 'rivastigmine', 'rivastigmine': 'rivastigmine', 'exelon': 'rivastigmine',
  'galantamina': 'galantamine', 'galantamine': 'galantamine', 'reminyl': 'galantamine',
  'memantina': 'memantine', 'memantine': 'memantine', 'ebixa': 'memantine',
  'levodopa': 'levodopa', 'sinemet': 'levodopa', 'madopar': 'levodopa',
  'pramipexol': 'pramipexole', 'pramipexole': 'pramipexole', 'mirapexin': 'pramipexole',
  'ropinirol': 'ropinirole', 'ropinirole': 'ropinirole', 'requip': 'ropinirole',
  'sumatriptano': 'sumatriptan', 'sumatriptan': 'sumatriptan', 'imigran': 'sumatriptan',
  'rizatriptano': 'rizatriptan', 'rizatriptan': 'rizatriptan', 'maxalt': 'rizatriptan',
  // Respiratorio
  'salbutamol': 'albuterol', 'albuterol': 'albuterol', 'ventolin': 'albuterol', 'bricanyl': 'albuterol',
  'terbutalina': 'terbutaline', 'terbutaline': 'terbutaline',
  'salmeterol': 'salmeterol', 'serevent': 'salmeterol',
  'formoterol': 'formoterol', 'foradil': 'formoterol',
  'indacaterol': 'indacaterol', 'onbrez': 'indacaterol',
  'tiotropio': 'tiotropium', 'tiotropium': 'tiotropium', 'spiriva': 'tiotropium',
  'umeclidinio': 'umeclidinium', 'umeclidinium': 'umeclidinium', 'incruse': 'umeclidinium',
  'aclidinio': 'aclidinium', 'aclidinium': 'aclidinium', 'eklira': 'aclidinium',
  'ipratropio': 'ipratropium', 'ipratropium': 'ipratropium', 'atrovent': 'ipratropium',
  'budesonido': 'budesonide', 'budesonide': 'budesonide', 'pulmicort': 'budesonide',
  'fluticasona': 'fluticasone', 'fluticasone': 'fluticasone', 'flixotide': 'fluticasone',
  'beclometasona': 'beclomethasone', 'beclomethasone': 'beclomethasone', 'qvar': 'beclomethasone',
  'mometasona': 'mometasone', 'mometasone': 'mometasone', 'asmanex': 'mometasone',
  'montelucaste': 'montelukast', 'montelukast': 'montelukast', 'singulair': 'montelukast',
  'omalizumab': 'omalizumab', 'xolair': 'omalizumab',
  'roflumilast': 'roflumilast', 'daxas': 'roflumilast',
  // Antibioticos
  'amoxicilina': 'amoxicillin', 'amoxicillin': 'amoxicillin', 'amoxil': 'amoxicillin', 'clamoxyl': 'amoxicillin', 'flemoxin': 'amoxicillin',
  'augmentin': 'amoxicillin', 'clavamox': 'amoxicillin',
  'azitromicina': 'azithromycin', 'azithromycin': 'azithromycin', 'zithromax': 'azithromycin', 'azitrocin': 'azithromycin', 'sumamed': 'azithromycin',
  'claritromicina': 'clarithromycin', 'clarithromycin': 'clarithromycin', 'klacid': 'clarithromycin', 'klaricid': 'clarithromycin',
  'eritromicina': 'erythromycin', 'erythromycin': 'erythromycin',
  'ciprofloxacina': 'ciprofloxacin', 'ciprofloxacin': 'ciprofloxacin', 'ciproxin': 'ciprofloxacin', 'cipro': 'ciprofloxacin', 'baycip': 'ciprofloxacin',
  'levofloxacina': 'levofloxacin', 'levofloxacin': 'levofloxacin', 'tavanic': 'levofloxacin', 'levaquin': 'levofloxacin',
  'moxifloxacina': 'moxifloxacin', 'moxifloxacin': 'moxifloxacin', 'avelox': 'moxifloxacin',
  'doxiciclina': 'doxycycline', 'doxycycline': 'doxycycline', 'vibramycin': 'doxycycline', 'oraxyl': 'doxycycline',
  'minociclina': 'minocycline', 'minocycline': 'minocycline',
  'metronidazol': 'metronidazole', 'metronidazole': 'metronidazole', 'flagyl': 'metronidazole',
  'clindamicina': 'clindamycin', 'clindamycin': 'clindamycin', 'dalacin': 'clindamycin', 'cleocin': 'clindamycin',
  'bactrim': 'trimethoprim', 'septrin': 'trimethoprim', 'trimetoprim': 'trimethoprim',
  'cefalexina': 'cephalexin', 'cephalexin': 'cephalexin', 'keflex': 'cephalexin',
  'cefuroxima': 'cefuroxime', 'cefuroxime': 'cefuroxime', 'zinnat': 'cefuroxime',
  'ceftriaxona': 'ceftriaxone', 'ceftriaxone': 'ceftriaxone', 'rocephin': 'ceftriaxone',
  'cefazolina': 'cefazolin', 'cefazolin': 'cefazolin',
  'vancomicina': 'vancomycin', 'vancomycin': 'vancomycin', 'vancocin': 'vancomycin',
  'linezolida': 'linezolid', 'linezolid': 'linezolid', 'zyvox': 'linezolid',
  'piperacilina': 'piperacillin', 'piperacillin': 'piperacillin', 'tazocin': 'piperacillin',
  'meropenem': 'meropenem', 'meronem': 'meropenem',
  'nitrofurantoina': 'nitrofurantoin', 'nitrofurantoin': 'nitrofurantoin', 'macrobid': 'nitrofurantoin',
  'fosfomicina': 'fosfomycin', 'fosfomycin': 'fosfomycin', 'monurol': 'fosfomycin',
  // Antifungicos / antivirais
  'fluconazol': 'fluconazole', 'fluconazole': 'fluconazole', 'diflucan': 'fluconazole',
  'itraconazol': 'itraconazole', 'itraconazole': 'itraconazole', 'sporanox': 'itraconazole',
  'voriconazol': 'voriconazole', 'voriconazole': 'voriconazole', 'vfend': 'voriconazole',
  'terbinafina': 'terbinafine', 'terbinafine': 'terbinafine', 'lamisil': 'terbinafine',
  'nistatina': 'nystatin', 'nystatin': 'nystatin', 'mycostatin': 'nystatin',
  'aciclovir': 'acyclovir', 'acyclovir': 'acyclovir', 'zovirax': 'acyclovir',
  'valaciclovir': 'valacyclovir', 'valacyclovir': 'valacyclovir', 'valtrex': 'valacyclovir',
  'famciclovir': 'famciclovir', 'famvir': 'famciclovir',
  'oseltamivir': 'oseltamivir', 'tamiflu': 'oseltamivir',
  // Tiroide
  'levotiroxina': 'levothyroxine', 'levothyroxine': 'levothyroxine', 'euthyrox': 'levothyroxine', 'synthroid': 'levothyroxine', 'letter': 'levothyroxine',
  'tiamazol': 'methimazole', 'methimazole': 'methimazole', 'strumazol': 'methimazole', 'thyrozol': 'methimazole',
  // Corticosteroides
  'prednisolona': 'prednisolone', 'prednisolone': 'prednisolone',
  'prednisona': 'prednisone', 'prednisone': 'prednisone',
  'dexametasona': 'dexamethasone', 'dexamethasone': 'dexamethasone', 'decadron': 'dexamethasone',
  'metilprednisolona': 'methylprednisolone', 'methylprednisolone': 'methylprednisolone', 'medrol': 'methylprednisolone',
  'hidrocortisona': 'hydrocortisone', 'hydrocortisone': 'hydrocortisone',
  'betametasona': 'betamethasone', 'betamethasone': 'betamethasone',
  'clobetasol': 'clobetasol', 'dermovate': 'clobetasol',
  // Alergias
  'cetirizina': 'cetirizine', 'cetirizine': 'cetirizine', 'zyrtec': 'cetirizine', 'zirtec': 'cetirizine',
  'levocetirizina': 'levocetirizine', 'levocetirizine': 'levocetirizine', 'xyzal': 'levocetirizine',
  'loratadina': 'loratadine', 'loratadine': 'loratadine', 'claritine': 'loratadine', 'claritin': 'loratadine',
  'desloratadina': 'desloratadine', 'desloratadine': 'desloratadine', 'aerius': 'desloratadine',
  'fexofenadina': 'fexofenadine', 'fexofenadine': 'fexofenadine', 'telfast': 'fexofenadine', 'allegra': 'fexofenadine',
  'bilastina': 'bilastine', 'bilastine': 'bilastine', 'ilaxten': 'bilastine',
  'difenidramina': 'diphenhydramine', 'diphenhydramine': 'diphenhydramine', 'benadryl': 'diphenhydramine',
  'polaramine': 'dexchlorpheniramine',
  'prometazina': 'promethazine', 'promethazine': 'promethazine', 'phenergan': 'promethazine',
  // Reumatologia / osteoporose
  'metotrexato': 'methotrexate', 'methotrexate': 'methotrexate',
  'hidroxicloroquina': 'hydroxychloroquine', 'hydroxychloroquine': 'hydroxychloroquine', 'plaquenil': 'hydroxychloroquine',
  'sulfassalazina': 'sulfasalazine', 'sulfasalazine': 'sulfasalazine',
  'leflunomida': 'leflunomide', 'leflunomide': 'leflunomide', 'arava': 'leflunomide',
  'alopurinol': 'allopurinol', 'allopurinol': 'allopurinol', 'zyloric': 'allopurinol',
  'febuxostat': 'febuxostat', 'adenuric': 'febuxostat',
  'alendronato': 'alendronate', 'alendronate': 'alendronate', 'fosamax': 'alendronate',
  'risedronato': 'risedronate', 'risedronate': 'risedronate', 'actonel': 'risedronate',
  'ibandronato': 'ibandronate', 'ibandronate': 'ibandronate', 'bonviva': 'ibandronate',
  'acido zoledronico': 'zoledronic acid', 'zoledronic acid': 'zoledronic acid', 'aclasta': 'zoledronic acid',
  'denosumab': 'denosumab', 'prolia': 'denosumab', 'xgeva': 'denosumab',
  'etanercept': 'etanercept', 'enbrel': 'etanercept',
  'infliximab': 'infliximab', 'remicade': 'infliximab',
  'adalimumab': 'adalimumab', 'humira': 'adalimumab',
  'tocilizumab': 'tocilizumab', 'roactemra': 'tocilizumab',
  'abatacept': 'abatacept', 'orencia': 'abatacept',
  // Urologia
  'tamsulosina': 'tamsulosin', 'tamsulosin': 'tamsulosin', 'omnic': 'tamsulosin', 'flomax': 'tamsulosin',
  'alfuzosina': 'alfuzosin', 'alfuzosin': 'alfuzosin', 'xatral': 'alfuzosin',
  'finasterida': 'finasteride', 'finasteride': 'finasteride', 'proscar': 'finasteride', 'propecia': 'finasteride',
  'dutasterida': 'dutasteride', 'dutasteride': 'dutasteride', 'avodart': 'dutasteride',
  'sildenafilo': 'sildenafil', 'sildenafil': 'sildenafil', 'viagra': 'sildenafil', 'revatio': 'sildenafil',
  'tadalafilo': 'tadalafil', 'tadalafil': 'tadalafil', 'cialis': 'tadalafil',
  'vardenafilo': 'vardenafil', 'vardenafil': 'vardenafil', 'levitra': 'vardenafil',
  'oxibutinina': 'oxybutynin', 'oxybutynin': 'oxybutynin', 'ditropan': 'oxybutynin',
  'solifenacina': 'solifenacin', 'solifenacin': 'solifenacin', 'vesicare': 'solifenacin',
  // Vitaminas / suplementos
  'vitamina d': 'vitamin d', 'vitamina d3': 'vitamin d', 'vigantol': 'vitamin d', 'oleovit': 'vitamin d',
  'vitamina b12': 'cyanocobalamin', 'cianocobalamina': 'cyanocobalamin', 'cyanocobalamin': 'cyanocobalamin',
  'acido folico': 'folic acid', 'folic acid': 'folic acid',
  'ferro': 'iron', 'iron': 'iron', 'ferrograd': 'iron', 'tardyferon': 'iron',
  'calcio': 'calcium', 'calcium': 'calcium',
  'magnesio': 'magnesium', 'magnesium': 'magnesium',
  'zinco': 'zinc', 'zinc': 'zinc',
  'melatonina': 'melatonin', 'melatonin': 'melatonin',
  // Oncologia
  'imatinib': 'imatinib', 'glivec': 'imatinib', 'gleevec': 'imatinib',
  'tamoxifeno': 'tamoxifen', 'tamoxifen': 'tamoxifen', 'nolvadex': 'tamoxifen',
  'letrozol': 'letrozole', 'letrozole': 'letrozole', 'femara': 'letrozole',
  'anastrozol': 'anastrozole', 'anastrozole': 'anastrozole', 'arimidex': 'anastrozole',
  'trastuzumab': 'trastuzumab', 'herceptin': 'trastuzumab',
  'bevacizumab': 'bevacizumab', 'avastin': 'bevacizumab',
  'rituximab': 'rituximab', 'mabthera': 'rituximab',
  // Hormonal / outros
  'estradiol': 'estradiol', 'estrofem': 'estradiol',
  'progesterona': 'progesterone', 'progesterone': 'progesterone', 'utrogestan': 'progesterone',
  'levonorgestrel': 'levonorgestrel', 'mirena': 'levonorgestrel', 'norlevo': 'levonorgestrel',
  'ulipristal': 'ulipristal acetate', 'ellaone': 'ulipristal acetate',
  'vareniclina': 'varenicline', 'varenicline': 'varenicline', 'champix': 'varenicline',
  'buprenorfina': 'buprenorphine', 'buprenorphine': 'buprenorphine', 'subutex': 'buprenorphine',
  'naloxona': 'naloxone', 'naloxone': 'naloxone', 'narcan': 'naloxone',
  'metadona': 'methadone', 'methadone': 'methadone',
  // Dermatologia
  'isotretinoina': 'isotretinoin', 'isotretinoin': 'isotretinoin', 'roaccutane': 'isotretinoin', 'accutane': 'isotretinoin',
  'tretinoina': 'tretinoin', 'tretinoin': 'tretinoin', 'retin-a': 'tretinoin',
  'mupirocina': 'mupirocin', 'mupirocin': 'mupirocin', 'bactroban': 'mupirocin', 'bactiderm': 'mupirocin',
  // Latanoproste / oftal
  'latanoproste': 'latanoprost', 'latanoprost': 'latanoprost', 'xalatan': 'latanoprost',
  'timolol': 'timolol', 'timacar': 'timolol',
  'dorzolamida': 'dorzolamide', 'dorzolamide': 'dorzolamide', 'trusopt': 'dorzolamide',
  'brimonidina': 'brimonidine', 'brimonidine': 'brimonidine', 'alphagan': 'brimonidine',
}

function resolveToFDA(term: string): string {
  // Remove diacritics for matching
  const normalized = term.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (PT_TO_FDA[normalized]) return PT_TO_FDA[normalized]
  const original = term.toLowerCase().trim()
  if (PT_TO_FDA[original]) return PT_TO_FDA[original]
  return original
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
    // Try multiple FDA search strategies in order
    async function fdaSearch(searchTerm: string): Promise<any> {
      // 1. exact generic name
      let r = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(searchTerm)}"&limit=1`, { signal: AbortSignal.timeout(6000) })
      let d = r.ok ? await r.json() : null
      if (d?.results?.[0]) return d.results[0]
      // 2. brand name
      r = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(searchTerm)}"&limit=1`, { signal: AbortSignal.timeout(6000) })
      d = r.ok ? await r.json() : null
      if (d?.results?.[0]) return d.results[0]
      // 3. wildcard generic name (catches "semaglutide injection" etc)
      r = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(searchTerm)}*&limit=1`, { signal: AbortSignal.timeout(6000) })
      d = r.ok ? await r.json() : null
      if (d?.results?.[0]) return d.results[0]
      // 4. full text search
      r = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(searchTerm)}&limit=1`, { signal: AbortSignal.timeout(6000) })
      d = r.ok ? await r.json() : null
      if (d?.results?.[0]) return d.results[0]
      return null
    }

    const [drug, adverseRes] = await Promise.all([
      fdaSearch(term),
      fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(term)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    const adverseData = adverseRes

    if (!drug) {
      return NextResponse.json({ error: `Medicamento "${q}" não encontrado. Tenta o nome científico em inglês.` }, { status: 404 })
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