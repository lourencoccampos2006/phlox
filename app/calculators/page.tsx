'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import type { ActiveProfile } from '@/lib/profileContext'

interface ProfileValues {
  age?: string
  weight?: string
  creatinine?: string
  sex?: string
}

// ─── Shared input style helper ────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }
const btn = (disabled = false): React.CSSProperties => ({ width: '100%', background: disabled ? 'var(--bg-3)' : 'var(--green)', color: disabled ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 })
const resultBox = (color: string): React.CSSProperties => ({ background: 'var(--bg-2)', border: `2px solid ${color}`, borderRadius: 6, padding: '20px' })

// ─── CALCULATORS ────────────────────────────────────────────────────────────

function CockcroftGault({ profileValues }: { profileValues?: ProfileValues }) {
  const [form, setForm] = useState({ age: '', weight: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

  useEffect(() => {
    if (!profileValues) return
    setResult(null)
    setForm(p => ({ age: profileValues.age ?? p.age, weight: profileValues.weight ?? p.weight, creatinine: profileValues.creatinine ?? p.creatinine, sex: profileValues.sex ?? p.sex }))
  }, [profileValues])

  const calc = () => {
    const age = parseFloat(form.age), weight = parseFloat(form.weight), cr = parseFloat(form.creatinine)
    if (!age || !weight || !cr) return
    const base = ((140 - age) * weight) / (72 * cr)
    setResult(form.sex === 'female' ? base * 0.85 : base)
  }
  const interpret = (v: number) => {
    if (v >= 90) return { label: 'Normal (G1)', color: '#276749' }
    if (v >= 60) return { label: 'Ligeiramente reduzida (G2)', color: '#d69e2e' }
    if (v >= 30) return { label: 'Moderadamente reduzida (G3)', color: '#dd6b20' }
    if (v >= 15) return { label: 'Gravemente reduzida (G4)', color: '#c53030' }
    return { label: 'Falência renal (G5)', color: '#742a2a' }
  }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (anos)', ph: 'Ex: 65' }, { key: 'weight', label: 'Peso (kg)', ph: 'Ex: 70' }, { key: 'creatinine', label: 'Creatinina sérica (mg/dL)', ph: 'Ex: 1.2' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
        <div><label style={lbl}>Sexo</label><select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))} style={inp}><option value="male">Masculino</option><option value="female">Feminino</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular ClCr</button>
      {result !== null && (() => { const i = interpret(result); return (<div style={resultBox(i.color)}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>CLEARANCE DE CREATININA</div><div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: i.color, marginBottom: 4 }}>{result.toFixed(1)} <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>mL/min</span></div><div style={{ fontSize: 13, fontWeight: 600, color: i.color, marginBottom: 8 }}>{i.label}</div><div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>Cockcroft-Gault — fórmula de referência para ajuste de dose em insuficiência renal.</div></div>) })()}
    </div>
  )
}

function EGFRCalc({ profileValues }: { profileValues?: ProfileValues }) {
  const [form, setForm] = useState({ age: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

  useEffect(() => {
    if (!profileValues) return
    setResult(null)
    setForm(p => ({ age: profileValues.age ?? p.age, creatinine: profileValues.creatinine ?? p.creatinine, sex: profileValues.sex ?? p.sex }))
  }, [profileValues])

  const calc = () => {
    const age = parseFloat(form.age), cr = parseFloat(form.creatinine)
    if (!age || !cr) return
    const kappa = form.sex === 'female' ? 0.7 : 0.9
    const alpha = form.sex === 'female' ? -0.241 : -0.302
    const crK = cr / kappa
    let egfr = 142 * Math.pow(Math.min(crK, 1), alpha) * Math.pow(Math.max(crK, 1), -1.200) * Math.pow(0.9938, age)
    if (form.sex === 'female') egfr *= 1.012
    setResult(egfr)
  }
  const stage = (v: number) => {
    if (v >= 90) return 'G1 — Normal ou elevada'
    if (v >= 60) return 'G2 — Ligeiramente diminuída'
    if (v >= 45) return 'G3a — Moderadamente diminuída'
    if (v >= 30) return 'G3b — Moderadamente a gravemente diminuída'
    if (v >= 15) return 'G4 — Gravemente diminuída'
    return 'G5 — Falência renal'
  }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (anos)', ph: 'Ex: 55' }, { key: 'creatinine', label: 'Creatinina (mg/dL)', ph: 'Ex: 1.1' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
        <div><label style={lbl}>Sexo</label><select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))} style={inp}><option value="male">Masculino</option><option value="female">Feminino</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular TFGe (CKD-EPI 2021)</button>
      {result !== null && (
        <div style={resultBox(result >= 60 ? '#276749' : result >= 30 ? '#dd6b20' : '#c53030')}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>TAXA DE FILTRAÇÃO GLOMERULAR ESTIMADA</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: result >= 60 ? '#276749' : result >= 30 ? '#dd6b20' : '#c53030', marginBottom: 6 }}>{result.toFixed(0)} <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>mL/min/1.73m²</span></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{stage(result)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>CKD-EPI 2021 — referência KDIGO para estadiamento da DRC</div>
        </div>
      )}
    </div>
  )
}

function BMICalc() {
  const [form, setForm] = useState({ height: '', weight: '' })
  const [result, setResult] = useState<number | null>(null)
  const calc = () => { const h = parseFloat(form.height) / 100, w = parseFloat(form.weight); if (!h || !w) return; setResult(w / (h * h)) }
  const interpret = (v: number) => {
    if (v < 18.5) return { label: 'Baixo peso', color: '#d69e2e' }
    if (v < 25) return { label: 'Peso normal', color: '#276749' }
    if (v < 30) return { label: 'Excesso de peso', color: '#dd6b20' }
    if (v < 35) return { label: 'Obesidade grau I', color: '#c53030' }
    if (v < 40) return { label: 'Obesidade grau II', color: '#c53030' }
    return { label: 'Obesidade grau III (mórbida)', color: '#742a2a' }
  }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'height', label: 'Altura (cm)', ph: 'Ex: 170' }, { key: 'weight', label: 'Peso (kg)', ph: 'Ex: 70' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
      </div>
      <button onClick={calc} style={btn()}>Calcular IMC</button>
      {result !== null && (() => { const i = interpret(result); return (<div style={resultBox(i.color)}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: i.color, marginBottom: 4 }}>{result.toFixed(1)} <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>kg/m²</span></div><div style={{ fontSize: 13, color: i.color, fontWeight: 600 }}>{i.label}</div></div>) })()}
    </div>
  )
}

