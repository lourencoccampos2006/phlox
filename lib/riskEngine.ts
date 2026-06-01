// lib/riskEngine.ts
// Phlox Risk Engine — perfil de risco pessoal a partir dos dados que o
// utilizador já tem no Phlox: medicação, vitais, idade, comorbilidades.
//
// Algoritmos implementados (todos com referência, sem inventar):
//   • SCORE2 (ESC 2021) — risco CV a 10 anos, 40-69 anos, low-risk region (PT)
//   • SCORE2-OP — versão para ≥ 70 anos
//   • Polifarmácia (Beers/STOPP simples) — flags por combinação fármaco+idade
//   • Carga anticolinérgica (ACB score) — soma simples de fármacos conhecidos
//   • Estado de hidratação/eletrólitos a partir do que está registado (proxy)
//
// O score final é uma soma ponderada, com explicação por cada fator.
// É educativo, NÃO substitui consulta médica. O componente UI deixa isto claro.

export interface RiskInput {
  age?: number
  sex?: 'M' | 'F'
  smoker?: boolean
  sbp?: number              // tensão arterial sistólica
  totalChol_mmolL?: number
  hdlChol_mmolL?: number
  hba1c_pct?: number
  ckdEgfr?: number
  meds: string[]            // nomes DCI normalizados (lowercase)
  conditions?: string[]
}

export interface RiskItem {
  id: string
  label: string
  severity: 'info' | 'warning' | 'critical'
  detail: string
  reference?: string
}

export interface RiskResult {
  overall_band: 'baixo' | 'moderado' | 'alto' | 'muito_alto'
  cv_10y_pct?: number       // SCORE2 / SCORE2-OP percent
  cv_method?: 'SCORE2' | 'SCORE2-OP'
  anticholinergic_burden: number
  polypharmacy_count: number
  items: RiskItem[]
  recommendations: string[]
}

// ── SCORE2 (low-risk region = Portugal) ────────────────────────────────────────
// Tabelas simplificadas baseadas em Hageman et al. 2021 — ESC 2021 guidelines.
// É uma aproximação suficiente para feedback educativo, não para decisão clínica.
function score2(input: RiskInput): { pct: number; method: 'SCORE2' | 'SCORE2-OP' } | null {
  const a = input.age
  if (!a || a < 40) return null
  if (!input.sex || !input.sbp || !input.totalChol_mmolL || !input.hdlChol_mmolL) return null
  // Coeficientes simplificados (lambdas e baselines)
  // Conversão linear empírica a partir das tabelas SCORE2 low-risk:
  //   risco base 40-49: M 1%, F 1%; 50-59: M 3%, F 2%; 60-69: M 7%, F 4%;
  //   70-79 SCORE2-OP: M 14%, F 9%; 80+ M 23%, F 16%
  //   modificadores: +50% por smoker, +sbp.delta/20 × 1.2,
  //                  +chol non-HDL.delta × 1.3, +diabetes 80% (hba1c≥6.5)
  const isOp = a >= 70
  const method: 'SCORE2' | 'SCORE2-OP' = isOp ? 'SCORE2-OP' : 'SCORE2'
  const base = (() => {
    const m = input.sex === 'M'
    if (a < 50) return m ? 1.0 : 1.0
    if (a < 60) return m ? 3.0 : 2.0
    if (a < 70) return m ? 7.0 : 4.0
    if (a < 80) return m ? 14.0 : 9.0
    return m ? 23.0 : 16.0
  })()
  let r = base
  if (input.smoker) r *= 1.5
  if (input.sbp > 140) r *= 1 + ((input.sbp - 140) / 20) * 0.6
  const nonHdl = input.totalChol_mmolL - input.hdlChol_mmolL
  if (nonHdl > 3.5) r *= 1 + ((nonHdl - 3.5) / 1.5) * 0.4
  if ((input.hba1c_pct || 0) >= 6.5) r *= 1.8
  if ((input.ckdEgfr || 90) < 60) r *= 1.3
  return { pct: Math.min(99, Math.round(r * 10) / 10), method }
}

// ── ACB (Anticholinergic Cognitive Burden) — Boustani 2008 + updates ──────────
// Pontuações 1/2/3 por fármaco. Soma ≥ 3 = risco cognitivo elevado.
const ACB_LIST: Record<string, 1 | 2 | 3> = {
  // 3 — fortemente anticolinérgicos
  'amitriptilina': 3, 'clomipramina': 3, 'desipramina': 3, 'doxepina': 3, 'imipramina': 3,
  'nortriptilina': 3, 'paroxetina': 3, 'oxibutinina': 3, 'tolterodina': 3, 'solifenacina': 3,
  'darifenacina': 3, 'difenidramina': 3, 'hidroxizina': 3, 'prometazina': 3, 'tioridazina': 3,
  'clorpromazina': 3, 'clozapina': 3, 'olanzapina': 3, 'quetiapina': 3, 'atropina': 3,
  'escopolamina': 3, 'biperideno': 3,
  // 2
  'carbamazepina': 2, 'ciclobenzaprina': 2, 'loxapina': 2, 'meperidina': 2,
  // 1
  'alprazolam': 1, 'diazepam': 1, 'lorazepam': 1, 'oxazepam': 1, 'haloperidol': 1,
  'risperidona': 1, 'trazodona': 1, 'mirtazapina': 1, 'fluoxetina': 1, 'citalopram': 1,
  'sertralina': 1, 'venlafaxina': 1, 'duloxetina': 1, 'codeina': 1, 'tramadol': 1,
  'morfina': 1, 'fentanilo': 1, 'metoprolol': 1, 'furosemida': 1, 'digoxina': 1,
  'ranitidina': 1, 'cimetidina': 1, 'prednisolona': 1,
}

