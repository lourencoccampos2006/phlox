'use client'

import { useState, useRef } from 'react'

// ─── Drug database ─────────────────────────────────────────────────────────────
interface Drug {
  name: string
  dose?: string // e.g. "0.1 mg/kg" or "1 mg fixed"
  doseMin?: number; doseMax?: number // mg/kg range
  doseFixed?: number // fixed dose mg
  unit: string // "mg" | "mcg" | "mL" | "mmol"
  concentration?: string // "1mg/mL", "10mg/mL", etc.
  route: string
  note?: string
  warning?: string
  maxDose?: number // max mg
  category: string
  color: string
  perKg: boolean // true = weight-based
}

const DRUGS: Drug[] = [
  // ─── CARDIAC ARREST ──────────────────────────────────────────────────────────
  { category: 'Paragem Cardiorrespiratória', color: '#dc2626', perKg: false,
    name: 'Adrenalina (Epinefrina)', doseFixed: 1, unit: 'mg',
    concentration: '1mg/10mL (1:10.000)', route: 'IV/IO',
    note: 'Repetir a cada 3-5 min. Primeira dose em PCR: 1mg IV bolus.',
    warning: 'Não misturar com bicarbonato na mesma via.' },
  { category: 'Paragem Cardiorrespiratória', color: '#dc2626', perKg: false,
    name: 'Amiodarona (FV/TV sem pulso)', doseFixed: 300, unit: 'mg',
    concentration: '50mg/mL — diluir em 20mL SG5%', route: 'IV bolus',
    note: '1ª dose: 300mg. 2ª dose (se necessário): 150mg.',
    warning: 'Pode causar hipotensão e bradicardia.' },
  { category: 'Paragem Cardiorrespiratória', color: '#dc2626', perKg: true,
    name: 'Bicarbonato 8.4%', doseMin: 1, doseMax: 1, unit: 'mL/kg',
    concentration: '1mEq/mL', route: 'IV lento',
    note: 'Usar apenas em acidose metabólica grave documentada ou hipercaliemia.' },
  { category: 'Paragem Cardiorrespiratória', color: '#dc2626', perKg: false,
    name: 'Atropina (assistolia/BAV)', doseFixed: 1, unit: 'mg',
    concentration: '0.5mg/mL ou 1mg/mL', route: 'IV bolus',
    note: 'Dose máxima 3mg. Repetir cada 3-5min. Para assistolia: 1mg.' },

  // ─── ARRITMIAS ────────────────────────────────────────────────────────────────
  { category: 'Arritmias', color: '#9333ea', perKg: false,
    name: 'Adenosina (TSVP)', doseFixed: 6, unit: 'mg',
    concentration: '3mg/mL', route: 'IV rápido (bolus + flush)',
    note: '1ª dose: 6mg. Se ineficaz após 1-2 min: 12mg. Pode repetir 12mg.',
    warning: 'Injetar na antecubital. Flush imediato com 20mL SF.' },
  { category: 'Arritmias', color: '#9333ea', perKg: true,
    name: 'Lidocaína IV', doseMin: 1, doseMax: 1.5, maxDose: 100, unit: 'mg',
    concentration: '20mg/mL', route: 'IV bolus lento',
    note: 'Alternativa à amiodarona em FV/TV. Manutenção: 1-4 mg/min.' },
  { category: 'Arritmias', color: '#9333ea', perKg: false,
    name: 'Verapamil IV', doseFixed: 5, unit: 'mg',
    concentration: '2.5mg/mL', route: 'IV lento (2-3 min)',
    note: '5mg. Se ineficaz após 10-15min: 10mg. NUNCA com betabloqueador IV.',
    warning: 'Contraindicado em WPW, disfunção sistólica grave, betabloqueador IV.' },
  { category: 'Arritmias', color: '#9333ea', perKg: false,
    name: 'Metoprolol IV', doseFixed: 5, unit: 'mg',
    concentration: '1mg/mL', route: 'IV lento (1-2 min)',
    note: '5mg. Pode repetir x3 com intervalo de 5 min. Max: 15mg.' },
  { category: 'Arritmias', color: '#9333ea', perKg: false,
    name: 'MgSO4 (Torsades)', doseFixed: 2000, unit: 'mg',
    concentration: '500mg/mL — diluir 2g em 100mL SG5%', route: 'IV 15 min',
    note: '2g IV em 15min. Repetir se necessário. Também para eclâmpsia e status asthmaticus.' },

  // ─── RSI ─────────────────────────────────────────────────────────────────────
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Ketamina (indutor RSI)', doseMin: 1.5, doseMax: 2, maxDose: 200, unit: 'mg',
    concentration: '50mg/mL ou 10mg/mL', route: 'IV bolus',
    note: 'Indicado em broncoespasmo, choque, trauma. Efeito em 45-60s. Duração: 10-15min.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Etomidato (indutor RSI)', doseMin: 0.3, doseMax: 0.3, maxDose: 40, unit: 'mg',
    concentration: '2mg/mL', route: 'IV bolus',
    note: 'Indicado em doente hemodinamicamente instável. Efeito em 30-60s. Duração: 3-5min.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Propofol (indutor RSI)', doseMin: 1.5, doseMax: 2, maxDose: 200, unit: 'mg',
    concentration: '10mg/mL', route: 'IV bolus lento',
    note: 'Evitar em hipotensão. Reduzir dose em idosos (0.5-1mg/kg).',
    warning: 'Hipotensão frequente. Ter preparado vasopressor.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Rocurônio (bloqueador NM)', doseMin: 0.9, doseMax: 1.2, maxDose: 200, unit: 'mg',
    concentration: '10mg/mL', route: 'IV rápido',
    note: 'RSI standard: 1.2mg/kg. Revertível com sugamadex (16mg/kg).' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Succinilcolina (bloqueador NM)', doseMin: 1, doseMax: 1.5, maxDose: 200, unit: 'mg',
    concentration: '50mg/mL', route: 'IV rápido',
    note: 'Início em 45-60s. Duração 8-10min. Contraindicada em hipercaliemia, queimados > 72h, esmagamento.',
    warning: 'Contraindicada em hipercaliemia, pseudocolinesterase déficit, história de HM.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: '#1d4ed8', perKg: true,
    name: 'Sugamadex (reversão rocurônio)', doseMin: 16, doseMax: 16, maxDose: 200, unit: 'mg',
    concentration: '200mg/2mL', route: 'IV bolus',
    note: 'Reversão imediata: 16mg/kg. Reversão moderada: 4mg/kg. Reversão ligeira: 2mg/kg.' },

  // ─── SEDAÇÃO / ANALGESIA ──────────────────────────────────────────────────────
  { category: 'Sedação e Analgesia', color: '#d97706', perKg: true,
    name: 'Midazolam IV', doseMin: 0.05, doseMax: 0.1, maxDose: 10, unit: 'mg',
    concentration: '5mg/mL ou 1mg/mL', route: 'IV lento',
    note: 'Titulação em bolus de 1mg. Reduzir dose em idosos, ICC, doença hepática.' },
  { category: 'Sedação e Analgesia', color: '#d97706', perKg: true,
    name: 'Fentanil IV', doseMin: 1, doseMax: 2, maxDose: 200, unit: 'mcg',
    concentration: '50mcg/mL', route: 'IV lento (1-2 min)',
    note: 'Analgesia em bolus. Para procedimento: 1-2mcg/kg. Titulação: 25-50mcg.' },
  { category: 'Sedação e Analgesia', color: '#d97706', perKg: true,
    name: 'Morfina IV', doseMin: 0.05, doseMax: 0.1, maxDose: 15, unit: 'mg',
    concentration: '10mg/mL — diluir', route: 'IV lento (5 min)',
    note: 'Titulação em bolus de 2-4mg. Monitorizar SpO2 e FR. Ter naloxona disponível.' },
  { category: 'Sedação e Analgesia', color: '#d97706', perKg: true,
    name: 'Ketamina IM (procedimento)', doseMin: 4, doseMax: 6, maxDose: 500, unit: 'mg',
    concentration: '50mg/mL', route: 'IM',
    note: 'Para procedimentos em pediatria e adultos. Ter midazolam disponível para delírio de emergência.' },

  // ─── VASOPRESSORES ────────────────────────────────────────────────────────────
  { category: 'Vasopressores e Inotrópicos', color: '#0f172a', perKg: false,
    name: 'Noradrenalina (Norepinefrina)', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '4mg/50mL (80mcg/mL)', route: 'IV via central',
    note: 'Início: 0.01-0.1 mcg/kg/min. Titular para PAM ≥ 65mmHg. Vasopressor 1ª linha em choque sético.' },
  { category: 'Vasopressores e Inotrópicos', color: '#0f172a', perKg: false,
    name: 'Dopamina', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '200mg/50mL', route: 'IV via central',
    note: 'Inotrópico: 5-10mcg/kg/min. Vasopressor: 10-20mcg/kg/min. Menor preferência que noradrenalina.' },
  { category: 'Vasopressores e Inotrópicos', color: '#0f172a', perKg: false,
    name: 'Dobutamina', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '250mg/50mL', route: 'IV via central',
    note: 'Inotrópico: 2.5-10mcg/kg/min. Indicado em IC com hipoperfusão e PAM adequada.' },

  // ─── ANTÍDOTOS ────────────────────────────────────────────────────────────────
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: true,
    name: 'Naloxona (reversão opioides)', doseMin: 0.01, doseMax: 0.02, maxDose: 2, unit: 'mg',
    concentration: '0.4mg/mL', route: 'IV/IM/SC/IN',
    note: 'Titulação em doses de 0.1-0.4mg IV cada 2-3min até resposta. Em intoxicação grave: 2mg bolus.',
    warning: 'Precaução em dependentes: pode precipitar abstinência aguda.' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: false,
    name: 'Flumazenil (reversão BZD)', doseFixed: 0.2, unit: 'mg',
    concentration: '0.1mg/mL', route: 'IV lento (30 seg)',
    note: '0.2mg. Se sem resposta após 1min: 0.1mg. Max 1mg total.',
    warning: 'Contraindicado em dependência de BZD (risco de status epilepticus).' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: true,
    name: 'N-Acetilcisteína (paracetamol)', doseMin: 150, doseMax: 150, maxDose: 15000, unit: 'mg',
    concentration: '200mg/mL — diluir em 200mL SG5%', route: 'IV em 60 min',
    note: 'Dose de carga: 150mg/kg em 1h. 2ª fase: 50mg/kg em 4h. 3ª fase: 100mg/kg em 16h.' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: false,
    name: 'Glucagom (hipoglicemia grave)', doseFixed: 1, unit: 'mg',
    concentration: '1mg/mL reconstituído', route: 'IM/SC/IV',
    note: '1mg IM/SC. Alternativa: Dextrose 50% 25g IV. Para bloqueador beta e bloqueador Ca grave: 3-5mg.' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: false,
    name: 'Vitamina K IV (reversão AVK)', doseFixed: 10, unit: 'mg',
    concentration: '10mg/mL', route: 'IV lento (≥ 30 min)',
    note: 'Reversão urgente: 10mg IV + CCP (Octaplex). Reversão não urgente: 1-5mg IV.',
    warning: 'Risco de anafilaxia. Infusão lenta. Ter adrenalina disponível.' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: false,
    name: 'Atropina (organofosforados)', doseFixed: 2, unit: 'mg',
    concentration: '0.5mg/mL ou 1mg/mL', route: 'IV a cada 5-10 min',
    note: 'Dose inicial: 2-4mg IV. Repetir cada 5-10min até secar secreções. Doses de 10-20mg+ em casos graves.' },
  { category: 'Antídotos e Emergências Específicas', color: '#059669', perKg: false,
    name: 'Gluconato de Ca 10% (hipocalcemia / hipercaliemia)', doseFixed: 1000, unit: 'mg',
    concentration: '100mg/mL (10mL/amp)', route: 'IV lento (10-20 min)',
    note: '10-20mL. Para hipercaliemia: 10mL IV em 5min (protege miocárdio). Para hipocalcemia: 10mL em 10min.' },

  // ─── NEUROLÓGICA ──────────────────────────────────────────────────────────────
  { category: 'Emergência Neurológica', color: '#6d28d9', perKg: true,
    name: 'Manitol 20% (HIC)', doseMin: 0.5, doseMax: 1, maxDose: 100, unit: 'g/kg',
    concentration: '200mg/mL', route: 'IV em 20-30 min',
    note: 'Calcular volume = (dose em g/kg × peso) / 0.2. Ex: 1g/kg em 80kg = 400mL de 20%.',
    warning: 'Monitorizar osmolalidade (máx 320 mOsm/L) e eletrólitos.' },
  { category: 'Emergência Neurológica', color: '#6d28d9', perKg: true,
    name: 'Valproato IV (status epilepticus)', doseMin: 20, doseMax: 40, maxDose: 3000, unit: 'mg',
    concentration: '100mg/mL', route: 'IV em 10 min',
    note: 'Loading: 20-40mg/kg IV em 10min. Manutenção: 1-2mg/kg/h.' },
  { category: 'Emergência Neurológica', color: '#6d28d9', perKg: true,
    name: 'Levetiracetam IV (status epilepticus)', doseMin: 30, doseMax: 60, maxDose: 4500, unit: 'mg',
    concentration: '100mg/mL — diluir em 100mL SF', route: 'IV em 15 min',
    note: 'Loading: 30-60mg/kg IV. Máx 4.5g. Perfil de segurança favorável, sem interações relevantes.' },
  { category: 'Emergência Neurológica', color: '#6d28d9', perKg: true,
    name: 'Fenitoína IV (status epilepticus)', doseMin: 15, doseMax: 20, maxDose: 1500, unit: 'mg',
    concentration: '50mg/mL — diluir em SF', route: 'IV ≤ 50mg/min',
    note: 'Loading: 15-20mg/kg, máx 50mg/min. Monitorizar ECG. Contraindicado: bradicardia, BAV.',
    warning: 'Hipotensão e arritmias se infusão rápida. Máximo 50mg/min.' },

  // ─── METABÓLICA ───────────────────────────────────────────────────────────────
  { category: 'Emergência Metabólica', color: '#0369a1', perKg: false,
    name: 'Dextrose 50% (hipoglicemia)', doseFixed: 25, unit: 'g',
    concentration: '500mg/mL — 50mL IV', route: 'IV bolus lento',
    note: '25g = 50mL de D50%. Repetir se glicemia < 3.9 mmol/L após 15min. Via central preferível.' },
  { category: 'Emergência Metabólica', color: '#0369a1', perKg: false,
    name: 'Insulina Regular IV (CAD/HHNS)', doseFixed: 0, unit: 'UI/h',
    concentration: '1 UI/mL (100UI em 100mL SF)', route: 'IV perfusão',
    note: 'CAD: 0.1 UI/kg/h. Hipercaliemia: 10 UI regular + 50g dextrose. Monitorizar K+.' },
  { category: 'Emergência Metabólica', color: '#0369a1', perKg: false,
    name: 'MgSO4 (eclâmpsia)', doseFixed: 4000, unit: 'mg',
    concentration: 'Diluir 4g em 100mL SG5%', route: 'IV em 20 min',
    note: '4g loading em 20min, depois 1-2g/h manutenção. Monitorizar reflexo patelar e FR.' },
]