function PediatricDose() {
  const [form, setForm] = useState({ drug: '', adultDose: '', weight: '', age: '' })
  const [result, setResult] = useState<{ young: number; clark: number } | null>(null)
  const calc = () => { const adult = parseFloat(form.adultDose), weight = parseFloat(form.weight), age = parseFloat(form.age); if (!adult) return; setResult({ young: age ? (adult * (age + 1)) / (age + 7) : 0, clark: weight ? (adult * weight) / 70 : 0 }) }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'drug', label: 'Medicamento', ph: 'Ex: Paracetamol' }, { key: 'adultDose', label: 'Dose adulto (mg)', ph: 'Ex: 1000' }, { key: 'weight', label: 'Peso criança (kg)', ph: 'Ex: 20' }, { key: 'age', label: 'Idade criança (anos)', ph: 'Ex: 6' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type={key === 'drug' ? 'text' : 'number'} placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
      </div>
      <button onClick={calc} style={btn()}>Calcular Dose Pediátrica</button>
      {result !== null && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {[{ label: 'Regra de Young (por idade)', value: result.young, note: 'Dose adulto × (Idade+1) / (Idade+7)' }, { label: 'Regra de Clark (por peso)', value: result.clark, note: 'Dose adulto × Peso / 70' }].filter(r => r.value > 0).map(({ label, value, note }, i, arr) => (
            <div key={label} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>{value.toFixed(1)} mg</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{note}</div>
            </div>
          ))}
          <div style={{ padding: '12px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
            <p style={{ fontSize: 11, color: '#92400e', margin: 0, lineHeight: 1.6 }}>Estimativas orientativas. Confirma sempre com a bula e consulta um profissional de saúde.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const OPIOID_TABLE: Record<string, { oral: number; iv: number; label: string }> = {
  morphine_oral:     { oral: 1,    iv: 0,   label: 'Morfina oral' },
  morphine_iv:       { oral: 0,    iv: 1,   label: 'Morfina IV/SC' },
  oxycodone_oral:    { oral: 1.5,  iv: 0,   label: 'Oxicodona oral' },
  hydromorphone_oral:{ oral: 5,    iv: 0,   label: 'Hidromorfona oral' },
  hydromorphone_iv:  { oral: 0,    iv: 5,   label: 'Hidromorfona IV' },
  fentanyl_patch:    { oral: 0,    iv: 100, label: 'Fentanil transdérmico (µg/h)' },
  tramadol_oral:     { oral: 0.1,  iv: 0,   label: 'Tramadol oral' },
  codeine_oral:      { oral: 0.15, iv: 0,   label: 'Codeína oral' },
  buprenorphine_sl:  { oral: 0,    iv: 75,  label: 'Buprenorfina sublingual' },
  tapentadol_oral:   { oral: 0.4,  iv: 0,   label: 'Tapentadol oral' },
}

function OpioidConversion() {
  const [from, setFrom] = useState('morphine_oral')
  const [dose, setDose] = useState('')
  const [results, setResults] = useState<{ label: string; dose: number; unit: string }[] | null>(null)
  const calc = () => {
    const d = parseFloat(dose); if (!d || d <= 0) return
    const src = OPIOID_TABLE[from]
    const mme = from === 'fentanyl_patch' ? d * 2.4 : d * (src.oral || src.iv)
    const out: { label: string; dose: number; unit: string }[] = []
    for (const [key, val] of Object.entries(OPIOID_TABLE)) {
      if (key === from) continue
      if (key === 'fentanyl_patch') { out.push({ label: val.label, dose: mme / 2.4, unit: 'µg/h' }) }
      else { const eq = val.oral > 0 ? mme / val.oral : val.iv > 0 ? mme / val.iv : 0; if (eq > 0) out.push({ label: val.label, dose: eq, unit: 'mg' }) }
    }
    setResults(out)
  }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Opióide actual</label><select value={from} onChange={e => { setFrom(e.target.value); setResults(null) }} style={inp}>{Object.entries(OPIOID_TABLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Dose actual ({from === 'fentanyl_patch' ? 'µg/h' : 'mg/dia'})</label><input type="number" placeholder={from === 'fentanyl_patch' ? 'Ex: 25' : 'Ex: 60'} value={dose} onChange={e => setDose(e.target.value)} style={inp} /></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular Equivalências</button>
      {results && (
        <div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', background: 'var(--green)' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>EQUIVALÊNCIAS EQUIANALGÉSICAS</span></div>
            {results.map(({ label, dose: d, unit }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', background: 'white' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)' }}>{d.toFixed(1)} <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{unit}</span></span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4 }}>
            <p style={{ fontSize: 11, color: '#742a2a', margin: 0, lineHeight: 1.6 }}>Reduz sempre 25–50% na rotação de opióides para tolerância cruzada incompleta. Uso exclusivo por profissionais de saúde.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function IdealBodyWeight() {
  const [form, setForm] = useState({ height: '', weight: '', sex: 'male' })
  const [result, setResult] = useState<{ ibw: number; abw: number; lbw: number; bmi: number } | null>(null)
  const calc = () => {
    const h = parseFloat(form.height), w = parseFloat(form.weight); if (!h || !w || h < 100) return
    const hIn = h / 2.54, base = form.sex === 'male' ? 50 : 45.5
    const ibw = Math.max(0, base + 2.3 * (hIn - 60))
    const abw = ibw + 0.4 * (w - ibw)
    const lbw = form.sex === 'male' ? (9270 * w) / (6680 + 216 * (w / ((h / 100) ** 2))) : (9270 * w) / (8780 + 244 * (w / ((h / 100) ** 2)))
    setResult({ ibw, abw, lbw, bmi: w / ((h / 100) ** 2) })
  }
  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'height', label: 'Altura (cm)', ph: 'Ex: 170' }, { key: 'weight', label: 'Peso actual (kg)', ph: 'Ex: 100' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Sexo</label><select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))} style={inp}><option value="male">Masculino</option><option value="female">Feminino</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular Pesos</button>
      {result && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {[{ label: 'Peso Ideal (IBW)', value: result.ibw, note: 'Devine — aminoglicosídeos, vancomicina, digoxina', color: '#276749' }, { label: 'Peso Ajustado (ABW)', value: result.abw, note: 'Usar quando peso > 130% do IBW', color: '#d69e2e' }, { label: 'Peso Magro (LBW)', value: result.lbw, note: 'Janmahasatian — propofol, barbitúricos', color: '#2b6cb0' }].map(({ label, value, note, color }, i) => (
            <div key={label} style={{ padding: '14px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'white' : 'var(--bg-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, fontWeight: 600 }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>{value.toFixed(1)} <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>kg</span></span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.5 }}>{note}</div>
            </div>
          ))}
          <div style={{ padding: '10px 16px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>IMC actual: {result.bmi.toFixed(1)} kg/m²</span>
          </div>
        </div>
      )}
    </div>
  )
}

const HAS_BLED_CRITERIA = [
  { key: 'hypertension', label: 'H — Hipertensão não controlada', desc: 'TAS > 160 mmHg', points: 1 },
  { key: 'renal',        label: 'A — Disfunção renal',            desc: 'Creatinina > 2.26 mg/dL ou diálise', points: 1 },
  { key: 'liver',        label: 'A — Disfunção hepática',         desc: 'Cirrose ou bilirrubina > 2× + AST/ALT > 3×', points: 1 },
  { key: 'stroke',       label: 'S — AVC prévio',                 desc: 'História de AVC isquémico ou hemorrágico', points: 1 },
  { key: 'bleeding',     label: 'B — Hemorragia ou predisposição', desc: 'Úlcera péptica, diátese hemorrágica, anemia', points: 1 },
  { key: 'labile_inr',   label: 'L — INR lábil',                  desc: 'INR instável / tempo em zona terapêutica < 60%', points: 1 },
  { key: 'elderly',      label: 'E — Idade > 65 anos',            desc: 'Ou fragilidade extrema', points: 1 },
  { key: 'drugs',        label: 'D — Fármacos hemorrágicos',      desc: 'AINEs, antiagregantes plaquetários', points: 1 },
  { key: 'alcohol',      label: 'D — Álcool',                     desc: '≥ 8 bebidas/semana', points: 1 },
]

function HASBLEDScore() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const score = Object.entries(checks).filter(([, v]) => v).length
  const interpret = (s: number) => {
    if (s <= 1) return { label: s === 0 ? 'Baixo risco' : 'Risco intermédio', color: s === 0 ? '#276749' : '#d69e2e', note: 'Anticoagulação recomendada se indicada. Score HAS-BLED não contra-indica anticoagulação por si só.' }
    if (s === 2) return { label: 'Risco intermédio-alto', color: '#dd6b20', note: 'Vigilância clínica recomendada. Corrigir factores de risco modificáveis.' }
    return { label: 'Alto risco hemorrágico', color: '#c53030', note: 'Corrigir factores de risco modificáveis (HTA, INR lábil, AINEs, álcool). Não contra-indica anticoagulação — avaliar risco/benefício.' }
  }
  const i = interpret(score)
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Score de risco hemorrágico em doentes anticoagulados com FA. Selecciona os critérios presentes.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {HAS_BLED_CRITERIA.map(({ key, label, desc }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: checks[key] ? 'var(--green-light)' : 'white', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checks[key]} onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))} style={{ marginTop: 2, accentColor: 'var(--green)', flexShrink: 0, width: 16, height: 16 }} />
            <div><div style={{ fontSize: 13, fontWeight: 600, color: checks[key] ? 'var(--green)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div><div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div></div>
          </label>
        ))}
      </div>
      <div style={resultBox(i.color)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>SCORE HAS-BLED</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: i.color }}>{score}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 6 }}>{i.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{i.note}</div>
      </div>
    </div>
  )
}

