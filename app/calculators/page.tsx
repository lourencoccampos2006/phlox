'use client'

import { useState } from 'react'
import Header from '@/components/Header'

function CockcroftGault() {
  const [form, setForm] = useState({ age: '', weight: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[
          { key: 'age', label: 'Idade (anos)', placeholder: 'Ex: 65' },
          { key: 'weight', label: 'Peso (kg)', placeholder: 'Ex: 70' },
          { key: 'creatinine', label: 'Creatinina sérica (mg/dL)', placeholder: 'Ex: 1.2' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
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
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
        Calcular ClCr
      </button>
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

function EGFRCalc() {
  const [form, setForm] = useState({ age: '', creatinine: '', sex: 'male' })
  const [result, setResult] = useState<number | null>(null)

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[{ key: 'age', label: 'Idade (anos)', placeholder: 'Ex: 55' }, { key: 'creatinine', label: 'Creatinina (mg/dL)', placeholder: 'Ex: 1.1' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
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
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
        Calcular TFGe (CKD-EPI 2021)
      </button>
      {result !== null && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>TAXA DE FILTRAÇÃO GLOMERULAR ESTIMADA</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: result >= 60 ? '#276749' : result >= 30 ? '#dd6b20' : '#c53030', marginBottom: 6 }}>{result.toFixed(0)} <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>mL/min/1.73m²</span></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{stage(result)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Fórmula CKD-EPI 2021 — referência para estadiamento da DRC segundo KDIGO</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[{ key: 'height', label: 'Altura (cm)', placeholder: 'Ex: 170' }, { key: 'weight', label: 'Peso (kg)', placeholder: 'Ex: 70' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type="number" placeholder={placeholder} value={form[key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
        Calcular IMC
      </button>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[{ key: 'drug', label: 'Medicamento', placeholder: 'Ex: Paracetamol' }, { key: 'adultDose', label: 'Dose adulto (mg)', placeholder: 'Ex: 1000' }, { key: 'weight', label: 'Peso criança (kg)', placeholder: 'Ex: 20' }, { key: 'age', label: 'Idade criança (anos)', placeholder: 'Ex: 6' }].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
            <input type={key === 'drug' ? 'text' : 'number'} placeholder={placeholder} value={form[key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
      </div>
      <button onClick={calc} style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
        Calcular Dose Pediátrica
      </button>
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

const CALCULATORS = [
  { id: 'cockcroft', title: 'Clearance de Creatinina', subtitle: 'Fórmula de Cockcroft-Gault', tag: 'Renal', description: 'Estima a clearance de creatinina para ajuste de dose em insuficiência renal.', component: CockcroftGault },
  { id: 'egfr', title: 'Taxa de Filtração Glomerular', subtitle: 'CKD-EPI 2021', tag: 'Renal', description: 'Estima a TFG para estadiamento da doença renal crónica segundo KDIGO.', component: EGFRCalc },
  { id: 'bmi', title: 'Índice de Massa Corporal', subtitle: 'IMC / BMI', tag: 'Geral', description: 'Calcula o IMC e classifica o peso corporal.', component: BMICalc },
  { id: 'pediatric', title: 'Dose Pediátrica', subtitle: 'Young · Clark · Peso', tag: 'Pediátrico', description: 'Estima doses pediátricas a partir da dose adulta.', component: PediatricDose },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Renal: { bg: '#ebf8ff', color: '#2b6cb0' },
  Geral: { bg: '#f0fff4', color: '#276749' },
  Pediátrico: { bg: '#fefce8', color: '#713f12' },
}

export default function CalculatorsPage() {
  const [active, setActive] = useState<string | null>(null)
  const ActiveCalc = active ? CALCULATORS.find(c => c.id === active)?.component : null

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        {active && (
          <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 24, padding: 0 }}>
            ← Voltar
          </button>
        )}

        {!active ? (
          <>
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 12 }}>Ferramenta 03</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>Calculadoras Clínicas</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 560 }}>Ferramentas de cálculo clínico para farmacêuticos, médicos e estudantes. Sem anúncios, sem registo.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {CALCULATORS.map(calc => {
                const tagStyle = TAG_COLORS[calc.tag] || TAG_COLORS['Geral']
                return (
                  <button key={calc.id} onClick={() => setActive(calc.id)}
                    style={{ background: 'white', border: 'none', padding: '24px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', background: tagStyle.bg, color: tagStyle.color, padding: '3px 8px', borderRadius: 3 }}>{calc.tag}</span>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.3 }}>{calc.title}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{calc.subtitle}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 4 }}>{calc.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--green-2)', fontWeight: 600, marginTop: 8 }}>Abrir calculadora →</div>
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 24, padding: '14px 20px', background: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
                ⚠️ Ferramentas de apoio à decisão clínica. Não substituem o julgamento clínico.
              </p>
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 700 }}>
            {ActiveCalc && (() => {
              const calc = CALCULATORS.find(c => c.id === active)!
              const tagStyle = TAG_COLORS[calc.tag] || TAG_COLORS['Geral']
              return (
                <>
                  <div style={{ marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', background: tagStyle.bg, color: tagStyle.color, padding: '3px 8px', borderRadius: 3, display: 'inline-block', marginBottom: 12 }}>{calc.tag}</span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>{calc.title}</h1>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginBottom: 8 }}>{calc.subtitle}</div>
                    <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{calc.description}</p>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '28px' }}>
                    <ActiveCalc />
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