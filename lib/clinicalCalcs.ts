// lib/clinicalCalcs.ts
// Calculadoras clínicas determinísticas — sem AI, fórmulas validadas.
// Cada uma é uma função pura: (inputs) => { value, label, interpretation, refs }.
// Para o Phlox Calc Hub.

export interface CalcInputField {
  key: string
  label: string
  unit?: string
  type: 'number' | 'select' | 'checkbox'
  options?: { label: string; value: number | string }[]
  min?: number; max?: number; step?: number
  hint?: string
}
export interface CalcResult { value: string; label: string; interpretation: string; tone: 'ok' | 'warn' | 'alert' | 'info'; refs?: string }
export interface ClinicalCalc {
  id: string
  name: string
  category: 'renal' | 'cardio' | 'metabolic' | 'icu' | 'hema' | 'hepatic' | 'general' | 'scales'
  desc: string
  fields: CalcInputField[]
  run: (v: Record<string, any>) => CalcResult | null
  refs: string
}

const round = (n: number, dp = 1) => Number(n.toFixed(dp))
const num = (v: any) => { const n = Number(v); return isNaN(n) ? null : n }

// ── 1. CrCl Cockcroft-Gault ────────────────────────────────────────────────────
const crcl: ClinicalCalc = {
  id: 'crcl', name: 'Clearance de Creatinina (Cockcroft-Gault)', category: 'renal',
  desc: 'Estimativa simples e clássica da TFG por idade, peso, sexo e creatinina sérica.',
  fields: [
    { key: 'age', label: 'Idade', unit: 'anos', type: 'number', min: 1, max: 120 },
    { key: 'weight', label: 'Peso', unit: 'kg', type: 'number', min: 20, max: 300 },
    { key: 'sex', label: 'Sexo', type: 'select', options: [{ label: 'Masculino', value: 'M' }, { label: 'Feminino', value: 'F' }] },
    { key: 'cr', label: 'Creatinina sérica', unit: 'mg/dL', type: 'number', min: 0.1, max: 20, step: 0.01 },
  ],
  run: v => {
    const age = num(v.age), weight = num(v.weight), cr = num(v.cr), sex = v.sex
    if (age == null || weight == null || cr == null || !sex) return null
    const base = ((140 - age) * weight) / (72 * cr)
    const value = sex === 'F' ? base * 0.85 : base
    const r = Math.round(value)
    const tone = r < 30 ? 'alert' : r < 60 ? 'warn' : 'ok'
    const interpretation = r < 15 ? 'Falência renal' : r < 30 ? 'DRC estádio 4' : r < 60 ? 'DRC estádio 3 — ajustes renais necessários' : r < 90 ? 'DRC estádio 2 (se lesão estrutural)' : 'Função renal preservada'
    return { value: `${r} mL/min`, label: 'CrCl', tone, interpretation }
  },
  refs: 'Cockcroft DW, Gault MH. Nephron 1976',
}

// ── 2. eGFR CKD-EPI 2021 (sem raça) ────────────────────────────────────────────
const egfr_ckdepi: ClinicalCalc = {
  id: 'egfr_ckdepi', name: 'eGFR · CKD-EPI 2021', category: 'renal',
  desc: 'Equação atual recomendada (sem variável raça). Resultado em mL/min/1.73m².',
  fields: [
    { key: 'age', label: 'Idade', unit: 'anos', type: 'number', min: 18, max: 110 },
    { key: 'sex', label: 'Sexo', type: 'select', options: [{ label: 'Masculino', value: 'M' }, { label: 'Feminino', value: 'F' }] },
    { key: 'cr', label: 'Creatinina sérica', unit: 'mg/dL', type: 'number', min: 0.1, max: 20, step: 0.01 },
  ],
  run: v => {
    const age = num(v.age), cr = num(v.cr), sex = v.sex
    if (age == null || cr == null || !sex) return null
    const kappa = sex === 'F' ? 0.7 : 0.9
    const alpha = sex === 'F' ? -0.241 : -0.302
    const sexCoef = sex === 'F' ? 1.012 : 1
    const minRatio = Math.pow(Math.min(cr / kappa, 1), alpha)
    const maxRatio = Math.pow(Math.max(cr / kappa, 1), -1.200)
    const egfr = 142 * minRatio * maxRatio * Math.pow(0.9938, age) * sexCoef
    const r = Math.round(egfr)
    const tone = r < 30 ? 'alert' : r < 60 ? 'warn' : 'ok'
    const interpretation = r >= 90 ? 'G1 (normal/alta)' : r >= 60 ? 'G2 (ligeiramente diminuída)' : r >= 45 ? 'G3a' : r >= 30 ? 'G3b' : r >= 15 ? 'G4 (severamente diminuída)' : 'G5 (falência)'
    return { value: `${r} mL/min/1.73m²`, label: 'eGFR', tone, interpretation }
  },
  refs: 'Inker LA et al. NEJM 2021 · KDIGO 2024',
}

// ── 3. IMC ─────────────────────────────────────────────────────────────────────
const bmi: ClinicalCalc = {
  id: 'bmi', name: 'Índice de Massa Corporal (IMC)', category: 'general',
  desc: 'Categoria de peso pelo IMC = peso / altura².',
  fields: [
    { key: 'weight', label: 'Peso', unit: 'kg', type: 'number', min: 20, max: 300 },
    { key: 'height', label: 'Altura', unit: 'cm', type: 'number', min: 100, max: 230 },
  ],
  run: v => {
    const w = num(v.weight), h = num(v.height); if (w == null || h == null || h === 0) return null
    const m = h / 100; const imc = w / (m * m)
    const r = round(imc, 1)
    let cat = 'Peso normal', tone: any = 'ok'
    if (r < 18.5) { cat = 'Magreza'; tone = 'warn' }
    else if (r < 25) { cat = 'Peso normal'; tone = 'ok' }
    else if (r < 30) { cat = 'Pré-obesidade'; tone = 'warn' }
    else if (r < 35) { cat = 'Obesidade grau I'; tone = 'alert' }
    else if (r < 40) { cat = 'Obesidade grau II'; tone = 'alert' }
    else { cat = 'Obesidade grau III'; tone = 'alert' }
    return { value: `${r} kg/m²`, label: 'IMC', tone, interpretation: cat }
  }, refs: 'OMS · DGS',
}

// ── 4. BSA (Mosteller) ─────────────────────────────────────────────────────────
const bsa: ClinicalCalc = {
  id: 'bsa', name: 'Superfície Corporal (BSA · Mosteller)', category: 'general',
  desc: 'Cálculo de superfície corporal — usado em dosagem oncológica e pediátrica.',
  fields: [
    { key: 'weight', label: 'Peso', unit: 'kg', type: 'number', min: 1, max: 300 },
    { key: 'height', label: 'Altura', unit: 'cm', type: 'number', min: 30, max: 230 },
  ],
  run: v => {
    const w = num(v.weight), h = num(v.height); if (w == null || h == null) return null
    const sa = Math.sqrt((h * w) / 3600)
    return { value: `${round(sa, 2)} m²`, label: 'BSA', tone: 'info', interpretation: 'Superfície corporal estimada' }
  }, refs: 'Mosteller RD. NEJM 1987',
}

// ── 5. Cálcio corrigido pela albumina ─────────────────────────────────────────
const ca_corr: ClinicalCalc = {
  id: 'ca_corr', name: 'Cálcio Corrigido (albumina)', category: 'metabolic',
  desc: 'Corrige o cálcio sérico para o valor de albumina.',
  fields: [
    { key: 'ca', label: 'Ca total', unit: 'mg/dL', type: 'number', min: 4, max: 20, step: 0.1 },
    { key: 'alb', label: 'Albumina', unit: 'g/dL', type: 'number', min: 0.5, max: 6, step: 0.1 },
  ],
  run: v => {
    const ca = num(v.ca), alb = num(v.alb); if (ca == null || alb == null) return null
    const corr = ca + 0.8 * (4 - alb)
    const r = round(corr, 1)
    const tone = r < 8.4 ? 'warn' : r > 10.4 ? 'warn' : 'ok'
    return { value: `${r} mg/dL`, label: 'Ca corrigido', tone, interpretation: r < 8.4 ? 'Hipocalcemia' : r > 10.4 ? 'Hipercalcemia' : 'Normal' }
  }, refs: 'Payne RB. BMJ 1973',
}