const CATEGORIES = Array.from(new Set(DRUGS.map(d => d.category)))

function calcDose(drug: Drug, weight: number): { value: string; volume: string } {
  if (!drug.perKg) {
    const v = drug.doseFixed!
    return { value: `${v} ${drug.unit}`, volume: '' }
  }
  const lo = drug.doseMin! * weight
  const hi = drug.doseMax! * weight
  const maxed = drug.maxDose ? ` (max ${drug.maxDose}${drug.unit})` : ''
  if (lo === hi) {
    const actual = drug.maxDose ? Math.min(lo, drug.maxDose) : lo
    return { value: `${actual.toFixed(1)} ${drug.unit}${maxed}`, volume: '' }
  }
  const actualLo = drug.maxDose ? Math.min(lo, drug.maxDose) : lo
  const actualHi = drug.maxDose ? Math.min(hi, drug.maxDose) : hi
  return { value: `${actualLo.toFixed(1)} – ${actualHi.toFixed(1)} ${drug.unit}${maxed}`, volume: '' }
}

export default function EmergencyDosesPage() {
  const [weight, setWeight] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0])
  const [search, setSearch] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const w = parseFloat(weight)
  const hasWeight = !isNaN(w) && w > 0

  const filtered = DRUGS.filter(d =>
    d.category === activeCategory &&
    (!search || d.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '20px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>EMERGÊNCIA MÉDICA</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', fontWeight: 400 }}>Doses de Emergência</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                Calculadas por peso · RSI, paragem, antídotos, vasopressores
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '8px 14px' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Peso</span>
                <input
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="kg"
                  type="number"
                  style={{ width: 64, background: 'transparent', border: 'none', outline: 'none', fontSize: 20, fontWeight: 700, color: hasWeight ? '#34d399' : 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>kg</span>
              </div>
              <button onClick={() => window.print()}
                style={{ padding: '9px 16px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 20, paddingBottom: 40 }}>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar fármaco..."
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'white', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
        </div>

        {/* Category tabs */}
        {!search && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {CATEGORIES.map(cat => {
              const drug = DRUGS.find(d => d.category === cat)
              const color = drug?.color || '#6b7280'
              const isActive = activeCategory === cat
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${isActive ? color : '#334155'}`, background: isActive ? `${color}22` : 'transparent', color: isActive ? color : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  {cat.split('(')[0].trim()}
                </button>
              )
            })}
          </div>
        )}

        {/* Not weight warning */}
        {!hasWeight && (
          <div style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #f59e0b44', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>⚖️</span>
            <span style={{ fontSize: 13, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>Introduz o peso do doente para calcular as doses individualizadas.</span>
          </div>
        )}

        {/* Drug cards */}
        <div ref={printRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(search ? DRUGS.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : filtered).map((drug, i) => {
            const calc = hasWeight ? calcDose(drug, w) : null
            return (
              <div key={i} style={{ background: '#1e293b', border: `1px solid ${drug.color}33`, borderLeft: `3px solid ${drug.color}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 3 }}>{drug.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: drug.color, background: `${drug.color}22`, padding: '2px 8px', borderRadius: 3 }}>{drug.route}</span>
                      {drug.concentration && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)' }}>{drug.concentration}</span>}
                    </div>
                    {drug.note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{drug.note}</div>}
                    {drug.warning && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#f87171', fontFamily: 'var(--font-mono)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0 }}>⚠</span>{drug.warning}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {calc ? (
                      <div>
                        <div style={{ fontSize: drug.perKg ? 20 : 22, fontWeight: 800, color: drug.color, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{calc.value}</div>
                        {drug.perKg && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>para {w}kg</div>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                        {drug.perKg ? `${drug.doseMin}–${drug.doseMax} ${drug.unit}/kg` : `${drug.doseFixed} ${drug.unit}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 24, padding: '12px 16px', background: '#1e293b', borderRadius: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, textAlign: 'center' }}>
          Ferramenta de apoio à decisão — verificar sempre dose, indicação e contraindicações antes de administrar.
          Baseado em guidelines ACLS, ERC 2021, NICE e SmPC. Uso exclusivo por profissionais de saúde.
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
