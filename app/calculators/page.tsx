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

// ─── CALCULATORS ────────────────────────────────────────────────────────────

function CockcroftGault({ profileValues }: { profileValues?: ProfileValues }) {
  const [form, setForm] = useState({ age: '', weight: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

  useEffect(() => {
    if (!profileValues) return
    setResult(null)
    setForm(p => ({
      age: profileValues.age ?? p.age,
      weight: profileValues.weight ?? p.weight,
      creatinine: profileValues.creatinine ?? p.creatinine,
      sex: profileValues.sex ?? p.sex,
    }))
  }, [profileValues])

  const calc = () => {
    const age = parseFloat(form.age), weight = parseFloat(form.weight), cr = parseFloat(form.creatinine)
    if (!age || !weight || !cr) return
    const base = ((140 - age) * weight) / (72 * cr)
    setResult(form.sex === 'female' ? base * 0.85 : base)
  }

  const interpret = (v: number) => {
    if (v >= 90) return { label: 'Normal', color: '#276749' }
    if (v >= 60) return { label: 'Ligeiramente reduzida', color: '#d69e2e' }
    if (v >= 30) return { label: 'Moderadamente reduzida', color: '#dd6b20' }
    if (v >= 15) return { label: 'Gravemente reduzida', color: '#c53030' }
    return { label: 'Falência renal', color: '#742a2a' }
  }

  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (anos)', placeholder: 'Ex: 65' }, { key: 'weight', label: 'Peso (kg)', placeholder: 'Ex: 70' }, { key: 'creatinine', label: 'Creatinina sérica (mg/dL)', placeholder: 'Ex: 1.2' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
          <select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular ClCr</button>
      {result !== null && (() => {
        const interp = interpret(result)
        return (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>RESULTADO</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: interp.color, marginBottom: 4 }}>{result.toFixed(1)} <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>mL/min</span></div>
            <div style={{ fontSize: 13, color: interp.color, fontWeight: 600, marginBottom: 8 }}>{interp.label}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>Fórmula de Cockcroft-Gault. Estima a clearance de creatinina para ajuste de dose em insuficiência renal.</div>
          </div>
        )
      })()}
    </div>
  )
}