function SCORE2Calc() {
  const [form, setForm] = useState({ age: '', sbp: '', cholesterol: '', hdl: '', sex: 'male', smoker: 'no' })
  const [result, setResult] = useState<number | null>(null)
  const calc = () => {
    const age = parseFloat(form.age), sbp = parseFloat(form.sbp), chol = parseFloat(form.cholesterol), hdl = parseFloat(form.hdl)
    if (!age || !sbp || !chol || !hdl) return
    if (age < 40 || age > 75) { setResult(-1); return }
    const male = form.sex === 'male', smoker = form.smoker === 'yes'
    const lp = male
      ? 0.3742 * (age - 60) / 5 + 0.6012 * (sbp - 120) / 20 + 0.2777 * (chol - 6) + (-0.1458) * (hdl - 1.3) + 0.7937 * (smoker ? 1 : 0)
      : 0.4648 * (age - 60) / 5 + 0.7744 * (sbp - 120) / 20 + 0.1102 * (chol - 6) + (-0.1988) * (hdl - 1.3) + 0.8078 * (smoker ? 1 : 0)
    const baselineS10 = male ? 0.9605 : 0.9776
    setResult(Math.max(0, Math.min(100, (1 - Math.pow(baselineS10, Math.exp(lp))) * 100)))
  }
  const interpret = (v: number) => {
    if (v < 2.5) return { label: 'Baixo risco', color: '#276749', note: 'Manter estilo de vida saudável. Reavaliar em 5 anos.' }
    if (v < 7.5) return { label: 'Risco moderado', color: '#d69e2e', note: 'Intervenção no estilo de vida. Estatina pode ser benéfica. Alvo LDL < 2.6 mmol/L.' }
    if (v < 15) return { label: 'Alto risco', color: '#dd6b20', note: 'Terapêutica farmacológica recomendada. Alvo LDL < 1.8 mmol/L. Considerar estatina de alta intensidade.' }
    return { label: 'Muito alto risco', color: '#c53030', note: 'Terapêutica intensiva. Alvo LDL < 1.4 mmol/L. Encaminhar para especialidade cardiovascular.' }
  }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Risco a 10 anos de evento CV fatal ou não-fatal. Guidelines ESC 2021. Válido para 40–75 anos sem DCV estabelecida.</p>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (40–75 anos)', ph: 'Ex: 55' }, { key: 'sbp', label: 'TAS sistólica (mmHg)', ph: 'Ex: 140' }, { key: 'cholesterol', label: 'Colesterol total (mmol/L)', ph: 'Ex: 5.5' }, { key: 'hdl', label: 'HDL-c (mmol/L)', ph: 'Ex: 1.2' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" step="0.1" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
        <div><label style={lbl}>Sexo</label><select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))} style={inp}><option value="male">Masculino</option><option value="female">Feminino</option></select></div>
        <div><label style={lbl}>Fumador</label><select value={form.smoker} onChange={e => setForm(p => ({ ...p, smoker: e.target.value }))} style={inp}><option value="no">Não</option><option value="yes">Sim</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular Risco SCORE2</button>
      {result !== null && (result === -1
        ? <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '14px 16px', fontSize: 13, color: '#742a2a' }}>SCORE2 válido apenas para idades entre 40 e 75 anos.</div>
        : (() => { const i = interpret(result); return (<div style={resultBox(i.color)}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>RISCO CV A 10 ANOS (SCORE2 — ESC 2021)</div><div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: i.color, marginBottom: 6 }}>{result.toFixed(1)}<span style={{ fontSize: 20 }}>%</span></div><div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 8 }}>{i.label}</div><div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{i.note}</div></div>) })()
      )}
    </div>
  )
}