// ── 6. Anion Gap ───────────────────────────────────────────────────────────────
const anion_gap: ClinicalCalc = {
  id: 'anion_gap', name: 'Anion Gap', category: 'metabolic',
  desc: 'AG = Na − (Cl + HCO3). Útil na investigação de acidose metabólica.',
  fields: [
    { key: 'na', label: 'Na', unit: 'mEq/L', type: 'number', min: 100, max: 180 },
    { key: 'cl', label: 'Cl', unit: 'mEq/L', type: 'number', min: 60, max: 130 },
    { key: 'hco3', label: 'HCO3', unit: 'mEq/L', type: 'number', min: 3, max: 50 },
    { key: 'alb', label: 'Albumina (opcional)', unit: 'g/dL', type: 'number', min: 0, max: 6, step: 0.1 },
  ],
  run: v => {
    const na = num(v.na), cl = num(v.cl), hco3 = num(v.hco3); if (na == null || cl == null || hco3 == null) return null
    const ag = na - (cl + hco3)
    const alb = num(v.alb)
    const agCorr = alb != null && alb > 0 ? ag + 2.5 * (4 - alb) : null
    const tone = ag > 14 ? 'warn' : 'ok'
    const interpretation = `AG ${ag > 14 ? 'aumentado' : 'normal'}${agCorr != null ? ` · corrigido ${round(agCorr, 1)}` : ''}`
    return { value: `${round(ag, 1)} mEq/L`, label: 'Anion Gap', tone, interpretation }
  }, refs: 'Berend K. NEJM 2014',
}

// ── 7. CHA2DS2-VASc ────────────────────────────────────────────────────────────
const cha2ds2: ClinicalCalc = {
  id: 'cha2ds2', name: 'CHA₂DS₂-VASc (FA — AVC)', category: 'cardio',
  desc: 'Estratifica risco de AVC em fibrilhação auricular.',
  fields: [
    { key: 'chf', label: 'Insuficiência cardíaca', type: 'checkbox' },
    { key: 'htn', label: 'Hipertensão', type: 'checkbox' },
    { key: 'age75', label: 'Idade ≥75', type: 'checkbox' },
    { key: 'dm', label: 'Diabetes', type: 'checkbox' },
    { key: 'stroke', label: 'AVC/AIT prévio', type: 'checkbox' },
    { key: 'vasc', label: 'Doença vascular', type: 'checkbox' },
    { key: 'age65', label: 'Idade 65-74', type: 'checkbox' },
    { key: 'sex_f', label: 'Sexo feminino', type: 'checkbox' },
  ],
  run: v => {
    let s = 0
    if (v.chf) s += 1; if (v.htn) s += 1; if (v.age75) s += 2; if (v.dm) s += 1
    if (v.stroke) s += 2; if (v.vasc) s += 1; if (v.age65) s += 1; if (v.sex_f) s += 1
    const risk: Record<number, string> = { 0: '0.2%', 1: '0.6%', 2: '2.2%', 3: '3.2%', 4: '4.8%', 5: '7.2%', 6: '9.7%', 7: '11.2%', 8: '10.8%', 9: '12.2%' }
    const tone = s >= 2 ? 'warn' : 'ok'
    return { value: `${s}`, label: 'CHA₂DS₂-VASc', tone, interpretation: `Risco anual AVC ~${risk[s] || '12%+'} · ${s >= 2 ? 'Anticoagulação recomendada' : s === 1 ? 'Considerar anticoagulação' : 'Anticoagulação não indicada'}` }
  }, refs: 'ESC AF Guidelines 2024',
}

// ── 8. HAS-BLED ────────────────────────────────────────────────────────────────
const hasbled: ClinicalCalc = {
  id: 'hasbled', name: 'HAS-BLED (risco hemorrágico)', category: 'cardio',
  desc: 'Risco hemorrágico em doentes anticoagulados.',
  fields: [
    { key: 'h', label: 'HTA não controlada (>160 sist.)', type: 'checkbox' },
    { key: 'a1', label: 'Função renal alterada', type: 'checkbox' },
    { key: 'a2', label: 'Função hepática alterada', type: 'checkbox' },
    { key: 's', label: 'AVC prévio', type: 'checkbox' },
    { key: 'b', label: 'Hemorragia prévia/predisposição', type: 'checkbox' },
    { key: 'l', label: 'INR lábil', type: 'checkbox' },
    { key: 'e', label: 'Idade >65', type: 'checkbox' },
    { key: 'd1', label: 'Fármacos pró-hemorrágicos', type: 'checkbox' },
    { key: 'd2', label: 'Álcool ≥8/sem', type: 'checkbox' },
  ],
  run: v => {
    let s = 0; for (const k of ['h', 'a1', 'a2', 's', 'b', 'l', 'e', 'd1', 'd2']) if (v[k]) s += 1
    const tone = s >= 3 ? 'alert' : s >= 2 ? 'warn' : 'ok'
    const interp = s >= 3 ? 'Alto risco — cuidados redobrados, reavaliar mensalmente' : 'Risco baixo/moderado'
    return { value: `${s}`, label: 'HAS-BLED', tone, interpretation: interp }
  }, refs: 'Pisters R et al. Chest 2010',
}

// ── 9. qSOFA ───────────────────────────────────────────────────────────────────
const qsofa: ClinicalCalc = {
  id: 'qsofa', name: 'qSOFA (rastreio sépsis)', category: 'icu',
  desc: 'Rastreio rápido de sépsis fora da UCI. Pontuação ≥2 sugere mau prognóstico.',
  fields: [
    { key: 'rr', label: 'FR ≥22/min', type: 'checkbox' },
    { key: 'gcs', label: 'Alteração estado mental (GCS <15)', type: 'checkbox' },
    { key: 'sbp', label: 'TA sistólica ≤100', type: 'checkbox' },
  ],
  run: v => {
    let s = 0; if (v.rr) s += 1; if (v.gcs) s += 1; if (v.sbp) s += 1
    const tone = s >= 2 ? 'alert' : s === 1 ? 'warn' : 'ok'
    return { value: `${s}`, label: 'qSOFA', tone, interpretation: s >= 2 ? 'Risco elevado — investigar sépsis e considerar UCI' : 'Risco baixo' }
  }, refs: 'Sepsis-3 (Singer M. JAMA 2016)',
}

// ── 10. NEWS2 ──────────────────────────────────────────────────────────────────
const news2: ClinicalCalc = {
  id: 'news2', name: 'NEWS2 (deterioração clínica)', category: 'icu',
  desc: 'National Early Warning Score 2 — escore de vigilância de doente agudo.',
  fields: [
    { key: 'rr', label: 'FR', unit: '/min', type: 'number', min: 4, max: 60 },
    { key: 'spo2', label: 'SpO₂', unit: '%', type: 'number', min: 50, max: 100 },
    { key: 'o2', label: 'Oxigénio suplementar', type: 'checkbox' },
    { key: 'sbp', label: 'TAS', unit: 'mmHg', type: 'number', min: 50, max: 250 },
    { key: 'hr', label: 'FC', unit: '/min', type: 'number', min: 20, max: 220 },
    { key: 'temp', label: 'Temp', unit: '°C', type: 'number', min: 30, max: 43, step: 0.1 },
    { key: 'avpu', label: 'Estado de consciência', type: 'select', options: [{ label: 'Alerta', value: 0 }, { label: 'V/P/U', value: 3 }] },
  ],
  run: v => {
    const rr = num(v.rr), spo2 = num(v.spo2), sbp = num(v.sbp), hr = num(v.hr), temp = num(v.temp)
    if (rr == null || spo2 == null || sbp == null || hr == null || temp == null) return null
    let s = 0
    if (rr <= 8) s += 3; else if (rr <= 11) s += 1; else if (rr <= 20) s += 0; else if (rr <= 24) s += 2; else s += 3
    if (spo2 <= 91) s += 3; else if (spo2 <= 93) s += 2; else if (spo2 <= 95) s += 1
    if (v.o2) s += 2
    if (sbp <= 90) s += 3; else if (sbp <= 100) s += 2; else if (sbp <= 110) s += 1; else if (sbp >= 220) s += 3
    if (hr <= 40) s += 3; else if (hr <= 50) s += 1; else if (hr <= 90) s += 0; else if (hr <= 110) s += 1; else if (hr <= 130) s += 2; else s += 3
    if (temp <= 35) s += 3; else if (temp <= 36) s += 1; else if (temp <= 38) s += 0; else if (temp <= 39) s += 1; else s += 2
    s += Number(v.avpu) || 0
    const tone = s >= 7 ? 'alert' : s >= 5 ? 'warn' : s >= 1 ? 'info' : 'ok'
    const action = s >= 7 ? 'Emergência — equipa de resposta rápida' : s >= 5 ? 'Avaliação urgente, monitorização contínua' : s >= 1 ? 'Reavaliar com intervalo apropriado' : 'Reavaliação de rotina'
    return { value: `${s}`, label: 'NEWS2', tone, interpretation: action }
  }, refs: 'Royal College of Physicians, NEWS2 2017',
}

