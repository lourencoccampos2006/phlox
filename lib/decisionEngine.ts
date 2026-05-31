// lib/decisionEngine.ts
// Phlox Decision Engine — motor de regras clínicas determinístico.
// Avalia um "caso" (medicação, condições, idade, função renal, QTc, etc) e devolve
// achados estruturados (severidade, explicação, evidência, ação). Sem AI, auditável.
// Cada regra é uma função pura: (case) => Finding | null.

export interface ClinicalCase {
  age?: number
  sex?: 'M' | 'F'
  weight_kg?: number
  egfr?: number              // mL/min/1.73m²
  qtc_ms?: number            // QTc Bazett (ms)
  conditions?: string[]      // strings livres, case-insensitive
  meds?: string[]            // nomes (DCI/comercial), case-insensitive
  allergies?: string[]
}

export interface Finding {
  id: string
  severity: 'critical' | 'major' | 'moderate' | 'minor' | 'info'
  title: string
  detail: string
  reference?: string          // evidência (guideline/criteria)
  action?: string             // sugestão prática
  involves?: string[]         // medicamentos/condições envolvidas
}

// ── Helpers (normalização) ─────────────────────────────────────────────────────
const norm = (s: string) => (s || '').toLowerCase()
const has = (arr: string[] | undefined, kw: string | RegExp) => {
  if (!arr) return false
  return arr.some(x => kw instanceof RegExp ? kw.test(norm(x)) : norm(x).includes(norm(kw)))
}
const list = (arr: string[] | undefined, kw: RegExp): string[] => (arr || []).filter(x => kw.test(norm(x)))

// Classes farmacológicas → padrões (DCI comuns em PT)
const RX = {
  anticoagulant_oral: /(varfarina|warfar|apixaban|edoxaban|rivaroxaban|dabigatran)/,
  antiplatelet:       /(clopidogrel|ticagrelor|prasugrel|aspirina|acido acetilsalicilico|aas)/,
  nsaid:              /(ibuprofeno|naproxeno|diclofenac|cetoprofeno|nimesulida|piroxicam|aceclofenac|etoricoxib|celecoxib|indometacina)/,
  ssri:               /(fluoxetina|sertralina|escitalopram|citalopram|paroxetina|fluvoxamina)/,
  benzodiazepine:     /(diazepam|lorazepam|alprazolam|bromazepam|oxazepam|midazolam|clobazam|cloxazolam|estazolam|brotizolam|triazolam|zolpidem|zopiclona|zaleplon|clonazepam)/,
  z_drug:             /(zolpidem|zopiclona|zaleplon)/,
  anticholinergic:    /(amitriptilina|clomipramina|imipramina|nortriptilina|hidroxizina|prometazina|difenidramina|oxibutinina|tolterodina|solifenacina|trospio|hioscina|atropina|biperideno|trihexifenidil)/,
  digoxin:            /digoxina/,
  ppi:                /(omeprazol|pantoprazol|esomeprazol|lansoprazol|rabeprazol)/,
  metformin:          /metformina/,
  beta_blocker:       /(bisoprolol|metoprolol|carvedilol|nebivolol|propranolol|atenolol|sotalol)/,
  diuretic_thiazide:  /(hidroclorotiazida|indapamida|clortalidona)/,
  diuretic_loop:      /(furosemida|torasemida|bumetanida)/,
  diuretic_potassium_sparing: /(espironolactona|eplerenona|amilorida|triamtereno)/,
  ace_inhibitor:      /(captopril|enalapril|lisinopril|ramipril|perindopril|trandolapril)/,
  arb:                /(losartan|valsartan|irbesartan|candesartan|olmesartan|telmisartan)/,
  statin:             /(sinvastatina|atorvastatina|rosuvastatina|pravastatina|fluvastatina|pitavastatina|lovastatina)/,
  macrolide:          /(eritromicina|claritromicina|azitromicina|roxitromicina)/,
  fluoroquinolone:    /(ciprofloxacina|levofloxacina|moxifloxacina|norfloxacina|ofloxacina)/,
  qtc_drugs:          /(amiodarona|sotalol|fluconazol|ondansetron|haloperidol|quetiapina|risperidona|citalopram|escitalopram|metadona|domperidona)/,
  opioid:             /(morfina|tramadol|tapentadol|oxicodona|fentanil|hidromorfona|metadona|codeina|tilidina)/,
  sulfonylurea:       /(glibenclamida|gliclazida|glimepirida|glipizida)/,
  sulfonylurea_long:  /(glibenclamida|glimepirida|clorpropamida)/,
  antipsychotic:      /(haloperidol|risperidona|quetiapina|olanzapina|aripiprazol|paliperidona|clozapina|amissulprida)/,
  trimethoprim:       /(trimetoprim|cotrimoxazol|sulfametoxazol)/,
  potassium:          /(cloreto de potassio|potassio|kcl)/,
  metoclopramide:     /metoclopramida/,
  amiodarone:         /amiodarona/,
}