function RenalDoseAdjust() {
  const [drug, setDrug] = useState('')
  const [egfr, setEgfr] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const calc = async () => {
    if (!drug.trim() || !egfr) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/calculators/renal-dose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drug: drug.trim(), egfr: parseFloat(egfr) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.recommendation)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') } finally { setLoading(false) }
  }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Recomendação de ajuste de dose baseada em guidelines (Micromedex, SmPC, UpToDate). Resultados gerados por IA.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <div><label style={lbl}>Medicamento</label><input type="text" placeholder="Ex: metformina, vancomicina, ciprofloxacina..." value={drug} onChange={e => setDrug(e.target.value)} onKeyDown={e => e.key === 'Enter' && calc()} style={inp} /></div>
        <div><label style={lbl}>TFG / ClCr (mL/min)</label><input type="number" placeholder="Ex: 35" value={egfr} onChange={e => setEgfr(e.target.value)} style={inp} /></div>
      </div>
      <button onClick={calc} disabled={!drug.trim() || !egfr || loading} style={btn(!drug.trim() || !egfr || loading)}>{loading ? 'A consultar guidelines...' : 'Obter Recomendação'}</button>
      {error && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '12px 16px', fontSize: 13, color: '#742a2a' }}>{error}</div>}
      {result && (<div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderLeft: '4px solid var(--green)', borderRadius: 4, padding: '16px 18px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', marginBottom: 8 }}>RECOMENDAÇÃO — TFG {egfr} mL/min</div><p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{result}</p><p style={{ fontSize: 11, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--font-mono)' }}>Confirma sempre com o SmPC do medicamento e com um farmacêutico.</p></div>)}
    </div>
  )
}

// ─── NOVA: CHA₂DS₂-VASc (risco de AVC em FA) ────────────────────────────────
const CHA2DS2_CRITERIA = [
  { key: 'chf',        label: 'C — Insuficiência Cardíaca', desc: 'IC sintomática ou FE reduzida', points: 1 },
  { key: 'htn',        label: 'H — Hipertensão',            desc: 'TA em repouso > 140/90 mmHg ou sob tratamento anti-HTA', points: 1 },
  { key: 'age75',      label: 'A₂ — Idade ≥ 75 anos',      desc: 'Pontuação dupla', points: 2 },
  { key: 'dm',         label: 'D — Diabetes Mellitus',      desc: 'Em terapêutica ou glicémia em jejum > 125 mg/dL', points: 1 },
  { key: 'stroke',     label: 'S₂ — AVC/AIT/TE prévio',    desc: 'AVC, AIT ou tromboembolismo — pontuação dupla', points: 2 },
  { key: 'vascular',   label: 'V — Doença Vascular',        desc: 'EAM, doença arterial periférica, placa aórtica', points: 1 },
  { key: 'age65',      label: 'A — Idade 65–74 anos',       desc: 'Não acumula com critério de ≥ 75 anos', points: 1 },
  { key: 'female',     label: 'Sc — Sexo Feminino',         desc: 'Factor modificador de risco', points: 1 },
]

function CHA2DS2VASc() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const score = CHA2DS2_CRITERIA.reduce((sum, { key, points }) => sum + (checks[key] ? points : 0), 0)
  const strokeRisk: Record<number, string> = { 0: '0%', 1: '1.3%', 2: '2.2%', 3: '3.2%', 4: '4.0%', 5: '6.7%', 6: '9.8%', 7: '9.6%', 8: '12.5%', 9: '15.2%' }
  const risk = strokeRisk[Math.min(score, 9)] || '> 15%'
  const interpret = (s: number) => {
    const isFemale = !!checks['female']
    const effectiveScore = isFemale ? s - 1 : s
    if (effectiveScore <= 0) return { label: 'Baixo risco — anticoagulação não recomendada', color: '#276749', note: 'Score 0 em homens ou 1 só por sexo feminino: anticoagulação oral não recomendada. Reavalia anualmente.' }
    if (effectiveScore === 1) return { label: 'Risco baixo-moderado', color: '#d69e2e', note: 'Score 1 (excluindo sexo feminino): anticoagulação pode ser considerada. Avalia risco hemorrágico (HAS-BLED) individualmente.' }
    return { label: 'Anticoagulação oral recomendada', color: '#c53030', note: 'Score ≥ 2 (excluindo sexo feminino): anticoagulação oral recomendada pelas guidelines ESC 2020. Preferir NOAC em vez de varfarina.' }
  }
  const i = interpret(score)
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Score de risco de AVC em doentes com fibrilhação auricular. Guidelines ESC 2020.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {CHA2DS2_CRITERIA.map(({ key, label, desc, points }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', background: checks[key] ? '#eff6ff' : 'white', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checks[key]} onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))} style={{ marginTop: 2, accentColor: '#1d4ed8', flexShrink: 0, width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: checks[key] ? '#1d4ed8' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>+{points}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div>
            </div>
          </label>
        ))}
      </div>
      <div style={{ ...resultBox(i.color), marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>SCORE CHA₂DS₂-VASc</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: i.color }}>{score}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 6 }}>{i.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 10 }}>{i.note}</div>
        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '8px 12px', display: 'inline-block' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>Risco anual de AVC estimado: </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i.color, fontWeight: 700 }}>{risk}</span>
        </div>
      </div>
    </div>
  )
}