function EGFRCalc({ profileValues }: { profileValues?: ProfileValues }) {
  const [form, setForm] = useState({ age: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

  useEffect(() => {
    if (!profileValues) return
    setResult(null)
    setForm(p => ({
      age: profileValues.age ?? p.age,
      creatinine: profileValues.creatinine ?? p.creatinine,
      sex: profileValues.sex ?? p.sex,
    }))
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
        {[{ key: 'age', label: 'Idade (anos)', placeholder: 'Ex: 55' }, { key: 'creatinine', label: 'Creatinina (mg/dL)', placeholder: 'Ex: 1.1' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
          <select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular TFGe (CKD-EPI 2021)</button>
      {result !== null && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>TAXA DE FILTRAÇÃO GLOMERULAR ESTIMADA</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: result >= 60 ? '#276749' : result >= 30 ? '#dd6b20' : '#c53030', marginBottom: 6 }}>{result.toFixed(0)} <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>mL/min/1.73m²</span></div>
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

  const calc = () => {
    const h = parseFloat(form.height) / 100, w = parseFloat(form.weight)
    if (!h || !w) return
    setResult(w / (h * h))
  }

  const interpret = (v: number) => {
    if (v < 18.5) return { label: 'Baixo peso', color: '#d69e2e' }
    if (v < 25) return { label: 'Peso normal', color: '#276749' }
    if (v < 30) return { label: 'Excesso de peso', color: '#dd6b20' }
    if (v < 35) return { label: 'Obesidade grau I', color: '#c53030' }
    if (v < 40) return { label: 'Obesidade grau II', color: '#c53030' }
    return { label: 'Obesidade grau III', color: '#742a2a' }
  }

  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'height', label: 'Altura (cm)', placeholder: 'Ex: 170' }, { key: 'weight', label: 'Peso (kg)', placeholder: 'Ex: 70' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular IMC</button>
      {result !== null && (() => {
        const interp = interpret(result)
        return (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>RESULTADO</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: interp.color, marginBottom: 4 }}>{result.toFixed(1)} <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>kg/m²</span></div>
            <div style={{ fontSize: 13, color: interp.color, fontWeight: 600 }}>{interp.label}</div>
          </div>
        )
      })()}
    </div>
  )
}

function PediatricDose() {
  const [form, setForm] = useState({ drug: '', adultDose: '', weight: '', age: '' })
  const [result, setResult] = useState<{ young: number; clark: number } | null>(null)

  const calc = () => {
    const adult = parseFloat(form.adultDose), weight = parseFloat(form.weight), age = parseFloat(form.age)
    if (!adult) return
    setResult({ young: age ? (adult * (age + 1)) / (age + 7) : 0, clark: weight ? (adult * weight) / 70 : 0 })
  }

  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'drug', label: 'Medicamento', placeholder: 'Ex: Paracetamol' }, { key: 'adultDose', label: 'Dose adulto (mg)', placeholder: 'Ex: 1000' }, { key: 'weight', label: 'Peso criança (kg)', placeholder: 'Ex: 20' }, { key: 'age', label: 'Idade criança (anos)', placeholder: 'Ex: 6' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type={key === 'drug' ? 'text' : 'number'} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular Dose Pediátrica</button>
      {result !== null && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {[{ label: 'Regra de Young (por idade)', value: result.young, note: 'Dose adulto × (Idade+1) / (Idade+7)' }, { label: 'Regra de Clark (por peso)', value: result.clark, note: 'Dose adulto × Peso / 70' }].filter(r => r.value > 0).map(({ label, value, note }, i, arr) => (
            <div key={label} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>{value.toFixed(1)} mg</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{note}</div>
            </div>
          ))}
          <div style={{ padding: '12px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
            <p style={{ fontSize: 11, color: '#92400e', margin: 0, lineHeight: 1.6 }}>⚠️ Estimativas orientativas. Confirma sempre com a bula e consulta um profissional de saúde.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NOVA: Conversão de Opióides ─────────────────────────────────────────────
const OPIOID_TABLE: Record<string, { oral: number; iv: number; label: string }> = {
  morphine_oral:    { oral: 1,     iv: 0,    label: 'Morfina oral' },
  morphine_iv:      { oral: 0,     iv: 1,    label: 'Morfina IV/SC' },
  oxycodone_oral:   { oral: 1.5,   iv: 0,    label: 'Oxicodona oral' },
  hydromorphone_oral:{ oral: 5,    iv: 0,    label: 'Hidromorfona oral' },
  hydromorphone_iv: { oral: 0,     iv: 5,    label: 'Hidromorfona IV' },
  fentanyl_patch:   { oral: 0,     iv: 100,  label: 'Fentanil transdérmico (µg/h)' },
  tramadol_oral:    { oral: 0.1,   iv: 0,    label: 'Tramadol oral' },
  codeine_oral:     { oral: 0.15,  iv: 0,    label: 'Codeína oral' },
  buprenorphine_sl: { oral: 0,     iv: 75,   label: 'Buprenorfina sublingual' },
  tapentadol_oral:  { oral: 0.4,   iv: 0,    label: 'Tapentadol oral' },
}

function OpioidConversion() {
  const [from, setFrom] = useState('morphine_oral')
  const [dose, setDose] = useState('')
  const [results, setResults] = useState<{ label: string; dose: number; unit: string }[] | null>(null)

  const calc = () => {
    const d = parseFloat(dose)
    if (!d || d <= 0) return
    const src = OPIOID_TABLE[from]
    // Converter para MME (Morphine Milligram Equivalents)
    const mme = from === 'fentanyl_patch'
      ? d * 2.4  // µg/h patch → MME/dia (aprox 2.4 factor)
      : d * (src.oral || src.iv)

    const out: { label: string; dose: number; unit: string }[] = []
    for (const [key, val] of Object.entries(OPIOID_TABLE)) {
      if (key === from) continue
      if (key === 'fentanyl_patch') {
        const patchDose = mme / 2.4
        out.push({ label: val.label, dose: patchDose, unit: 'µg/h' })
      } else {
        const equiv = val.oral > 0 ? mme / val.oral : val.iv > 0 ? mme / val.iv : 0
        if (equiv > 0) out.push({ label: val.label, dose: equiv, unit: 'mg' })
      }
    }
    setResults(out)
  }

  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Opióide actual</label>
          <select value={from} onChange={e => { setFrom(e.target.value); setResults(null) }}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            {Object.entries(OPIOID_TABLE).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Dose actual ({from === 'fentanyl_patch' ? 'µg/h' : 'mg/dia'})
          </label>
          <input type="number" placeholder={from === 'fentanyl_patch' ? 'Ex: 25' : 'Ex: 60'} value={dose} onChange={e => setDose(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular Equivalências</button>
      {results && (
        <div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', background: 'var(--green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>EQUIVALÊNCIAS EQUIANALGÉSICAS</span>
            </div>
            {results.map(({ label, dose: d, unit }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', background: 'white' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 700 }}>{d.toFixed(1)} <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{unit}</span></span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4 }}>
            <p style={{ fontSize: 11, color: '#742a2a', margin: 0, lineHeight: 1.6 }}>⚠️ Reduz sempre 25–50% na rotação de opióides para tolerância cruzada incompleta. Individualiza sempre a dose. Uso exclusivo por profissionais de saúde.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NOVA: Peso Ideal + Peso Ajustado ────────────────────────────────────────
function IdealBodyWeight() {
  const [form, setForm] = useState({ height: '', weight: '', sex: 'male' })
  const [result, setResult] = useState<{ ibw: number; abw: number; lbw: number; bmi: number } | null>(null)

  const calc = () => {
    const h = parseFloat(form.height), w = parseFloat(form.weight)
    if (!h || !w || h < 100) return
    const hIn = h / 2.54  // cm → inches
    const base = form.sex === 'male' ? 50 : 45.5
    const ibw = Math.max(0, base + 2.3 * (hIn - 60))
    const abw = ibw + 0.4 * (w - ibw)
    const lbw = form.sex === 'male'
      ? (9270 * w) / (6680 + 216 * (w / ((h / 100) ** 2)))
      : (9270 * w) / (8780 + 244 * (w / ((h / 100) ** 2)))
    const bmi = w / ((h / 100) ** 2)
    setResult({ ibw, abw, lbw, bmi })
  }

  return (
    <div>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'height', label: 'Altura (cm)', placeholder: 'Ex: 170' }, { key: 'weight', label: 'Peso actual (kg)', placeholder: 'Ex: 100' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
          <select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular Pesos</button>
      {result && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { label: 'Peso Ideal (IBW)', value: result.ibw, note: 'Devine — usado para aminoglicosídeos, vancomicina, digoxina', color: 'var(--green-2)' },
            { label: 'Peso Ajustado (ABW)', value: result.abw, note: 'Usar quando peso actual > 130% do IBW (ex: fluoroquinolonas, heparina)', color: '#d69e2e' },
            { label: 'Peso Magro (LBW)', value: result.lbw, note: 'Janmahasatian — útil para propofol e barbitúricos', color: '#2b6cb0' },
          ].map(({ label, value, note, color }, i) => (
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

// ─── NOVA: Score HAS-BLED ────────────────────────────────────────────────────
const HAS_BLED_CRITERIA = [
  { key: 'hypertension', label: 'H — Hipertensão não controlada', desc: 'TAS > 160 mmHg', points: 1 },
  { key: 'renal', label: 'A — Disfunção renal', desc: 'Creatinina > 2.26 mg/dL ou diálise', points: 1 },
  { key: 'liver', label: 'A — Disfunção hepática', desc: 'Cirrose ou bilirrubina > 2× + AST/ALT > 3×', points: 1 },
  { key: 'stroke', label: 'S — AVC prévio', desc: 'História de AVC', points: 1 },
  { key: 'bleeding', label: 'B — Hemorragia prévia ou predisposição', desc: 'Úlcera, diátese hemorrágica, anemia', points: 1 },
  { key: 'labile_inr', label: 'L — INR lábil', desc: 'INR instável / tempo em zona terapêutica < 60%', points: 1 },
  { key: 'elderly', label: 'E — Idade > 65 anos', desc: 'Ou fragilidade extrema', points: 1 },
  { key: 'drugs', label: 'D — Fármacos hemorrágicos', desc: 'AINEs, antiagregantes plaquetários', points: 1 },
  { key: 'alcohol', label: 'D — Álcool', desc: '≥ 8 bebidas/semana', points: 1 },
]

function HASBLEDScore() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const score = Object.entries(checks).filter(([, v]) => v).length

  const interpret = (s: number) => {
    if (s === 0) return { label: 'Baixo risco', color: '#276749', note: 'Anticoagulação recomendada se indicada' }
    if (s === 1) return { label: 'Risco intermédio', color: '#d69e2e', note: 'Anticoagulação pode ser considerada' }
    if (s === 2) return { label: 'Risco intermédio-alto', color: '#dd6b20', note: 'Vigilância clínica recomendada' }
    return { label: 'Alto risco hemorrágico', color: '#c53030', note: 'Corrigir factores de risco modificáveis. Não contra-indica anticoagulação per se.' }
  }

  const interp = interpret(score)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Score de risco hemorrágico em doentes anticoagulados com FA. Selecciona os critérios presentes.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {HAS_BLED_CRITERIA.map(({ key, label, desc }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: checks[key] ? 'var(--green-light)' : 'white', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checks[key]} onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))}
              style={{ marginTop: 2, accentColor: 'var(--green)', flexShrink: 0, width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: checks[key] ? 'var(--green)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div>
            </div>
          </label>
        ))}
      </div>
      <div style={{ background: 'var(--bg-2)', border: `2px solid ${interp.color}`, borderRadius: 6, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>SCORE HAS-BLED</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: interp.color, fontWeight: 700 }}>{score}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: interp.color, marginBottom: 6 }}>{interp.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{interp.note}</div>
      </div>
    </div>
  )
}

// ─── NOVA: SCORE2 Risco Cardiovascular ───────────────────────────────────────
function SCORE2Calc() {
  const [form, setForm] = useState({ age: '', sbp: '', cholesterol: '', hdl: '', sex: 'male', smoker: 'no', region: 'high' })
  const [result, setResult] = useState<number | null>(null)

  // SCORE2 simplificado (equação logística ESC 2021, região de risco alto — Portugal)
  const calc = () => {
    const age = parseFloat(form.age)
    const sbp = parseFloat(form.sbp)
    const chol = parseFloat(form.cholesterol)  // mmol/L
    const hdl = parseFloat(form.hdl)           // mmol/L
    if (!age || !sbp || !chol || !hdl) return
    if (age < 40 || age > 75) { setResult(-1); return }

    const male = form.sex === 'male'
    const smoker = form.smoker === 'yes'

    // Coeficientes SCORE2 (região alto risco, ESC 2021)
    const lp = male
      ? 0.3742 * (age - 60) / 5 + 0.6012 * (sbp - 120) / 20 + 0.2777 * (chol - 6) + (-0.1458) * (hdl - 1.3) + 0.7937 * (smoker ? 1 : 0)
      : 0.4648 * (age - 60) / 5 + 0.7744 * (sbp - 120) / 20 + 0.1102 * (chol - 6) + (-0.1988) * (hdl - 1.3) + 0.8078 * (smoker ? 1 : 0)

    const baselineS10 = male ? 0.9605 : 0.9776
    const risk = 1 - Math.pow(baselineS10, Math.exp(lp))
    setResult(Math.max(0, Math.min(1, risk)) * 100)
  }

  const interpret = (v: number) => {
    if (v < 2.5) return { label: 'Baixo risco', color: '#276749', note: 'Manter estilo de vida saudável' }
    if (v < 7.5) return { label: 'Risco moderado', color: '#d69e2e', note: 'Considerar intervenção no estilo de vida. Estatina pode ser benéfica.' }
    if (v < 15) return { label: 'Alto risco', color: '#dd6b20', note: 'Terapêutica farmacológica recomendada. Alvo LDL < 1.8 mmol/L.' }
    return { label: 'Muito alto risco', color: '#c53030', note: 'Terapêutica intensiva. Alvo LDL < 1.4 mmol/L. Encaminhar para especialidade.' }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Risco a 10 anos de evento cardiovascular fatal ou não-fatal. Guidelines ESC 2021. Válido para 40–75 anos sem DCV estabelecida.
      </p>
      <div className="card-grid-2" style={{ marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (40–75 anos)', placeholder: 'Ex: 55' }, { key: 'sbp', label: 'TAS sistólica (mmHg)', placeholder: 'Ex: 140' }, { key: 'cholesterol', label: 'Colesterol total (mmol/L)', placeholder: 'Ex: 5.5' }, { key: 'hdl', label: 'HDL-c (mmol/L)', placeholder: 'Ex: 1.2' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" step="0.1" placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
          <select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Fumador</label>
          <select value={form.smoker} onChange={e => setForm(p => ({ ...p, smoker: e.target.value }))}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </div>
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Calcular Risco SCORE2</button>
      {result !== null && (
        result === -1 ? (
          <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '14px 16px', fontSize: 13, color: '#742a2a' }}>
            SCORE2 válido apenas para idades entre 40 e 75 anos.
          </div>
        ) : (() => {
          const interp = interpret(result)
          return (
            <div style={{ background: 'var(--bg-2)', border: `2px solid ${interp.color}`, borderRadius: 6, padding: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>RISCO CARDIOVASCULAR A 10 ANOS (SCORE2)</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: interp.color, marginBottom: 6 }}>{result.toFixed(1)}<span style={{ fontSize: 20 }}>%</span></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: interp.color, marginBottom: 8 }}>{interp.label}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{interp.note}</div>
            </div>
          )
        })()
      )}
    </div>
  )
}

// ─── NOVA: Ajuste de Dose Renal (IA) ─────────────────────────────────────────
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
      const res = await fetch('/api/calculators/renal-dose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug: drug.trim(), egfr: parseFloat(egfr) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.recommendation)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally {
      setLoading(false) }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Recomendação de ajuste de dose baseada em guidelines (Micromedex, SmPC, UpToDate). Resultados gerados por IA — confirma sempre com fontes primárias.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Medicamento</label>
          <input type="text" placeholder="Ex: metformina, vancomicina, ciprofloxacina..." value={drug} onChange={e => setDrug(e.target.value)} onKeyDown={e => e.key === 'Enter' && calc()}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>TFG / ClCr (mL/min)</label>
          <input type="number" placeholder="Ex: 35" value={egfr} onChange={e => setEgfr(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>
      </div>
      <button onClick={calc} disabled={!drug.trim() || !egfr || loading}
        style={{ width: '100%', background: drug.trim() && egfr && !loading ? 'var(--green)' : 'var(--bg-3)', color: drug.trim() && egfr && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: drug.trim() && egfr && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
        {loading ? 'A consultar guidelines...' : 'Obter Recomendação'}
      </button>
      {error && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '12px 16px', fontSize: 13, color: '#742a2a' }}>{error}</div>}
      {result && (
        <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderLeft: '4px solid var(--green)', borderRadius: 4, padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', marginBottom: 8 }}>RECOMENDAÇÃO — TFG {egfr} mL/min</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{result}</p>
          <p style={{ fontSize: 11, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--font-mono)' }}>⚠️ Confirma sempre com o SmPC do medicamento e com um farmacêutico.</p>
        </div>
      )}
    </div>
  )
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────

const CALCULATORS = [
  { id: 'score2',    title: 'Risco Cardiovascular',       subtitle: 'SCORE2 — ESC 2021',              tag: 'Cardiovascular', description: 'Risco a 10 anos de evento CV fatal/não-fatal. Guidelines ESC. Válido para 40–75 anos sem DCV estabelecida.', component: SCORE2Calc },
  { id: 'hasBled',   title: 'Risco Hemorrágico',          subtitle: 'HAS-BLED',                        tag: 'Cardiovascular', description: 'Score de risco hemorrágico em doentes anticoagulados com fibrilhação auricular.', component: HASBLEDScore },
  { id: 'opioid',    title: 'Conversão de Opióides',      subtitle: 'Equianalgesia · 10 fármacos',     tag: 'Dor', description: 'Converte doses entre morfina, fentanil, oxicodona, tramadol, buprenorfina e outros. Com factores de conversão validados.', component: OpioidConversion },
  { id: 'renal',     title: 'Ajuste de Dose Renal',       subtitle: 'IA + Guidelines',                 tag: 'Renal', description: 'Recomendação de ajuste posológico para qualquer medicamento com base na TFG/ClCr. Baseado em Micromedex e SmPC.', component: RenalDoseAdjust },
  { id: 'ibw',       title: 'Peso Ideal e Ajustado',      subtitle: 'IBW · ABW · LBW (Devine/Janmahasatian)', tag: 'Geral', description: 'Calcula peso ideal, ajustado e magro. Essencial para doses de aminoglicosídeos, vancomicina e fármacos em obesos.', component: IdealBodyWeight },
  { id: 'cockcroft', title: 'Clearance de Creatinina',    subtitle: 'Cockcroft-Gault',                 tag: 'Renal', description: 'Estima a clearance de creatinina para ajuste de dose em insuficiência renal.', component: CockcroftGault },
  { id: 'egfr',      title: 'Taxa de Filtração Glomerular', subtitle: 'CKD-EPI 2021',                  tag: 'Renal', description: 'Estima a TFG para estadiamento da doença renal crónica segundo KDIGO.', component: EGFRCalc },
  { id: 'bmi',       title: 'Índice de Massa Corporal',   subtitle: 'IMC / BMI',                       tag: 'Geral', description: 'Calcula o IMC e classifica o peso corporal segundo a OMS.', component: BMICalc },
  { id: 'pediatric', title: 'Dose Pediátrica',             subtitle: 'Young · Clark · Peso',            tag: 'Pediátrico', description: 'Estima doses pediátricas a partir da dose adulto por peso e idade.', component: PediatricDose },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Cardiovascular: { bg: '#fff1f2', color: '#9f1239' },
  Dor:            { bg: '#fdf4ff', color: '#7e22ce' },
  Renal:          { bg: '#ebf8ff', color: '#2b6cb0' },
  Geral:          { bg: '#f0fff4', color: '#276749' },
  Pediátrico:     { bg: '#fefce8', color: '#713f12' },
}

export default function CalculatorsPage() {
  const { user, supabase } = useAuth()
  const [active, setActive] = useState<string | null>(null)
  const [profileValues, setProfileValues] = useState<ProfileValues | undefined>(undefined)
  const ActiveCalc = active ? CALCULATORS.find(c => c.id === active)?.component : null

  const handleProfileSelect = async (profile: ActiveProfile) => {
    if (profile.type === 'self') { setProfileValues(undefined); return }
    const { data } = await supabase.from('family_profiles').select('age, weight, creatinine, sex').eq('id', profile.id).single()
    if (!data) return
    setProfileValues({
      age: data.age?.toString() ?? undefined,
      weight: data.weight?.toString() ?? undefined,
      creatinine: data.creatinine?.toString() ?? undefined,
      sex: data.sex === 'F' ? 'female' : 'male',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {active && (
          <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 24, padding: 0 }}>
            ← Voltar às calculadoras
          </button>
        )}

        {!active ? (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta 03</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>Calculadoras Clínicas</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
                {CALCULATORS.length} ferramentas de cálculo clínico. Sem anúncios, sem registo obrigatório.
              </p>
            </div>
            {user && (
              <div style={{ marginBottom: 20 }}>
                <ProfileSelector onChange={handleProfileSelect} />
              </div>
            )}

            <div className="card-grid-2" style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
              {CALCULATORS.map(calc => {
                const tagStyle = TAG_COLORS[calc.tag] || TAG_COLORS['Geral']
                return (
                  <button key={calc.id} onClick={() => setActive(calc.id)}
                    style={{ background: 'white', border: 'none', padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                ⚠️ Ferramentas de apoio à decisão clínica. Não substituem o julgamento clínico nem a consulta de fontes primárias.
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
                    {(active === 'cockcroft') ? (
                      <CockcroftGault profileValues={profileValues} />
                    ) : (active === 'egfr') ? (
                      <EGFRCalc profileValues={profileValues} />
                    ) : (
                      <ActiveCalc />
                    )}
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