// lib/riskScore.ts
// FONTE ÚNICA do score de risco clínico de um doente/residente.
//
// Porquê existe: o /rounds e o /patients calculavam o risco de formas diferentes
// (fórmulas distintas) e o /rounds ainda metia a contagem de alertas da IA no
// número — que muda a cada chamada. Resultado: o score variava entre aberturas e
// nunca batia certo entre as duas páginas. Agora ambas importam ESTE ficheiro, que
// é 100% DETERMINÍSTICO: depende só de dados guardados (condições, idade, CrCl,
// nº de fármacos). O mesmo doente dá sempre o mesmo número, em qualquer página.

export interface RiskInput {
  age?: number | null
  sex?: string | null
  weight?: number | null
  creatinine?: number | null
  conditions?: string | null
  meds_count?: number | null
}

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low'

// Clearance de creatinina (Cockcroft-Gault). null se faltarem dados.
export function calcCrCl(p: RiskInput): number | null {
  if (!p.age || !p.weight || !p.creatinine) return null
  return Math.round(((140 - p.age) * p.weight * (p.sex === 'F' ? 0.85 : 1)) / (72 * p.creatinine) * 10) / 10
}

// Risco por condições clínicas + idade + função renal. Determinístico, 0-70.
export function conditionRisk(p: RiskInput): number {
  let s = 0
  const c = (p.conditions || '').toLowerCase()

  // Oncológico / terminal
  if (/cancro|cancer|carcinoma|tumor|neoplasia|oncol|leucemia|linfoma|mieloma|sarcoma|metást/.test(c)) s += 40
  if (/terminal|paliat|hospice|cuidados de conforto/.test(c)) s += 50
  if (/transplante/.test(c)) s += 22

  // Falência de órgão
  if (/diálise|hemodiálise|periton/.test(c)) s += 38
  if (/insuficiência renal|irc|drc g[45]|ckd [45]|rim (crónico|agudo)/.test(c)) s += 28
  if (/insuficiência hepática|cirrose|child.pugh [bc]|hepatite (b|c) crónica/.test(c)) s += 28
  if (/insuficiência cardíaca|ic [34]|feve [<≤]|ic avançada/.test(c)) s += 22
  if (/insuficiência respiratória|dpoc grave|dpoc estadio [34]|fibrose pulmonar|hap/.test(c)) s += 18

  // Neurológico / cognitivo
  if (/demência|alzheimer|parkinson|eps/.test(c)) s += 15
  if (/avc|acidente vascular|epilepsia|convul/.test(c)) s += 10

  // Hematológico / imunológico
  if (/anticoagul|varfarina|warfarin|dabigatran|rivaroxaban|apixaban/.test(c)) s += 12
  if (/imunossuprimid|transplantado|vih|hiv|vdih/.test(c)) s += 18

  // Metabólico
  if (/diabetes/.test(c)) s += 8
  if (/hipertiroid|hipotiroid|addison|cushing/.test(c)) s += 8

  // Idade
  if ((p.age || 0) >= 85) s += 22
  else if ((p.age || 0) >= 75) s += 12

  // CrCl (quando há creatinina mas a condição renal não está escrita)
  const crcl = calcCrCl(p)
  if (crcl !== null) {
    if (crcl < 15) s += 35
    else if (crcl < 30) s += 22
    else if (crcl < 60) s += 8
  }

  return Math.min(s, 70)
}

// Score TOTAL 0-100: condições + polimedicação. É isto que ambas as páginas mostram.
export function riskScore(p: RiskInput): number {
  return Math.min(100, conditionRisk(p) + Math.min(30, (p.meds_count || 0) * 3))
}

export function riskLevel(score: number): RiskLevel {
  return score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'moderate' : 'low'
}