// ── 11. Wells DVT ──────────────────────────────────────────────────────────────
const wells_dvt: ClinicalCalc = {
  id: 'wells_dvt', name: 'Wells DVT', category: 'hema',
  desc: 'Probabilidade clínica de trombose venosa profunda.',
  fields: [
    { key: 'cancer', label: 'Cancro ativo', type: 'checkbox' },
    { key: 'paralysis', label: 'Paralisia/imobilização MMII', type: 'checkbox' },
    { key: 'bedrest', label: 'Cama >3d ou cirurgia recente', type: 'checkbox' },
    { key: 'tender', label: 'Dor ao longo da veia profunda', type: 'checkbox' },
    { key: 'swelling', label: 'Tumefação de toda a perna', type: 'checkbox' },
    { key: 'calf', label: 'Edema gémeos >3cm vs contralateral', type: 'checkbox' },
    { key: 'pit', label: 'Edema com fóvea unilateral', type: 'checkbox' },
    { key: 'collat', label: 'Veias colaterais superficiais', type: 'checkbox' },
    { key: 'history', label: 'História de TVP', type: 'checkbox' },
    { key: 'alt_dx', label: 'Diagnóstico alternativo igual ou mais provável (−2)', type: 'checkbox' },
  ],
  run: v => {
    let s = 0
    for (const k of ['cancer', 'paralysis', 'bedrest', 'tender', 'swelling', 'calf', 'pit', 'collat', 'history']) if (v[k]) s += 1
    if (v.alt_dx) s -= 2
    const tone = s >= 2 ? 'warn' : 'ok'
    const interp = s >= 2 ? 'TVP provável — eco doppler' : 'TVP improvável — D-dímero'
    return { value: `${s}`, label: 'Wells DVT', tone, interpretation: interp }
  }, refs: 'Wells PS et al. Lancet 1997',
}

// ── 12. Wells EP ───────────────────────────────────────────────────────────────
const wells_pe: ClinicalCalc = {
  id: 'wells_pe', name: 'Wells EP', category: 'hema',
  desc: 'Probabilidade clínica de embolia pulmonar.',
  fields: [
    { key: 'dvt', label: 'Sinais clínicos de TVP', type: 'checkbox' },
    { key: 'alt', label: 'EP é o diagnóstico mais provável', type: 'checkbox' },
    { key: 'hr', label: 'FC > 100', type: 'checkbox' },
    { key: 'immob', label: 'Imobilização/cirurgia 4 semanas', type: 'checkbox' },
    { key: 'history', label: 'História de TVP/EP', type: 'checkbox' },
    { key: 'hemoptysis', label: 'Hemoptises', type: 'checkbox' },
    { key: 'cancer', label: 'Cancro ativo', type: 'checkbox' },
  ],
  run: v => {
    let s = 0
    if (v.dvt) s += 3; if (v.alt) s += 3; if (v.hr) s += 1.5; if (v.immob) s += 1.5
    if (v.history) s += 1.5; if (v.hemoptysis) s += 1; if (v.cancer) s += 1
    const tone = s >= 4 ? 'warn' : 'ok'
    const interp = s > 6 ? 'Alta probabilidade' : s >= 4 ? 'Moderada — angio-TC pulmonar' : 'Baixa — D-dímero'
    return { value: `${s}`, label: 'Wells EP', tone, interpretation: interp }
  }, refs: 'Wells PS et al. Ann Intern Med 1998',
}

// ── 13. MELD-Na ────────────────────────────────────────────────────────────────
const meld_na: ClinicalCalc = {
  id: 'meld_na', name: 'MELD-Na (cirrose)', category: 'hepatic',
  desc: 'Mortalidade a 3 meses em cirrose; usado para priorização de transplante.',
  fields: [
    { key: 'bili', label: 'Bilirrubina', unit: 'mg/dL', type: 'number', min: 0.1, max: 40, step: 0.1 },
    { key: 'cr', label: 'Creatinina', unit: 'mg/dL', type: 'number', min: 0.1, max: 8, step: 0.1 },
    { key: 'inr', label: 'INR', type: 'number', min: 0.5, max: 10, step: 0.1 },
    { key: 'na', label: 'Na', unit: 'mEq/L', type: 'number', min: 100, max: 160 },
  ],
  run: v => {
    let bili = num(v.bili), cr = num(v.cr), inr = num(v.inr), na = num(v.na)
    if (bili == null || cr == null || inr == null || na == null) return null
    bili = Math.max(1, bili); cr = Math.max(1, Math.min(cr, 4)); inr = Math.max(1, inr)
    const meld = Math.round(0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.120 * Math.log(inr) + 0.643) * 10 / 10
    const meldI = Math.round((0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.120 * Math.log(inr) + 0.643) * 10)
    const naClamped = Math.max(125, Math.min(na, 137))
    const meldNa = meldI + 1.32 * (137 - naClamped) - (0.033 * meldI * (137 - naClamped))
    const r = Math.round(meldNa)
    const tone = r >= 25 ? 'alert' : r >= 15 ? 'warn' : 'ok'
    return { value: `${r}`, label: 'MELD-Na', tone, interpretation: r >= 25 ? 'Mortalidade 3m >50%' : r >= 15 ? 'Mortalidade 3m elevada' : 'Mortalidade 3m baixa' }
  }, refs: 'UNOS · Kim WR. NEJM 2008',
}

// ── 14. Centor (faringite estreptocócica) ─────────────────────────────────────
const centor: ClinicalCalc = {
  id: 'centor', name: 'Centor / McIsaac (faringite)', category: 'general',
  desc: 'Probabilidade de faringite por estreptococo grupo A.',
  fields: [
    { key: 'fever', label: 'Febre >38°C', type: 'checkbox' },
    { key: 'exudate', label: 'Exsudado amigdalino', type: 'checkbox' },
    { key: 'nodes', label: 'Adenopatias cervicais ant.', type: 'checkbox' },
    { key: 'cough', label: 'Ausência de tosse', type: 'checkbox' },
    { key: 'age', label: 'Idade', unit: 'anos', type: 'number', min: 1, max: 100 },
  ],
  run: v => {
    let s = 0
    if (v.fever) s += 1; if (v.exudate) s += 1; if (v.nodes) s += 1; if (v.cough) s += 1
    const age = num(v.age)
    if (age != null) { if (age < 15) s += 1; else if (age >= 45) s -= 1 }
    const tone = s >= 4 ? 'warn' : 'ok'
    const interp = s >= 4 ? 'Considerar antibioterapia empírica' : s >= 2 ? 'Teste rápido / cultura' : 'Sem necessidade de teste/AB'
    return { value: `${s}`, label: 'Centor', tone, interpretation: interp }
  }, refs: 'McIsaac WJ. CMAJ 1998',
}

