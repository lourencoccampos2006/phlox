'use client'

import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcId =
  | 'crcl' | 'ckdepi' | 'ibw' | 'bmi' | 'bsa' | 'anion'
  | 'calcium' | 'phenytoin' | 'vancomycin' | 'map' | 'tdd' | 'hepatic'

interface CalcDef {
  id: CalcId; icon: string; label: string; category: string; desc: string
}

const CALCS: CalcDef[] = [
  { id: 'crcl',      icon: '🧪', label: 'CrCl — Cockcroft-Gault', category: 'Renal', desc: 'Depuração creatinina estimada' },
  { id: 'ckdepi',    icon: '🔬', label: 'eGFR — CKD-EPI',         category: 'Renal', desc: 'Filtração glomerular CKD-EPI 2021' },
  { id: 'ibw',       icon: '⚖️',  label: 'Peso Ideal / Ajustado',  category: 'Dosagem', desc: 'IBW (Devine) + ABW (obeso)' },
  { id: 'bmi',       icon: '📏',  label: 'IMC + Classe Obesidade', category: 'Dosagem', desc: 'Body Mass Index com classificação OMS' },
  { id: 'bsa',       icon: '🧬',  label: 'Superfície Corporal',    category: 'Dosagem', desc: 'BSA Mosteller (quimioterapia)' },
  { id: 'anion',     icon: '⚗️',  label: 'Anion Gap Corrigido',    category: 'Electrólitos', desc: 'AG corrigido para albumina' },
  { id: 'calcium',   icon: '🦴',  label: 'Cálcio Corrigido',       category: 'Electrólitos', desc: 'Ca total corrigido para albumina' },
  { id: 'phenytoin', icon: '🧠',  label: 'Fenitoína Corrigida',    category: 'TDM', desc: 'Sheiner-Tozer: albumina + função renal' },
  { id: 'vancomycin',icon: '💉',  label: 'Alvo Vancomicina',       category: 'TDM', desc: 'Estimativa AUC/MIC e dose inicial' },
  { id: 'map',       icon: '❤️',  label: 'Pressão Arterial Média', category: 'Hemodinâmica', desc: 'PAM e perfusão estimada' },
  { id: 'tdd',       icon: '💊',  label: 'Dose Diária Total',      category: 'Dosagem', desc: 'Conversão oral ↔ IV para opioides' },
  { id: 'hepatic',   icon: '🫀',  label: 'Child-Pugh',             category: 'Hepático', desc: 'Score Child-Pugh para cirrose' },
]

const CATEGORIES = ['Renal', 'Dosagem', 'Electrólitos', 'TDM', 'Hemodinâmica', 'Hepático']

// ─── Calculation logic ────────────────────────────────────────────────────────

function crclCG(age: number, weight: number, creatinine: number, sex: 'M' | 'F') {
  const base = ((140 - age) * weight) / (72 * creatinine)
  return sex === 'F' ? base * 0.85 : base
}

function egfrCKDEPI(creatinine: number, age: number, sex: 'M' | 'F') {
  const kappa = sex === 'F' ? 0.7 : 0.9
  const alpha = sex === 'F' ? -0.241 : -0.302
  const A = sex === 'F' ? 1.012 : 1.0
  const scr = creatinine / kappa
  const minVal = Math.min(scr, 1)
  const maxVal = Math.max(scr, 1)
  return 142 * Math.pow(minVal, alpha) * Math.pow(maxVal, -1.200) * Math.pow(0.9938, age) * A
}

function ibwDevine(heightCm: number, sex: 'M' | 'F') {
  const excess = Math.max(0, heightCm - 152.4)
  return sex === 'M' ? 50 + 0.906 * excess : 45.5 + 0.906 * excess
}

function abw(actualWeight: number, ibwVal: number) {
  return ibwVal + 0.4 * (actualWeight - ibwVal)
}

function bmi(weight: number, heightCm: number) {
  const h = heightCm / 100
  return weight / (h * h)
}

