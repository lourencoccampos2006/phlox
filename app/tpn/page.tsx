'use client'

import { useState, useMemo } from 'react'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition =
  | 'maintenance'   | 'critically_ill' | 'burns'
  | 'renal_ckd'     | 'renal_hd'       | 'renal_crrt'
  | 'hepatic'       | 'obese_icu'      | 'oncology'

type AccessRoute = 'central' | 'peripheral'

interface PatientForm {
  weight: string; height: string; age: string
  sex: 'male' | 'female'; condition: Condition
  additional_energy: string; glucose_limit: string
  albumin: string; bgl: string   // baseline glucose mg/dL
  na: string; k: string; mg: string; phos: string; ca: string
  insulin: string
  lipid_type: 'soy' | 'olive' | 'smof'
  lipid_omit: boolean; access: AccessRoute
}

// ─── Condition Metadata ───────────────────────────────────────────────────────

const CONDITIONS: Record<Condition, {
  label: string; energy_min: number; energy_max: number
  prot_min: number; prot_max: number; use_ibw?: boolean; note: string
}> = {
  maintenance:   { label: 'Manutenção',               energy_min: 25, energy_max: 30, prot_min: 0.8,  prot_max: 1.2, note: '' },
  critically_ill:{ label: 'Doente crítico / UCI',     energy_min: 25, energy_max: 30, prot_min: 1.2,  prot_max: 2.0, note: 'ASPEN 2022: evitar sobrealimentação; proteína ↑ precocemente' },
  burns:         { label: 'Queimados',                energy_min: 35, energy_max: 40, prot_min: 2.0,  prot_max: 2.5, note: 'Catabolismo extremo; monitorizar glicemia; fórmula Curreri' },
  renal_ckd:     { label: 'IRC sem diálise',           energy_min: 30, energy_max: 35, prot_min: 0.6,  prot_max: 0.8, note: 'Restringir proteína; fósforo e potássio limitados' },
  renal_hd:      { label: 'Hemodiálise',              energy_min: 30, energy_max: 35, prot_min: 1.2,  prot_max: 1.4, note: 'Perdas proteicas na diálise; sem restrição proteica' },
  renal_crrt:    { label: 'CRRT (diálise contínua)',  energy_min: 25, energy_max: 30, prot_min: 1.5,  prot_max: 2.5, note: 'Perdas de aa na membrana; aportar 1.5-2.5 g/kg/dia' },
  hepatic:       { label: 'Hepatopatia avançada',     energy_min: 30, energy_max: 40, prot_min: 1.0,  prot_max: 1.5, note: 'Não restringir proteína (EH grau I-II). Fórmulas hepáticas se EH grau III-IV' },
  obese_icu:     { label: 'Obeso UCI (IMC > 30)',     energy_min: 11, energy_max: 14, prot_min: 2.0,  prot_max: 2.5, use_ibw: true, note: 'Energia por PIB; proteína 2-2.5 g/kg PIB. Hipocalórico hiperproteico.' },
  oncology:      { label: 'Oncologia',                energy_min: 25, energy_max: 30, prot_min: 1.2,  prot_max: 2.0, note: 'Suporte nutricional quando NP indicada (intolerância entérica/obstrução)' },
}

// ─── PK / Nutrition Math ──────────────────────────────────────────────────────

function ibw(ht_cm: number, sex: 'male' | 'female') {
  const h_in = ht_cm / 2.54
  return Math.max(sex === 'male' ? 50 + 2.3 * (h_in - 60) : 45.5 + 2.3 * (h_in - 60), 30)
}

function mifflinBMR(wt: number, ht: number, age: number, sex: 'male' | 'female') {
  return sex === 'male'
    ? 10 * wt + 6.25 * ht - 5 * age + 5
    : 10 * wt + 6.25 * ht - 5 * age - 161
}

// Osmolarity contributions (mOsm/unit)
const OSMO = {
  aa_per_g:     7.4,  // amino acids per gram
  dex_per_g:    5.0,  // dextrose per gram
  nacl_per_meq: 2.0,  // Na + Cl
  k_per_meq:    2.0,
  mg_per_meq:   1.0,
  ca_per_meq:   1.4,
  phos_per_mmol: 1.8,
  lipid_per_g:  0,    // lipid emulsions are iso-osmotic
}

