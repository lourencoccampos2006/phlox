'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type DrugTab = 'vancomycin' | 'aminoglycoside' | 'phenytoin' | 'digoxin'

interface PatientForm {
  weight: string; height: string; age: string
  sex: 'male' | 'female'; scr: string; albumin: string
}

// ─── PK Math ─────────────────────────────────────────────────────────────────

function ibw(ht_cm: number, sex: 'male' | 'female') {
  const h_in = ht_cm / 2.54
  return Math.max(sex === 'male' ? 50 + 2.3 * (h_in - 60) : 45.5 + 2.3 * (h_in - 60), 30)
}
function abw(ibw_: number, act: number) { return ibw_ + 0.4 * (act - ibw_) }
function cgCrCl(age: number, wt: number, sex: 'male' | 'female', scr: number) {
  if (!age || !wt || !scr || scr <= 0) return 0
  const r = ((140 - age) * wt) / (72 * scr)
  return Math.max(0, sex === 'female' ? r * 0.85 : r)
}

// ─── Vancomycin (Rybak 2020 ASHP/IDSA) ───────────────────────────────────────

interface VancoForm {
  dose: string; interval: string; infusion_time: string
  peak: string; peak_time: string; trough: string; mic: string
}

function vancoCalc(p: PatientForm, v: VancoForm) {
  const age = +p.age, wt = +p.weight, ht = +p.height || 170, scr = +p.scr
  if (!age || !wt || !scr || scr <= 0) return null

  const ibw_ = ibw(ht, p.sex), abw_ = abw(ibw_, wt)
  const cg_wt  = wt > ibw_ * 1.3 ? abw_ : wt
  const pk_wt  = wt > ibw_ * 1.3 ? abw_ : wt
  const crcl   = cgCrCl(age, cg_wt, p.sex, scr)

  // Matzke et al. (1984) population PK
  const ke_pop = 0.00083 * crcl + 0.0044
  const vd_pop = 0.7 * pk_wt
  const tau    = +v.interval || 12
  const t_inf  = +v.infusion_time || 1
  const dose   = +v.dose || 0
  const mic    = Math.max(+v.mic || 1, 0.25)

  let ke = ke_pop, vd = vd_pop
  let method: 'population' | 'two_level' = 'population'

  const Cp = +v.peak, tp = +v.peak_time || 1, Ct = +v.trough
  if (Cp > 0 && Ct > 0 && Cp > Ct && dose > 0) {
    const t1 = tp, t2 = tau - t_inf
    if (t2 > t1) {
      const ke_calc = Math.log(Cp / Ct) / (t2 - t1)
      if (ke_calc > 0 && ke_calc < 0.5) {
        ke = ke_calc
        const C_end = Cp * Math.exp(ke * t1)
        const vd_calc = (dose / t_inf) * (1 - Math.exp(-ke * t_inf)) /
          (ke * C_end * (1 - Math.exp(-ke * tau)))
        if (vd_calc > 0 && vd_calc < 200) { vd = vd_calc; method = 'two_level' }
      }
    }
  }

  const t_half = 0.693 / ke, cl = ke * vd
  const tdd    = dose > 0 ? dose * (24 / tau) : 0
  const auc24  = tdd > 0 ? tdd / cl : 0
  const auc_mic = auc24 / mic

  // Recommend dose for AUC/MIC = 500
  const rec_daily = Math.round(500 * mic * cl / 250) * 250
  let rec_tau = 12
  if (t_half < 5) rec_tau = 6
  else if (t_half < 9) rec_tau = 8
  else if (t_half < 15) rec_tau = 12
  else if (t_half < 25) rec_tau = 24
  else rec_tau = 48
  const rec_dose = Math.round(rec_daily * rec_tau / 24 / 250) * 250
  const loading  = Math.min(3000, Math.round(pk_wt * 30 / 250) * 250)

  // Predicted concentrations for recommended dose
  const Cmax_rec = (rec_dose / (ke * vd * t_inf)) *
    (1 - Math.exp(-ke * t_inf)) / (1 - Math.exp(-ke * rec_tau))
  const Cmin_rec = Cmax_rec * Math.exp(-ke * (rec_tau - t_inf))

  const warns: string[] = [], notes: string[] = []
  if (crcl < 15) warns.push('CrCl < 15 mL/min — dose única guiada por nível; avaliar CVVH/diálise')
  else if (crcl < 30) warns.push('CrCl < 30 mL/min — insuficiência severa. Monitorizar TDM a cada 24-48h.')
  else if (crcl < 60) warns.push('CrCl < 60 mL/min — intervalo alargado necessário. Vigiar TDM.')
  if (auc_mic > 0 && auc_mic > 600) warns.push(`AUC/MIC = ${auc_mic.toFixed(0)} > 600 — nefrotoxicidade. Reduzir dose.`)
  if (auc_mic > 0 && auc_mic < 400) warns.push(`AUC/MIC = ${auc_mic.toFixed(0)} < 400 — eficácia insuficiente. Aumentar dose.`)
  if (Cmin_rec > 20) warns.push('Nível mínimo previsto > 20 mg/L — nefrotóxico.')
  if (wt > ibw_ * 1.3) notes.push(`Obesidade: PIB ${ibw_.toFixed(0)} kg → peso ajustado ${abw_.toFixed(0)} kg (utilizado para PK)`)
  if (method === 'two_level') notes.push('PK individualizado pelos dois níveis fornecidos (método log-linear)')
  else notes.push('Parâmetros populacionais (Matzke 1984) — individualizar com nível após 24-48h de tratamento')

  return {
    crcl, pk_wt, ibw_, abw_, ke, vd, t_half, cl, auc24, auc_mic,
    target_met: auc_mic >= 400 && auc_mic <= 600,
    rec_dose, rec_tau, rec_daily, loading,
    Cmax_rec, Cmin_rec, method, warns, notes,
  }
}