function bsaMosteller(weight: number, heightCm: number) {
  return Math.sqrt((weight * heightCm) / 3600)
}

function anionGap(na: number, cl: number, hco3: number, albumin: number) {
  const ag = na - cl - hco3
  const correction = 2.5 * (4.0 - albumin)
  return { ag, agCorrected: ag + correction }
}

function correctedCalcium(calcium: number, albumin: number) {
  return calcium + 0.8 * (4.0 - albumin)
}

function correctedPhenytoin(measured: number, albumin: number, crcl: number) {
  const dialysis = crcl < 10
  const denom = dialysis ? 0.1 * albumin + 0.1 : 0.2 * albumin + 0.1
  return measured / denom
}

function bmiClass(b: number) {
  if (b < 18.5) return { label: 'Baixo peso', color: '#2563eb' }
  if (b < 25)   return { label: 'Normal', color: '#16a34a' }
  if (b < 30)   return { label: 'Pré-obesidade', color: '#ca8a04' }
  if (b < 35)   return { label: 'Obesidade I', color: '#ea580c' }
  if (b < 40)   return { label: 'Obesidade II', color: '#dc2626' }
  return { label: 'Obesidade III', color: '#991b1b' }
}

function crclRisk(crcl: number) {
  if (crcl >= 60) return { label: 'Normal/Ligeira redução', color: '#16a34a' }
  if (crcl >= 30) return { label: 'Redução moderada — ajustar dose', color: '#ca8a04' }
  if (crcl >= 15) return { label: 'Redução grave — dose muito reduzida', color: '#ea580c' }
  return { label: 'Insuficiência renal terminal', color: '#dc2626' }
}

// ─── Calculator Components ────────────────────────────────────────────────────

function N(val: string) { return parseFloat(val) || 0 }