// ── 15. ABCD2 (AIT) ────────────────────────────────────────────────────────────
const abcd2: ClinicalCalc = {
  id: 'abcd2', name: 'ABCD² (AIT — risco de AVC)', category: 'cardio',
  desc: 'Risco a 2/7 dias de AVC após AIT.',
  fields: [
    { key: 'age', label: 'Idade ≥60', type: 'checkbox' },
    { key: 'bp', label: 'TA ≥140/90', type: 'checkbox' },
    { key: 'clinical', label: 'Hemiparesia (2) ou disfasia s/parésia (1)', type: 'select', options: [{ label: 'Não', value: 0 }, { label: 'Disfasia sem parésia', value: 1 }, { label: 'Hemiparesia', value: 2 }] },
    { key: 'duration', label: 'Duração: <10m (0) · 10-59m (1) · ≥60m (2)', type: 'select', options: [{ label: '<10 min', value: 0 }, { label: '10-59 min', value: 1 }, { label: '≥60 min', value: 2 }] },
    { key: 'dm', label: 'Diabetes', type: 'checkbox' },
  ],
  run: v => {
    let s = 0
    if (v.age) s += 1; if (v.bp) s += 1; if (v.dm) s += 1
    s += Number(v.clinical) || 0; s += Number(v.duration) || 0
    const tone = s >= 4 ? 'warn' : 'ok'
    const interp = s >= 6 ? 'Risco 8.1% a 2 dias' : s >= 4 ? 'Risco 4.1% a 2 dias' : 'Risco 1% a 2 dias'
    return { value: `${s}`, label: 'ABCD²', tone, interpretation: interp }
  }, refs: 'Johnston SC. Lancet 2007',
}

// ── 16. Padua (TEV em internamento) ────────────────────────────────────────────
const padua: ClinicalCalc = {
  id: 'padua', name: 'Padua (TEV em internamento)', category: 'hema',
  desc: 'Profilaxia de TEV no doente médico hospitalizado.',
  fields: [
    { key: 'cancer', label: 'Cancro ativo', type: 'checkbox' },
    { key: 'tev_prev', label: 'TEV prévio', type: 'checkbox' },
    { key: 'immobility', label: 'Imobilidade ≥3 dias', type: 'checkbox' },
    { key: 'thrombo', label: 'Trombofilia conhecida', type: 'checkbox' },
    { key: 'trauma', label: 'Trauma/cirurgia recente <1m', type: 'checkbox' },
    { key: 'age70', label: 'Idade ≥70', type: 'checkbox' },
    { key: 'hf_resp', label: 'IC/IR aguda', type: 'checkbox' },
    { key: 'infection', label: 'Infeção/doença reumatológica aguda', type: 'checkbox' },
    { key: 'obesity', label: 'IMC ≥30', type: 'checkbox' },
    { key: 'hormonal', label: 'Tratamento hormonal', type: 'checkbox' },
  ],
  run: v => {
    let s = 0
    if (v.cancer) s += 3; if (v.tev_prev) s += 3; if (v.immobility) s += 3; if (v.thrombo) s += 3
    if (v.trauma) s += 2
    if (v.age70) s += 1; if (v.hf_resp) s += 1; if (v.infection) s += 1; if (v.obesity) s += 1; if (v.hormonal) s += 1
    const tone = s >= 4 ? 'warn' : 'ok'
    return { value: `${s}`, label: 'Padua', tone, interpretation: s >= 4 ? 'Alto risco — profilaxia farmacológica' : 'Baixo risco — profilaxia mecânica ou nenhuma' }
  }, refs: 'Barbar S. J Thromb Haemost 2010',
}

// ── 17. Glasgow Coma Scale ─────────────────────────────────────────────────────
const gcs: ClinicalCalc = {
  id: 'gcs', name: 'Glasgow Coma Scale (GCS)', category: 'icu',
  desc: 'Avaliação do nível de consciência: olhos + verbal + motor (3-15).',
  fields: [
    { key: 'eyes', label: 'Olhos', type: 'select', options: [
      { label: '1 · Não abre', value: 1 }, { label: '2 · À dor', value: 2 }, { label: '3 · Ao som', value: 3 }, { label: '4 · Espontâneo', value: 4 },
    ] },
    { key: 'verbal', label: 'Verbal', type: 'select', options: [
      { label: '1 · Sem resposta', value: 1 }, { label: '2 · Sons incompreensíveis', value: 2 }, { label: '3 · Palavras desconexas', value: 3 }, { label: '4 · Confuso', value: 4 }, { label: '5 · Orientado', value: 5 },
    ] },
    { key: 'motor', label: 'Motor', type: 'select', options: [
      { label: '1 · Sem resposta', value: 1 }, { label: '2 · Extensão à dor', value: 2 }, { label: '3 · Flexão anormal', value: 3 }, { label: '4 · Retirada à dor', value: 4 }, { label: '5 · Localiza a dor', value: 5 }, { label: '6 · Obedece a ordens', value: 6 },
    ] },
  ],
  run: v => {
    const e = Number(v.eyes) || 0, v_ = Number(v.verbal) || 0, m = Number(v.motor) || 0
    if (!e || !v_ || !m) return null
    const s = e + v_ + m
    const tone = s <= 8 ? 'alert' : s <= 12 ? 'warn' : 'ok'
    const interp = s <= 8 ? 'TCE grave — proteção via aérea' : s <= 12 ? 'TCE moderado' : 'TCE ligeiro'
    return { value: `${s}`, label: `GCS ${e}-${v_}-${m}`, tone, interpretation: interp }
  }, refs: 'Teasdale G, Jennett B. Lancet 1974',
}

// ── 18. Osmolalidade sérica ────────────────────────────────────────────────────
const osm: ClinicalCalc = {
  id: 'osm', name: 'Osmolalidade Sérica', category: 'metabolic',
  desc: '2×Na + Glic/18 + BUN/2.8',
  fields: [
    { key: 'na', label: 'Na', unit: 'mEq/L', type: 'number', min: 100, max: 180 },
    { key: 'gluc', label: 'Glicemia', unit: 'mg/dL', type: 'number', min: 30, max: 1500 },
    { key: 'bun', label: 'BUN', unit: 'mg/dL', type: 'number', min: 1, max: 200 },
  ],
  run: v => {
    const na = num(v.na), gluc = num(v.gluc), bun = num(v.bun); if (na == null || gluc == null || bun == null) return null
    const o = 2 * na + gluc / 18 + bun / 2.8
    const r = round(o, 1)
    const tone = r < 275 ? 'warn' : r > 295 ? 'warn' : 'ok'
    return { value: `${r} mOsm/kg`, label: 'Osmolalidade', tone, interpretation: r < 275 ? 'Hipoosmolar' : r > 295 ? 'Hiperosmolar' : 'Normal' }
  }, refs: 'Worthley LI. CCP 1997',
}

// ── 19. FENa ───────────────────────────────────────────────────────────────────
const fena: ClinicalCalc = {
  id: 'fena', name: 'FENa (sódio fracionado)', category: 'renal',
  desc: 'Distingue LRA pré-renal de tubular aguda.',
  fields: [
    { key: 'una', label: 'Na urinário', unit: 'mEq/L', type: 'number', min: 1, max: 500 },
    { key: 'sna', label: 'Na sérico', unit: 'mEq/L', type: 'number', min: 100, max: 180 },
    { key: 'ucr', label: 'Creatinina urinária', unit: 'mg/dL', type: 'number', min: 1, max: 500 },
    { key: 'scr', label: 'Creatinina sérica', unit: 'mg/dL', type: 'number', min: 0.1, max: 15, step: 0.01 },
  ],
  run: v => {
    const una = num(v.una), sna = num(v.sna), ucr = num(v.ucr), scr = num(v.scr); if (una == null || sna == null || ucr == null || scr == null) return null
    const fena = ((una * scr) / (sna * ucr)) * 100
    const r = round(fena, 2)
    const interp = r < 1 ? 'Pré-renal' : r > 2 ? 'NTA / intrínseca' : 'Indeterminada'
    return { value: `${r} %`, label: 'FENa', tone: r > 2 ? 'warn' : 'ok', interpretation: interp }
  }, refs: 'Espinel CH. JAMA 1976',
}