// ─── NOVA: Child-Pugh (gravidade cirrose hepática) ───────────────────────────
function ChildPugh() {
  const [form, setForm] = useState({ bilirubin: '1', albumin: '1', pt: '1', ascites: '1', encephalopathy: '1' })
  const score = Object.values(form).reduce((s, v) => s + parseInt(v), 0)
  const classify = (s: number) => {
    if (s <= 6) return { cls: 'A', label: 'Cirrose compensada', color: '#276749', survival: 'Sobrevida a 1 ano: ~100%', transplant: 'Transplante não indicado' }
    if (s <= 9) return { cls: 'B', label: 'Compromisso funcional moderado', color: '#d69e2e', survival: 'Sobrevida a 1 ano: ~80%', transplant: 'Avaliar transplante hepático' }
    return { cls: 'C', label: 'Cirrose descompensada', color: '#c53030', survival: 'Sobrevida a 1 ano: ~45%', transplant: 'Transplante hepático urgente' }
  }
  const c = classify(score)
  const SELECT = (key: string, opts: { v: string; label: string }[]) => (
    <select value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  )
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Avalia a gravidade da cirrose hepática e guia decisões de tratamento e elegibilidade para transplante.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div><label style={lbl}>Bilirrubina total (µmol/L)</label>{SELECT('bilirubin', [{ v: '1', label: '< 34 µmol/L (< 2 mg/dL) — 1 ponto' }, { v: '2', label: '34–51 µmol/L (2–3 mg/dL) — 2 pontos' }, { v: '3', label: '> 51 µmol/L (> 3 mg/dL) — 3 pontos' }])}</div>
        <div><label style={lbl}>Albumina sérica</label>{SELECT('albumin', [{ v: '1', label: '> 35 g/L — 1 ponto' }, { v: '2', label: '28–35 g/L — 2 pontos' }, { v: '3', label: '< 28 g/L — 3 pontos' }])}</div>
        <div><label style={lbl}>Tempo de Protrombina (prolongamento em segundos)</label>{SELECT('pt', [{ v: '1', label: '< 4 segundos — 1 ponto' }, { v: '2', label: '4–6 segundos — 2 pontos' }, { v: '3', label: '> 6 segundos — 3 pontos' }])}</div>
        <div><label style={lbl}>Ascite</label>{SELECT('ascites', [{ v: '1', label: 'Ausente — 1 ponto' }, { v: '2', label: 'Leve / controlada com diuréticos — 2 pontos' }, { v: '3', label: 'Moderada a grave / refractária — 3 pontos' }])}</div>
        <div><label style={lbl}>Encefalopatia Hepática</label>{SELECT('encephalopathy', [{ v: '1', label: 'Sem encefalopatia — 1 ponto' }, { v: '2', label: 'Grau I–II (confusão leve) — 2 pontos' }, { v: '3', label: 'Grau III–IV (estupor/coma) — 3 pontos' }])}</div>
      </div>
      <div style={resultBox(c.color)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>CHILD-PUGH</span>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-4)' }}>Score</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 48, color: c.color, lineHeight: 1 }}>{score}</span>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 800, color: c.color }}>Classe {c.cls}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.color, marginBottom: 6 }}>{c.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>{c.survival}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{c.transplant}</div>
      </div>
    </div>
  )
}

// ─── NOVA: Wells Score para TEP (Tromboembolismo Pulmonar) ────────────────────
const WELLS_PE_CRITERIA = [
  { key: 'dvt_sx',    label: 'Sinais/sintomas de TVP', desc: 'Edema, dor à palpação de veias profundas', points: 3 },
  { key: 'alt_dx',    label: 'Diagnóstico alternativo menos provável que TEP', desc: '', points: 3 },
  { key: 'hr100',     label: 'FC > 100 bpm', desc: '', points: 1.5 },
  { key: 'immob',     label: 'Imobilização ≥ 3 dias ou cirurgia < 4 semanas', desc: '', points: 1.5 },
  { key: 'prev_dvt',  label: 'TVP ou TEP prévio', desc: '', points: 1.5 },
  { key: 'hemoptysis',label: 'Hemoptise', desc: '', points: 1 },
  { key: 'malignancy',label: 'Neoplasia activa', desc: 'Em tratamento, tratada < 6 meses ou em cuidados paliativos', points: 1 },
]

function WellsPE() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const score = WELLS_PE_CRITERIA.reduce((s, { key, points }) => s + (checks[key] ? points : 0), 0)
  const interpret = (s: number) => {
    if (s <= 1) return { label: 'Baixa probabilidade', color: '#276749', prob: 'Prevalência de TEP: ~3.6%', action: 'D-dímeros negativos excluem TEP. AngioTC se D-dímeros positivos.' }
    if (s <= 6) return { label: 'Probabilidade moderada', color: '#d69e2e', prob: 'Prevalência de TEP: ~20.5%', action: 'D-dímeros se <2 pontos de Wells modificado. AngioTC-tórax se D-dímeros positivos ou score > 4.' }
    return { label: 'Alta probabilidade', color: '#c53030', prob: 'Prevalência de TEP: ~66.7%', action: 'AngioTC-tórax imediata sem esperar D-dímeros. Anticoagulação empírica enquanto aguarda.' }
  }
  const i = interpret(score)
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Score de probabilidade pré-teste para Tromboembolismo Pulmonar. Wells 2000.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {WELLS_PE_CRITERIA.map(({ key, label, desc, points }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', background: checks[key] ? '#fef2f2' : 'white', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checks[key]} onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))} style={{ marginTop: 2, accentColor: '#dc2626', flexShrink: 0, width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: checks[key] ? '#dc2626' : 'var(--ink-2)', marginBottom: desc ? 2 : 0 }}>{label}</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>+{points}</span>
              </div>
              {desc && <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div>}
            </div>
          </label>
        ))}
      </div>
      <div style={resultBox(i.color)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>WELLS SCORE — TEP</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: i.color }}>{score}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 4 }}>{i.label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{i.prob}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, background: 'rgba(255,255,255,0.5)', borderRadius: 4, padding: '8px 12px' }}>{i.action}</div>
      </div>
    </div>
  )
}

