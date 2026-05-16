// STOPP/START v2 — client-side screener
// Reference: O'Mahony et al. (2015) Eur J Clin Pharmacol

export interface STOPPFlag {
  code: string
  category: string
  criterion: string
  severity: 'high' | 'medium'
  action: string
  drug_class: string
}

export interface STARTFlag {
  code: string
  category: string
  criterion: string
  rationale: string
  missing_class: string
}

export interface STOPPSTARTResult {
  stopp: STOPPFlag[]
  start: STARTFlag[]
  score: number
  level: 'critical' | 'high' | 'moderate' | 'low'
}

// ─── Drug class helpers ────────────────────────────────────────────────────────

const has = (meds: string[], terms: string[]) =>
  meds.some(m => terms.some(t => m.includes(t)))

const hasCondition = (conditions: string | null, terms: string[]) => {
  if (!conditions) return false
  const c = conditions.toLowerCase()
  return terms.some(t => c.includes(t))
}

const BZD = ['diazepam','lorazepam','alprazolam','midazolam','clonazepam','temazepam','triazolam','oxazepam','bromazepam','clobazam','nitrazepam','flurazepam','brotizolam']
const Z_DRUGS = ['zolpidem','zopiclona','zaleplon','eszopiclona']
const ANTIPSYCH = ['haloperidol','risperidona','olanzapina','quetiapina','aripiprazol','ziprasidona','clozapina','sulpirida','amisulprida','paliperidona','lurasidona','clorpromazina','levomepromazina','flufenazina','perfenazina']
const TCA = ['amitriptilina','nortriptilina','imipramina','clomipramina','dosulpina','trimipramina','doxepina','protriptilina']
const ANTICHOLINERGIC = [...TCA, 'oxibutinina','tolterodina','solifenacina','darifenacina','trospium','flavoxato','biperideno','triexifenidil','prometazina','clorfenamina','ciproeptadina','clorfeniramina','difenidramina','hidroxizina','cetirizina','loratadina']
const FIRST_GEN_AH = ['prometazina','clorfenamina','ciproeptadina','clorfeniramina','difenidramina','hidroxizina','clemastina','dexclorfeniramina']
const NSAIDS = ['ibuprofeno','diclofenac','naproxeno','meloxicam','piroxicam','indometacina','celecoxib','etoricoxib','nimesulida','cetoprofeno','aceclofenac','tenoxicam','lornoxicam']
const ANTICOAG = ['varfarina','acenocumarol','warfarin','rivaroxabano','apixabano','dabigatrano','edoxabano','heparina','enoxaparina','dalteparina','fondaparinux','bivalirudina']
const ANTIPLATELET = ['aspirina','acido acetilsalicilico','clopidogrel','ticagrelor','prasugrel','dipiridamol']
const OPIOID = ['morfina','codeina','tramadol','fentanil','oxicodona','hidromorfona','buprenorfina','metadona','tapentadol','hidrocodona','petidina']
const SULFONYL = ['glibenclamida','glipizida','gliclazida','glimepirida','gliquidona','clorpropamida','tolbutamida']
const LONG_SULFONYL = ['glibenclamida','clorpropamida'] // longest half-life, highest hypoglycemia risk
const LOOP_DIURETIC = ['furosemida','torasemida','bumetanida','piretanida','ácido etacrínico']
const BETA_BLOCKER = ['atenolol','metoprolol','bisoprolol','carvedilol','nebivolol','propranolol','nadolol','sotalol','timolol','celiprolol','betaxolol','acebutolol']
const NON_CARDIO_BB = ['propranolol','nadolol','sotalol','timolol','pindolol','oxprenolol']
const ACE_ARB = ['ramipril','enalapril','lisinopril','perindopril','captopril','quinapril','trandolapril','fosinopril','losartan','valsartan','candesartan','irbesartan','olmesartan','telmisartan','eprosartan']
const STATIN = ['atorvastatina','rosuvastatina','sinvastatina','pravastatina','fluvastatina','lovastatina','pitavastatina','cerivastatina']
const PPI = ['omeprazol','pantoprazol','lansoprazol','rabeprazol','esomeprazol','dexlansoprazol']
const ANTICHOLINERGIC_BD = ['ipratrópio','tiotrópio','glicopirrônio','aclidínio','umeclidínio','revefenacina']
const LAXATIVE = ['lactulose','bisacodil','sena','macrogol','polietilenoglicol','psílio','docusato','picossulfato']
const CORTICOSTEROID = ['prednisolona','prednisona','dexametasona','metilprednisolona','betametasona','hidrocortisona','beclometasona']
const SSRI = ['fluoxetina','sertralina','paroxetina','citalopram','escitalopram','fluvoxamina']
const DIGOXIN = ['digoxina']
const ANTIDEPRESSANT = [...SSRI, ...TCA, 'venlafaxina','duloxetina','mirtazapina','bupropiona','trazodona','milnaciprano','vortioxetina','agomelatina','moclobemida']
const VITAMIN_D = ['colecalciferol','ergocalciferol','calcifediol','calcitriol','vitamina d','alfacalcidol']
const CALCIUM = ['carbonato de calcio','citrato de calcio','gluconato de calcio','calcio']
const BISPHOSPHONATE = ['alendronato','risedronato','ibandronato','zoledronato','clodronato']