const COND = {
  renal:  /(insuficiencia renal|doenca renal cronica|drc|nefropatia|tfg)/,
  hf:     /(insuficiencia cardiaca|ic|fej reduzida)/,
  liver:  /(insuficiencia hepatica|cirrose|hepatopatia)/,
  gout:   /(gota|hiperuricemia)/,
  asthma_copd: /(asma|dpoc|epoc|brônquica)/,
  qt_prol: /(qt longo|qtc longo|prolongamento qt)/,
  dementia: /(demencia|alzheimer|cognitivo grave)/,
  falls:    /(quedas|histor.*queda)/,
  ulcer:    /(ulcera|hda|hemorragia digestiva|esofagite)/,
  bph:      /(hipertrofia prostatica|hbp|prostat)/,
  hypoNa:   /(hiponatremia|hipoNa)/,
}

// ── Regras ─────────────────────────────────────────────────────────────────────
type Rule = (c: ClinicalCase) => Finding | null
const ALL_RULES: Rule[] = [
  // R1 — AINEs + anticoagulante (hemorragia)
  c => {
    const a = list(c.meds, RX.nsaid), b = list(c.meds, RX.anticoagulant_oral)
    if (a.length && b.length) return { id: 'R1', severity: 'critical', title: 'AINE + anticoagulante oral', detail: 'Combinação aumenta risco de hemorragia (digestiva e cerebral) de forma significativa.', reference: 'STOPP v3 · BNF interactions', action: 'Substituir AINE por paracetamol; se necessário AINE, gastroprotecção e reavaliação.', involves: [...a, ...b] }
    return null
  },
  // R2 — AINEs + função renal reduzida
  c => {
    if (c.egfr != null && c.egfr < 30 && has(c.meds, RX.nsaid)) return { id: 'R2', severity: 'major', title: 'AINE com TFG < 30', detail: 'AINEs reduzem perfusão renal e podem precipitar lesão renal aguda.', reference: 'KDIGO · STOPP', action: 'Suspender AINE; usar paracetamol/topical.' }
    return null
  },
  // R3 — Metformina + função renal
  c => {
    if (c.egfr != null && c.egfr < 30 && has(c.meds, RX.metformin)) return { id: 'R3', severity: 'major', title: 'Metformina com TFG < 30', detail: 'Risco de acidose láctica.', reference: 'Resumo das Características do Medicamento · DGS', action: 'Suspender metformina.' }
    if (c.egfr != null && c.egfr >= 30 && c.egfr < 45 && has(c.meds, RX.metformin)) return { id: 'R3b', severity: 'moderate', title: 'Metformina com TFG 30–45', detail: 'Reduzir dose máxima a 1000 mg/dia e monitorizar.', reference: 'EMA 2016 review', action: 'Ajustar dose; reavaliar função renal a cada 3 meses.' }
    return null
  },
  // R4 — Digoxina dose vs idade/renal
  c => {
    if (has(c.meds, RX.digoxin) && c.age != null && c.age >= 75) return { id: 'R4', severity: 'moderate', title: 'Digoxina em idoso ≥ 75', detail: 'Risco de toxicidade aumentado; preferir doses ≤ 125 mcg/dia.', reference: 'STOPP', action: 'Confirmar dose; monitorizar digoxinemia.' }
    if (has(c.meds, RX.digoxin) && c.egfr != null && c.egfr < 30) return { id: 'R4b', severity: 'major', title: 'Digoxina com TFG < 30', detail: 'Acumulação renal; risco de toxicidade.', action: 'Reduzir dose ou substituir; monitorizar níveis.' }
    return null
  },
  // R5 — Benzodiazepinas em idosos
  c => {
    const bz = list(c.meds, RX.benzodiazepine)
    if (bz.length && c.age != null && c.age >= 65) return { id: 'R5', severity: 'major', title: 'Benzodiazepina/Z-drug em idoso', detail: 'Aumenta risco de quedas, fraturas e disfunção cognitiva.', reference: 'Beers 2023 · STOPP', action: 'Desprescrever progressivamente (10–25% / 2 semanas); preferir higiene do sono.', involves: bz }
    return null
  },
  // R6 — Carga anticolinérgica (≥ 2)
  c => {
    const a = list(c.meds, RX.anticholinergic)
    if (a.length >= 2) return { id: 'R6', severity: 'major', title: 'Carga anticolinérgica elevada', detail: `${a.length} fármacos anticolinérgicos — risco de quedas, delírio, retenção urinária e obstipação.`, reference: 'ACB score · STOPP', action: 'Reduzir carga anticolinérgica; substituir por alternativas.', involves: a }
    if (a.length === 1 && c.age != null && c.age >= 75) return { id: 'R6b', severity: 'moderate', title: 'Anticolinérgico em idoso', detail: 'Mesmo um único anticolinérgico tem peso em ≥ 75 anos.', involves: a }
    return null
  },
  // R7 — Sulfonilureia de longa ação em idoso
  c => {
    const sl = list(c.meds, RX.sulfonylurea_long)
    if (sl.length && c.age != null && c.age >= 70) return { id: 'R7', severity: 'major', title: 'Sulfonilureia de longa ação em idoso', detail: 'Risco prolongado de hipoglicemia (sobretudo glibenclamida).', reference: 'STOPP · Beers', action: 'Substituir por gliclazida ou outra classe.', involves: sl }
    return null
  },
  // R8 — Macrólido + estatina (rabdomiólise)
  c => {
    const m = list(c.meds, RX.macrolide), s = list(c.meds, RX.statin)
    if (m.length && s.length) return { id: 'R8', severity: 'major', title: 'Macrólido + estatina', detail: 'Risco de miopatia/rabdomiólise (inibição CYP3A4).', reference: 'Stockley\'s drug interactions', action: 'Pausar estatina durante o macrólido ou preferir azitromicina.', involves: [...m, ...s] }
    return null
  },
  // R9 — QTc > 500 ou >450 com drogas QT
  c => {
    const qd = list(c.meds, RX.qtc_drugs)
    if (c.qtc_ms != null && c.qtc_ms >= 500) return { id: 'R9', severity: 'critical', title: 'QTc ≥ 500 ms', detail: 'Risco elevado de torsades de pointes.', action: 'Rever todos os fármacos QT-prolongantes; corrigir K/Mg.', involves: qd }
    if (c.qtc_ms != null && c.qtc_ms >= 450 && qd.length) return { id: 'R9b', severity: 'major', title: 'QTc elevado com fármacos QT-prolongantes', detail: `QTc ${c.qtc_ms} ms com ${qd.length} fármaco(s) com potencial QT.`, involves: qd }
    return null
  },
  // R10 — IECA + ARB (duplicação)
  c => {
    const i = list(c.meds, RX.ace_inhibitor), a = list(c.meds, RX.arb)
    if (i.length && a.length) return { id: 'R10', severity: 'major', title: 'IECA + ARA', detail: 'Combinação não recomendada — risco renal e hipercaliemia, sem benefício adicional.', reference: 'ESC HF · ONTARGET', action: 'Suspender um dos dois.', involves: [...i, ...a] }
    return null
  },
  // R11 — ARB/IECA + diurético poupador de K + suplementos K
  c => {
    const rx = [...list(c.meds, RX.ace_inhibitor), ...list(c.meds, RX.arb), ...list(c.meds, RX.diuretic_potassium_sparing), ...list(c.meds, RX.potassium)]
    if (rx.length >= 3) return { id: 'R11', severity: 'major', title: 'Risco de hipercaliemia', detail: 'Combinação de fármacos que retêm potássio.', action: 'Monitorizar K+ sérico; rever indicação de poupador de K.', involves: rx }
    return null
  },
  // R12 — SSRI + anticoagulante (hemorragia)
  c => {
    const s = list(c.meds, RX.ssri), a = list(c.meds, RX.anticoagulant_oral)
    if (s.length && a.length) return { id: 'R12', severity: 'moderate', title: 'ISRS + anticoagulante', detail: 'Risco aumentado de hemorragia digestiva.', action: 'Considerar gastroprotecção; vigiar sinais hemorrágicos.', involves: [...s, ...a] }
    return null
  },
  // R13 — Antipsicótico em demência
  c => {
    const ap = list(c.meds, RX.antipsychotic)
    if (ap.length && has(c.conditions, COND.dementia)) return { id: 'R13', severity: 'major', title: 'Antipsicótico em demência', detail: 'Aumenta mortalidade e AVC. Usar só se sintomas refratários.', reference: 'NICE · DGS · STOPP', action: 'Limitar a < 3 meses; rever periodicamente.', involves: ap }
    return null
  },
  // R14 — Beta-bloqueador + asma/DPOC grave
  c => {
    const bb = list(c.meds, RX.beta_blocker)
    if (bb.length && has(c.conditions, /asma/)) return { id: 'R14', severity: 'moderate', title: 'Beta-bloqueador em asma', detail: 'Pode precipitar broncoespasmo.', action: 'Preferir cardioseletivo (bisoprolol, nebivolol) em dose baixa.', involves: bb }
    return null
  },
  // R15 — IBP de longa duração
  c => {
    if (has(c.meds, RX.ppi)) return { id: 'R15', severity: 'minor', title: 'IBP — rever indicação', detail: 'IBP >8 semanas sem causa formal aumenta risco de infecções, hipomagnesiemia e fraturas em idosos.', action: 'Confirmar indicação documentada; tentar step-down.' }
    return null
  },
  // R16 — Opioide + benzodiazepina
  c => {
    const o = list(c.meds, RX.opioid), b = list(c.meds, RX.benzodiazepine)
    if (o.length && b.length) return { id: 'R16', severity: 'critical', title: 'Opioide + benzodiazepina', detail: 'Depressão respiratória potencialmente fatal.', reference: 'FDA black box', action: 'Evitar combinação; se necessária, doses mínimas e vigilância.', involves: [...o, ...b] }
    return null
  },
  // R17 — Metoclopramida prolongada (extrapiramidais)
  c => {
    if (has(c.meds, RX.metoclopramide) && c.age != null && c.age >= 65) return { id: 'R17', severity: 'moderate', title: 'Metoclopramida em idoso', detail: 'Risco de discinesia tardia; limitar a 5 dias.', reference: 'EMA 2013', action: 'Suspender se ≥ 5 dias.' }
    return null
  },
  // R18 — Aspirina sem indicação cardiovascular em ≥80 anos
  c => {
    const aas = list(c.meds, /(aspirina|acido acetilsalicilico|aas)/)
    if (aas.length && c.age != null && c.age >= 80 && !has(c.conditions, /(enfarte|avc|doença coronaria|stent)/)) return { id: 'R18', severity: 'moderate', title: 'AAS sem indicação CV em idoso', detail: 'Prevenção primária com AAS em ≥ 80 anos: benefício < risco.', reference: 'USPSTF 2022', action: 'Suspender se prevenção primária.' }
    return null
  },
  // R19 — Trimetoprim + IECA/ARA (hipercaliemia)
  c => {
    const t = list(c.meds, RX.trimethoprim), ra = [...list(c.meds, RX.ace_inhibitor), ...list(c.meds, RX.arb)]
    if (t.length && ra.length && c.age != null && c.age >= 65) return { id: 'R19', severity: 'major', title: 'Trimetoprim + IECA/ARA em idoso', detail: 'Risco de hipercaliemia e morte súbita.', reference: 'BMJ 2014', action: 'Preferir nitrofurantoína ou ajustar; monitorizar K+.', involves: [...t, ...ra] }
    return null
  },
  // R20 — Polifarmácia
  c => {
    const n = (c.meds || []).length
    if (n >= 10) return { id: 'R20', severity: 'major', title: 'Polifarmácia ≥ 10 fármacos', detail: 'Risco elevado de interações, eventos adversos e baixa adesão.', action: 'Auditar com NO TEARS / STOPP-START / Brown bag review.' }
    if (n >= 5) return { id: 'R20b', severity: 'moderate', title: 'Polifarmácia (≥ 5)', detail: 'Iniciar revisão terapêutica estruturada.', reference: 'WHO Medication Without Harm' }
    return null
  },
  // R21 — Estatina em > 80 (prevenção primária)
  c => {
    if (has(c.meds, RX.statin) && c.age != null && c.age >= 85 && !has(c.conditions, /(enfarte|avc|doença coronaria)/)) return { id: 'R21', severity: 'minor', title: 'Estatina em prevenção primária em ≥ 85', detail: 'Benefício marginal; rever individualmente.', reference: 'NICE NG181' }
    return null
  },
  // R22 — Fluoroquinolona + idoso/anticoagulante
  c => {
    const f = list(c.meds, RX.fluoroquinolone)
    if (f.length && c.age != null && c.age >= 60) return { id: 'R22', severity: 'moderate', title: 'Fluoroquinolona em idoso', detail: 'Risco de tendinopatia, disseção aórtica, QT, neuropatia.', reference: 'EMA 2018', action: 'Reservar para infecções graves sem alternativa.', involves: f }
    return null
  },
  // R23 — Amiodarona + estatina alta
  c => {
    if (has(c.meds, RX.amiodarone) && has(c.meds, /(sinvastatina|atorvastatina)/)) return { id: 'R23', severity: 'moderate', title: 'Amiodarona + sinvastatina/atorvastatina', detail: 'Aumenta exposição da estatina (CYP3A4) — limitar sinvastatina a 20 mg.', reference: 'FDA' }
    return null
  },
  // R24 — Antiplaquetar duplo sem indicação clara em idoso
  c => {
    const ap = list(c.meds, RX.antiplatelet)
    if (ap.length >= 2 && c.age != null && c.age >= 75) return { id: 'R24', severity: 'moderate', title: 'Antiagregação dupla em idoso', detail: 'Avaliar tempo de DAPT; risco hemorrágico aumenta com idade.', action: 'Confirmar duração apropriada (geralmente ≤ 12 meses pós-SCA).', involves: ap }
    return null
  },
  // R25 — Diurético tiazídico + hiponatremia história
  c => {
    if (list(c.meds, RX.diuretic_thiazide).length && has(c.conditions, COND.hypoNa)) return { id: 'R25', severity: 'major', title: 'Tiazídico com história de hiponatremia', detail: 'Risco recorrente de hiponatremia severa.', action: 'Substituir por outra classe; monitorizar Na+.' }
    return null
  },
  // R26 — Sem renal info mas idade ≥ 80 (alerta)
  c => {
    if (c.age != null && c.age >= 80 && c.egfr == null && (c.meds || []).length >= 3) return { id: 'R26', severity: 'info', title: 'Sem dados de função renal em idoso', detail: 'Recomendar TFG (CKD-EPI) — várias regras dependem disso.' }
    return null
  },
]

export function runRules(c: ClinicalCase): Finding[] {
  return ALL_RULES.map(r => { try { return r(c) } catch { return null } }).filter((f): f is Finding => !!f)
}

// Pontuação resumida (0–100) — mais alta = mais risco
export function riskScore(findings: Finding[]): number {
  const weight = { critical: 25, major: 12, moderate: 6, minor: 2, info: 0 }
  const total = findings.reduce((a, f) => a + weight[f.severity], 0)
  return Math.min(100, total)
}

export const SEVERITY_META: Record<Finding['severity'], { label: string; color: string; bg: string }> = {
  critical: { label: 'Crítico',   color: '#7f1d1d', bg: '#fee2e2' },
  major:    { label: 'Grave',     color: '#b91c1c', bg: '#fef2f2' },
  moderate: { label: 'Moderado',  color: '#b45309', bg: '#fffbeb' },
  minor:    { label: 'Ligeiro',   color: '#1d4ed8', bg: '#eff6ff' },
  info:     { label: 'Info',      color: '#64748b', bg: '#f1f5f9' },
}