// ── 20. Maddrey ────────────────────────────────────────────────────────────────
const maddrey: ClinicalCalc = {
  id: 'maddrey', name: 'Maddrey (hepatite alcoólica)', category: 'hepatic',
  desc: 'mDF = 4.6 × (TP doente - TP controlo) + Bilirrubina. ≥32 → grave.',
  fields: [
    { key: 'tp', label: 'TP doente', unit: 's', type: 'number', min: 5, max: 100 },
    { key: 'tpc', label: 'TP controlo', unit: 's', type: 'number', min: 5, max: 30 },
    { key: 'bili', label: 'Bilirrubina', unit: 'mg/dL', type: 'number', min: 0.1, max: 50, step: 0.1 },
  ],
  run: v => {
    const tp = num(v.tp), tpc = num(v.tpc), bili = num(v.bili); if (tp == null || tpc == null || bili == null) return null
    const m = 4.6 * (tp - tpc) + bili
    const r = round(m, 1)
    const tone = r >= 32 ? 'alert' : 'warn'
    return { value: `${r}`, label: 'Maddrey', tone, interpretation: r >= 32 ? 'Hepatite alcoólica grave — considerar corticoide' : 'Hepatite alcoólica não-grave' }
  }, refs: 'Maddrey WC. Gastroenterology 1978',
}

// ── 21. Light criteria (derrame pleural) ──────────────────────────────────────
const light: ClinicalCalc = {
  id: 'light', name: 'Light (derrame pleural)', category: 'general',
  desc: 'Distingue exsudado de transudado. Exsudado se ≥1 critério.',
  fields: [
    { key: 'prot_pl', label: 'Proteína pleural', unit: 'g/dL', type: 'number', min: 0.1, max: 10, step: 0.1 },
    { key: 'prot_s', label: 'Proteína sérica', unit: 'g/dL', type: 'number', min: 1, max: 12, step: 0.1 },
    { key: 'ldh_pl', label: 'LDH pleural', unit: 'U/L', type: 'number', min: 1, max: 5000 },
    { key: 'ldh_s', label: 'LDH sérica', unit: 'U/L', type: 'number', min: 1, max: 2000 },
    { key: 'ldh_uln', label: 'LDH sérica ULN (normalidade superior)', unit: 'U/L', type: 'number', min: 100, max: 500 },
  ],
  run: v => {
    const pp = num(v.prot_pl), ps = num(v.prot_s), lp = num(v.ldh_pl), ls = num(v.ldh_s), lu = num(v.ldh_uln)
    if (pp == null || ps == null || lp == null || ls == null || lu == null) return null
    const c1 = (pp / ps) > 0.5
    const c2 = (lp / ls) > 0.6
    const c3 = lp > (2 / 3) * lu
    const exsudate = c1 || c2 || c3
    return { value: exsudate ? 'Exsudado' : 'Transudado', label: 'Light', tone: 'info', interpretation: exsudate ? `Critérios positivos: ${[c1 ? 'prot' : '', c2 ? 'LDH' : '', c3 ? 'LDH/ULN' : ''].filter(Boolean).join(' · ')}` : 'Nenhum critério' }
  }, refs: 'Light RW. Ann Intern Med 1972',
}

// ── 22. Bishop score ──────────────────────────────────────────────────────────
const bishop: ClinicalCalc = {
  id: 'bishop', name: 'Bishop (indução de parto)', category: 'general',
  desc: 'Maturidade cervical para indução de trabalho de parto.',
  fields: [
    { key: 'dilation', label: 'Dilatação (cm)', type: 'select', options: [
      { label: '0', value: 0 }, { label: '1-2', value: 1 }, { label: '3-4', value: 2 }, { label: '≥5', value: 3 },
    ] },
    { key: 'effacement', label: 'Esvaecimento (%)', type: 'select', options: [
      { label: '0-30', value: 0 }, { label: '40-50', value: 1 }, { label: '60-70', value: 2 }, { label: '80+', value: 3 },
    ] },
    { key: 'station', label: 'Estação fetal', type: 'select', options: [
      { label: '-3', value: 0 }, { label: '-2', value: 1 }, { label: '-1/0', value: 2 }, { label: '+1/+2', value: 3 },
    ] },
    { key: 'consistency', label: 'Consistência', type: 'select', options: [
      { label: 'Firme', value: 0 }, { label: 'Média', value: 1 }, { label: 'Macia', value: 2 },
    ] },
    { key: 'position', label: 'Posição', type: 'select', options: [
      { label: 'Posterior', value: 0 }, { label: 'Média', value: 1 }, { label: 'Anterior', value: 2 },
    ] },
  ],
  run: v => {
    const s = (Number(v.dilation) || 0) + (Number(v.effacement) || 0) + (Number(v.station) || 0) + (Number(v.consistency) || 0) + (Number(v.position) || 0)
    const tone = s >= 8 ? 'ok' : s >= 6 ? 'warn' : 'alert'
    return { value: `${s}`, label: 'Bishop', tone, interpretation: s >= 8 ? 'Indução provavelmente bem sucedida' : s >= 6 ? 'Indução favorável' : 'Indução desfavorável — considerar maturação cervical' }
  }, refs: 'Bishop EH. Obstet Gynecol 1964',
}

// ── Escalas clínicas validadas (eram /escalas — página própria) ────────────────
const FREQ4 = [{ label: 'Nunca', value: 0 }, { label: 'Vários dias', value: 1 }, { label: 'Mais de metade dos dias', value: 2 }, { label: 'Quase todos os dias', value: 3 }]

const phq9: ClinicalCalc = {
  id: 'phq9', name: 'PHQ-9 (Depressão — Triagem)', category: 'scales',
  desc: 'Patient Health Questionnaire. Triagem e monitorização da depressão. 9 itens, score 0–27.',
  fields: [
    { key: 'q1', label: '1. Pouco interesse ou prazer em fazer coisas', type: 'select', options: FREQ4 },
    { key: 'q2', label: '2. Sentir-se em baixo, deprimido(a) ou sem esperança', type: 'select', options: FREQ4 },
    { key: 'q3', label: '3. Dificuldade em adormecer, manter o sono, ou dormir demasiado', type: 'select', options: FREQ4 },
    { key: 'q4', label: '4. Sentir-se cansado(a) ou com pouca energia', type: 'select', options: FREQ4 },
    { key: 'q5', label: '5. Pouco apetite ou comer em excesso', type: 'select', options: FREQ4 },
    { key: 'q6', label: '6. Sentir-se mal consigo próprio(a) — ou um fardo para os outros', type: 'select', options: FREQ4 },
    { key: 'q7', label: '7. Dificuldade de concentração (leitura, TV, trabalho)', type: 'select', options: FREQ4 },
    { key: 'q8', label: '8. Mover-se/falar mais devagar; ou estar irrequieto(a)/agitado(a)', type: 'select', options: FREQ4 },
    { key: 'q9', label: '9. Pensamentos de que seria melhor estar morto(a) ou de se magoar', type: 'select', options: FREQ4, hint: 'Se positivo, avaliar ideação suicida diretamente.' },
  ],
  run: v => {
    const keys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score <= 4 ? 'ok' : score <= 14 ? 'warn' : 'alert'
    const interp = score <= 4 ? 'Sem depressão / mínima. Sem tratamento indicado.'
      : score <= 9 ? 'Depressão leve. Vigilância, psicoeducação e apoio.'
      : score <= 14 ? 'Depressão moderada. Iniciar tratamento (psicoterapia e/ou ISRS).'
      : score <= 19 ? 'Depressão moderada a grave. Tratamento activo, referenciação a psiquiatria.'
      : 'Depressão grave. Tratamento urgente, referenciação imediata a psiquiatria.'
    const suicide = Number(v.q9) > 0 ? ' ⚠ Item 9 positivo: avaliar ideação suicida directamente.' : ''
    return { value: `${score}/27`, label: 'PHQ-9', tone, interpretation: interp + suicide }
  }, refs: 'Kroenke K, Spitzer RL, Williams JB. JAMA Intern Med. 2001',
}