// ─── Main Calculation ─────────────────────────────────────────────────────────

function calcTPN(p: PatientForm) {
  const wt_act = +p.weight, ht = +p.height || 170, age = +p.age
  if (!wt_act || !age) return null

  const ibw_val = ibw(ht, p.sex)
  const cond = CONDITIONS[p.condition]
  const use_ibw = cond.use_ibw && wt_act > ibw_val * 1.3

  const wt_energy = use_ibw ? ibw_val : wt_act
  const wt_prot   = use_ibw ? ibw_val : wt_act

  // Energy
  const bmr = mifflinBMR(wt_energy, ht, age, p.sex)
  const energy_min = cond.energy_min * wt_energy
  const energy_max = cond.energy_max * wt_energy
  const energy_target = +p.additional_energy || ((energy_min + energy_max) / 2)
  const energy_kcal = energy_target

  // Protein
  const prot_min_g = cond.prot_min * wt_prot
  const prot_max_g = cond.prot_max * wt_prot
  const prot_target_g = (prot_min_g + prot_max_g) / 2
  const prot_kcal = prot_target_g * 4

  // Lipid (25-35% of total non-protein calories)
  const np_kcal = energy_kcal - prot_kcal
  const lipid_kcal = p.lipid_omit ? 0 : Math.min(1.5 * wt_act * 9, np_kcal * 0.30)
  const lipid_g = lipid_kcal / 9

  // Dextrose (remainder of NP calories)
  const dex_kcal_target = np_kcal - lipid_kcal
  const glucose_limit_g = +p.glucose_limit || 5 * wt_act * 60 / 1000  // 5mg/kg/min → g/day
  const dex_g = Math.min(dex_kcal_target / 3.4, glucose_limit_g)
  const dex_kcal = dex_g * 3.4

  // GIR check
  const gir_mg_kg_min = (dex_g * 1000) / (wt_act * 1440)

  // Total kcal delivered
  const total_kcal = prot_kcal + dex_kcal + lipid_kcal

  // Volume calculation
  // Amino acids: 10% solution = 100g/L
  // Dextrose: 70% solution = 700g/L
  // Lipid: 20% solution = 200g/L
  const aa_vol   = (prot_target_g / 100) * 1000   // mL (10% AA solution)
  const dex_vol  = (dex_g / 700) * 1000            // mL (70% dextrose concentrate)
  const lip_vol  = p.lipid_omit ? 0 : (lipid_g / 200) * 1000  // mL (20% lipid)

  // Electrolytes (mEq/day unless noted)
  const na_meq   = +p.na || Math.round(wt_act * 1.5)    // 1-2 mEq/kg
  const k_meq    = +p.k  || Math.round(wt_act * 1.2)    // 1-2 mEq/kg
  const mg_meq   = +p.mg || 16                            // 8-20 mEq
  const phos_mmol = +p.phos || 30                         // 20-40 mmol
  const ca_meq   = +p.ca || 10                            // 10-15 mEq

  // Additional volume for electrolytes (~50-150mL electrolyte solution)
  const electrolyte_vol = 100

  // Total volume
  const base_vol  = aa_vol + dex_vol + lip_vol + electrolyte_vol
  const total_vol = Math.round(base_vol / 50) * 50  // round to nearest 50mL

  // Rate
  const rate_mL_h = Math.round(total_vol / 24 * 2) / 2  // over 24h, round to 0.5

  // Osmolarity (without lipid - lipid is iso-osmotic)
  const aa_osmo   = prot_target_g * OSMO.aa_per_g
  const dex_osmo  = dex_g * OSMO.dex_per_g
  const na_osmo   = na_meq * OSMO.nacl_per_meq
  const k_osmo    = k_meq * OSMO.k_per_meq
  const mg_osmo   = mg_meq * OSMO.mg_per_meq
  const ca_osmo   = ca_meq * OSMO.ca_per_meq
  const phos_osmo = phos_mmol * OSMO.phos_per_mmol

  const base_vol_L = (aa_vol + dex_vol + electrolyte_vol) / 1000
  const osmolarity = base_vol_L > 0
    ? (aa_osmo + dex_osmo + na_osmo + k_osmo + mg_osmo + ca_osmo + phos_osmo) / base_vol_L
    : 0

  // Ca × P compatibility (in mEq/L and mmol/L)
  const ca_L  = base_vol_L > 0 ? ca_meq / base_vol_L : 0
  const p_L   = base_vol_L > 0 ? phos_mmol / base_vol_L : 0
  const ca_p_product = ca_L * p_L  // should be < 200 for TNA

  // Dextrose concentration
  const final_dex_pct = base_vol_L > 0 ? (dex_g / base_vol_L / 10) : 0

  const warns: string[] = []
  const notes: string[] = []

  if (osmolarity > 1800 && p.access === 'peripheral') warns.push(`Osmolaridade ${osmolarity.toFixed(0)} mOsm/L — demasiado alto para acesso periférico (máx ~900 mOsm/L). Requer acesso central.`)
  else if (osmolarity > 900 && p.access === 'peripheral') warns.push(`Osmolaridade ${osmolarity.toFixed(0)} mOsm/L > 900 — risco de flebite periférica. Reconsiderar acesso central.`)
  if (gir_mg_kg_min > 5) warns.push(`GIR = ${gir_mg_kg_min.toFixed(2)} mg/kg/min > 5 — oxidação máxima excedida. Reduzir glicose ou aumentar insulina.`)
  if (+p.bgl > 200) warns.push(`Glicemia basal ${p.bgl} mg/dL — protocolo de insulina intensivo indicado. Manter < 180 mg/dL durante NP.`)
  if (ca_p_product > 200) warns.push(`Ca × P = ${ca_p_product.toFixed(0)} mEq/L × mmol/L > 200 — precipitação possível. Reduzir cálcio ou fosfato.`)
  if (p.condition === 'renal_ckd') { notes.push('IRC sem diálise: fosfato e potássio limitados. Verificar ionograma antes de iniciar NP.') }
  if (p.lipid_omit) notes.push('Lípidos omitidos — atenção a défice de ácidos gordos essenciais se NP > 7 dias. Reavaliar indicação.')
  if (use_ibw) notes.push(`Obeso: a energia e proteína calculadas com base no PIB (${ibw_val.toFixed(0)} kg) e não no peso actual (${wt_act} kg)`)
  if (+p.insulin > 0) notes.push(`Insulina regular ${p.insulin} UI adicionada à bolsa. Monitorizar glicemia capilar de 4/4h.`)

  return {
    wt_energy, wt_prot, ibw_val, bmr, energy_min, energy_max, energy_kcal, energy_target,
    prot_min_g, prot_max_g, prot_target_g, prot_kcal,
    lipid_g, lipid_kcal, dex_g, dex_kcal, gir_mg_kg_min,
    total_kcal, aa_vol, dex_vol, lip_vol, electrolyte_vol,
    total_vol, rate_mL_h, osmolarity, final_dex_pct,
    na_meq, k_meq, mg_meq, phos_mmol, ca_meq,
    ca_p_product, use_ibw, warns, notes,
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function InputF({ label, value, onChange, suffix, placeholder, type = 'number', note }: {
  label: string; value: string; onChange: (v: string) => void
  suffix?: string; placeholder?: string; type?: string; note?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '—'}
          style={{
            width: '100%', padding: suffix ? '7px 36px 7px 9px' : '7px 9px',
            borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontSize: 'var(--t-dado)',
            background: 'white', color: 'var(--ink)', fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {suffix && <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
      {note && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

function MacroBar({ label, g, kcal, color, pct }: { label: string; g: number; kcal: number; color: string; pct: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{g.toFixed(1)} g</span>
          <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color }}>
            {kcal.toFixed(0)} kcal <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontWeight: 'var(--peso-normal)' as any }}>({pct.toFixed(0)}%)</span>
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 'var(--r-sm)', transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function LabelRow({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--bg-3)' }}>
      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{label}</span>
      <span style={{ fontSize: 'var(--t-dado)', fontWeight: highlight ? 800 : 600, color: highlight ? 'var(--ink)' : 'var(--ink-3)' }}>
        {value}<span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', fontWeight: 'var(--peso-normal)' as any, marginLeft: 2 }}>{unit}</span>
      </span>
    </div>
  )
}

// ─── Print label ──────────────────────────────────────────────────────────────

function PrintLabel({ res, p }: { res: ReturnType<typeof calcTPN>; p: PatientForm }) {
  if (!res) return null
  const date = new Date().toLocaleDateString('pt-PT')
  const time_start = '08:00', time_end = '08:00 (+1)'
  const lipidName = p.lipid_type === 'smof' ? 'SMOFlipid 20%' : p.lipid_type === 'olive' ? 'ClinOleic 20%' : 'Intralipid 20%'

  return (
    <div className="print-label" style={{
      background: 'white', border: '2px solid var(--ink)', borderRadius: 'var(--r)',
      padding: '14px 16px', fontFamily: 'monospace', fontSize: 'var(--t-meta)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, letterSpacing: '-0.01em' }}>NUTRIÇÃO PARENTÉRICA</div>
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-3)', marginTop: 2 }}>
            {p.access === 'central' ? 'VIA CENTRAL' : '◈ VIA PERIFÉRICA'}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'var(--t-micro)' }}>
          <div>Data: {date}</div>
          <div>Início: {time_start}</div>
          <div>Fim: {time_end}</div>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, color: 'var(--ink-3)' }}>Composição / Bolsa</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-meta)' }}>
          <tbody>
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td style={{ padding: '2px 0' }}>Aminoácidos 10%</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{(res.aa_vol).toFixed(0)} mL</td>
              <td style={{ textAlign: 'right', color: 'var(--ink-4)' }}>({res.prot_target_g.toFixed(1)} g)</td>
            </tr>
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>Glicose 70%</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{(res.dex_vol).toFixed(0)} mL</td>
              <td style={{ textAlign: 'right', color: 'var(--ink-4)' }}>({res.dex_g.toFixed(1)} g)</td>
            </tr>
            {!p.lipid_omit && (
              <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
                <td>{lipidName}</td>
                <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{(res.lip_vol).toFixed(0)} mL</td>
                <td style={{ textAlign: 'right', color: 'var(--ink-4)' }}>({res.lipid_g.toFixed(1)} g)</td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>NaCl</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{res.na_meq} mEq</td>
              <td />
            </tr>
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>KCl / KH₂PO₄</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{res.k_meq} mEq / {res.phos_mmol} mmol</td>
              <td />
            </tr>
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>MgSO₄</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{res.mg_meq} mEq</td>
              <td />
            </tr>
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>Gluconato de Ca</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{res.ca_meq} mEq</td>
              <td />
            </tr>
            {+p.insulin > 0 && (
              <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
                <td>Insulina Regular</td>
                <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>{p.insulin} UI</td>
                <td />
              </tr>
            )}
            <tr style={{ borderBottom: '1px dotted var(--border-2)' }}>
              <td>MVIpediatric / Traços</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--peso-forte)' as any }}>10 mL / 1 amp</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, fontSize: 'var(--t-meta)' }}>
        <div>
          <div style={{ fontWeight: 'var(--peso-forte)' as any }}>Volume total</div>
          <div>{res.total_vol} mL</div>
        </div>
        <div>
          <div style={{ fontWeight: 'var(--peso-forte)' as any }}>Velocidade</div>
          <div>{res.rate_mL_h} mL/h</div>
        </div>
        <div>
          <div style={{ fontWeight: 'var(--peso-forte)' as any }}>Osmolaridade</div>
          <div>{res.osmolarity.toFixed(0)} mOsm/L</div>
        </div>
      </div>

      <div style={{ borderTop: '1px dotted var(--border-2)', marginTop: 8, paddingTop: 6, fontSize: 'var(--t-micro)', color: 'var(--ink-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div>Energia total: <strong>{res.total_kcal.toFixed(0)} kcal</strong></div>
        <div>Proteína: <strong>{res.prot_target_g.toFixed(1)} g ({(res.prot_target_g/+p.weight).toFixed(2)} g/kg)</strong></div>
        <div>GIR: <strong>{res.gir_mg_kg_min.toFixed(2)} mg/kg/min</strong></div>
        <div>Glicose final: <strong>{res.final_dex_pct.toFixed(1)}%</strong></div>
      </div>

      <div style={{ borderTop: '1px dotted var(--border-2)', marginTop: 6, paddingTop: 5, display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-micro)', color: 'var(--ink-3)' }}>
        <span>Prescritor: _________________________</span>
        <span>Farmácia: _________________________</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_ELECTROLYTES: Record<Condition, { na: string; k: string; mg: string; phos: string; ca: string }> = {
  maintenance:    { na: '',  k: '',  mg: '16', phos: '30', ca: '10' },
  critically_ill: { na: '',  k: '',  mg: '20', phos: '40', ca: '10' },
  burns:          { na: '',  k: '',  mg: '20', phos: '40', ca: '15' },
  renal_ckd:      { na: '40', k: '20', mg: '8',  phos: '10', ca: '5'  },
  renal_hd:       { na: '80', k: '40', mg: '12', phos: '15', ca: '10' },
  renal_crrt:     { na: '',  k: '40', mg: '20', phos: '30', ca: '10' },
  hepatic:        { na: '60', k: '',  mg: '16', phos: '30', ca: '10' },
  obese_icu:      { na: '',  k: '',  mg: '16', phos: '35', ca: '10' },
  oncology:       { na: '',  k: '',  mg: '16', phos: '30', ca: '10' },
}

export default function TPN() {
  const [showLabel, setShowLabel] = useState(false)
  const [p, setP] = useState<PatientForm>({
    weight: '', height: '', age: '', sex: 'male',
    condition: 'critically_ill', additional_energy: '',
    glucose_limit: '', albumin: '', bgl: '', insulin: '0',
    lipid_type: 'smof', lipid_omit: false, access: 'central',
    ...DEFAULT_ELECTROLYTES.critically_ill,
  })

  const up = <K extends keyof PatientForm>(k: K) => (v: PatientForm[K]) =>
    setP(prev => ({ ...prev, [k]: v }))

  const handleConditionChange = (cond: Condition) => {
    setP(prev => ({ ...prev, condition: cond, ...DEFAULT_ELECTROLYTES[cond] }))
  }

  const res = useMemo(() => calcTPN(p), [p])
  const cond = CONDITIONS[p.condition]

  const prot_pct = res ? (res.prot_kcal / res.total_kcal) * 100 : 0
  const dex_pct  = res ? (res.dex_kcal  / res.total_kcal) * 100 : 0
  const lip_pct  = res ? (res.lipid_kcal / res.total_kcal) * 100 : 0

  const osmo_color = !res ? 'var(--ink-5)'
    : res.osmolarity > 1800 ? 'var(--red)'
    : res.osmolarity > 900 && p.access === 'peripheral' ? 'var(--amber)'
    : 'var(--green)'

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Nutrição parentérica</span>
        </BarraDeTrabalho>
      }
    >

      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '16px 24px 16px', borderBottom: '1px solid var(--ink-2)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              Nutrição Clínica
            </div>
            <h1 style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
              Designer de Nutrição Parentérica
            </h1>
            <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '3px 0 0' }}>
              ASPEN 2022 · ESPEN 2023 · Cálculo completo com rótulo de bolsa
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowLabel(l => !l)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-3)',
                background: showLabel ? 'var(--ink-2)' : 'var(--ink-2)', color: 'white', cursor: 'pointer',
                fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'inherit',
              }}
            >
              {showLabel ? '◀ Esconder rótulo' : 'Pré-visualizar rótulo'}
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: '8px 16px', borderRadius: 'var(--r-md)', border: 'none',
                background: 'var(--green-3)', color: 'white', cursor: 'pointer',
                fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'inherit',
              }}
            >
              🖨 Imprimir rótulo
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {showLabel && res && (
          <div style={{ marginBottom: 24, padding: '20px', background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pré-visualização do Rótulo
            </div>
            <PrintLabel res={res} p={p} />
          </div>
        )}

        <div className="tpn-grid" style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 20 }}>

          {/* ── Left: Inputs ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Patient */}
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span>👤</span> Dados do Doente
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <InputF label="Peso actual" value={p.weight} onChange={up('weight')} suffix="kg" placeholder="70" />
                <InputF label="Altura" value={p.height} onChange={up('height')} suffix="cm" placeholder="170" />
                <InputF label="Idade" value={p.age} onChange={up('age')} suffix="anos" placeholder="65" />
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sexo</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['male', 'female'] as const).map(s => (
                      <button key={s} onClick={() => up('sex')(s)} style={{
                        flex: 1, padding: '7px 4px', borderRadius: 'var(--r-md)', border: `1px solid ${p.sex === s ? 'var(--green-3)' : 'var(--border)'}`,
                        background: p.sex === s ? 'var(--green-light)' : 'white', cursor: 'pointer',
                        fontSize: 'var(--t-meta)', fontWeight: p.sex === s ? 700 : 500,
                        color: p.sex === s ? 'var(--green-3)' : 'var(--ink-4)', fontFamily: 'inherit',
                      }}>
                        {s === 'male' ? '♂ Masc' : '♀ Fem'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <InputF label="Glicemia basal" value={p.bgl} onChange={up('bgl')} suffix="mg/dL" placeholder="120" />
              <InputF label="Albumina sérica" value={p.albumin} onChange={up('albumin')} suffix="g/dL" placeholder="3.0" />
            </div>

            {/* Condition */}
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>Condição Clínica</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(Object.entries(CONDITIONS) as [Condition, typeof CONDITIONS[Condition]][]).map(([id, c]) => (
                  <button key={id} onClick={() => handleConditionChange(id)} style={{
                    padding: '8px 11px', borderRadius: 'var(--r-md)', border: `1px solid ${p.condition === id ? 'var(--green-3)' : 'var(--bg-3)'}`,
                    background: p.condition === id ? 'var(--green-light)' : 'var(--bg-2)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.1s',
                  }}>
                    <div style={{ fontSize: 'var(--t-meta)', fontWeight: p.condition === id ? 700 : 500, color: p.condition === id ? 'var(--green-3)' : 'var(--ink-3)' }}>
                      {c.label}
                    </div>
                    <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 1 }}>
                      Energia {c.energy_min}–{c.energy_max} kcal/kg · Proteína {c.prot_min}–{c.prot_max} g/kg
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Access + Lipids */}
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>⚙️ Formulação</div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Via de acesso</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 'central', l: 'Central' }, { v: 'peripheral', l: 'Periférico' }].map(o => (
                    <button key={o.v} onClick={() => up('access')(o.v as AccessRoute)} style={{
                      flex: 1, padding: '7px 6px', borderRadius: 'var(--r-md)', border: `1px solid ${p.access === o.v ? 'var(--green-3)' : 'var(--border)'}`,
                      background: p.access === o.v ? 'var(--green-light)' : 'white', cursor: 'pointer',
                      fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: p.access === o.v ? 'var(--green-3)' : 'var(--ink-4)', fontFamily: 'inherit',
                    }}>{o.l}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Emulsão lipídica</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[{ v: 'smof', l: 'SMOFlipid' }, { v: 'olive', l: 'ClinOleic' }, { v: 'soy', l: 'Intralipid' }].map(o => (
                    <button key={o.v} onClick={() => up('lipid_type')(o.v as typeof p.lipid_type)} style={{
                      padding: '5px 10px', borderRadius: 'var(--r-md)', border: `1px solid ${p.lipid_type === o.v ? 'var(--roxo)' : 'var(--border)'}`,
                      background: p.lipid_type === o.v ? 'var(--roxo-claro)' : 'white', cursor: 'pointer',
                      fontSize: 'var(--t-meta)', fontWeight: p.lipid_type === o.v ? 700 : 500,
                      color: p.lipid_type === o.v ? 'var(--roxo)' : 'var(--ink-4)', fontFamily: 'inherit',
                    }}>{o.l}</button>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer', fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                  <input type="checkbox" checked={p.lipid_omit} onChange={e => up('lipid_omit')(e.target.checked)} style={{ width: 13, height: 13 }} />
                  Omitir lípidos (TGA &gt; 400 mg/dL ou outra contraindicação)
                </label>
              </div>

              <InputF label="Energia alvo (override)" value={p.additional_energy} onChange={up('additional_energy')} suffix="kcal/dia" note={`Calculado: ${res ? res.energy_min.toFixed(0) : '—'}–${res ? res.energy_max.toFixed(0) : '—'} kcal/dia`} placeholder={res ? ((res.energy_min + res.energy_max) / 2).toFixed(0) : ''} />
              <InputF label="Limite GIR (máx glicose)" value={p.glucose_limit} onChange={up('glucose_limit')} suffix="g/dia" note="Máx recomendada: 5 mg/kg/min" />
            </div>

            {/* Electrolytes */}
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>⚗️ Eletrólitos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <InputF label="Sódio (Na)" value={p.na} onChange={up('na')} suffix="mEq" placeholder={`${res ? Math.round(+p.weight * 1.5) : '~90'}`} note="1–2 mEq/kg/dia" />
                <InputF label="Potássio (K)" value={p.k} onChange={up('k')} suffix="mEq" placeholder={`${res ? Math.round(+p.weight * 1.2) : '~60'}`} note="1–2 mEq/kg/dia" />
                <InputF label="Magnésio (Mg)" value={p.mg} onChange={up('mg')} suffix="mEq" placeholder="16" note="8–20 mEq/dia" />
                <InputF label="Fósforo (PO₄)" value={p.phos} onChange={up('phos')} suffix="mmol" placeholder="30" note="20–40 mmol/dia" />
              </div>
              <InputF label="Cálcio (Ca)" value={p.ca} onChange={up('ca')} suffix="mEq" placeholder="10" note="10–15 mEq/dia" />
              <InputF label="Insulina regular" value={p.insulin} onChange={up('insulin')} suffix="UI" note="Adicionar à bolsa (glicemia > 150 mg/dL)" />
            </div>
          </div>

          {/* ── Right: Results ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {!res ? (
              <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)', padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--t-numero)', marginBottom: 12 }}>🧪</div>
                <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 6 }}>Preencha os dados do doente</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>Peso, altura e idade são necessários para calcular a formulação.</div>
              </div>
            ) : (
              <>
                {/* Warnings */}
                {res.warns.length > 0 && (
                  <div>
                    {res.warns.map((w, i) => (
                      <div key={i} style={{
                        padding: '9px 13px', borderRadius: 'var(--r-lg)', marginBottom: 6,
                        background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)',
                        fontSize: 'var(--t-meta)', color: 'var(--red)', display: 'flex', gap: 7,
                      }}>
                        <span style={{ flexShrink: 0 }}>⚠</span> {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Condition note */}
                {cond.note && (
                  <div style={{ padding: '9px 13px', borderRadius: 'var(--r-lg)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-bg)', fontSize: 'var(--t-meta)', color: 'var(--amber)', display: 'flex', gap: 7 }}>
                    <span>💡</span> {cond.note}
                  </div>
                )}

                {/* Energy summary */}
                <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Balanço Energético</div>
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>
                        Alvo: {cond.energy_min}–{cond.energy_max} kcal/kg · Peso utilizado: {res.wt_energy.toFixed(0)} kg{res.use_ibw ? ' (PIB)' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green-3)', lineHeight: 1 }}>{res.total_kcal.toFixed(0)}</div>
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>kcal/dia ({(res.total_kcal / res.wt_energy).toFixed(0)} kcal/kg)</div>
                    </div>
                  </div>
                  <MacroBar label="Proteína (aminoácidos)" g={res.prot_target_g} kcal={res.prot_kcal} color="var(--ink-2)" pct={prot_pct} />
                  <MacroBar label="Hidratos de carbono (glicose)" g={res.dex_g} kcal={res.dex_kcal} color="var(--green)" pct={dex_pct} />
                  {!p.lipid_omit && <MacroBar label="Lípidos (emulsão)" g={res.lipid_g} kcal={res.lipid_kcal} color="var(--amber)" pct={lip_pct} />}
                </div>

                {/* Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { label: 'Proteína', value: `${(res.prot_target_g / res.wt_prot).toFixed(2)}`, unit: 'g/kg/dia', color: 'var(--ink-2)', note: `${res.prot_target_g.toFixed(1)} g` },
                    { label: 'GIR', value: res.gir_mg_kg_min.toFixed(2), unit: 'mg/kg/min', color: res.gir_mg_kg_min > 5 ? 'var(--red)' : 'var(--green)', note: `Máx 5.0` },
                    { label: 'Osmolaridade', value: res.osmolarity.toFixed(0), unit: 'mOsm/L', color: osmo_color, note: p.access === 'peripheral' ? 'Periférico <900' : 'Central OK' },
                    { label: 'Ca×P', value: res.ca_p_product.toFixed(0), unit: '', color: res.ca_p_product > 200 ? 'var(--red)' : 'var(--green)', note: 'Máx 200 (TNA)' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'white', borderRadius: 'var(--r-xl)', border: `2px solid ${m.color}20`, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: m.color, lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 1 }}>{m.unit}</div>
                      <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: m.color, marginTop: 3 }}>{m.label}</div>
                      <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 1 }}>{m.note}</div>
                    </div>
                  ))}
                </div>

                {/* Formulation */}
                <div style={{ background: 'white', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 14 }}>Formulação da Bolsa</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                    <div>
                      <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Macronutrientes</div>
                      <LabelRow label="Aminoácidos 10%" value={res.aa_vol.toFixed(0)} unit="mL" />
                      <LabelRow label="Glicose 70%" value={res.dex_vol.toFixed(0)} unit="mL" />
                      {!p.lipid_omit && <LabelRow label={`${p.lipid_type === 'smof' ? 'SMOFlipid' : p.lipid_type === 'olive' ? 'ClinOleic' : 'Intralipid'} 20%`} value={res.lip_vol.toFixed(0)} unit="mL" />}
                      <LabelRow label="Eletrólitos / aditivos" value={res.electrolyte_vol.toFixed(0)} unit="mL" />
                      <div style={{ borderTop: '2px solid var(--ink)', marginTop: 6, paddingTop: 6 }}>
                        <LabelRow label="Volume total" value={res.total_vol.toFixed(0)} unit="mL" highlight />
                        <LabelRow label="Velocidade (24h)" value={res.rate_mL_h.toFixed(1)} unit="mL/h" highlight />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Eletrólitos</div>
                      <LabelRow label="Sódio (NaCl)" value={res.na_meq.toString()} unit="mEq" />
                      <LabelRow label="Potássio" value={res.k_meq.toString()} unit="mEq" />
                      <LabelRow label="Magnésio (MgSO₄)" value={res.mg_meq.toString()} unit="mEq" />
                      <LabelRow label="Fósforo (KH₂PO₄)" value={res.phos_mmol.toString()} unit="mmol" />
                      <LabelRow label="Cálcio (gluconato)" value={res.ca_meq.toString()} unit="mEq" />
                      {+p.insulin > 0 && <LabelRow label="Insulina regular" value={p.insulin} unit="UI" />}
                      <div style={{ borderTop: '1px solid var(--bg-3)', marginTop: 6, paddingTop: 6, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                        + MVI 10 mL + Oligoelementos 1 ampola/dia
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {res.notes.length > 0 && (
                  <div>
                    {res.notes.map((n, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', marginBottom: 5, background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 'var(--t-meta)', color: 'var(--ink-2)', display: 'flex', gap: 7 }}>
                        <span>ℹ</span> {n}
                      </div>
                    ))}
                  </div>
                )}

                {/* Guidelines reference */}
                <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--bg-3)', fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                  ASPEN Board of Directors. <em>J Parenter Enteral Nutr.</em> 2022. ·
                  Singer P et al. ESPEN guidelines on clinical nutrition in the ICU. <em>Clin Nutr.</em> 2019;38(1):48–79.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        input:focus, select:focus { border-color:var(--green) !important; box-shadow:0 0 0 3px rgba(13,148,136,0.1); }
        /* Coluna fixa de 340px + conteúdo: a 390px não cabe (transbordava
           147px). Em ecrã estreito passa a uma coluna. */
        @media (max-width: 900px) { .tpn-grid { grid-template-columns: minmax(0,1fr) !important; } }
        @media print {
          .no-print { display:none !important; }
          body { background:white !important; }
          .print-label { border:2px solid black !important; max-width:100% !important; }
        }
      `}</style>
    </Mesa>
  )
}
