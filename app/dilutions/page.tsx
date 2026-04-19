'use client'

import { useState } from 'react'
import Header from '@/components/Header'

// ─── Data ─────────────────────────────────────────────────────────────────────

interface DrugProtocol {
  name: string
  concentration: string        // concentração habitual
  diluents: string[]           // diluentes compatíveis
  standardDilutions: { dose: string; volume: string; finalConc: string }[]
  infusionRate?: string        // velocidade standard
  maxRate?: string             // velocidade máxima
  stabilityRoom: string        // estabilidade à temp. ambiente
  stabilityFridge: string      // estabilidade no frigorífico
  lightProtection: boolean
  filterRequired: boolean
  warnings: string[]
  notes?: string
}

const IV_DRUGS: DrugProtocol[] = [
  {
    name: 'Vancomicina',
    concentration: '500mg/10ml ou 1000mg/20ml (reconstituir)',
    diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '500mg', volume: '100 ml', finalConc: '5 mg/ml' },
      { dose: '1000mg', volume: '250 ml', finalConc: '4 mg/ml' },
      { dose: '1500mg', volume: '250 ml', finalConc: '6 mg/ml' },
    ],
    infusionRate: 'Mínimo 60 min para 500mg; 90 min para 1g; 120 min para 1.5g',
    maxRate: 'Não ultrapassar 10 mg/min (risco Red Man Syndrome)',
    stabilityRoom: '24 horas',
    stabilityFridge: '96 horas',
    lightProtection: false,
    filterRequired: false,
    warnings: ['Red Man Syndrome se infusão rápida', 'Monitorizar vancocinémia (target: 15-20 mg/L)', 'Nefrotóxico — monitorizar função renal'],
    notes: 'Não administrar em bolus. Ajustar dose pela TFG.',
  },
  {
    name: 'Amiodarona',
    concentration: '150mg/3ml (50 mg/ml)',
    diluents: ['G5%'],
    standardDilutions: [
      { dose: '150mg (carga)', volume: '100 ml G5%', finalConc: '1.5 mg/ml' },
      { dose: '900mg (24h)', volume: '500 ml G5%', finalConc: '1.8 mg/ml' },
      { dose: '300mg', volume: '250 ml G5%', finalConc: '1.2 mg/ml' },
    ],
    infusionRate: 'Carga: 150mg em 10 min. Manutenção: 1mg/min (6h) → 0.5mg/min (18h)',
    maxRate: '1.2 mg/ml em periférico; concentrações > 2mg/ml apenas em CVC',
    stabilityRoom: '24 horas (proteger da luz)',
    stabilityFridge: 'Não recomendado',
    lightProtection: true,
    filterRequired: false,
    warnings: ['APENAS em G5% — precipita em NaCl', 'Concentrações > 2mg/ml requerem CVC', 'Hipotensão se infusão rápida', 'Incompatível com muitos fármacos'],
    notes: 'Usar equipamento de PVC ou vidro. Absorve em PVC — usar volume superior ao calculado.',
  },
  {
    name: 'Meropenem',
    concentration: '500mg ou 1000mg (pó reconstituir)',
    diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '500mg', volume: '100 ml', finalConc: '5 mg/ml' },
      { dose: '1000mg', volume: '100 ml', finalConc: '10 mg/ml' },
      { dose: '2000mg (infusão prolongada)', volume: '250 ml', finalConc: '8 mg/ml' },
    ],
    infusionRate: 'Standard: 30 min. Infusão prolongada (PK/PD): 3-4 horas',
    maxRate: 'Sem máximo definido',
    stabilityRoom: '1 hora (reconstituído), 4 horas (diluído)',
    stabilityFridge: '24 horas (diluído)',
    lightProtection: false,
    filterRequired: false,
    warnings: ['Estabilidade limitada após reconstituição', 'Infusão prolongada melhora eficácia para MIC elevado'],
    notes: 'Para infusão prolongada, preparar em 2 bolsas de 4h.',
  },
  {
    name: 'Furosemida',
    concentration: '10mg/ml (ampoulas 20mg/2ml ou 250mg/25ml)',
    diluents: ['NaCl 0.9%', 'Lactato de Ringer'],
    standardDilutions: [
      { dose: '40mg', volume: '100 ml', finalConc: '0.4 mg/ml' },
      { dose: '250mg', volume: '250 ml', finalConc: '1 mg/ml' },
      { dose: '500mg', volume: '250 ml', finalConc: '2 mg/ml' },
    ],
    infusionRate: 'Bolus: máx 4mg/min. Infusão contínua: 0.1-1mg/kg/h',
    maxRate: '4 mg/min (risco ototoxicidade)',
    stabilityRoom: '24 horas',
    stabilityFridge: '24 horas',
    lightProtection: true,
    filterRequired: false,
    warnings: ['Ototóxico se infusão rápida (> 4mg/min)', 'Incompatível com ambiente ácido (G5% pH baixo — usar NaCl)', 'Monitorizar electrólitos'],
    notes: 'Para infusão de alto volume (250mg/25ml) usar apenas NaCl 0.9%.',
  },
  {
    name: 'Midazolam',
    concentration: '5mg/ml (ampoulas 5mg/1ml, 15mg/3ml, 50mg/10ml)',
    diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '15mg', volume: '50 ml', finalConc: '0.3 mg/ml' },
      { dose: '50mg', volume: '50 ml', finalConc: '1 mg/ml' },
      { dose: '100mg', volume: '100 ml', finalConc: '1 mg/ml' },
    ],
    infusionRate: 'Sedação: 0.02-0.1 mg/kg/h. Ajustar individualmente.',
    maxRate: 'Sem máximo em infusão. Bolus IV lento (2-3 min)',
    stabilityRoom: '24 horas',
    stabilityFridge: '72 horas',
    lightProtection: false,
    filterRequired: false,
    warnings: ['Depressor respiratório — ter flumazenil disponível', 'Hipotensão em bolus rápido', 'Acumulação em insuficiência renal/hepática'],
    notes: 'Compatible com muitos fármacos em Y-site. Ver tabela de compatibilidade.',
  },
  {
    name: 'Dopamina',
    concentration: '200mg/5ml (40 mg/ml)',
    diluents: ['NaCl 0.9%', 'G5%', 'Lactato de Ringer'],
    standardDilutions: [
      { dose: '200mg', volume: '250 ml', finalConc: '0.8 mg/ml (800 µg/ml)' },
      { dose: '400mg', volume: '250 ml', finalConc: '1.6 mg/ml (1600 µg/ml)' },
      { dose: '800mg', volume: '500 ml', finalConc: '1.6 mg/ml' },
    ],
    infusionRate: 'Renal: 1-5 µg/kg/min. Cardíaca: 5-10 µg/kg/min. Vasopressora: > 10 µg/kg/min',
    maxRate: '20-50 µg/kg/min',
    stabilityRoom: '24 horas',
    stabilityFridge: '48 horas',
    lightProtection: true,
    filterRequired: false,
    warnings: ['CVC preferencial — extravasão causa necrose tecidular', 'Monitorização hemodinâmica contínua', 'Incompatível com alcalinos (bicarbonato de sódio)'],
    notes: 'Calcular em µg/kg/min. Regra prática: 3 × peso (kg) = mg em 50ml NaCl → 1ml/h = 1µg/kg/min.',
  },
  {
    name: 'Morfina',
    concentration: '10mg/ml (ampoulas 10mg/1ml)',
    diluents: ['NaCl 0.9%', 'G5%', 'Água para injectáveis'],
    standardDilutions: [
      { dose: '10mg', volume: '10 ml NaCl', finalConc: '1 mg/ml' },
      { dose: '50mg', volume: '50 ml NaCl', finalConc: '1 mg/ml' },
      { dose: '100mg', volume: '100 ml NaCl', finalConc: '1 mg/ml' },
    ],
    infusionRate: 'Analgesia: 1-10mg/h. PCA: 1mg/bolus, lockout 5-10 min',
    maxRate: 'Titular pela resposta clínica',
    stabilityRoom: '24 horas',
    stabilityFridge: '7 dias',
    lightProtection: true,
    filterRequired: false,
    warnings: ['Depressor respiratório — ter naloxona disponível', 'Evitar em insuficiência renal grave (acumulação de metabolito ativo M6G)', 'Náuseas e vómitos frequentes'],
    notes: 'Acumulação em insuficiência renal. Preferir fentanil em DRC avançada.',
  },
  {
    name: 'Piperacilina/Tazobactam',
    concentration: '4.5g/pó (4g pip + 0.5g taz)',
    diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '4.5g', volume: '100 ml', finalConc: '45 mg/ml' },
      { dose: '4.5g (inf. prolongada)', volume: '250 ml', finalConc: '18 mg/ml' },
    ],
    infusionRate: 'Standard: 30 min. Infusão prolongada: 4 horas (melhora cobertura PK/PD)',
    maxRate: 'Sem máximo definido',
    stabilityRoom: '12 horas',
    stabilityFridge: '24 horas',
    lightProtection: false,
    filterRequired: false,
    warnings: ['Instabilidade após reconstituição — preparar próximo da administração', 'Ajuste em DRC (TFG < 40)'],
    notes: 'Infusão prolongada (4h) é padrão em UCI para agentes multirresistentes.',
  },
  {
    name: 'Heparina não fraccionada',
    concentration: '5000 UI/ml',
    diluents: ['NaCl 0.9%'],
    standardDilutions: [
      { dose: '25.000 UI', volume: '500 ml NaCl', finalConc: '50 UI/ml' },
      { dose: '25.000 UI', volume: '250 ml NaCl', finalConc: '100 UI/ml' },
    ],
    infusionRate: 'Bólus: 80 UI/kg. Manutenção: 18 UI/kg/h (ajustar por aPTT)',
    maxRate: 'Titular pelo aPTT (alvo 60-100s)',
    stabilityRoom: '24 horas',
    stabilityFridge: '24 horas',
    lightProtection: false,
    filterRequired: false,
    warnings: ['Monitorizar aPTT 6h após início e 6h após cada ajuste', 'Trombocitopenia induzida por heparina (TIH) — monitorizar plaquetas', 'Antagonista: Sulfato de protamina 1mg/100UI heparina'],
    notes: 'Nomograma de ajuste recomendado. Ver protocolo local.',
  },
  {
    name: 'Propofol',
    concentration: '10mg/ml (emulsão 1%) ou 20mg/ml (2%)',
    diluents: ['Não diluir habitualmente. Se necessário: G5% apenas'],
    standardDilutions: [
      { dose: '200mg', volume: '20 ml (1%)', finalConc: '10 mg/ml' },
      { dose: '500mg (1%)', volume: '50 ml seringa', finalConc: '10 mg/ml' },
    ],
    infusionRate: 'Sedação leve: 0.3-4 mg/kg/h. Anestesia: 4-12 mg/kg/h',
    maxRate: '4 mg/kg/h por > 48h (risco PRIS)',
    stabilityRoom: '6 horas após abertura',
    stabilityFridge: 'Não refrigerar após abertura',
    lightProtection: false,
    filterRequired: true,
    warnings: ['PRIS (Propofol Infusion Syndrome) > 4mg/kg/h por > 48h', 'Contém soja e ovo — alergia', 'Técnica asséptica rigorosa — meio de cultura bacteriano', 'Dor na injecção — pré-medicar com lidocaína'],
    notes: 'Descartar resíduos 6h após abertura. Substituir sistema cada 12h.',
  },
]