function Result({ label, value, unit, color = '#0f172a', sub }: { label: string; value: string; unit?: string; color?: string; sub?: string }) {
  return (
    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{children}</div>
}

function Input({ label, value, onChange, type = 'number', placeholder = '', min, step }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; min?: string; step?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min} step={step}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8,
          border: '1px solid #e2e8f0', fontSize: 14, outline: 'none',
          background: 'white', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function SexSelect({ value, onChange }: { value: 'M' | 'F'; onChange: (v: 'M' | 'F') => void }) {
  return (
    <div>
      <Label>Sexo</Label>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['M', 'F'] as const).map(s => (
          <button key={s} onClick={() => onChange(s)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${value === s ? '#2563eb' : '#e2e8f0'}`,
            background: value === s ? '#eff6ff' : 'white', cursor: 'pointer',
            fontSize: 13, fontWeight: value === s ? 700 : 500,
            color: value === s ? '#2563eb' : '#64748b', fontFamily: 'inherit',
          }}>{s === 'M' ? '♂ Masculino' : '♀ Feminino'}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Individual Calculators ───────────────────────────────────────────────────

function CalcCrCl() {
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [cr, setCr] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const valid = N(age) > 0 && N(weight) > 0 && N(cr) > 0
  const crcl = valid ? crclCG(N(age), N(weight), N(cr), sex) : null
  const risk = crcl !== null ? crclRisk(crcl) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SexSelect value={sex} onChange={setSex} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Input label="Idade (anos)" value={age} onChange={setAge} min="1" />
        <Input label="Peso (kg)" value={weight} onChange={setWeight} min="1" step="0.1" />
        <Input label="Creatinina sérica (mg/dL)" value={cr} onChange={setCr} min="0.1" step="0.1" />
      </div>
      {crcl !== null && risk && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Result label="CrCl Cockcroft-Gault" value={crcl.toFixed(1)} unit="mL/min" color={risk.color} sub={risk.label} />
          <Result label="Categoria CKD" value={
            crcl >= 90 ? 'G1' : crcl >= 60 ? 'G2' : crcl >= 45 ? 'G3a' : crcl >= 30 ? 'G3b' : crcl >= 15 ? 'G4' : 'G5'
          } color={risk.color} sub={risk.label} />
        </div>
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        <strong>Fórmula:</strong> CrCl = [(140-idade) × peso] / (72 × Cr) × (0.85 se F).<br />
        Usar peso real se IMC &lt; 25, peso ideal se obeso, ABW se IMC 25–40.
      </div>
    </div>
  )
}

function CalcCKDEPI() {
  const [age, setAge] = useState('')
  const [cr, setCr] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const valid = N(age) > 0 && N(cr) > 0
  const egfr = valid ? egfrCKDEPI(N(cr), N(age), sex) : null
  const risk = egfr !== null ? crclRisk(egfr) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SexSelect value={sex} onChange={setSex} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Idade (anos)" value={age} onChange={setAge} min="18" />
        <Input label="Creatinina sérica (mg/dL)" value={cr} onChange={setCr} min="0.1" step="0.1" />
      </div>
      {egfr !== null && risk && (
        <Result label="eGFR CKD-EPI 2021" value={egfr.toFixed(1)} unit="mL/min/1.73m²" color={risk.color} sub={risk.label} />
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        CKD-EPI 2021 — sem variável raça, conforme KDIGO 2024.
      </div>
    </div>
  )
}

function CalcIBW() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const valid = N(height) > 0
  const ibwVal = valid ? ibwDevine(N(height), sex) : null
  const abwVal = (valid && N(weight) > 0 && ibwVal !== null) ? abw(N(weight), ibwVal) : null
  const bmiVal = (N(weight) > 0 && N(height) > 0) ? bmi(N(weight), N(height)) : null
  const isObese = bmiVal !== null && bmiVal >= 30
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SexSelect value={sex} onChange={setSex} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Altura (cm)" value={height} onChange={setHeight} min="100" />
        <Input label="Peso real (kg)" value={weight} onChange={setWeight} min="1" step="0.1" placeholder="Para ABW" />
      </div>
      {ibwVal !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Result label="Peso Ideal (IBW) — Devine" value={ibwVal.toFixed(1)} unit="kg" color="#2563eb" />
          {abwVal !== null && isObese && (
            <Result label="Peso Ajustado (ABW)" value={abwVal.toFixed(1)} unit="kg" color="#ca8a04" sub="Usar para aminoglicosídeos e vancomicina em obesos" />
          )}
        </div>
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        <strong>IBW Devine:</strong> H: 50 + 0.906×(cm-152.4) · M: 45.5 + 0.906×(cm-152.4).<br />
        <strong>ABW:</strong> IBW + 0.4×(peso real − IBW). Usar quando peso real &gt; 20% acima de IBW.
      </div>
    </div>
  )
}

function CalcBMI() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const valid = N(weight) > 0 && N(height) > 0
  const bmiVal = valid ? bmi(N(weight), N(height)) : null
  const cls = bmiVal !== null ? bmiClass(bmiVal) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Peso (kg)" value={weight} onChange={setWeight} min="1" step="0.1" />
        <Input label="Altura (cm)" value={height} onChange={setHeight} min="100" />
      </div>
      {bmiVal !== null && cls && (
        <Result label="IMC (Body Mass Index)" value={bmiVal.toFixed(1)} unit="kg/m²" color={cls.color} sub={cls.label} />
      )}
    </div>
  )
}

function CalcBSA() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const valid = N(weight) > 0 && N(height) > 0
  const bsaVal = valid ? bsaMosteller(N(weight), N(height)) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Peso (kg)" value={weight} onChange={setWeight} min="1" step="0.1" />
        <Input label="Altura (cm)" value={height} onChange={setHeight} min="100" />
      </div>
      {bsaVal !== null && (
        <Result label="Superfície Corporal (Mosteller)" value={bsaVal.toFixed(2)} unit="m²" color="#7c3aed" sub="Para cálculo de doses de quimioterapia e ciclosporina" />
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        BSA Mosteller = √(peso × altura / 3600). BSA padrão adulto: 1.73 m².
      </div>
    </div>
  )
}

function CalcAnionGap() {
  const [na, setNa] = useState('')
  const [cl, setCl] = useState('')
  const [hco3, setHco3] = useState('')
  const [albumin, setAlbumin] = useState('4.0')
  const valid = N(na) > 0 && N(cl) > 0 && N(hco3) > 0
  const result = valid ? anionGap(N(na), N(cl), N(hco3), N(albumin)) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <Input label="Na⁺ (mEq/L)" value={na} onChange={setNa} min="100" />
        <Input label="Cl⁻ (mEq/L)" value={cl} onChange={setCl} min="70" />
        <Input label="HCO₃⁻ (mEq/L)" value={hco3} onChange={setHco3} min="5" />
        <Input label="Albumina (g/dL)" value={albumin} onChange={setAlbumin} min="0.5" step="0.1" />
      </div>
      {result !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Result label="Anion Gap" value={result.ag.toFixed(1)} unit="mEq/L"
            color={result.ag > 12 ? '#dc2626' : '#16a34a'}
            sub={result.ag > 12 ? 'ELEVADO — investigar causa' : 'Normal (8–12 mEq/L)'} />
          <Result label="AG Corrigido (albumina)" value={result.agCorrected.toFixed(1)} unit="mEq/L"
            color={result.agCorrected > 12 ? '#dc2626' : '#16a34a'}
            sub={result.agCorrected > 12 ? 'ELEVADO após correcção' : 'Normal após correcção'} />
        </div>
      )}
      <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
        Causas AG↑: MUDPILES — Metanol, Uremia, Diabética(CAD), Paraldéide, Isoniazida/Fe, Lactato, Etilenoglicol, Salicilatos.
      </div>
    </div>
  )
}

function CalcCalcium() {
  const [calcium, setCalcium] = useState('')
  const [albumin, setAlbumin] = useState('')
  const valid = N(calcium) > 0 && N(albumin) > 0
  const corrCa = valid ? correctedCalcium(N(calcium), N(albumin)) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Cálcio total (mg/dL)" value={calcium} onChange={setCalcium} min="1" step="0.1" />
        <Input label="Albumina (g/dL)" value={albumin} onChange={setAlbumin} min="0.5" step="0.1" />
      </div>
      {corrCa !== null && (
        <Result label="Cálcio Corrigido" value={corrCa.toFixed(1)} unit="mg/dL"
          color={corrCa > 10.5 ? '#dc2626' : corrCa < 8.5 ? '#2563eb' : '#16a34a'}
          sub={corrCa > 10.5 ? 'Hipercalcemia' : corrCa < 8.5 ? 'Hipocalcemia' : 'Normal (8.5–10.5 mg/dL)'} />
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        Correcção: Ca corrigido = Ca medido + 0.8 × (4.0 − albumina). Albumina normal: 4.0 g/dL.
      </div>
    </div>
  )
}

function CalcPhenytoin() {
  const [measured, setMeasured] = useState('')
  const [albumin, setAlbumin] = useState('')
  const [crcl, setCrcl] = useState('')
  const valid = N(measured) > 0 && N(albumin) > 0 && N(crcl) >= 0
  const corrPh = valid ? correctedPhenytoin(N(measured), N(albumin), N(crcl)) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Input label="Fenitoína medida (mg/L)" value={measured} onChange={setMeasured} min="0" step="0.1" />
        <Input label="Albumina (g/dL)" value={albumin} onChange={setAlbumin} min="0.5" step="0.1" />
        <Input label="CrCl (mL/min)" value={crcl} onChange={setCrcl} min="0" />
      </div>
      {corrPh !== null && (
        <Result label="Fenitoína Corrigida (Sheiner-Tozer)" value={corrPh.toFixed(1)} unit="mg/L"
          color={corrPh > 20 ? '#dc2626' : corrPh < 10 ? '#2563eb' : '#16a34a'}
          sub={corrPh > 20 ? 'TÓXICO — reduzir dose' : corrPh < 10 ? 'INFRA-TERAPÊUTICO — aumentar dose' : 'Terapêutico (10–20 mg/L)'} />
      )}
      <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
        Sheiner-Tozer: nível corrigido = medido / [0.2×alb + 0.1]. Para CrCl &lt;10: divisor = 0.1×alb + 0.1.<br />
        Fenitoína ligada à albumina — hipalbuminemia e uremia reduzem fracção livre medida.
      </div>
    </div>
  )
}

function CalcVancomycin() {
  const [weight, setWeight] = useState('')
  const [crcl, setCrcl] = useState('')
  const [mpi, setMpi] = useState('') // target trough
  const valid = N(weight) > 0 && N(crcl) > 0
  const dose = valid ? Math.round((N(crcl) * 15 * N(weight) / 1000) * 10) / 10 : null
  const interval = valid ? (N(crcl) >= 50 ? 'q12h' : N(crcl) >= 30 ? 'q24h' : 'q48h (com TDM)') : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Peso (kg)" value={weight} onChange={setWeight} min="1" step="0.1" />
        <Input label="CrCl (mL/min)" value={crcl} onChange={setCrcl} min="0" />
      </div>
      {dose !== null && interval && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Result label="Dose inicial estimada" value={`${(N(weight) * 15).toFixed(0)}–${(N(weight) * 20).toFixed(0)}`} unit="mg" color="#7c3aed" sub="15–20 mg/kg/dose (peso real)" />
          <Result label="Intervalo recomendado" value={interval} color="#2563eb" sub="Ajustar após 1.º nível TDM" />
        </div>
      )}
      <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
        <strong>Alvo AUC/MIC ≥ 400 mg·h/L</strong> (MRSA com MIC ≤ 1 mg/L). TDM obrigatório: colher nível antes da 4.ª dose.<br />
        Dose máxima: 4.5g/dia. Infundir em mín. 1h para evitar Red Man Syndrome.
      </div>
    </div>
  )
}

function CalcMAP() {
  const [sbp, setSbp] = useState('')
  const [dbp, setDbp] = useState('')
  const valid = N(sbp) > 0 && N(dbp) > 0
  const map = valid ? ((N(sbp) + 2 * N(dbp)) / 3) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Sistólica (mmHg)" value={sbp} onChange={setSbp} min="50" />
        <Input label="Diastólica (mmHg)" value={dbp} onChange={setDbp} min="30" />
      </div>
      {map !== null && (
        <Result label="Pressão Arterial Média (PAM)" value={map.toFixed(1)} unit="mmHg"
          color={map < 65 ? '#dc2626' : '#16a34a'}
          sub={map < 65 ? 'HIPOPERFUSÃO — alvo crítico: PAM ≥ 65 mmHg (sépsis)' : 'Adequada para perfusão orgânica'} />
      )}
      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
        PAM = (PAS + 2×PAD) / 3. Em sépsis: alvo PAM ≥ 65 mmHg (Surviving Sepsis Campaign).
      </div>
    </div>
  )
}

function CalcTDD() {
  const [drug, setDrug] = useState<'morphine' | 'oxycodone' | 'tramadol' | 'fentanyl'>('morphine')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState<'oral' | 'iv' | 'sc'>('oral')

  const EQUI: Record<string, Record<string, number>> = {
    morphine:  { oral: 1, iv: 3, sc: 2 },
    oxycodone: { oral: 1.5, iv: 3, sc: 3 },
    tramadol:  { oral: 0.1, iv: 0.15, sc: 0.13 },
    fentanyl:  { oral: 0, iv: 100, sc: 80 },
  }
  const DRUG_LABELS: Record<string, string> = { morphine: 'Morfina', oxycodone: 'Oxicodona', tramadol: 'Tramadol', fentanyl: 'Fentanilo' }

  const valid = N(dose) > 0
  const ivEquiv = valid ? (N(dose) * EQUI[drug][route] / EQUI[drug].iv) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <Label>Opioide</Label>
          <select value={drug} onChange={e => setDrug(e.target.value as any)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit' }}>
            {Object.entries(DRUG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Input label="Dose diária total (mg)" value={dose} onChange={setDose} min="0" step="0.5" />
        <div>
          <Label>Via actual</Label>
          <select value={route} onChange={e => setRoute(e.target.value as any)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit' }}>
            <option value="oral">Oral</option>
            <option value="iv">IV</option>
            <option value="sc">SC</option>
          </select>
        </div>
      </div>
      {ivEquiv !== null && (
        <Result label={`Equivalente IV Morfina`} value={ivEquiv.toFixed(1)} unit="mg/dia" color="#7c3aed"
          sub="Reduzir 25–50% ao converter entre vias — atenção à sobredosagem" />
      )}
      <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 11, color: '#991b1b' }}>
        <strong>ATENÇÃO:</strong> Tabelas de equianalgesia são estimativas populacionais. Ajustar individualmente. Reduzir sempre 25–50% na conversão por variabilidade farmacodinâmica.
      </div>
    </div>
  )
}

function CalcChildPugh() {
  const [bilirubin, setBilirubin] = useState<1|2|3>(1)
  const [albumin, setAlbumin] = useState<1|2|3>(1)
  const [inr, setInr] = useState<1|2|3>(1)
  const [ascites, setAscites] = useState<1|2|3>(1)
  const [enceph, setEnceph] = useState<1|2|3>(1)

  const total = bilirubin + albumin + inr + ascites + enceph
  const cls = total <= 6 ? 'A' : total <= 9 ? 'B' : 'C'
  const survival = cls === 'A' ? '95% (1 ano)' : cls === 'B' ? '80% (1 ano)' : '45% (1 ano)'
  const color = cls === 'A' ? '#16a34a' : cls === 'B' ? '#ca8a04' : '#dc2626'

  function ScoreRow({ label, value, onChange, options }: { label: string; value: number; onChange: (v: 1|2|3) => void; options: [string, string, string] }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {([1,2,3] as const).map((v, i) => (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, padding: '6px 4px', borderRadius: 7, border: `2px solid ${value === v ? '#7c3aed' : '#e2e8f0'}`,
              background: value === v ? '#faf5ff' : 'white', cursor: 'pointer',
              fontSize: 11, fontWeight: value === v ? 700 : 400, color: value === v ? '#7c3aed' : '#64748b',
              fontFamily: 'inherit', textAlign: 'center',
            }}>{v} — {options[i]}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ScoreRow label="Bilirrubina total" value={bilirubin} onChange={setBilirubin} options={['<2 mg/dL', '2–3 mg/dL', '>3 mg/dL']} />
      <ScoreRow label="Albumina" value={albumin} onChange={setAlbumin} options={['>3.5 g/dL', '2.8–3.5 g/dL', '<2.8 g/dL']} />
      <ScoreRow label="INR / Protrombina" value={inr} onChange={setInr} options={['<1.7', '1.7–2.3', '>2.3']} />
      <ScoreRow label="Ascite" value={ascites} onChange={setAscites} options={['Ausente', 'Ligeira', 'Moderada/Grave']} />
      <ScoreRow label="Encefalopatia" value={enceph} onChange={setEnceph} options={['Ausente', 'Grau I–II', 'Grau III–IV']} />
      <Result label={`Score Child-Pugh: ${total} pontos — Classe ${cls}`} value={`Classe ${cls}`}
        color={color} sub={`Sobrevida estimada: ${survival} · Score: ${total}/15`} />
      <div style={{ padding: '10px 12px', background: '#faf5ff', borderRadius: 8, fontSize: 11, color: '#6d28d9' }}>
        Classe A (5–6): bem compensada. Classe B (7–9): compromisso funcional significativo. Classe C (10–15): descompensada. Ajustar doses conforme classe.
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CALC_COMPONENTS: Record<CalcId, React.FC> = {
  crcl: CalcCrCl, ckdepi: CalcCKDEPI, ibw: CalcIBW, bmi: CalcBMI,
  bsa: CalcBSA, anion: CalcAnionGap, calcium: CalcCalcium,
  phenytoin: CalcPhenytoin, vancomycin: CalcVancomycin,
  map: CalcMAP, tdd: CalcTDD, hepatic: CalcChildPugh,
}

export default function Calculos() {
  const [active, setActive] = useState<CalcId>('crcl')
  const [catFilter, setCatFilter] = useState<string | null>(null)

  const filtered = catFilter ? CALCS.filter(c => c.category === catFilter) : CALCS
  const def = CALCS.find(c => c.id === active)!
  const ActiveCalc = CALC_COMPONENTS[active]

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            🧮 Calculadoras Clínicas
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Farmácia clínica · Dosagem · Electrólitos · TDM · Hemodinâmica
          </p>
        </div>
      </div>

      {/* Calculadoras especializadas (consolidadas aqui) */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['/iv-calc', '💧 Cálculo IV'],
          ['/iv-compatibility', '🧪 Compatibilidade IV'],
          ['/dilutions', '🧫 Diluições e estabilidade'],
          ['/pk-dosing', '📈 Console PK (TDM)'],
          ['/electrolytes', '⚡ Eletrólitos'],
          ['/emergency-doses', '🚨 Doses de urgência'],
          ['/dose-crianca', '👶 Dose pediátrica'],
          ['/antibiotics', '🦠 Antibioterapia'],
          ['/tpn', '🧴 Nutrição parentérica'],
          ['/protocol', '📋 Protocolos'],
          ['/calculators', '📊 Mais escalas'],
        ].map(([href, label]) => (
          <a key={href} href={href} style={{ padding: '7px 13px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: '#334155', textDecoration: 'none' }}>{label}</a>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>

        {/* Sidebar */}
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            <button onClick={() => setCatFilter(null)} style={{
              padding: '4px 10px', borderRadius: 20, border: `1px solid ${catFilter === null ? '#0d9488' : '#e2e8f0'}`,
              background: catFilter === null ? '#f0fdfa' : 'white', cursor: 'pointer',
              fontSize: 11, fontWeight: catFilter === null ? 700 : 500,
              color: catFilter === null ? '#0d9488' : '#64748b', fontFamily: 'inherit',
            }}>Todos</button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat === catFilter ? null : cat)} style={{
                padding: '4px 10px', borderRadius: 20, border: `1px solid ${catFilter === cat ? '#0d9488' : '#e2e8f0'}`,
                background: catFilter === cat ? '#f0fdfa' : 'white', cursor: 'pointer',
                fontSize: 11, fontWeight: catFilter === cat ? 700 : 500,
                color: catFilter === cat ? '#0d9488' : '#64748b', fontFamily: 'inherit',
              }}>{cat}</button>
            ))}
          </div>

          {/* Calculator list */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {filtered.map((c, i) => (
              <button key={c.id} onClick={() => setActive(c.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: active === c.id ? '#f0fdfa' : 'white',
                borderLeft: active === c.id ? '3px solid #0d9488' : '3px solid transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none',
                fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: active === c.id ? 700 : 600, color: active === c.id ? '#0d9488' : '#0f172a' }}>{c.label}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{c.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 10, flexShrink: 0 }}>{c.category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calculator panel */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{def.icon}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{def.label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{def.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{def.category}</span>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <ActiveCalc />
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .calc-layout{grid-template-columns:1fr!important}
        }
        input:focus{border-color:#0d9488!important;box-shadow:0 0 0 3px #0d948820}
        select:focus{outline:2px solid #0d9488;outline-offset:1px}
      `}</style>
    </div>
  )
}