// ─── Aminoglycosides (Hartford/EID) ───────────────────────────────────────────

interface AminoForm {
  drug: 'gentamicin' | 'tobramycin' | 'amikacin'
  dose: string; interval: string; random_level: string; random_time: string
}

function aminoCalc(p: PatientForm, a: AminoForm) {
  const age = +p.age, wt = +p.weight, ht = +p.height || 170, scr = +p.scr
  if (!age || !wt || !scr || scr <= 0) return null

  const ibw_ = ibw(ht, p.sex), abw_ = abw(ibw_, wt)
  const pk_wt = wt > ibw_ * 1.3 ? abw_ : wt < ibw_ ? wt : ibw_
  const cg_wt = wt > ibw_ * 1.3 ? abw_ : wt < ibw_ ? wt : ibw_
  const crcl = cgCrCl(age, cg_wt, p.sex, scr)

  // Population PK (Dager et al.; Vd gentamicin/tobra/amikacin similar)
  const vd = (a.drug === 'amikacin' ? 0.27 : 0.26) * pk_wt
  const ke = (a.drug === 'amikacin' ? (0.00293 * crcl + 0.014) : (0.00293 * crcl + 0.014))
  const t_half = 0.693 / ke
  const cl = ke * vd

  // EID initial dose (Barnes-Jewish/Hartford)
  const dose_per_kg = a.drug === 'amikacin' ? 15 : 7
  const max_dose = a.drug === 'amikacin' ? 1500 : 600
  const init_dose = Math.min(max_dose, Math.round(dose_per_kg * pk_wt / (a.drug === 'amikacin' ? 50 : 10)) * (a.drug === 'amikacin' ? 50 : 10))

  let init_tau = 24
  if (crcl >= 60) init_tau = 24
  else if (crcl >= 40) init_tau = 36
  else if (crcl >= 20) init_tau = 48
  else init_tau = 0  // traditional dosing required

  // Hartford nomogram (Freeman 2003, validated for 7mg/kg gent/tobra)
  // Boundary lines fitted to published nomogram
  const C = +a.random_level, t = +a.random_time
  let nomogram: { interval: number; zone: string; color: string; action: string } | null = null
  if (C > 0 && t >= 6 && t <= 14) {
    const b24 = 6.5  * Math.exp(-0.092 * t)
    const b36 = 4.5  * Math.exp(-0.073 * t)
    const b48 = 2.65 * Math.exp(-0.056 * t)
    if (C < b48) nomogram = { interval: 24, zone: 'q24h', color: '#16a34a', action: 'Continuar dose actual q24h' }
    else if (C < b36) nomogram = { interval: 36, zone: 'q36h', color: '#ca8a04', action: 'Alterar para q36h' }
    else if (C < b24) nomogram = { interval: 48, zone: 'q48h', color: '#ea580c', action: 'Alterar para q48h' }
    else nomogram = { interval: 0, zone: 'Fora nomograma', color: '#dc2626', action: 'Aguardar CXL < 1 mg/L. Consultar farmacêutico.' }
  }

  const targets = a.drug === 'amikacin'
    ? { peak_min: 55, peak_max: 65, trough_max: 5 }
    : { peak_min: 8, peak_max: 12, trough_max: 1 }

  const warns: string[] = []
  if (crcl < 20) warns.push('CrCl < 20 mL/min — EID não adequado. Usar dosagem tradicional (2-3mg/kg/dose) com nível pico e vale.')
  if (age >= 65) warns.push('Idoso ≥ 65 anos — ototoxicidade/nefrotoxicidade aumentadas. Cursos curtos (≤5 dias). Monitorizar activamente.')
  if (nomogram?.zone === 'Fora nomograma') warns.push('Nível acima da zona q48h — acumulação tóxica iminente. Ver acção.')

  return { crcl, pk_wt, ibw_, vd, cl, ke, t_half, init_dose, init_tau, nomogram, targets, warns }
}

// ─── Phenytoin (Michaelis-Menten, Sheiner-Tozer) ─────────────────────────────

interface PhenyForm {
  dose: string; measured_level: string; target_min: string; target_max: string
  esrd: boolean
}