const gad7: ClinicalCalc = {
  id: 'gad7', name: 'GAD-7 (Ansiedade — Triagem)', category: 'scales',
  desc: 'Generalized Anxiety Disorder Scale. Triagem de ansiedade generalizada. 7 itens, score 0–21.',
  fields: [
    { key: 'q1', label: '1. Sentir-se nervoso(a), ansioso(a) ou no limite', type: 'select', options: FREQ4 },
    { key: 'q2', label: '2. Não conseguir parar de se preocupar', type: 'select', options: FREQ4 },
    { key: 'q3', label: '3. Preocupar-se demasiado com as mais diversas coisas', type: 'select', options: FREQ4 },
    { key: 'q4', label: '4. Ter dificuldade em relaxar', type: 'select', options: FREQ4 },
    { key: 'q5', label: '5. Estar tão irrequieto(a) que é difícil ficar sentado(a)', type: 'select', options: FREQ4 },
    { key: 'q6', label: '6. Ficar facilmente irritado(a) ou implicante', type: 'select', options: FREQ4 },
    { key: 'q7', label: '7. Sentir medo de que algo terrível possa acontecer', type: 'select', options: FREQ4 },
  ],
  run: v => {
    const keys = ['q1','q2','q3','q4','q5','q6','q7']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score <= 4 ? 'ok' : score <= 9 ? 'warn' : 'alert'
    const interp = score <= 4 ? 'Ansiedade mínima. Sem tratamento indicado.'
      : score <= 9 ? 'Ansiedade leve. Vigilância, técnicas de relaxamento.'
      : score <= 14 ? 'Ansiedade moderada. Tratar (ISRS, TCC).'
      : 'Ansiedade grave. Tratamento activo urgente, referenciação.'
    return { value: `${score}/21`, label: 'GAD-7', tone, interpretation: interp }
  }, refs: 'Spitzer RL et al. Arch Intern Med. 2006',
}

const morseFall: ClinicalCalc = {
  id: 'morse_fall', name: 'Morse Fall (Risco de queda)', category: 'scales',
  desc: 'Escala de Morse para avaliação do risco de queda. 6 itens. Obrigatória na admissão hospitalar.',
  fields: [
    { key: 'falls', label: 'Historial de quedas (últimos 3 meses ou internamento actual)', type: 'select', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 25 }] },
    { key: 'diagnosis', label: 'Diagnóstico secundário (2+ diagnósticos)', type: 'select', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 15 }] },
    { key: 'ambulatory', label: 'Ajuda para deambular', type: 'select', options: [{ label: 'Nenhuma / repouso / cadeira de rodas', value: 0 }, { label: 'Muletas / bengala / andarilho', value: 15 }, { label: 'Apoia-se nos móveis', value: 30 }] },
    { key: 'iv', label: 'Terapia intravenosa / heparina', type: 'select', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 20 }] },
    { key: 'gait', label: 'Marcha', type: 'select', options: [{ label: 'Normal / cadeira de rodas / acamado', value: 0 }, { label: 'Fraca (curvado, passos arrastados)', value: 10 }, { label: 'Comprometida (dificuldade a levantar, desequilíbrio)', value: 20 }] },
    { key: 'cognition', label: 'Estado mental', type: 'select', options: [{ label: 'Orientado segundo as suas capacidades', value: 0 }, { label: 'Sobrestima capacidades / esquece limitações', value: 15 }] },
  ],
  run: v => {
    const keys = ['falls','diagnosis','ambulatory','iv','gait','cognition']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score < 25 ? 'ok' : score < 51 ? 'warn' : 'alert'
    const interp = score < 25 ? 'Baixo risco de queda. Precauções standard.'
      : score < 51 ? 'Médio risco de queda. Programa de prevenção de quedas.'
      : 'Alto risco de queda. Intervenções intensivas, supervisão aumentada.'
    return { value: `${score}`, label: 'Morse Fall Score', tone, interpretation: interp }
  }, refs: 'Morse JM. Preventing Patient Falls. 1996',
}

const braden: ClinicalCalc = {
  id: 'braden', name: 'Braden (Úlceras por pressão)', category: 'scales',
  desc: 'Escala de Braden — risco de úlceras por pressão. 6 subescalas, score 6–23. Menor score = maior risco.',
  fields: [
    { key: 'sensory', label: 'Percepção sensorial', type: 'select', options: [{ label: '1 — Completamente limitado', value: 1 }, { label: '2 — Muito limitado', value: 2 }, { label: '3 — Ligeiramente limitado', value: 3 }, { label: '4 — Sem limitação', value: 4 }] },
    { key: 'moisture', label: 'Humidade', type: 'select', options: [{ label: '1 — Constantemente húmido', value: 1 }, { label: '2 — Muito húmido', value: 2 }, { label: '3 — Ocasionalmente húmido', value: 3 }, { label: '4 — Raramente húmido', value: 4 }] },
    { key: 'activity', label: 'Actividade', type: 'select', options: [{ label: '1 — Acamado', value: 1 }, { label: '2 — Confinado a cadeira', value: 2 }, { label: '3 — Anda ocasionalmente', value: 3 }, { label: '4 — Anda frequentemente', value: 4 }] },
    { key: 'mobility', label: 'Mobilidade', type: 'select', options: [{ label: '1 — Completamente imóvel', value: 1 }, { label: '2 — Muito limitado', value: 2 }, { label: '3 — Ligeiramente limitado', value: 3 }, { label: '4 — Sem limitações', value: 4 }] },
    { key: 'nutrition', label: 'Nutrição', type: 'select', options: [{ label: '1 — Muito pobre', value: 1 }, { label: '2 — Provavelmente inadequada', value: 2 }, { label: '3 — Adequada', value: 3 }, { label: '4 — Excelente', value: 4 }] },
    { key: 'friction', label: 'Fricção e forças de deslizamento', type: 'select', options: [{ label: '1 — Problema', value: 1 }, { label: '2 — Problema potencial', value: 2 }, { label: '3 — Sem problema aparente', value: 3 }] },
  ],
  run: v => {
    const keys = ['sensory','moisture','activity','mobility','nutrition','friction']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score <= 12 ? 'alert' : score <= 14 ? 'warn' : 'ok'
    const interp = score <= 9 ? 'Risco muito elevado. Mudanças de posição cada 1h, superfície de alívio de pressão especial.'
      : score <= 12 ? 'Risco elevado. Mudanças de posição cada 2h, superfície de alívio de pressão.'
      : score <= 14 ? 'Risco moderado. Mudanças de posição cada 2–3h, proteger proeminências ósseas.'
      : score <= 18 ? 'Risco leve. Medidas preventivas básicas.'
      : 'Sem risco significativo. Reavaliar periodicamente.'
    return { value: `${score}/23`, label: 'Braden', tone, interpretation: interp }
  }, refs: 'Braden BJ, Bergstrom N. Nurs Res. 1987',
}