// ─── Main screener ─────────────────────────────────────────────────────────────

export function runSTOPPSTART(
  age: number | null,
  conditions: string | null,
  meds: string[], // lowercase medication names
  crCl?: number | null,
): STOPPSTARTResult {
  const stopp: STOPPFlag[] = []
  const start: STARTFlag[] = []
  const elderly = (age || 0) >= 65
  const veryElderly = (age || 0) >= 75

  const hasMed = (terms: string[]) => has(meds, terms)
  const hasCond = (terms: string[]) => hasCondition(conditions, terms)

  // ─── STOPP CRITERIA ──────────────────────────────────────────────────────────

  // B — Cardiovascular system
  if (hasMed(NSAIDS) && hasCond(['insuficiência cardíaca','insuficiencia cardiaca','heart failure','IC ']))
    stopp.push({ code: 'B5', category: 'Cardiovascular', severity: 'high', drug_class: 'AINE',
      criterion: 'AINE em insuficiência cardíaca',
      action: 'Suspender AINE — agrava retenção hídrica e pode precipitar descompensação cardíaca' })

  if (hasMed(NON_CARDIO_BB) && hasCond(['asma','asthma','dpoc','copd','broncoespasmo','doença pulmonar']))
    stopp.push({ code: 'B6', category: 'Cardiovascular', severity: 'high', drug_class: 'Beta-bloqueador não cardio-selectivo',
      criterion: 'Beta-bloqueador não cardio-selectivo em doença pulmonar obstrutiva',
      action: 'Substituir por beta-bloqueador cardio-selectivo (bisoprolol, metoprolol, atenolol)' })

  if (hasMed(LOOP_DIURETIC) && !hasCond(['edema','ascite','insuficiência cardíaca','insuficiencia cardiaca','síndrome nefrótico']) && !hasMed(ANTIPSYCH) && !hasMed(CORTICOSTEROID))
    stopp.push({ code: 'B3', category: 'Cardiovascular', severity: 'medium', drug_class: 'Diurético da ansa',
      criterion: 'Diurético da ansa como primeira linha para hipertensão sem indicação estabelecida',
      action: 'Avaliar indicação — considerar tiazida ou outras classes de anti-hipertensores' })

  // C — Antiplatelet / Anticoagulant drugs
  if (hasMed(ANTIPLATELET) && hasMed(ANTICOAG) && !hasMed(PPI))
    stopp.push({ code: 'C1', category: 'Anticoagulação', severity: 'high', drug_class: 'Antiagregante + anticoagulante',
      criterion: 'Antiagregante + anticoagulante oral sem inibidor da bomba de protões',
      action: 'Adicionar PPI (omeprazol/pantoprazol) para protecção gástrica — risco de hemorragia GI grave' })

  if (hasMed(NSAIDS) && hasMed(ANTICOAG))
    stopp.push({ code: 'C2', category: 'Anticoagulação', severity: 'high', drug_class: 'AINE + anticoagulante',
      criterion: 'AINE combinado com anticoagulante oral',
      action: 'Substituir AINE por paracetamol — risco de hemorragia grave (gástrica, SNC, renal)' })

  // D — CNS and Psychotropic drugs
  if (hasMed(TCA) && hasCond(['glaucoma','retenção urinária','hiperplasia prostática','HPB','obstipação crónica','bloqueio cardíaco','arritmia']))
    stopp.push({ code: 'D1', category: 'SNC', severity: 'high', drug_class: 'Antidepressivo tricíclico',
      criterion: 'Antidepressivo tricíclico em doentes com glaucoma de ângulo fechado, retenção urinária, obstipação grave ou arritmia cardíaca',
      action: 'Substituir por ISRS ou outro antidepressivo sem efeito anticolinérgico' })

  if (hasMed(ANTIPSYCH) && hasCond(['parkinson','parkinsonismo']) && !hasMed(['quetiapina','clozapina']))
    stopp.push({ code: 'D2', category: 'SNC', severity: 'high', drug_class: 'Antipsicótico',
      criterion: 'Antipsicótico (excepto quetiapina/clozapina) em doença de Parkinson',
      action: 'Mudar para quetiapina ou clozapina — outros antipsicóticos agravam o parkinsonismo' })

  if (hasMed(BZD) && elderly)
    stopp.push({ code: 'D6', category: 'SNC', severity: 'high', drug_class: 'Benzodiazepina',
      criterion: `Benzodiazepina em doente ≥ 65 anos${veryElderly ? ' (≥75 anos — risco ainda maior)' : ''}`,
      action: 'Redução gradual e descontinuação — risco de quedas, fracturas, confusão, sedação excessiva e dependência' })

  if (hasMed(Z_DRUGS) && elderly)
    stopp.push({ code: 'D7', category: 'SNC', severity: 'high', drug_class: 'Fármacos-Z (hipnóticos)',
      criterion: 'Fármacos-Z (zolpidem/zopiclona) em doente ≥ 65 anos',
      action: 'Descontinuar — riscos semelhantes às benzodiazepinas. Promover higiene do sono' })

  if (hasMed(FIRST_GEN_AH) && elderly)
    stopp.push({ code: 'D8', category: 'SNC', severity: 'medium', drug_class: 'Anti-histamínico 1ª geração',
      criterion: 'Anti-histamínico de 1ª geração em doente ≥ 65 anos',
      action: 'Substituir por anti-histamínico não sedativo (cetirizina, loratadina, fexofenadina)' })

  if (hasMed(OPIOID) && !hasMed(LAXATIVE) && !hasMed(['macrogol']))
    stopp.push({ code: 'D9', category: 'SNC', severity: 'medium', drug_class: 'Opióide',
      criterion: 'Opióide sem laxante concomitante',
      action: 'Adicionar laxante osmótico (macrogol/lactulose) — obstipação induzida por opióides afecta > 90% dos doentes' })

  // E — Renal system
  if (crCl !== null && crCl !== undefined) {
    if (hasMed(NSAIDS) && crCl < 50)
      stopp.push({ code: 'E1', category: 'Renal', severity: 'high', drug_class: 'AINE',
        criterion: `AINE com CrCl ${crCl.toFixed(0)} mL/min (< 50 mL/min)`,
        action: 'Suspender AINE — nefrotóxico. Usar paracetamol para analgesia' })

    if (hasMed(DIGOXIN) && crCl < 30)
      stopp.push({ code: 'E2', category: 'Renal', severity: 'high', drug_class: 'Digoxina',
        criterion: `Digoxina com CrCl ${crCl.toFixed(0)} mL/min (< 30 mL/min)`,
        action: 'Risco de toxicidade digitálica — ajustar dose ou suspender' })

    if (hasMed(['metformina']) && crCl < 30)
      stopp.push({ code: 'E3', category: 'Renal', severity: 'high', drug_class: 'Metformina',
        criterion: `Metformina com CrCl ${crCl.toFixed(0)} mL/min (< 30 mL/min)`,
        action: 'Suspender metformina — risco de acidose láctica' })

    if (hasMed(['colchicina']) && crCl < 10)
      stopp.push({ code: 'E4', category: 'Renal', severity: 'high', drug_class: 'Colquicina',
        criterion: `Colquicina com CrCl ${crCl.toFixed(0)} mL/min (< 10 mL/min)`,
        action: 'Contraindicado — risco de toxicidade grave (neuropatia, miopatia)' })
  }

  // F — Gastrointestinal system
  if (hasMed(NSAIDS) && hasCond(['úlcera péptica','ulcera gástrica','hemorragia gastrointestinal','HDA','doença de crohn','colite']) && !hasMed(PPI))
    stopp.push({ code: 'F1', category: 'Gastrointestinal', severity: 'high', drug_class: 'AINE',
      criterion: 'AINE em doença péptica ou hemorragia GI sem PPI',
      action: 'Suspender AINE ou adicionar PPI — risco de hemorragia grave' })

  if (hasMed(NSAIDS) && hasMed(CORTICOSTEROID) && !hasMed(PPI))
    stopp.push({ code: 'F2', category: 'Gastrointestinal', severity: 'high', drug_class: 'AINE + corticóide',
      criterion: 'AINE + corticóide oral sem PPI',
      action: 'Adicionar PPI — risco cumulativo de hemorragia GI grave' })

  // G — Respiratory system
  if (hasMed(ANTICHOLINERGIC_BD) && hasCond(['retenção urinária','hiperplasia prostática','HPB','bexiga hiperactiva']))
    stopp.push({ code: 'G1', category: 'Respiratório', severity: 'medium', drug_class: 'Anticolinérgico inalado',
      criterion: 'Broncodilatador anticolinérgico inalado em doente com sintomas do tracto urinário inferior',
      action: 'Avaliar alternativas — pode agravar sintomas urinários' })

  // H — Musculoskeletal system
  if (hasMed(LONG_SULFONYL) && elderly)
    stopp.push({ code: 'H1', category: 'Endócrino', severity: 'high', drug_class: 'Sulfonilureia de longa acção',
      criterion: 'Sulfonilureia de longa acção (glibenclamida/clorpropamida) em doente ≥ 65 anos',
      action: 'Substituir por sulfonilureia de curta acção (gliclazida) ou iSGLT2/iDPP4 — menor risco de hipoglicémia prolongada' })

  if (hasMed(ANTIPSYCH) && veryElderly && !hasCond(['psicose','esquizofrenia','bipolar','delírio']))
    stopp.push({ code: 'K1', category: 'Geral', severity: 'medium', drug_class: 'Antipsicótico',
      criterion: 'Antipsicótico em doente ≥ 75 anos sem indicação psiquiátrica documentada',
      action: 'Reavaliar indicação — risco de AVC, sedação, quedas, mortalidade aumentada em idosos' })

  // ─── START CRITERIA ──────────────────────────────────────────────────────────

  const hasCVD = hasCond(['doença coronária','enfarte','eam','angina','iam','acidente vascular','avc','avc isquémico','doença arterial periférica','dap','aterosclerose','coronariopatia'])
  const hasDM2 = hasCond(['diabetes tipo 2','diabetes mellitus','dm2','diabético','diabetica','hiperglicemia'])
  const hasHF = hasCond(['insuficiência cardíaca','ic ','icfep','icfer','heart failure'])
  const hasCAD = hasCond(['doença coronária','enfarte','eam','angina','iam','coronariopatia'])
  const hasOsteo = hasCond(['osteoporose','fractura osteoporótica','baixa densidade ossea','fratura','fraturas'])
  const hasAF = hasCond(['fibrilhação auricular','fa ','flutter','fibrilacao'])
  const hasCOPD = hasCond(['dpoc','copd','enfisema','bronquite crónica'])
  const hasAsthma = hasCond(['asma','asthma'])
  const hasCKD = hasCond(['insuficiência renal','doença renal crónica','drc','nefropatia'])
  const hasDepression = hasCond(['depressão','depressao','depression'])

  if (hasCVD && !hasMed(ANTIPLATELET) && !hasMed(ANTICOAG))
    start.push({ code: 'A1', category: 'Cardiovascular', missing_class: 'Antiagregante plaquetário',
      criterion: 'Terapêutica antiagregante em doença cardiovascular documentada (CAD, AVC isquémico, DAP)',
      rationale: 'Reduz eventos cardiovasculares major (MACE) — aspirina ou clopidogrel indicados' })

  if (hasCVD && !hasMed(STATIN))
    start.push({ code: 'A2', category: 'Cardiovascular', missing_class: 'Estatina',
      criterion: 'Estatina em doença cardiovascular documentada',
      rationale: 'Reduz mortalidade cardiovascular em 25-30% — primeira linha na prevenção secundária' })

  if (hasHF && !hasMed(ACE_ARB))
    start.push({ code: 'A3', category: 'Cardiovascular', missing_class: 'IECA / ARA-II',
      criterion: 'IECA ou ARA-II em insuficiência cardíaca sistólica',
      rationale: 'Reduz mortalidade e hospitalizações em IC com FE reduzida (guideline ESC Classe I)' })

  if (hasCAD && !hasMed(BETA_BLOCKER))
    start.push({ code: 'A4', category: 'Cardiovascular', missing_class: 'Beta-bloqueador',
      criterion: 'Beta-bloqueador em doença coronária estável',
      rationale: 'Reduz mortalidade e re-enfarte em doença coronária — benefício bem documentado' })

  if (hasAF && !hasMed(ANTICOAG) && !hasMed(ANTIPLATELET))
    start.push({ code: 'A5', category: 'Cardiovascular', missing_class: 'Anticoagulante oral',
      criterion: 'Anticoagulação oral em fibrilhação auricular',
      rationale: 'Previne AVC embólico — NOAC preferidos em relação à varfarina (ESC 2020)' })

  if ((hasCOPD || hasAsthma) && !hasMed([...ANTICHOLINERGIC_BD, 'salbutamol','formoterol','salmeterol','indacaterol','vilanterol','salmeterol','beclometasona','fluticasona','budesonido','mometasona']))
    start.push({ code: 'B1', category: 'Respiratório', missing_class: 'Broncodilatador inalado',
      criterion: 'Broncodilatador inalado em DPOC ou asma sem tratamento',
      rationale: 'Melhora função pulmonar, qualidade de vida e reduz exacerbações' })

  if ((hasMed(NSAIDS) || hasMed(ANTIPLATELET)) && !hasMed(PPI))
    start.push({ code: 'C1', category: 'Gastro', missing_class: 'Inibidor da bomba de protões',
      criterion: 'PPI em doente a tomar AINE ou aspirina regularmente',
      rationale: 'Reduz risco de hemorragia e úlcera péptica — indicado quando AINE/aspirina são necessários' })

  if (hasOsteo && !hasMed([...BISPHOSPHONATE, ...VITAMIN_D, ...CALCIUM]))
    start.push({ code: 'D1', category: 'Musculo-esquelético', missing_class: 'Bifosfonato + Vitamina D + Cálcio',
      criterion: 'Terapêutica anti-osteoporótica em osteoporose documentada',
      rationale: 'Reduz risco de fractura vertebral e da anca — bifosfonato + vitamina D + cálcio' })

  if (hasMed(CORTICOSTEROID) && !hasMed(VITAMIN_D) && !hasMed(CALCIUM))
    start.push({ code: 'D2', category: 'Musculo-esquelético', missing_class: 'Vitamina D + Cálcio',
      criterion: 'Vitamina D + Cálcio em corticoterapia prolongada',
      rationale: 'Previne osteoporose induzida por corticóides — recomendado sempre que há corticoterapia ≥ 3 meses' })

  if (hasDM2 && !hasMed(STATIN))
    start.push({ code: 'E1', category: 'Endócrino', missing_class: 'Estatina',
      criterion: 'Estatina em diabetes mellitus tipo 2',
      rationale: 'Reduz eventos cardiovasculares em diabéticos independentemente dos níveis de colesterol' })

  if (hasDM2 && hasCKD && !hasMed(ACE_ARB))
    start.push({ code: 'E2', category: 'Endócrino', missing_class: 'IECA / ARA-II',
      criterion: 'IECA ou ARA-II em diabetes mellitus tipo 2 com nefropatia',
      rationale: 'Reduz progressão de nefropatia diabética e proteinúria' })

  if (hasDepression && !hasMed(ANTIDEPRESSANT))
    start.push({ code: 'F1', category: 'SNC', missing_class: 'Antidepressivo',
      criterion: 'Antidepressivo em depressão moderada-grave sem tratamento',
      rationale: 'Depressão não tratada tem morbi-mortalidade significativa — ISRS como primeira linha' })

  if (hasMed(OPIOID) && !hasMed(LAXATIVE))
    start.push({ code: 'G1', category: 'Analgesia', missing_class: 'Laxante',
      criterion: 'Laxante em doente a tomar opióides regularmente',
      rationale: 'Obstipação induzida por opióides é universal — profilaxia com laxante osmótico' })

  // ─── Score ────────────────────────────────────────────────────────────────────

  const score = stopp.reduce((s, f) => s + (f.severity === 'high' ? 30 : 15), 0) +
                start.reduce((s) => s + 10, 0)
  const level: STOPPSTARTResult['level'] = score >= 60 ? 'critical' : score >= 35 ? 'high' : score >= 15 ? 'moderate' : 'low'

  return { stopp, start, score, level }
}