// ─── NOVA: Correcção de Sódio na Hiperglicemia ────────────────────────────────
function SodiumCorrection() {
  const [form, setForm] = useState({ measured_na: '', glucose: '', unit: 'mg' })
  const [result, setResult] = useState<{ corrected: number; delta: number } | null>(null)
  const calc = () => {
    const na = parseFloat(form.measured_na)
    let glucose = parseFloat(form.glucose)
    if (!na || !glucose) return
    if (form.unit === 'mg') glucose = glucose / 18  // mg/dL → mmol/L
    const normal_glucose = 5.6  // mmol/L (100 mg/dL)
    if (glucose <= normal_glucose) { setResult({ corrected: na, delta: 0 }); return }
    // Katz formula: +1.6 mEq/L por cada 5.6 mmol/L (100 mg/dL) acima de 100 mg/dL
    const delta = 1.6 * ((glucose - normal_glucose) / 5.6)
    setResult({ corrected: na + delta, delta })
  }
  const interpret = (v: number) => {
    if (v < 135) return { label: 'Hiponatrémia', color: '#2b6cb0' }
    if (v <= 145) return { label: 'Normonatrémia', color: '#276749' }
    if (v <= 155) return { label: 'Hipernatrémia leve', color: '#d69e2e' }
    if (v <= 165) return { label: 'Hipernatrémia moderada', color: '#dd6b20' }
    return { label: 'Hipernatrémia grave', color: '#c53030' }
  }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Corrige o sódio medido para a hiperglicemia (fórmula de Katz). Essencial na cetoacidose diabética e estado hiperosmolar.</p>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        <div><label style={lbl}>Sódio medido (mEq/L)</label><input type="number" placeholder="Ex: 130" value={form.measured_na} onChange={e => setForm(p => ({ ...p, measured_na: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>Glicémia</label><input type="number" placeholder={form.unit === 'mg' ? 'Ex: 450' : 'Ex: 25'} value={form.glucose} onChange={e => setForm(p => ({ ...p, glucose: e.target.value }))} style={inp} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Unidade da glicémia</label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={inp}><option value="mg">mg/dL</option><option value="mmol">mmol/L</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular Sódio Corrigido</button>
      {result !== null && (() => {
        const i = interpret(result.corrected)
        return (
          <div style={resultBox(i.color)}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>SÓDIO CORRIGIDO (Fórmula de Katz)</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: i.color, marginBottom: 4 }}>{result.corrected.toFixed(1)} <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>mEq/L</span></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 8 }}>{i.label}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              Sódio medido: {form.measured_na} mEq/L · Correcção: +{result.delta.toFixed(1)} mEq/L
            </div>
            {result.corrected > 145 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.5)', borderRadius: 4, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                Na CAD, o sódio corrigido elevado indica depleção de água livre — repõe fluidos com monitorização horária.
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── NOVA: Glasgow Coma Scale ─────────────────────────────────────────────────
function GlasgowComaScale() {
  const [form, setForm] = useState({ eye: '4', verbal: '5', motor: '6' })
  const score = parseInt(form.eye) + parseInt(form.verbal) + parseInt(form.motor)
  const interpret = (s: number) => {
    if (s >= 13) return { label: 'TCE leve / Sem alteração significativa', color: '#276749', action: 'Observação, TC se critérios NICE/Canadian CT Head Rule.' }
    if (s >= 9) return { label: 'TCE moderado', color: '#d69e2e', action: 'TC-CE urgente. Internamento e monitorização neurológica.' }
    return { label: 'TCE grave / Coma', color: '#c53030', action: 'TC-CE imediata. Considerar intubação se GCS < 8. UCI neurocirúrgica.' }
  }
  const i = interpret(score)
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Escala de Coma de Glasgow — avaliação do nível de consciência em trauma e emergência.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div><label style={lbl}>E — Abertura Ocular</label><select value={form.eye} onChange={e => setForm(p => ({ ...p, eye: e.target.value }))} style={inp}><option value="4">4 — Espontânea</option><option value="3">3 — Ao som</option><option value="2">2 — À pressão</option><option value="1">1 — Ausente</option></select></div>
        <div><label style={lbl}>V — Resposta Verbal</label><select value={form.verbal} onChange={e => setForm(p => ({ ...p, verbal: e.target.value }))} style={inp}><option value="5">5 — Orientada</option><option value="4">4 — Confusa</option><option value="3">3 — Palavras isoladas</option><option value="2">2 — Sons incompreensíveis</option><option value="1">1 — Ausente</option></select></div>
        <div><label style={lbl}>M — Resposta Motora</label><select value={form.motor} onChange={e => setForm(p => ({ ...p, motor: e.target.value }))} style={inp}><option value="6">6 — Obedece a ordens</option><option value="5">5 — Localiza a dor</option><option value="4">4 — Flexão normal</option><option value="3">3 — Flexão anormal (decorticação)</option><option value="2">2 — Extensão (descerebração)</option><option value="1">1 — Ausente</option></select></div>
      </div>
      <div style={resultBox(i.color)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>GLASGOW COMA SCALE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>E{form.eye} + V{form.verbal} + M{form.motor}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 48, color: i.color, lineHeight: 1 }}>{score}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: i.color, marginBottom: 6 }}>{i.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, background: 'rgba(255,255,255,0.5)', borderRadius: 4, padding: '8px 12px' }}>{i.action}</div>
      </div>
    </div>
  )
}