const nihss: ClinicalCalc = {
  id: 'nihss', name: 'NIHSS (AVC — Gravidade neurológica)', category: 'scales',
  desc: 'NIH Stroke Scale. Avaliação neurológica padronizada no AVC agudo. 11 itens, score 0–31 (versão simplificada).',
  fields: [
    { key: 'consciousness', label: '1a. Nível de consciência', type: 'select', options: [{ label: '0 — Alerta', value: 0 }, { label: '1 — Não alerta, estimulável', value: 1 }, { label: '2 — Não alerta, estimulação repetida', value: 2 }, { label: '3 — Reflexos ou sem resposta', value: 3 }] },
    { key: 'questions', label: '1b. Perguntas (mês e idade)', type: 'select', options: [{ label: '0 — Ambas correctas', value: 0 }, { label: '1 — Uma correcta', value: 1 }, { label: '2 — Nenhuma correcta', value: 2 }] },
    { key: 'commands', label: '1c. Ordens (fechar/abrir olhos, mão)', type: 'select', options: [{ label: '0 — Ambas obedecidas', value: 0 }, { label: '1 — Uma obedecida', value: 1 }, { label: '2 — Nenhuma obedecida', value: 2 }] },
    { key: 'gaze', label: '2. Olhar conjugado', type: 'select', options: [{ label: '0 — Normal', value: 0 }, { label: '1 — Paresia parcial do olhar', value: 1 }, { label: '2 — Desvio forçado', value: 2 }] },
    { key: 'visual', label: '3. Campo visual', type: 'select', options: [{ label: '0 — Sem perda', value: 0 }, { label: '1 — Hemianopsia parcial', value: 1 }, { label: '2 — Hemianopsia completa', value: 2 }, { label: '3 — Cegueira bilateral', value: 3 }] },
    { key: 'facial', label: '4. Paralisia facial', type: 'select', options: [{ label: '0 — Normal', value: 0 }, { label: '1 — Paresia ligeira', value: 1 }, { label: '2 — Paresia parcial', value: 2 }, { label: '3 — Paralisia completa', value: 3 }] },
    { key: 'motor_left', label: '5. Motor MS esquerdo', type: 'select', options: [{ label: '0 — Sem queda', value: 0 }, { label: '1 — Queda antes de 10s', value: 1 }, { label: '2 — Alguma força', value: 2 }, { label: '3 — Sem força', value: 3 }, { label: '4 — Sem movimento', value: 4 }] },
    { key: 'motor_right', label: '6. Motor MS direito', type: 'select', options: [{ label: '0 — Sem queda', value: 0 }, { label: '1 — Queda antes de 10s', value: 1 }, { label: '2 — Alguma força', value: 2 }, { label: '3 — Sem força', value: 3 }, { label: '4 — Sem movimento', value: 4 }] },
    { key: 'sensory', label: '8. Sensibilidade', type: 'select', options: [{ label: '0 — Normal', value: 0 }, { label: '1 — Perda ligeira a moderada', value: 1 }, { label: '2 — Perda grave ou ausente', value: 2 }] },
    { key: 'language', label: '9. Linguagem', type: 'select', options: [{ label: '0 — Normal', value: 0 }, { label: '1 — Afasia leve-moderada', value: 1 }, { label: '2 — Afasia grave', value: 2 }, { label: '3 — Mudo/global', value: 3 }] },
    { key: 'dysarthria', label: '10. Disartria', type: 'select', options: [{ label: '0 — Normal', value: 0 }, { label: '1 — Leve a moderada', value: 1 }, { label: '2 — Grave/anártrico', value: 2 }] },
  ],
  run: v => {
    const keys = ['consciousness','questions','commands','gaze','visual','facial','motor_left','motor_right','sensory','language','dysarthria']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score === 0 ? 'ok' : score <= 4 ? 'ok' : score <= 15 ? 'warn' : 'alert'
    const interp = score === 0 ? 'Sem défice neurológico.'
      : score <= 4 ? 'AVC minor.'
      : score <= 15 ? 'AVC moderado.'
      : score <= 20 ? 'AVC moderado-grave.'
      : 'AVC grave.'
    return { value: `${score}`, label: 'NIHSS (parcial)', tone, interpretation: interp + ' Activar Via Verde AVC se score ≥1 e <4h de evolução.' }
  }, refs: 'Brott T et al. Stroke. 1989',
}

const mnaSf: ClinicalCalc = {
  id: 'mna_sf', name: 'MNA-SF (Triagem nutricional)', category: 'scales',
  desc: 'Mini Nutritional Assessment — Short Form. Triagem nutricional validada em idosos ≥65 anos. Score 0–14.',
  fields: [
    { key: 'food_decline', label: 'A. Diminuição da ingestão alimentar nas últimas 3 semanas', type: 'select', options: [{ label: '0 — Redução grave', value: 0 }, { label: '1 — Redução moderada', value: 1 }, { label: '2 — Sem redução', value: 2 }] },
    { key: 'weight_loss', label: 'B. Perda de peso nos últimos 3 meses', type: 'select', options: [{ label: '0 — Superior a 3 kg', value: 0 }, { label: '1 — Não sabe', value: 1 }, { label: '2 — Entre 1–3 kg', value: 2 }, { label: '3 — Sem perda', value: 3 }] },
    { key: 'mobility', label: 'C. Mobilidade', type: 'select', options: [{ label: '0 — Acamado ou cadeira de rodas', value: 0 }, { label: '1 — Sai da cama/cadeira mas não sai de casa', value: 1 }, { label: '2 — Sai de casa', value: 2 }] },
    { key: 'stress', label: 'D. Doença aguda ou stress psicológico nos últimos 3 meses', type: 'select', options: [{ label: '0 — Sim', value: 0 }, { label: '2 — Não', value: 2 }] },
    { key: 'neuro', label: 'E. Problemas neuropsicológicos', type: 'select', options: [{ label: '0 — Demência grave ou depressão', value: 0 }, { label: '1 — Demência leve', value: 1 }, { label: '2 — Sem problemas', value: 2 }] },
    { key: 'bmi', label: 'F. IMC (kg/m²)', type: 'select', options: [{ label: '0 — IMC < 19', value: 0 }, { label: '1 — IMC 19–20', value: 1 }, { label: '2 — IMC 21–22', value: 2 }, { label: '3 — IMC ≥ 23', value: 3 }] },
  ],
  run: v => {
    const keys = ['food_decline','weight_loss','mobility','stress','neuro','bmi']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score >= 12 ? 'ok' : score >= 8 ? 'warn' : 'alert'
    const interp = score >= 12 ? 'Estado nutricional normal. Sem necessidade de intervenção.'
      : score >= 8 ? 'Risco de malnutrição. Avaliar com MNA completo, intervenção preventiva.'
      : 'Malnutrição. Intervenção nutricional urgente, referenciação a nutricionista.'
    return { value: `${score}/14`, label: 'MNA-SF', tone, interpretation: interp }
  }, refs: 'Guigoz Y. J Nutr Health Aging. 2006',
}

const painNrs: ClinicalCalc = {
  id: 'pain_nrs', name: 'Dor NRS / EVA (0–10)', category: 'scales',
  desc: 'Numeric Rating Scale — intensidade da dor com orientação terapêutica pela escada analgésica OMS.',
  fields: [
    { key: 'score', label: 'Intensidade da dor (0 = sem dor, 10 = insuportável)', type: 'select', options: Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: i })) },
  ],
  run: v => {
    const s = num(v.score); if (s == null) return null
    const tone = s === 0 ? 'ok' : s <= 3 ? 'ok' : s <= 6 ? 'warn' : 'alert'
    const interp = s === 0 ? 'Sem dor. Continuar avaliação regular.'
      : s <= 3 ? 'Dor leve. Analgesia de 1ª escada (paracetamol, AINEs).'
      : s <= 6 ? 'Dor moderada. Analgesia de 2ª escada, considerar opióide fraco.'
      : s <= 9 ? 'Dor intensa. Analgesia de 3ª escada, opióide forte.'
      : 'Dor insuportável. Analgesia urgente, opióide IV, considerar sedação.'
    return { value: `${s}/10`, label: 'Dor (NRS)', tone, interpretation: interp + ' Reavaliação 30–60 min após analgesia.' }
  }, refs: 'OMS — Escada Analgésica',
}