// ─── Infusion Rate Calculator ─────────────────────────────────────────────────

function InfusionCalc({ drug }: { drug: DrugProtocol }) {
  const [dose, setDose] = useState('')
  const [volume, setVolume] = useState('')
  const [weight, setWeight] = useState('')
  const [duration, setDuration] = useState('')
  const [result, setResult] = useState<{
    rateMLh: number; rateMlMin: number; drops?: number; doseRateMgKgH?: number
  } | null>(null)

  const calc = () => {
    const d = parseFloat(dose), v = parseFloat(volume), dur = parseFloat(duration)
    if (!v || !dur) return
    const rateMLh = v / dur
    const rateMlMin = rateMLh / 60
    const drops = rateMlMin * 20 // gotejamento com macrogotejador padrão (20 gotas/ml)
    const doseRateMgKgH = (d && parseFloat(weight)) ? (d / parseFloat(weight)) / dur : undefined
    setResult({ rateMLh, rateMlMin, drops, doseRateMgKgH })
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginTop: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Calcular velocidade de perfusão
      </div>
      <div className="card-grid-2" style={{ gap: 8, marginBottom: 10 }}>
        {[
          { key: 'dose', label: 'Dose (mg ou UI)', ph: 'Ex: 1000', val: dose, set: setDose },
          { key: 'volume', label: 'Volume (mL)', ph: 'Ex: 250', val: volume, set: setVolume },
          { key: 'weight', label: 'Peso doente (kg)', ph: 'Ex: 70', val: weight, set: setWeight },
          { key: 'duration', label: 'Duração (horas)', ph: 'Ex: 1.5', val: duration, set: setDuration },
        ].map(({ key, label, ph, val, set }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4, letterSpacing: '0.06em' }}>{label}</label>
            <input type="number" placeholder={ph} value={val} onChange={e => set(e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '7px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        ))}
      </div>
      <button onClick={calc} disabled={!volume || !duration}
        style={{ width: '100%', background: volume && duration ? 'var(--green)' : 'var(--bg-3)', color: volume && duration ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '9px', fontSize: 13, fontWeight: 600, cursor: volume && duration ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: result ? 12 : 0 }}>
        Calcular
      </button>
      {result && (
        <div style={{ border: '1px solid var(--green-mid)', borderRadius: 6, overflow: 'hidden' }}>
          {[
            { label: 'Velocidade', value: `${result.rateMLh.toFixed(1)} mL/h`, highlight: true },
            { label: 'mL/min', value: `${result.rateMlMin.toFixed(2)} mL/min`, highlight: false },
            { label: 'Gotas/min', value: `${Math.round(result.drops || 0)} gotas/min`, highlight: false },
            ...(result.doseRateMgKgH ? [{ label: 'Dose/kg/h', value: `${result.doseRateMgKgH.toFixed(3)} mg/kg/h`, highlight: false }] : []),
          ].map(({ label, value, highlight }, i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: highlight ? 'var(--green-light)' : 'white', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: highlight ? 22 : 16, color: highlight ? 'var(--green)' : 'var(--ink)', fontWeight: highlight ? 700 : 400 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Drug Detail ──────────────────────────────────────────────────────────────

function DrugDetail({ drug, onBack }: { drug: DrugProtocol; onBack: () => void }) {
  const [showCalc, setShowCalc] = useState(false)

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
        ← Voltar
      </button>

      {/* Header */}
      <div style={{ background: 'var(--green)', borderRadius: '6px 6px 0 0', padding: '20px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', margin: '0 0 6px' }}>{drug.name}</h2>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>{drug.concentration}</div>
      </div>

      {/* Badges */}
      <div style={{ background: 'var(--bg-2)', padding: '10px 20px', border: '1px solid var(--border)', borderTop: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {drug.lightProtection && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: '#fef9c3', color: '#713f12', border: '1px solid #fde68a', borderRadius: 4, padding: '3px 8px' }}>🌑 PROTEGER DA LUZ</span>}
        {drug.filterRequired && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 4, padding: '3px 8px' }}>🔽 FILTRO OBRIGATÓRIO</span>}
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', color: 'var(--ink-4)', borderRadius: 4, padding: '3px 8px' }}>🌡 TA: {drug.stabilityRoom}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', color: 'var(--ink-4)', borderRadius: 4, padding: '3px 8px' }}>❄ Frio: {drug.stabilityFridge}</span>
      </div>

      {/* Main content */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', background: 'white' }}>
        {/* Diluents */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Diluentes compatíveis</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {drug.diluents.map(d => <span key={d} style={{ fontSize: 13, background: 'var(--green-light)', color: 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 4, padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>{d}</span>)}
          </div>
        </div>

        {/* Standard dilutions */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Diluições standard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {drug.standardDilutions.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, background: 'white' }}>
                {[{ label: 'Dose', val: d.dose }, { label: 'Volume', val: d.volume }, { label: 'Conc. final', val: d.finalConc }].map(({ label, val }, j) => (
                  <div key={label} style={{ padding: '10px 12px', borderRight: j < 2 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: j === 2 ? 600 : 400 }}>{val}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Infusion rate */}
        {drug.infusionRate && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Velocidade de perfusão</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{drug.infusionRate}</p>
            {drug.maxRate && <div style={{ marginTop: 6, fontSize: 12, color: '#c53030', fontFamily: 'var(--font-mono)' }}>MÁX: {drug.maxRate}</div>}
          </div>
        )}

        {/* Warnings */}
        {drug.warnings.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#fffbeb' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>⚠ Atenção</div>
            {drug.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#d97706', flexShrink: 0, fontSize: 12 }}>•</span>
                <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {drug.notes && (
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Notas clínicas</div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{drug.notes}</p>
          </div>
        )}
      </div>

      {/* Infusion rate calculator */}
      <button onClick={() => setShowCalc(!showCalc)}
        style={{ width: '100%', marginTop: 12, background: showCalc ? 'var(--green)' : 'white', color: showCalc ? 'white' : 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
        {showCalc ? '▾ Esconder calculadora' : '▸ Calcular velocidade de perfusão →'}
      </button>
      {showCalc && <InfusionCalc drug={drug} />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DilutionsPage() {
  const [selected, setSelected] = useState<DrugProtocol | null>(null)
  const [search, setSearch] = useState('')

  const filtered = IV_DRUGS.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {selected ? (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <DrugDetail drug={selected} onBack={() => setSelected(null)} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Diluições e Perfusões IV</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, margin: '0 0 20px' }}>
                Protocolos de diluição, velocidades de perfusão, estabilidade e calculadora integrada. {IV_DRUGS.length} fármacos.
              </p>

              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar fármaco IV..."
                style={{ width: '100%', maxWidth: 400, border: '1px solid var(--border-2)', borderRadius: 6, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
            </div>

            <div className="card-grid-2" style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {filtered.map(drug => (
                <button key={drug.name} onClick={() => setSelected(drug)}
                  style={{ background: 'white', border: 'none', padding: '20px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{drug.name}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {drug.lightProtection && <span style={{ fontSize: 12 }}>🌑</span>}
                      {drug.filterRequired && <span style={{ fontSize: 12 }}>🔽</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{drug.concentration}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {drug.diluents.slice(0,2).map(d => (
                      <span key={d} style={{ fontSize: 10, background: 'var(--green-light)', color: 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 3, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>{d}</span>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}>TA: {drug.stabilityRoom}</span>
                  </div>
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                Nenhum fármaco encontrado para "{search}"
              </div>
            )}

            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              ⚕️ Confirma sempre com o Resumo das Características do Medicamento (RCM) e com o protocolo da tua instituição. Velocidades e diluições podem variar por doente e contexto.
            </div>
          </>
        )}
      </div>
    </div>
  )
}