function phenyCalc(p: PatientForm, f: PhenyForm) {
  const age = +p.age, wt = +p.weight, alb = +p.albumin
  if (!age || !wt) return null

  const C_meas = +f.measured_level

  // Sheiner-Tozer correction (Winter 1988)
  let C_adj: number | null = null, C_free: number | null = null
  if (C_meas > 0 && alb > 0) {
    C_adj = f.esrd
      ? C_meas / (0.1 * (alb / 4.4) + 0.1)   // Winter-Tozer for ESRD
      : C_meas / (0.2 * (alb / 4.4) + 0.1)    // Sheiner-Tozer standard
    C_free = C_adj * 0.1
  }

  // Michaelis-Menten population PK (Ludden 1977)
  const Vmax = (age >= 65 ? 5.5 : 7) * wt  // mg/day; elderly have reduced Vmax
  const Km   = 4  // mg/L population average
  const Vd   = 0.65 * wt  // L

  const dose = +f.dose
  let C_predicted: number | null = null
  if (dose > 0) {
    // SS: dose = Vmax * Css / (Km + Css) → Css = Km*dose / (Vmax - dose)
    if (Vmax > dose) {
      C_predicted = (Km * dose) / (Vmax - dose)
    } else {
      C_predicted = 999  // dose exceeds Vmax → accumulation
    }
  }

  // Recommended dose for target midpoint
  const tgt = ((+f.target_min || 10) + (+f.target_max || 20)) / 2
  const rec_dose_raw = Vmax * tgt / (Km + tgt)
  const rec_dose = Math.round(rec_dose_raw / 25) * 25

  // Loading dose
  const load_iv   = Math.round(Math.min(20 * wt, 1500) / 50) * 50
  const load_oral  = Math.round(load_iv * 1.1 / 50) * 50  // ~10% extra for oral bioavailability

  const C_disp = C_adj ?? C_meas
  const in_range = C_disp > 0 && C_disp >= (+f.target_min || 10) && C_disp <= (+f.target_max || 20)

  const warns: string[] = []
  if (C_adj && C_adj > 20) warns.push(`Nível corrigido ${C_adj.toFixed(1)} mg/L — TÓXICO. Ataxia, nistagmo, confusão.`)
  if (C_adj && C_adj > 30) warns.push('Nível > 30 mg/L — convulsões paradoxais e depressão respiratória possíveis.')
  if (age >= 65) warns.push('Idoso: Vmax reduzida (~5 mg/kg/dia). Titulação lenta. Pequenas alterações de dose → grandes variações de nível.')
  if (C_predicted && C_predicted === 999) warns.push('Dose excede Vmax estimada — acumulação inevitável. Reduzir dose imediatamente.')

  return { C_adj, C_free, C_predicted, rec_dose, load_iv, load_oral, in_range, Vd, warns }
}

// ─── Digoxin (Jelliffe) ───────────────────────────────────────────────────────

interface DigoxinForm { indication: 'af' | 'hf'; target_level: string }