const apgar: ClinicalCalc = {
  id: 'apgar', name: 'APGAR (Avaliação neonatal)', category: 'scales',
  desc: 'Escala de Apgar para avaliação do recém-nascido ao 1º, 5º e 10º minuto. Score 0–10.',
  fields: [
    { key: 'appearance', label: 'A — Aparência (cor): 0 Cianose total · 1 Cianose extremidades · 2 Rosado', type: 'select', options: [{ label: '0', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }] },
    { key: 'pulse', label: 'P — Pulso (FC): 0 Ausente · 1 <100 bpm · 2 ≥100 bpm', type: 'select', options: [{ label: '0', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }] },
    { key: 'grimace', label: 'G — Resposta a estímulos: 0 Sem resposta · 1 Careta · 2 Tosse/espirro/choro', type: 'select', options: [{ label: '0', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }] },
    { key: 'activity', label: 'A — Actividade (tónus): 0 Sem tónus · 1 Ligeira flexão · 2 Movimentos activos', type: 'select', options: [{ label: '0', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }] },
    { key: 'respiration', label: 'R — Respiração: 0 Ausente · 1 Irregular/fraco · 2 Choro forte', type: 'select', options: [{ label: '0', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }] },
  ],
  run: v => {
    const keys = ['appearance','pulse','grimace','activity','respiration']
    if (keys.some(k => v[k] === undefined || v[k] === '')) return null
    const score = keys.reduce((s, k) => s + Number(v[k]), 0)
    const tone = score >= 7 ? 'ok' : score >= 4 ? 'warn' : 'alert'
    const interp = score >= 7 ? 'Normal. Sem necessidade de reanimação activa.'
      : score >= 4 ? 'Depressão moderada. Estimulação e O₂ suplementar, reavaliar.'
      : 'Depressão grave. Reanimação neonatal imediata, chamar equipa.'
    return { value: `${score}/10`, label: 'APGAR', tone, interpretation: interp }
  }, refs: 'Virginia Apgar. JAMA. 1958',
}

// ── Calculadoras de preparações IV (eram /iv-calc) ──────────────────────────────
const DOSE_UNITS = [{ label: 'mg', value: 'mg' }, { label: 'mcg', value: 'mcg' }, { label: 'g', value: 'g' }, { label: 'UI', value: 'UI' }]
const CONC_UNITS = [{ label: 'mg/mL', value: 'mg/mL' }, { label: 'mcg/mL', value: 'mcg/mL' }, { label: 'g/L', value: 'g/L' }, { label: 'UI/mL', value: 'UI/mL' }]

const ivVolume: ClinicalCalc = {
  id: 'iv_volume', name: 'Volume IV a administrar', category: 'icu',
  desc: 'Volume (mL) a administrar a partir da dose prescrita e da concentração disponível.',
  fields: [
    { key: 'dose', label: 'Dose prescrita', type: 'number', step: 0.01 },
    { key: 'doseUnit', label: 'Unidade da dose', type: 'select', options: DOSE_UNITS },
    { key: 'perKg', label: 'Dose é por kg de peso', type: 'checkbox' },
    { key: 'weight', label: 'Peso (só se dose por kg)', unit: 'kg', type: 'number', step: 0.1 },
    { key: 'conc', label: 'Concentração disponível', type: 'number', step: 0.01 },
    { key: 'concUnit', label: 'Unidade da concentração', type: 'select', options: CONC_UNITS },
  ],
  run: v => {
    const dose = num(v.dose), conc = num(v.conc); if (dose == null || conc == null || conc === 0) return null
    const convFactor: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000, UI: 1 }
    const concFactor: Record<string, number> = { 'mg/mL': 1, 'mcg/mL': 0.001, 'g/L': 1, 'UI/mL': 1 }
    const doseInMg = dose * (v.perKg ? (num(v.weight) || 1) : 1) * (convFactor[v.doseUnit] ?? 1)
    const concInMgMl = conc * (concFactor[v.concUnit] ?? 1)
    if (concInMgMl <= 0) return null
    const volume = doseInMg / concInMgMl
    return { value: `${volume.toFixed(2)} mL`, label: 'Volume a administrar', tone: 'info', interpretation: 'Volume = Dose ÷ Concentração' }
  }, refs: 'Farmacotecnia — fórmula padrão',
}

const ivInfusion: ClinicalCalc = {
  id: 'iv_infusion', name: 'Taxa de infusão IV (mL/h)', category: 'icu',
  desc: 'Taxa de infusão em mL/h e gotas/min a partir da dose, peso e concentração.',
  fields: [
    { key: 'dose', label: 'Dose', type: 'number', step: 0.01 },
    { key: 'doseUnit', label: 'Unidade da dose', type: 'select', options: [{ label: 'mcg/kg/min', value: 'mcg/kg/min' }, { label: 'mg/kg/h', value: 'mg/kg/h' }, { label: 'mg/h', value: 'mg/h' }, { label: 'UI/h', value: 'UI/h' }] },
    { key: 'weight', label: 'Peso (necessário para mcg/kg/min e mg/kg/h)', unit: 'kg', type: 'number', step: 0.1 },
    { key: 'conc', label: 'Concentração da solução', type: 'number', step: 0.01 },
    { key: 'concUnit', label: 'Unidade da concentração', type: 'select', options: [{ label: 'mg/mL', value: 'mg/mL' }, { label: 'mcg/mL', value: 'mcg/mL' }, { label: 'UI/mL', value: 'UI/mL' }] },
  ],
  run: v => {
    const d = num(v.dose), w = num(v.weight) || 1, c = num(v.conc)
    if (d == null || c == null || c === 0) return null
    const concMgMl = v.concUnit === 'mcg/mL' ? c / 1000 : c
    let rateMLH: number | null = null
    if (v.doseUnit === 'mcg/kg/min') rateMLH = (d * w * 60) / (1000 * concMgMl)
    else if (v.doseUnit === 'mg/kg/h') rateMLH = (d * w) / concMgMl
    else if (v.doseUnit === 'UI/h') rateMLH = d / (v.concUnit === 'UI/mL' ? c : 1)
    else rateMLH = d / concMgMl
    if (rateMLH == null || isNaN(rateMLH) || rateMLH <= 0) return null
    return { value: `${rateMLH.toFixed(2)} mL/h`, label: 'Taxa de infusão', tone: 'info', interpretation: `≈ ${(rateMLH / 3).toFixed(1)} gotas/min (macrogotas)` }
  }, refs: 'Farmacotecnia — fórmula padrão',
}

const ivReconstitution: ClinicalCalc = {
  id: 'iv_reconstitution', name: 'Reconstituição — diluente necessário', category: 'icu',
  desc: 'Volume de diluente necessário para atingir a concentração desejada.',
  fields: [
    { key: 'powder', label: 'Pó para reconstituir', type: 'number', step: 0.01 },
    { key: 'powderUnit', label: 'Unidade', type: 'select', options: [{ label: 'mg', value: 'mg' }, { label: 'g', value: 'g' }, { label: 'UI', value: 'UI' }] },
    { key: 'targetConc', label: 'Concentração desejada', type: 'number', step: 0.01 },
    { key: 'targetUnit', label: 'Unidade da concentração', type: 'select', options: [{ label: 'mg/mL', value: 'mg/mL' }, { label: 'g/L', value: 'g/L' }, { label: 'UI/mL', value: 'UI/mL' }] },
  ],
  run: v => {
    const powder = num(v.powder), target = num(v.targetConc); if (powder == null || target == null || target === 0) return null
    const convFactor: Record<string, number> = { mg: 1, g: 1000, UI: 1 }
    const massInMg = powder * (convFactor[v.powderUnit] ?? 1)
    const volume = massInMg / target
    return { value: `${volume.toFixed(2)} mL`, label: 'Diluente a adicionar', tone: 'info', interpretation: `Concentração final: ${target} ${v.targetUnit}` }
  }, refs: 'Farmacotecnia — fórmula padrão',
}

export const CALCULATORS: ClinicalCalc[] = [
  crcl, egfr_ckdepi, bmi, bsa, ca_corr, anion_gap, cha2ds2, hasbled, qsofa, news2,
  wells_dvt, wells_pe, meld_na, centor, abcd2, padua, gcs, osm, fena, maddrey, light, bishop,
  phq9, gad7, morseFall, braden, nihss, mnaSf, painNrs, apgar,
  ivVolume, ivInfusion, ivReconstitution,
]

export const CATEGORY_LABEL: Record<ClinicalCalc['category'], string> = {
  renal: 'Renal', cardio: 'Cardio', metabolic: 'Metabólico', icu: 'UCI / Agudo', hema: 'Hematológico', hepatic: 'Hepático', general: 'Geral', scales: 'Escalas',
}