// ─── NOVA: Clearance de Vancomicina (AUC-guided) ─────────────────────────────
function VancomycinDose() {
  const [form, setForm] = useState({ weight: '', age: '', creatinine: '', sex: 'male', infection: 'severe' })
  const [result, setResult] = useState<{ dose: number; interval: string; targetAUC: string; loading: number } | null>(null)
  const calc = () => {
    const w = parseFloat(form.weight), age = parseFloat(form.age), cr = parseFloat(form.creatinine)
    if (!w || !age || !cr) return
    // Clearance Vancomicina por Matzke
    const clcr = ((140 - age) * w) / (72 * cr) * (form.sex === 'female' ? 0.85 : 1)
    const vanccl = (0.689 * clcr) + 3.66  // mL/min
    const vd = 0.7 * w  // L (distribuição)
    const t12 = (0.693 * vd * 1000) / (vanccl * 60)  // horas
    // AUC target: ASHP/IDSA 2020 = 400-600 mg·h/L para MRSA
    // Dose = AUC_target × CL_vanc
    const targetAUC = form.infection === 'severe' ? 500 : 400  // mg·h/L
    const dailyDose = (targetAUC * vanccl * 60 / 1000)  // mg/dia
    // Arredonda para múltiplos de 250mg
    const doseRounded = Math.round(dailyDose / 250) * 250
    const interval = clcr > 70 ? 8 : clcr > 35 ? 12 : clcr > 15 ? 24 : 48
    const dosePer = Math.round(doseRounded / (24 / interval) / 250) * 250
    const loading = Math.min(3000, Math.round(25 * w / 250) * 250)
    setResult({ dose: dosePer, interval: `${interval}h`, targetAUC: `${targetAUC} mg·h/L`, loading })
  }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>Estimativa de dose inicial de vancomicina por AUC/MIC (ASHP/IDSA 2020). Requer monitorização farmacocinética com níveis séricos.</p>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'weight', label: 'Peso real (kg)', ph: 'Ex: 70' }, { key: 'age', label: 'Idade (anos)', ph: 'Ex: 65' }, { key: 'creatinine', label: 'Creatinina sérica (mg/dL)', ph: 'Ex: 1.0' }].map(({ key, label, ph }) => (
          <div key={key}><label style={lbl}>{label}</label><input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inp} /></div>
        ))}
        <div><label style={lbl}>Sexo</label><select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))} style={inp}><option value="male">Masculino</option><option value="female">Feminino</option></select></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Gravidade da infecção</label><select value={form.infection} onChange={e => setForm(p => ({ ...p, infection: e.target.value }))} style={inp}><option value="severe">Grave / MRSA suspeita — alvo AUC 500 mg·h/L</option><option value="moderate">Moderada — alvo AUC 400 mg·h/L</option></select></div>
      </div>
      <button onClick={calc} style={btn()}>Calcular Dose de Vancomicina</button>
      {result && (
        <div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', background: '#1d4ed8' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>DOSE ESTIMADA — VANCOMICINA (AUC-guided)</span></div>
            {[
              { label: 'Dose de carga', value: `${result.loading} mg IV`, note: '25–30 mg/kg, máx 3g — infundir em 60–120 min (máx 15 mg/min)' },
              { label: 'Dose de manutenção', value: `${result.dose} mg de ${result.interval}`, note: `Alvo AUC/MIC: ${result.targetAUC}` },
            ].map(({ label, value, note }, i) => (
              <div key={label} style={{ padding: '14px 16px', borderBottom: i === 0 ? '1px solid var(--border)' : 'none', background: 'white' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{note}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4 }}>
            <p style={{ fontSize: 11, color: '#92400e', margin: 0, lineHeight: 1.6 }}>Monitorizar AUC com 2 níveis séricos após 3ª–4ª dose (pico e vale). Ajustar dose para AUC 400–600 mg·h/L. Vigiar nefrotoxicidade (creatinina 2–3×/semana).</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────

const CALCULATORS = [
  { id: 'cha2ds2',   title: 'Risco de AVC na FA',            subtitle: 'CHA₂DS₂-VASc — ESC 2020',        tag: 'Cardiovascular', description: 'Score de risco tromboembólico em doentes com fibrilhação auricular. Indica necessidade de anticoagulação oral.', component: CHA2DS2VASc },
  { id: 'score2',    title: 'Risco Cardiovascular',           subtitle: 'SCORE2 — ESC 2021',               tag: 'Cardiovascular', description: 'Risco a 10 anos de evento CV fatal/não-fatal em doentes sem DCV estabelecida. Válido para 40–75 anos.', component: SCORE2Calc },
  { id: 'hasBled',   title: 'Risco Hemorrágico',             subtitle: 'HAS-BLED — ESC 2020',             tag: 'Cardiovascular', description: 'Score de risco hemorrágico em doentes anticoagulados com FA. Não contra-indica anticoagulação — identifica factores corrigíveis.', component: HASBLEDScore },
  { id: 'wells_pe',  title: 'Probabilidade de TEP',          subtitle: 'Wells Score — Tromboembolismo Pulmonar', tag: 'Hemato', description: 'Score de probabilidade pré-teste para TEP. Orienta pedido de D-dímeros e AngioTC segundo algoritmo ESC 2019.', component: WellsPE },
  { id: 'renal',     title: 'Ajuste de Dose Renal',          subtitle: 'IA + Guidelines',                 tag: 'Renal', description: 'Recomendação de ajuste posológico para qualquer medicamento com base na TFG/ClCr. Baseado em Micromedex e SmPC.', component: RenalDoseAdjust },
  { id: 'vancomycin',title: 'Dose de Vancomicina',           subtitle: 'AUC-guided — ASHP/IDSA 2020',     tag: 'Renal', description: 'Estimativa de dose inicial de vancomicina por AUC/MIC. Para MRSA e infecções graves. Requer monitorização com níveis séricos.', component: VancomycinDose },
  { id: 'cockcroft', title: 'Clearance de Creatinina',       subtitle: 'Cockcroft-Gault',                 tag: 'Renal', description: 'Estima a clearance de creatinina para ajuste de dose em insuficiência renal. Referência para maioria dos SmPC.', component: CockcroftGault },
  { id: 'egfr',      title: 'Taxa de Filtração Glomerular',  subtitle: 'CKD-EPI 2021',                    tag: 'Renal', description: 'Estima a TFG para estadiamento da DRC segundo KDIGO 2012. Referência para classificação de estádio G1-G5.', component: EGFRCalc },
  { id: 'sodium',    title: 'Sódio Corrigido',               subtitle: 'Hiperglicemia — Fórmula de Katz', tag: 'Metab', description: 'Corrige o sódio medido para a hiperglicemia. Essencial na CAD e estado hiperosmolar hiperglicémico.', component: SodiumCorrection },
  { id: 'child_pugh',title: 'Gravidade da Cirrose',          subtitle: 'Child-Pugh A/B/C',                tag: 'Gastro', description: 'Avalia a gravidade da cirrose hepática. Guia elegibilidade para transplante hepático e sobrevivência estimada.', component: ChildPugh },
  { id: 'glasgow',   title: 'Glasgow Coma Scale',            subtitle: 'GCS — E+V+M',                    tag: 'Neuro', description: 'Escala padronizada de avaliação do nível de consciência em trauma e emergência. Orienta decisão de intubação e TC-CE.', component: GlasgowComaScale },
  { id: 'opioid',    title: 'Conversão de Opióides',         subtitle: 'Equianalgesia · 10 fármacos',     tag: 'Dor', description: 'Converte doses entre morfina, fentanil, oxicodona, tramadol, buprenorfina e outros. Com factores de conversão validados.', component: OpioidConversion },
  { id: 'ibw',       title: 'Peso Ideal e Ajustado',         subtitle: 'IBW · ABW · LBW',                 tag: 'Geral', description: 'Calcula peso ideal (Devine), ajustado e magro (Janmahasatian). Essencial para doses de aminoglicosídeos, vancomicina.', component: IdealBodyWeight },
  { id: 'bmi',       title: 'Índice de Massa Corporal',      subtitle: 'IMC / BMI — OMS',                 tag: 'Geral', description: 'Calcula o IMC e classifica o estado ponderal segundo OMS. Base para estratificação de risco metabólico.', component: BMICalc },
  { id: 'pediatric', title: 'Dose Pediátrica',               subtitle: 'Young · Clark · Peso',            tag: 'Pediátrico', description: 'Estima doses pediátricas a partir da dose adulto por peso (Clark) e idade (Young). Estimativas orientativas.', component: PediatricDose },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Cardiovascular: { bg: '#fff1f2', color: '#9f1239' },
  Hemato:         { bg: '#fdf4ff', color: '#7e22ce' },
  Renal:          { bg: '#ebf8ff', color: '#2b6cb0' },
  Metab:          { bg: '#f0fff4', color: '#276749' },
  Gastro:         { bg: '#fef9c3', color: '#713f12' },
  Neuro:          { bg: '#eff6ff', color: '#1e40af' },
  Dor:            { bg: '#fdf4ff', color: '#7e22ce' },
  Geral:          { bg: '#f0fff4', color: '#276749' },
  Pediátrico:     { bg: '#fefce8', color: '#713f12' },
}

export default function CalculatorsPage() {
  const { user, supabase } = useAuth()
  const [active, setActive] = useState<string | null>(null)
  const [profileValues, setProfileValues] = useState<ProfileValues | undefined>(undefined)
  const [filter, setFilter] = useState<string>('Todos')
  const ActiveCalc = active ? CALCULATORS.find(c => c.id === active)?.component : null

  const tags = ['Todos', ...Array.from(new Set(CALCULATORS.map(c => c.tag)))]
  const filtered = filter === 'Todos' ? CALCULATORS : CALCULATORS.filter(c => c.tag === filter)

  const handleProfileSelect = async (profile: ActiveProfile) => {
    if (profile.type === 'self') { setProfileValues(undefined); return }
    const { data } = await supabase.from('family_profiles').select('age, weight, creatinine, sex').eq('id', profile.id).single()
    if (!data) return
    setProfileValues({ age: data.age?.toString() ?? undefined, weight: data.weight?.toString() ?? undefined, creatinine: data.creatinine?.toString() ?? undefined, sex: data.sex === 'F' ? 'female' : 'male' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {active && (
          <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 24, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar às calculadoras
          </button>
        )}

        {!active ? (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta 03</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>Calculadoras Clínicas</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
                {CALCULATORS.length} ferramentas de cálculo clínico. Scores validados com interpretação integrada.
              </p>
            </div>

            {user && (<div style={{ marginBottom: 20 }}><ProfileSelector onChange={handleProfileSelect} /></div>)}

            {/* Tag filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {tags.map(tag => {
                const isActive = filter === tag
                const tc = TAG_COLORS[tag] || { bg: '#f0fff4', color: '#276749' }
                return (
                  <button key={tag} onClick={() => setFilter(tag)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${isActive ? tc.color : 'var(--border)'}`, background: isActive ? tc.bg : 'white', color: isActive ? tc.color : 'var(--ink-4)', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', transition: 'all 0.12s' }}>
                    {tag}
                  </button>
                )
              })}
            </div>

            <div className="card-grid-2" style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
              {filtered.map(calc => {
                const tagStyle = TAG_COLORS[calc.tag] || TAG_COLORS['Geral']
                return (
                  <button key={calc.id} onClick={() => setActive(calc.id)}
                    style={{ background: 'white', border: 'none', padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', background: tagStyle.bg, color: tagStyle.color, padding: '3px 8px', borderRadius: 3 }}>{calc.tag}</span>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', lineHeight: 1.3 }}>{calc.title}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{calc.subtitle}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 2 }}>{calc.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--green-2)', fontWeight: 600, marginTop: 6 }}>Abrir →</div>
                  </button>
                )
              })}
            </div>

            <div style={{ padding: '14px 20px', background: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
                Ferramentas de apoio à decisão clínica. Não substituem o julgamento clínico nem a consulta de fontes primárias.
              </p>
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {ActiveCalc && (() => {
              const calc = CALCULATORS.find(c => c.id === active)!
              const tagStyle = TAG_COLORS[calc.tag] || TAG_COLORS['Geral']
              return (
                <>
                  <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', background: tagStyle.bg, color: tagStyle.color, padding: '3px 8px', borderRadius: 3, display: 'inline-block', marginBottom: 12 }}>{calc.tag}</span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>{calc.title}</h1>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginBottom: 8 }}>{calc.subtitle}</div>
                    <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{calc.description}</p>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '24px 20px' }}>
                    {active === 'cockcroft' ? <CockcroftGault profileValues={profileValues} /> :
                     active === 'egfr' ? <EGFRCalc profileValues={profileValues} /> :
                     <ActiveCalc />}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}