function digoxinCalc(p: PatientForm, d: DigoxinForm) {
  const age = +p.age, wt = +p.weight, ht = +p.height || 170, scr = +p.scr
  if (!age || !wt || !scr || scr <= 0) return null

  const ibw_ = ibw(ht, p.sex), lbw = Math.min(wt, ibw_)
  const cg_wt = wt > ibw_ * 1.3 ? ibw_ : wt
  const crcl = cgCrCl(age, cg_wt, p.sex, scr)

  // Jelliffe 1968 (corrected for LBW)
  const cl_mL_min = (0.8 * crcl + 40) * (lbw / 70)  // mL/min
  const cl_L_day  = cl_mL_min * 1.44
  const vd_L_kg   = d.indication === 'hf' ? 4.7 : 7.3
  const vd        = vd_L_kg * lbw
  const ke        = cl_L_day / vd  // 1/day
  const t_half_h  = 0.693 / ke * 24

  const C_target = +d.target_level || (d.indication === 'af' ? 1.5 : 0.75)
  const daily_mcg_exact = cl_L_day * C_target
  const daily_mcg = Math.round(daily_mcg_exact / 62.5) * 62.5
  const load_mcg = Math.round(vd * C_target / 0.75 / 62.5) * 62.5  // oral bioavailability 75%

  const warns: string[] = []
  if (crcl < 50) warns.push('CrCl < 50 mL/min — clearance reduzida. Usar dose mínima eficaz.')
  if (crcl < 30) warns.push('CrCl < 30 mL/min — considerar q48h ou alternativas. Nível 6h+ após dose.')
  if (age >= 70) warns.push('STOPP v3: Idoso ≥ 70 anos com FA → preferir betabloqueante ou amiodarona. Se manter, dose ≤ 125 mcg/dia.')
  if (d.indication === 'hf') warns.push('ICC: Vd reduzido. Manter nível 0.5-0.9 ng/mL. Nível > 1.0 ng/mL associado a maior mortalidade (DIG trial).')

  return { crcl, lbw, vd, cl_L_day, t_half_h, daily_mcg, load_mcg, C_target, warns }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function Row({ label, value, unit, dim }: { label: string; value: string; unit?: string; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: dim ? '#94a3b8' : '#64748b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: dim ? '#94a3b8' : '#0f172a' }}>
        {value}{unit && <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>}
      </span>
    </div>
  )
}

function Warn({ text, type = 'error' }: { text: string; type?: 'error' | 'info' }) {
  return (
    <div style={{
      padding: '8px 11px', borderRadius: 8, marginBottom: 6,
      background: type === 'error' ? '#fef2f2' : '#eff6ff',
      border: `1px solid ${type === 'error' ? '#fecaca' : '#bfdbfe'}`,
      fontSize: 12, color: type === 'error' ? '#dc2626' : '#1d4ed8',
      display: 'flex', gap: 7, alignItems: 'flex-start',
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{type === 'error' ? '⚠' : 'ℹ'}</span>
      {text}
    </div>
  )
}

function Input({
  label, value, onChange, type = 'number', min, max, step, suffix, placeholder, small
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; min?: number; max?: number; step?: string; suffix?: string; placeholder?: string; small?: boolean
}) {
  return (
    <div style={{ marginBottom: small ? 8 : 11 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder ?? '—'}
          style={{
            width: '100%', padding: suffix ? '7px 36px 7px 10px' : '7px 10px',
            borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13,
            background: 'white', color: '#0f172a', fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 11 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 7,
          border: '1px solid #e2e8f0', fontSize: 13, background: 'white',
          color: '#0f172a', fontFamily: 'inherit', outline: 'none',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
      {children}
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
    </div>
  )
}

function BigNumber({ value, label, color, unit }: { value: string; label: string; color: string; unit?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px', background: `${color}08`, borderRadius: 10, border: `1px solid ${color}20` }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PKDosing() {
  const [tab, setTab] = useState<DrugTab>('vancomycin')

  const [pt, setPt] = useState<PatientForm>({ weight: '', height: '', age: '', sex: 'male', scr: '', albumin: '' })
  const up = (k: keyof PatientForm) => (v: string) => setPt(p => ({ ...p, [k]: v }))

  const [vf, setVf] = useState<VancoForm>({ dose: '', interval: '12', infusion_time: '1', peak: '', peak_time: '1', trough: '', mic: '1' })
  const uv = (k: keyof VancoForm) => (v: string) => setVf(f => ({ ...f, [k]: v }))

  const [af, setAf] = useState<AminoForm>({ drug: 'gentamicin', dose: '', interval: '24', random_level: '', random_time: '' })
  const ua = (k: keyof AminoForm) => (v: string) => setAf(f => ({ ...f, [k]: v }))

  const [pf, setPf] = useState<PhenyForm>({ dose: '', measured_level: '', target_min: '10', target_max: '20', esrd: false })
  const up2 = (k: keyof PhenyForm) => (v: string) => setPf(f => ({ ...f, [k]: v }))

  const [df, setDf] = useState<DigoxinForm>({ indication: 'af', target_level: '' })
  const ud = (k: keyof DigoxinForm) => (v: string) => setDf(f => ({ ...f, [k]: v }))

  const vRes = useMemo(() => vancoCalc(pt, vf), [pt, vf])
  const aRes = useMemo(() => aminoCalc(pt, af), [pt, af])
  const pRes = useMemo(() => phenyCalc(pt, pf), [pt, pf])
  const dRes = useMemo(() => digoxinCalc(pt, df), [pt, df])

  const crcl_live = useMemo(() => {
    const age = +pt.age, wt = +pt.weight, scr = +pt.scr
    if (!age || !wt || !scr) return null
    const ibw_ = ibw(+pt.height || 170, pt.sex)
    const cg_wt = wt > ibw_ * 1.3 ? abw(ibw_, wt) : wt
    return cgCrCl(age, cg_wt, pt.sex, scr)
  }, [pt])

  const TABS: { id: DrugTab; label: string; sub: string; icon: string }[] = [
    { id: 'vancomycin',    label: 'Vancomicina',       sub: 'AUC-guided · Rybak 2020',       icon: '💉' },
    { id: 'aminoglycoside', label: 'Aminoglicosídeos', sub: 'Hartford · EID nomograma',        icon: '🔬' },
    { id: 'phenytoin',     label: 'Fenitoína',          sub: 'Michaelis-Menten · Sheiner-Tozer', icon: '⚡' },
    { id: 'digoxin',       label: 'Digoxina',           sub: 'Jelliffe · DIG trial',           icon: '❤️' },
  ]

  const CRCL_COLOR = !crcl_live ? '#94a3b8' : crcl_live < 30 ? '#dc2626' : crcl_live < 60 ? '#ca8a04' : '#16a34a'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '18px 24px 0' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Farmácia Clínica · TDM
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                Console PK — Dosagem Individualizada
              </h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                Farmacocinética clínica com modelos validados · Vancomicina, Aminoglicosídeos, Fenitoína, Digoxina
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {crcl_live !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CrCl Cockcroft-Gault</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: CRCL_COLOR, lineHeight: 1.1 }}>{crcl_live.toFixed(0)}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>mL/min</div>
                </div>
              )}
            </div>
          </div>

          {/* Drug tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? '#0f172a' : '#64748b',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</div>
                    <div style={{ fontSize: 9, opacity: 0.65, marginTop: 1 }}>{t.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>

          {/* ── Left: Patient + Drug Inputs ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Patient Card */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16 }}>👤</span> Dados do Doente
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Input label="Peso" value={pt.weight} onChange={up('weight')} suffix="kg" placeholder="70" />
                <Input label="Altura" value={pt.height} onChange={up('height')} suffix="cm" placeholder="170" />
                <Input label="Idade" value={pt.age} onChange={up('age')} suffix="anos" placeholder="65" />
                <div style={{ marginBottom: 11 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sexo</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['male', 'female'] as const).map(s => (
                      <button key={s} onClick={() => setPt(p => ({ ...p, sex: s }))} style={{
                        flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${pt.sex === s ? '#2563eb' : '#e2e8f0'}`,
                        background: pt.sex === s ? '#eff6ff' : 'white', cursor: 'pointer',
                        fontSize: 12, fontWeight: pt.sex === s ? 700 : 500,
                        color: pt.sex === s ? '#2563eb' : '#64748b', fontFamily: 'inherit',
                      }}>
                        {s === 'male' ? '♂ Masc' : '♀ Fem'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Input label="Creatinina sérica" value={pt.scr} onChange={up('scr')} suffix="mg/dL" placeholder="1.0" />
              {tab === 'phenytoin' && (
                <Input label="Albumina sérica" value={pt.albumin} onChange={up('albumin')} suffix="g/dL" placeholder="4.0" />
              )}

              {crcl_live !== null && (
                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 7, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CrCl (Cockcroft-Gault)</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: CRCL_COLOR }}>{crcl_live.toFixed(1)} mL/min</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    {crcl_live < 30 ? 'Insuficiência renal severa' : crcl_live < 60 ? 'Insuficiência renal moderada' : crcl_live < 90 ? 'Função renal ligeiramente reduzida' : 'Função renal normal'}
                  </div>
                </div>
              )}
            </div>

            {/* Drug-specific inputs */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>

              {/* Vancomycin inputs */}
              {tab === 'vancomycin' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>💉</span> Vancomicina
                  </div>
                  <SectionTitle>Dose atual (se conhecida)</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Input label="Dose" value={vf.dose} onChange={uv('dose')} suffix="mg" placeholder="1000" />
                    <Input label="Intervalo" value={vf.interval} onChange={uv('interval')} suffix="h" placeholder="12" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Input label="Tempo de infusão" value={vf.infusion_time} onChange={uv('infusion_time')} suffix="h" placeholder="1" />
                    <Input label="MIC do patogénio" value={vf.mic} onChange={uv('mic')} suffix="mg/L" placeholder="1" />
                  </div>
                  <SectionTitle>Níveis plasmáticos (opcional)</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Input label="Nível pico" value={vf.peak} onChange={uv('peak')} suffix="mg/L" placeholder="30" />
                    <Input label="Horas após fim infusão" value={vf.peak_time} onChange={uv('peak_time')} suffix="h" placeholder="1" />
                  </div>
                  <Input label="Nível vale (pré-dose)" value={vf.trough} onChange={uv('trough')} suffix="mg/L" placeholder="12" />
                </>
              )}

              {/* Aminoglycoside inputs */}
              {tab === 'aminoglycoside' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>🔬</span> Aminoglicosídeo
                  </div>
                  <Select
                    label="Fármaco"
                    value={af.drug}
                    onChange={ua('drug')}
                    options={[
                      { value: 'gentamicin', label: 'Gentamicina' },
                      { value: 'tobramycin', label: 'Tobramicina' },
                      { value: 'amikacin', label: 'Amicacina' },
                    ]}
                  />
                  <SectionTitle>Nível aleatório (6–14h após 1ª dose)</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Input label="Nível" value={af.random_level} onChange={ua('random_level')} suffix="mg/L" placeholder="3.2" />
                    <Input label="Horas após dose" value={af.random_time} onChange={ua('random_time')} suffix="h" placeholder="8" />
                  </div>
                </>
              )}

              {/* Phenytoin inputs */}
              {tab === 'phenytoin' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>⚡</span> Fenitoína
                  </div>
                  <Input label="Dose atual (se conhecida)" value={pf.dose} onChange={up2('dose')} suffix="mg/dia" placeholder="300" />
                  <SectionTitle>Nível medido</SectionTitle>
                  <Input label="Fenitoína total medida" value={pf.measured_level} onChange={up2('measured_level')} suffix="mg/L" placeholder="8" />
                  <div style={{ marginBottom: 11 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={pf.esrd}
                        onChange={e => setPf(f => ({ ...f, esrd: e.target.checked }))}
                        style={{ width: 14, height: 14 }}
                      />
                      Doente com IRCT/diálise (fórmula Winter-Tozer)
                    </label>
                  </div>
                  <SectionTitle>Alvo terapêutico</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <Input label="Mínimo" value={pf.target_min} onChange={up2('target_min')} suffix="mg/L" placeholder="10" />
                    <Input label="Máximo" value={pf.target_max} onChange={up2('target_max')} suffix="mg/L" placeholder="20" />
                  </div>
                </>
              )}

              {/* Digoxin inputs */}
              {tab === 'digoxin' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>❤️</span> Digoxina
                  </div>
                  <Select
                    label="Indicação"
                    value={df.indication}
                    onChange={ud('indication')}
                    options={[
                      { value: 'af', label: 'FA (Fibrilhação Auricular)' },
                      { value: 'hf', label: 'IC (Insuficiência Cardíaca)' },
                    ]}
                  />
                  <Input
                    label="Nível alvo desejado"
                    value={df.target_level}
                    onChange={ud('target_level')}
                    suffix="ng/mL"
                    placeholder={df.indication === 'af' ? '1.5' : '0.8'}
                  />
                  <div style={{ padding: '8px 10px', background: '#fffbeb', borderRadius: 7, border: '1px solid #fef3c7', fontSize: 11, color: '#92400e' }}>
                    <strong>Alvo terapêutico:</strong> FA: 1.5–2.0 ng/mL · ICC: 0.5–0.9 ng/mL (evitar &gt;1.0)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Right: Results ─────────────────────────────────────────── */}
          <div>

            {/* Vancomycin Results */}
            {tab === 'vancomycin' && (
              vRes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Warnings */}
                  {vRes.warns.length > 0 && (
                    <div>
                      {vRes.warns.map((w, i) => <Warn key={i} text={w} type="error" />)}
                    </div>
                  )}

                  {/* AUC/MIC target */}
                  {vRes.auc24 > 0 && (
                    <div style={{ background: 'white', borderRadius: 14, border: `2px solid ${vRes.target_met ? '#16a34a' : vRes.auc_mic > 600 ? '#dc2626' : '#ca8a04'}`, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            AUC24/MIC — Alvo 400–600
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 36, fontWeight: 900, color: vRes.target_met ? '#16a34a' : vRes.auc_mic > 600 ? '#dc2626' : '#ca8a04', lineHeight: 1 }}>
                              {vRes.auc_mic.toFixed(0)}
                            </span>
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>mg·h/L / mg/L</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px 18px', borderRadius: 10, background: vRes.target_met ? '#f0fdf4' : '#fef2f2', border: `1px solid ${vRes.target_met ? '#bbf7d0' : '#fecaca'}` }}>
                          <div style={{ fontSize: 20 }}>{vRes.target_met ? '✅' : '❌'}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: vRes.target_met ? '#15803d' : '#dc2626', marginTop: 4 }}>
                            {vRes.target_met ? 'Alvo atingido' : 'Ajustar dose'}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <BigNumber value={vRes.auc24.toFixed(0)} unit=" mg·h/L" label="AUC24" color="#0d9488" />
                        <BigNumber value={vRes.Cmax_rec.toFixed(1)} unit=" mg/L" label="Pico previsto" color="#7c3aed" />
                        <BigNumber value={vRes.Cmin_rec.toFixed(1)} unit=" mg/L" label="Vale previsto" color="#2563eb" />
                      </div>
                    </div>
                  )}

                  {/* PK Parameters */}
                  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      Parâmetros Farmacocinéticos
                      <span style={{ fontSize: 10, background: vRes.method === 'two_level' ? '#eff6ff' : '#f8fafc', color: vRes.method === 'two_level' ? '#2563eb' : '#64748b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {vRes.method === 'two_level' ? 'Individualizado 2 níveis' : 'Populacional (Matzke)'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                      <Row label="Ke (constante eliminação)" value={vRes.ke.toFixed(4)} unit="h⁻¹" />
                      <Row label="t½ (semi-vida)" value={vRes.t_half.toFixed(1)} unit="h" />
                      <Row label="Vd (volume distribuição)" value={vRes.vd.toFixed(1)} unit="L" />
                      <Row label="CL (clearance)" value={vRes.cl.toFixed(2)} unit="L/h" />
                      <Row label="CrCl Cockcroft-Gault" value={vRes.crcl.toFixed(1)} unit="mL/min" />
                      <Row label="Peso utilizado (PK)" value={vRes.pk_wt.toFixed(1)} unit="kg" />
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div style={{ background: '#0f172a', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                      💡 Recomendação de Dose
                      <span style={{ fontSize: 10, color: '#475569', background: '#1e293b', padding: '2px 7px', borderRadius: 20 }}>MIC = {+vf.mic || 1} mg/L → Alvo AUC/MIC 500</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#22d3ee', lineHeight: 1 }}>{vRes.rec_dose}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mg / dose</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#a78bfa', lineHeight: 1 }}>q{vRes.rec_tau}h</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>intervalo</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#86efac', lineHeight: 1 }}>{vRes.rec_daily}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mg / dia</div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#1e293b', borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Dose de carga (infecção grave, MRSA)</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b' }}>{vRes.loading} mg IV (25–35 mg/kg)</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {vRes.notes.length > 0 && (
                    <div>{vRes.notes.map((n, i) => <Warn key={i} text={n} type="info" />)}</div>
                  )}

                  {/* Reference */}
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
                    Rybak MJ et al. Therapeutic Monitoring of Vancomycin for Serious Methicillin-Resistant
                    Staphylococcus aureus Infections. <em>Am J Health Syst Pharm.</em> 2020;77(11):835–864 (ASHP/IDSA/SIDP).
                    Matzke GR et al. <em>Ann Pharmacother.</em> 1984.
                  </div>
                </div>
              ) : (
                <EmptyState drug="vancomicina" fields="peso, idade, sexo e creatinina" />
              )
            )}

            {/* Aminoglycoside Results */}
            {tab === 'aminoglycoside' && (
              aRes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {aRes.warns.length > 0 && <div>{aRes.warns.map((w, i) => <Warn key={i} text={w} type="error" />)}</div>}

                  {/* Initial dose */}
                  <div style={{ background: '#0f172a', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 14 }}>
                      💡 Dose Inicial EID — {af.drug === 'amikacin' ? 'Amicacina' : af.drug === 'tobramycin' ? 'Tobramicina' : 'Gentamicina'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#22d3ee', lineHeight: 1 }}>{aRes.init_dose}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mg</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#a78bfa', lineHeight: 1 }}>
                          {aRes.init_tau === 0 ? 'TID' : `q${aRes.init_tau}h`}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                          {aRes.init_tau === 0 ? 'Dosagem tradicional' : 'intervalo inicial'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#86efac', lineHeight: 1 }}>{af.drug === 'amikacin' ? '15' : '7'}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mg/kg peso PK</div>
                      </div>
                    </div>
                    {aRes.init_tau > 0 && (
                      <div style={{ marginTop: 10, padding: '9px 12px', background: '#1e293b', borderRadius: 9, fontSize: 11, color: '#94a3b8' }}>
                        Colher nível aleatório <strong style={{ color: 'white' }}>6–14h após a 1ª dose</strong> para aplicar o nomograma de Hartford
                      </div>
                    )}
                  </div>

                  {/* Hartford Nomogram result */}
                  {aRes.nomogram && (
                    <div style={{ background: 'white', borderRadius: 14, border: `2px solid ${aRes.nomogram.color}`, padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                        Nomograma de Hartford — Resultado
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ padding: '14px 20px', background: aRes.nomogram.color + '15', borderRadius: 12, border: `2px solid ${aRes.nomogram.color}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: aRes.nomogram.color }}>
                            {aRes.nomogram.zone === 'Fora nomograma' ? '⛔' : aRes.nomogram.zone}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: aRes.nomogram.color }}>{aRes.nomogram.action}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            Nível {af.random_level} mg/L às {af.random_time}h após dose
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PK Parameters */}
                  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Parâmetros PK (populacional)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                      <Row label="t½" value={aRes.t_half.toFixed(1)} unit="h" />
                      <Row label="Vd" value={aRes.vd.toFixed(1)} unit="L" />
                      <Row label="CL (estimada)" value={aRes.cl.toFixed(2)} unit="L/h" />
                      <Row label="CrCl" value={aRes.crcl.toFixed(1)} unit="mL/min" />
                    </div>
                    <div style={{ marginTop: 12, padding: '8px 10px', background: '#f8fafc', borderRadius: 7, fontSize: 11, color: '#64748b' }}>
                      <strong>Alvos:</strong> {af.drug === 'amikacin' ? 'Pico 55–65 mg/L, Vale &lt;5 mg/L' : 'Pico 8–12 mg/L (infecções graves: 12–20), Vale &lt;1 mg/L'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
                    Nicolau DP et al. Experience with a once-daily aminoglycoside program (Hartford Hospital). <em>Antimicrob Agents Chemother.</em> 1995;39(3):650–655.
                    Freeman CD et al. Once-daily aminoglycoside dosing nomogram. <em>Pharmacotherapy.</em> 1996.
                  </div>
                </div>
              ) : (
                <EmptyState drug="aminoglicosídeo" fields="peso, idade, sexo e creatinina" />
              )
            )}

            {/* Phenytoin Results */}
            {tab === 'phenytoin' && (
              pRes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pRes.warns.length > 0 && <div>{pRes.warns.map((w, i) => <Warn key={i} text={w} type="error" />)}</div>}

                  {/* Level correction */}
                  {pRes.C_adj !== null && (
                    <div style={{ background: 'white', borderRadius: 14, border: `2px solid ${pRes.in_range ? '#16a34a' : '#dc2626'}`, padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                        Correção de Nível — {pf.esrd ? 'Winter-Tozer (IRCT)' : 'Sheiner-Tozer (padrão)'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        <BigNumber value={pf.measured_level} unit=" mg/L" label="Nível medido" color="#94a3b8" />
                        <BigNumber value={pRes.C_adj.toFixed(1)} unit=" mg/L" label="Nível corrigido" color={pRes.in_range ? '#16a34a' : '#dc2626'} />
                        <BigNumber value={(pRes.C_adj * 0.1).toFixed(2)} unit=" mg/L" label="Fenitoína livre (est.)" color="#7c3aed" />
                      </div>
                      <div style={{ marginTop: 10, padding: '8px 11px', background: pRes.in_range ? '#f0fdf4' : '#fef2f2', borderRadius: 7, fontSize: 12, color: pRes.in_range ? '#15803d' : '#dc2626', fontWeight: 600, textAlign: 'center' }}>
                        {pRes.in_range ? `✅ Dentro do alvo (${pf.target_min}–${pf.target_max} mg/L)` : `❌ Fora do alvo terapêutico (${pf.target_min}–${pf.target_max} mg/L)`}
                      </div>
                    </div>
                  )}

                  {/* Dose prediction */}
                  {pRes.C_predicted !== null && (
                    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
                        Previsão de Nível em Steady-State
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 32, fontWeight: 900, color: pRes.C_predicted > 20 ? '#dc2626' : pRes.C_predicted < 10 ? '#ca8a04' : '#16a34a' }}>
                          {pRes.C_predicted === 999 ? '⛔' : pRes.C_predicted.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>mg/L (SS)</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Para dose de {pf.dose} mg/dia com Vmax={((+pt.age >= 65 ? 5.5 : 7) * +pt.weight).toFixed(0)} mg/dia (população)
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  <div style={{ background: '#0f172a', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 14 }}>💡 Recomendação</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ padding: '14px 12px', background: '#1e293b', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Manutenção sugerida</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#22d3ee' }}>{pRes.rec_dose}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>mg/dia</div>
                      </div>
                      <div style={{ padding: '14px 12px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Dose de carga IV</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{pRes.load_iv} mg IV</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>máx 50 mg/min · monitorizar ECG</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#86efac', marginTop: 6 }}>{pRes.load_oral} mg oral</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>dividir em 2-3 tomas</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', padding: '8px 10px', background: '#1e293b', borderRadius: 8 }}>
                      ⚠ Cinética não-linear — pequenas alterações de dose → grandes variações de nível. Titular com incrementos de 25–50 mg.
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
                    Sheiner LB, Tozer TN. Clinical pharmacokinetics: the use of plasma concentrations of drugs.
                    In: Clinical Pharmacology: Basic Principles in Therapeutics. 1978. · Winter ME. Basic Clinical Pharmacokinetics. 6th ed. 2019.
                  </div>
                </div>
              ) : (
                <EmptyState drug="fenitoína" fields="peso, idade, sexo e albumina sérica" />
              )
            )}

            {/* Digoxin Results */}
            {tab === 'digoxin' && (
              dRes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {dRes.warns.length > 0 && <div>{dRes.warns.map((w, i) => <Warn key={i} text={w} type="error" />)}</div>}

                  <div style={{ background: '#0f172a', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 14 }}>
                      💡 Esquema de Dosagem — {df.indication === 'af' ? 'Fibrilhação Auricular' : 'Insuficiência Cardíaca'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#22d3ee', lineHeight: 1 }}>{dRes.daily_mcg}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mcg / dia (manutenção)</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{dRes.load_mcg}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>mcg carga oral (total)</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '14px 8px', background: '#1e293b', borderRadius: 10 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#a78bfa', lineHeight: 1 }}>{dRes.t_half_h.toFixed(0)}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>h (t½)</div>
                      </div>
                    </div>
                    <div style={{ padding: '9px 12px', background: '#1e293b', borderRadius: 9, fontSize: 11, color: '#94a3b8' }}>
                      Carga oral: dividir em 2 tomas (ex: {Math.round(dRes.load_mcg / 2 / 62.5) * 62.5} mcg + {Math.round(dRes.load_mcg / 2 / 62.5) * 62.5} mcg com 6h de intervalo).
                      Colher nível 8-12h após última dose de carga.
                    </div>
                  </div>

                  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Parâmetros PK</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                      <Row label="Vd" value={dRes.vd.toFixed(1)} unit="L" />
                      <Row label="CL" value={dRes.cl_L_day.toFixed(2)} unit="L/dia" />
                      <Row label="t½" value={dRes.t_half_h.toFixed(0)} unit="h" />
                      <Row label="CrCl" value={dRes.crcl.toFixed(1)} unit="mL/min" />
                      <Row label="Peso lean (LBW)" value={dRes.lbw.toFixed(1)} unit="kg" />
                      <Row label="Nível alvo" value={dRes.C_target.toFixed(2)} unit="ng/mL" />
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
                    Jelliffe RW. An improved method of digoxin therapy. <em>Ann Intern Med.</em> 1968;69(4):703–717.
                    Ahmed A et al. Effects of digoxin on morbidity and mortality in diastolic heart failure (DIG trial). <em>Lancet.</em> 2006.
                  </div>
                </div>
              ) : (
                <EmptyState drug="digoxina" fields="peso, idade, sexo e creatinina" />
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        input:focus, select:focus { border-color:#2563eb !important; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
        input[type=number]::-webkit-inner-spin-button { opacity:0.4; }
        @media (max-width:900px) { .pk-grid { grid-template-columns:1fr !important; } }
      `}</style>
    </div>
  )
}

function EmptyState({ drug, fields }: { drug: string; fields: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px dashed #e2e8f0', padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧮</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Preencha os dados do doente</div>
      <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 320, margin: '0 auto' }}>
        Para calcular os parâmetros PK da <strong>{drug}</strong>, introduza {fields} no painel esquerdo.
      </div>
    </div>
  )
}
