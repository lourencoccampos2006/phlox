'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcMode = 'volume' | 'infusion' | 'reconstitution' | 'reference'

// ─── Quick Reference Data ─────────────────────────────────────────────────────

const QUICK_REF = [
  { drug: 'Dopamina',       conc: '200 mg em 50 mL SGD 5%',  result: '4 mg/mL',     note: 'Risco de extravasamento — via central preferida' },
  { drug: 'Noradrenalina',  conc: '4 mg em 50 mL SF',         result: '80 mcg/mL',   note: 'Sempre via central; titular para PAM > 65 mmHg' },
  { drug: 'Adrenalina',     conc: '1 mg em 50 mL SF',         result: '20 mcg/mL',   note: 'Preparação de emergência — infusão contínua' },
  { drug: 'Morfina',        conc: '10 mg em 10 mL SF',        result: '1 mg/mL',     note: 'Titular em bolus de 2 mg IV; início 5 min' },
  { drug: 'Heparina',       conc: '25 000 UI em 50 mL SF',    result: '500 UI/mL',   note: 'Protocolo APTT obrigatório' },
  { drug: 'Insulina',       conc: '50 UI em 50 mL SF',        result: '1 UI/mL',     note: 'Nunca misturar com outras drogas; monitorizar glicemia horária' },
  { drug: 'Midazolam',      conc: '50 mg em 50 mL SF',        result: '1 mg/mL',     note: 'Titular para RASS -1 a -2' },
  { drug: 'Propofol',       conc: '200 mg em 20 mL',          result: '10 mg/mL',    note: 'Não exceder 4 mg/kg/h; vigiar triglicéridos' },
  { drug: 'Amiodarona',     conc: '300 mg em 250 mL SGD 5%',  result: '1.2 mg/mL',   note: 'Bolus 300mg em 20 min depois 900mg/24h' },
  { drug: 'Furosemida',     conc: '250 mg em 50 mL SF',       result: '5 mg/mL',     note: 'Não exceder 4 mg/min em infusão IV' },
  { drug: 'Fentanil',       conc: '0.5 mg em 50 mL SF',       result: '10 mcg/mL',   note: 'Analgesia pós-op: 25 mcg/h titulação' },
  { drug: 'Labetalol',      conc: '200 mg em 200 mL SF',      result: '1 mg/mL',     note: 'Crise HTA; iniciar 0.5-2 mg/min' },
  { drug: 'Nitroglicerina', conc: '50 mg em 50 mL SGD 5%',   result: '1 mg/mL',     note: 'Titular para alívio de dor ou PA desejada; fotossensível' },
  { drug: 'Vasopressina',   conc: '20 UI em 50 mL SF',        result: '0.4 UI/mL',   note: 'Choque séptico: 0.03-0.04 UI/min fixo' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: string) => parseFloat(v.replace(',', '.')) || 0

function field(label: string, value: string, onChange: (v: string) => void, unit?: string, placeholder?: string) {
  return (
    <div>
      <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '0'}
          inputMode="decimal"
          style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: unit ? '7px 0 0 7px' : 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white', width: '100%' }} />
        {unit && (
          <span style={{ background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderLeft: 'none', borderRadius: '0 7px 7px 0', padding: '10px 12px', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

function ResultBox({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#eff6ff' : 'var(--bg-2)', border: `1.5px solid ${highlight ? '#bfdbfe' : 'var(--border)'}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: highlight ? '#1d4ed8' : 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-serif)', color: highlight ? '#1d4ed8' : 'var(--ink)', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: highlight ? '#3b82f6' : 'var(--ink-3)', marginLeft: 6 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ─── Volume calculator (dose → volume to give) ────────────────────────────────

function VolumeCalc() {
  const [dose, setDose] = useState('')
  const [doseUnit, setDoseUnit] = useState<'mg' | 'mcg' | 'g' | 'UI'>('mg')
  const [conc, setConc] = useState('')
  const [concUnit, setConcUnit] = useState<'mg/mL' | 'mcg/mL' | 'g/L' | 'UI/mL'>('mg/mL')
  const [weight, setWeight] = useState('')
  const [perKg, setPerKg] = useState(false)

  const convFactor: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000, UI: 1 }
  const concFactor: Record<string, number> = { 'mg/mL': 1, 'mcg/mL': 0.001, 'g/L': 1, 'UI/mL': 1 }

  const doseInMg = n(dose) * (perKg ? n(weight) : 1) * convFactor[doseUnit]
  const concInMgPerMl = n(conc) * concFactor[concUnit]
  const volume = concInMgPerMl > 0 ? doseInMg / concInMgPerMl : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
        <strong>Fórmula:</strong> Volume (mL) = Dose ÷ Concentração
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Dose prescrita</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={dose} onChange={e => setDose(e.target.value)} placeholder="0" inputMode="decimal"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 0 }} />
            <select value={doseUnit} onChange={e => setDoseUnit(e.target.value as any)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 8px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
              {['mg','mcg','g','UI'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Concentração disponível</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={conc} onChange={e => setConc(e.target.value)} placeholder="0" inputMode="decimal"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 0 }} />
            <select value={concUnit} onChange={e => setConcUnit(e.target.value as any)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 8px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
              {['mg/mL','mcg/mL','g/L','UI/mL'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>
          <input type="checkbox" checked={perKg} onChange={e => setPerKg(e.target.checked)} style={{ width: 16, height: 16 }} />
          Dose por kg de peso
        </label>
        {perKg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="Peso" inputMode="decimal"
              style={{ width: 80, border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>kg</span>
          </div>
        )}
      </div>

      {volume !== null && !isNaN(volume) && volume > 0 && (
        <ResultBox label="Volume a administrar" value={volume.toFixed(2)} unit="mL" highlight />
      )}
    </div>
  )
}

// ─── Infusion rate calculator ──────────────────────────────────────────────────

function InfusionCalc() {
  const [dose, setDose] = useState('')
  const [doseUnit, setDoseUnit] = useState<'mcg/kg/min' | 'mg/kg/h' | 'UI/h' | 'mg/h'>('mcg/kg/min')
  const [weight, setWeight] = useState('')
  const [conc, setConc] = useState('')
  const [concUnit, setConcUnit] = useState<'mg/mL' | 'mcg/mL' | 'UI/mL'>('mg/mL')

  let rateMLH: number | null = null

  const d = n(dose), w = n(weight), c = n(conc)
  if (d > 0 && c > 0) {
    if (doseUnit === 'mcg/kg/min') {
      // mcg/kg/min → mg/h: × weight × 60 / 1000
      // mL/h = mg/h / conc_mg_mL
      const concMgMl = concUnit === 'mcg/mL' ? c / 1000 : c
      rateMLH = (d * (w || 1) * 60) / (1000 * concMgMl)
    } else if (doseUnit === 'mg/kg/h') {
      const concMgMl = concUnit === 'mcg/mL' ? c / 1000 : c
      rateMLH = (d * (w || 1)) / concMgMl
    } else if (doseUnit === 'UI/h') {
      const concUiMl = concUnit === 'UI/mL' ? c : 1
      rateMLH = d / concUiMl
    } else { // mg/h
      const concMgMl = concUnit === 'mcg/mL' ? c / 1000 : c
      rateMLH = d / concMgMl
    }
  }

  const needsWeight = doseUnit === 'mcg/kg/min' || doseUnit === 'mg/kg/h'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
        <strong>Fórmula:</strong> Taxa (mL/h) = Dose × Peso × 60 ÷ (1000 × Concentração) [para mcg/kg/min]
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: needsWeight ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Dose</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={dose} onChange={e => setDose(e.target.value)} placeholder="0" inputMode="decimal"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 0 }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Unidade da dose</label>
          <select value={doseUnit} onChange={e => setDoseUnit(e.target.value as any)}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
            {['mcg/kg/min','mg/kg/h','mg/h','UI/h'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {needsWeight && (
          <div>
            {field('Peso', weight, setWeight, 'kg', '70')}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          {field('Concentração da solução', conc, setConc, undefined, '0')}
        </div>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Unidade concentração</label>
          <select value={concUnit} onChange={e => setConcUnit(e.target.value as any)}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
            {['mg/mL','mcg/mL','UI/mL'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {rateMLH !== null && !isNaN(rateMLH) && rateMLH > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ResultBox label="Taxa de infusão" value={rateMLH.toFixed(2)} unit="mL/h" highlight />
          <ResultBox label="Gotas/min (macrogotas)" value={(rateMLH / 3).toFixed(1)} unit="gts/min" />
        </div>
      )}
    </div>
  )
}

// ─── Reconstitution calculator ────────────────────────────────────────────────

function ReconstitutionCalc() {
  const [powderMg, setPowderMg] = useState('')
  const [powderUnit, setPowderUnit] = useState<'mg' | 'g' | 'UI'>('mg')
  const [targetConc, setTargetConc] = useState('')
  const [targetUnit, setTargetUnit] = useState<'mg/mL' | 'g/L' | 'UI/mL'>('mg/mL')

  const convFactor: Record<string, number> = { mg: 1, g: 1000, UI: 1 }
  const concFactor: Record<string, number> = { 'mg/mL': 1, 'g/L': 1, 'UI/mL': 1 }

  const massInMg = n(powderMg) * convFactor[powderUnit]
  const concInMgMl = n(targetConc) * concFactor[targetUnit]
  const diluentVol = concInMgMl > 0 ? massInMg / concInMgMl : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#854d0e' }}>
        <strong>Fórmula:</strong> Volume de diluente (mL) = Massa ÷ Concentração desejada
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Pó para reconstituir</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={powderMg} onChange={e => setPowderMg(e.target.value)} placeholder="0" inputMode="decimal"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 0 }} />
            <select value={powderUnit} onChange={e => setPowderUnit(e.target.value as any)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 8px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
              {['mg','g','UI'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Concentração desejada</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={targetConc} onChange={e => setTargetConc(e.target.value)} placeholder="0" inputMode="decimal"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 0 }} />
            <select value={targetUnit} onChange={e => setTargetUnit(e.target.value as any)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 8px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', background: 'white' }}>
              {['mg/mL','g/L','UI/mL'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {diluentVol !== null && !isNaN(diluentVol) && diluentVol > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <ResultBox label="Diluente a adicionar" value={diluentVol.toFixed(2)} unit="mL" highlight />
          <ResultBox label="Volume final" value={diluentVol.toFixed(2)} unit="mL" />
          <ResultBox label="Concentração final" value={n(targetConc).toFixed(2)} unit={targetUnit} />
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function IVCalcPage() {
  const [mode, setMode] = useState<CalcMode>('volume')

  const tabStyle = (m: CalcMode) => ({
    padding: '9px 18px', border: 'none', background: mode === m ? 'var(--ink)' : 'white',
    color: mode === m ? 'white' : 'var(--ink-4)', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
    borderBottom: mode === m ? 'none' : '1px solid var(--border)',
    transition: 'all 0.15s',
  })

  const tabs: { id: CalcMode; label: string }[] = [
    { id: 'volume',         label: 'Volume a Dar' },
    { id: 'infusion',       label: 'Taxa de Infusão' },
    { id: 'reconstitution', label: 'Reconstituição' },
    { id: 'reference',      label: 'Referência Rápida' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>


      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '16px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Calculadoras IV</span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', background: '#1e3a8a', padding: '2px 8px', borderRadius: 3, letterSpacing: '0.08em' }}>FARMACOTECNIA</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400, margin: 0 }}>
            Calculadora de Preparações IV
          </h1>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setMode(t.id)} style={{ ...tabStyle(t.id), flex: 1, borderRadius: 0 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Calculator panel */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
          {mode === 'volume'         && <VolumeCalc />}
          {mode === 'infusion'       && <InfusionCalc />}
          {mode === 'reconstitution' && <ReconstitutionCalc />}
          {mode === 'reference'      && (
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                Preparações padrão comuns em UCI / Urgência
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {QUICK_REF.map((r, i) => (
                  <div key={r.drug} style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr', gap: 0, padding: '12px 0', borderBottom: i < QUICK_REF.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.drug}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                      <div>{r.conc}</div>
                      <div style={{ color: '#1d4ed8', fontWeight: 700, marginTop: 2 }}>→ {r.result}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.5 }}>{r.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12, color: '#854d0e', lineHeight: 1.6 }}>
          ⚠ Verificar sempre com a farmácia e o protocolo institucional antes de preparar. Esta calculadora é um auxiliar — o profissional é sempre responsável pela decisão final.
        </div>
      </div>
    </div>
  )
}