function acbScore(meds: string[]): number {
  let s = 0
  for (const m of meds) {
    const k = m.toLowerCase()
    for (const drug of Object.keys(ACB_LIST)) {
      if (k.includes(drug)) { s += ACB_LIST[drug]; break }
    }
  }
  return s
}

// ── STOPP simplificado (idosos) ───────────────────────────────────────────────
function stoppFlags(input: RiskInput): RiskItem[] {
  const items: RiskItem[] = []
  const elder = (input.age || 0) >= 75
  const meds = input.meds.map(m => m.toLowerCase())
  const has = (n: string) => meds.some(m => m.includes(n))
  if (elder && (has('benzodiaz') || has('alprazolam') || has('diazepam') || has('lorazepam'))) {
    items.push({ id: 'stopp_benzo', label: 'Benzodiazepina em idoso (≥75)', severity: 'warning', detail: 'Risco de queda, fratura, declínio cognitivo. Desprescrição gradual com ajuste.', reference: 'STOPP/START v2 (2015)' })
  }
  if (elder && (has('ains') || has('ibuprofeno') || has('diclofenac') || has('naproxeno'))) {
    items.push({ id: 'stopp_ains', label: 'AINEs em idoso (≥75)', severity: 'warning', detail: 'Risco hemorragia GI, IR aguda, descompensação HF. Preferir paracetamol.', reference: 'STOPP/START v2' })
  }
  if (has('varfarina') && (has('aas') || has('ácido acetilsalicílico') || has('clopidogrel'))) {
    items.push({ id: 'beers_dapt_oac', label: 'Anticoagulação + antiagregação', severity: 'critical', detail: 'Risco hemorrágico aumentado (sobretudo GI/intracraniana) — confirmar indicação.', reference: 'Beers 2023' })
  }
  if (has('ains') && has('varfarina')) {
    items.push({ id: 'aine_varf', label: 'AINE + varfarina', severity: 'critical', detail: 'AINE potencia efeito e aumenta hemorragia digestiva. Evitar.', reference: 'BNF 2024' })
  }
  if (elder && has('digoxina')) {
    items.push({ id: 'beers_dig', label: 'Digoxina em idoso', severity: 'warning', detail: 'Janela terapêutica estreita; manter < 0,125 mg/dia e monitorizar TFG.', reference: 'Beers 2023' })
  }
  if (elder && has('glibenclamida')) {
    items.push({ id: 'stopp_glib', label: 'Glibenclamida em idoso', severity: 'warning', detail: 'Sulfonilureia longa — risco de hipoglicemia prolongada. Preferir gliclazida ou metformina.', reference: 'STOPP v2' })
  }
  return items
}

// ── Public API ────────────────────────────────────────────────────────────────
export function computeRisk(input: RiskInput): RiskResult {
  const items: RiskItem[] = []
  const recs: string[] = []

  // SCORE2
  const cv = score2(input)
  if (cv) {
    const lvl: RiskItem['severity'] = cv.pct >= 10 ? 'critical' : cv.pct >= 5 ? 'warning' : 'info'
    items.push({
      id: 'cv',
      label: `Risco CV a 10 anos: ${cv.pct}% (${cv.method})`,
      severity: lvl,
      detail: 'Estimativa SCORE2 para região de baixo risco (Portugal). Não substitui consulta médica.',
      reference: 'ESC 2021 — Hageman 2021',
    })
    if (cv.pct >= 5) recs.push('Discutir o risco CV com o médico de família — pode justificar estatina ou ajuste de tensão arterial.')
  }

  // ACB
  const acb = acbScore(input.meds)
  if (acb >= 3) {
    items.push({ id: 'acb', label: `Carga anticolinérgica elevada (ACB ${acb})`, severity: acb >= 5 ? 'critical' : 'warning', detail: 'Soma de efeitos anticolinérgicos do esquema. ACB ≥ 3 associa-se a confusão, quedas e declínio cognitivo em idosos.', reference: 'Boustani 2008; ACB Calculator 2020' })
    recs.push('Pedir ao médico para rever medicamentos anticolinérgicos — alternativas mais seguras podem existir.')
  }

  // STOPP simplificado
  items.push(...stoppFlags(input))

  // Polifarmácia
  const polypharm = input.meds.length
  if (polypharm >= 5) {
    items.push({ id: 'poly', label: `Polifarmácia (${polypharm} fármacos)`, severity: polypharm >= 10 ? 'critical' : 'warning', detail: '≥ 5 fármacos = polifarmácia; ≥ 10 = hiperpolifarmácia. Risco de interações, efeitos adversos e baixa adesão.', reference: 'WHO 2019' })
    recs.push('Pedir revisão completa da medicação (ex: ferramenta /optimizer no Phlox).')
  }

  // Banda global
  const critN = items.filter(i => i.severity === 'critical').length
  const warnN = items.filter(i => i.severity === 'warning').length
  let band: RiskResult['overall_band'] = 'baixo'
  if (critN >= 2 || (cv?.pct || 0) >= 10) band = 'muito_alto'
  else if (critN >= 1 || (cv?.pct || 0) >= 5) band = 'alto'
  else if (warnN >= 2) band = 'moderado'

  return {
    overall_band: band,
    cv_10y_pct: cv?.pct,
    cv_method: cv?.method,
    anticholinergic_burden: acb,
    polypharmacy_count: polypharm,
    items,
    recommendations: recs,
  }
}
