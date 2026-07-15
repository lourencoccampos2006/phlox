'use client'

// Referência de diluições/perfusões IV — era a página /dilutions (base de dados de
// 10 fármacos) + a tabela de referência rápida da antiga /iv-calc. Fundido em
// /calculos como um segundo separador (não uma página própria nem um redirect).

import { useState } from 'react'

interface DrugProtocol {
  name: string
  concentration: string
  diluents: string[]
  standardDilutions: { dose: string; volume: string; finalConc: string }[]
  infusionRate?: string
  maxRate?: string
  stabilityRoom: string
  stabilityFridge: string
  lightProtection: boolean
  filterRequired: boolean
  warnings: string[]
  notes?: string
}

const IV_DRUGS: DrugProtocol[] = [
  {
    name: 'Vancomicina', concentration: '500mg/10ml ou 1000mg/20ml (reconstituir)', diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '500mg', volume: '100 ml', finalConc: '5 mg/ml' },
      { dose: '1000mg', volume: '250 ml', finalConc: '4 mg/ml' },
      { dose: '1500mg', volume: '250 ml', finalConc: '6 mg/ml' },
    ],
    infusionRate: 'Mínimo 60 min para 500mg; 90 min para 1g; 120 min para 1.5g',
    maxRate: 'Não ultrapassar 10 mg/min (risco Red Man Syndrome)',
    stabilityRoom: '24 horas', stabilityFridge: '96 horas', lightProtection: false, filterRequired: false,
    warnings: ['Red Man Syndrome se infusão rápida', 'Monitorizar vancocinémia (target: 15-20 mg/L)', 'Nefrotóxico — monitorizar função renal'],
    notes: 'Não administrar em bolus. Ajustar dose pela TFG.',
  },
  {
    name: 'Amiodarona', concentration: '150mg/3ml (50 mg/ml)', diluents: ['G5%'],
    standardDilutions: [
      { dose: '150mg (carga)', volume: '100 ml G5%', finalConc: '1.5 mg/ml' },
      { dose: '900mg (24h)', volume: '500 ml G5%', finalConc: '1.8 mg/ml' },
      { dose: '300mg', volume: '250 ml G5%', finalConc: '1.2 mg/ml' },
    ],
    infusionRate: 'Carga: 150mg em 10 min. Manutenção: 1mg/min (6h) → 0.5mg/min (18h)',
    maxRate: '1.2 mg/ml em periférico; concentrações > 2mg/ml apenas em CVC',
    stabilityRoom: '24 horas (proteger da luz)', stabilityFridge: 'Não recomendado', lightProtection: true, filterRequired: false,
    warnings: ['APENAS em G5% — precipita em NaCl', 'Concentrações > 2mg/ml requerem CVC', 'Hipotensão se infusão rápida', 'Incompatível com muitos fármacos'],
    notes: 'Usar equipamento de PVC ou vidro. Absorve em PVC — usar volume superior ao calculado.',
  },
  {
    name: 'Meropenem', concentration: '500mg ou 1000mg (pó reconstituir)', diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '500mg', volume: '100 ml', finalConc: '5 mg/ml' },
      { dose: '1000mg', volume: '100 ml', finalConc: '10 mg/ml' },
      { dose: '2000mg (infusão prolongada)', volume: '250 ml', finalConc: '8 mg/ml' },
    ],
    infusionRate: 'Standard: 30 min. Infusão prolongada (PK/PD): 3-4 horas', maxRate: 'Sem máximo definido',
    stabilityRoom: '1 hora (reconstituído), 4 horas (diluído)', stabilityFridge: '24 horas (diluído)', lightProtection: false, filterRequired: false,
    warnings: ['Estabilidade limitada após reconstituição', 'Infusão prolongada melhora eficácia para MIC elevado'],
    notes: 'Para infusão prolongada, preparar em 2 bolsas de 4h.',
  },
  {
    name: 'Furosemida', concentration: '10mg/ml (ampoulas 20mg/2ml ou 250mg/25ml)', diluents: ['NaCl 0.9%', 'Lactato de Ringer'],
    standardDilutions: [
      { dose: '40mg', volume: '100 ml', finalConc: '0.4 mg/ml' },
      { dose: '250mg', volume: '250 ml', finalConc: '1 mg/ml' },
      { dose: '500mg', volume: '250 ml', finalConc: '2 mg/ml' },
    ],
    infusionRate: 'Bolus: máx 4mg/min. Infusão contínua: 0.1-1mg/kg/h', maxRate: '4 mg/min (risco ototoxicidade)',
    stabilityRoom: '24 horas', stabilityFridge: '24 horas', lightProtection: true, filterRequired: false,
    warnings: ['Ototóxico se infusão rápida (> 4mg/min)', 'Incompatível com ambiente ácido (G5% pH baixo — usar NaCl)', 'Monitorizar electrólitos'],
    notes: 'Para infusão de alto volume (250mg/25ml) usar apenas NaCl 0.9%.',
  },
  {
    name: 'Midazolam', concentration: '5mg/ml (ampoulas 5mg/1ml, 15mg/3ml, 50mg/10ml)', diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '15mg', volume: '50 ml', finalConc: '0.3 mg/ml' },
      { dose: '50mg', volume: '50 ml', finalConc: '1 mg/ml' },
      { dose: '100mg', volume: '100 ml', finalConc: '1 mg/ml' },
    ],
    infusionRate: 'Sedação: 0.02-0.1 mg/kg/h. Ajustar individualmente.', maxRate: 'Sem máximo em infusão. Bolus IV lento (2-3 min)',
    stabilityRoom: '24 horas', stabilityFridge: '72 horas', lightProtection: false, filterRequired: false,
    warnings: ['Depressor respiratório — ter flumazenil disponível', 'Hipotensão em bolus rápido', 'Acumulação em insuficiência renal/hepática'],
    notes: 'Compatível com muitos fármacos em Y-site. Ver tabela de compatibilidade.',
  },
  {
    name: 'Dopamina', concentration: '200mg/5ml (40 mg/ml)', diluents: ['NaCl 0.9%', 'G5%', 'Lactato de Ringer'],
    standardDilutions: [
      { dose: '200mg', volume: '250 ml', finalConc: '0.8 mg/ml (800 µg/ml)' },
      { dose: '400mg', volume: '250 ml', finalConc: '1.6 mg/ml (1600 µg/ml)' },
      { dose: '800mg', volume: '500 ml', finalConc: '1.6 mg/ml' },
    ],
    infusionRate: 'Renal: 1-5 µg/kg/min. Cardíaca: 5-10 µg/kg/min. Vasopressora: > 10 µg/kg/min', maxRate: '20-50 µg/kg/min',
    stabilityRoom: '24 horas', stabilityFridge: '48 horas', lightProtection: true, filterRequired: false,
    warnings: ['CVC preferencial — extravasão causa necrose tecidular', 'Monitorização hemodinâmica contínua', 'Incompatível com alcalinos (bicarbonato de sódio)'],
    notes: 'Calcular em µg/kg/min. Regra prática: 3 × peso (kg) = mg em 50ml NaCl → 1ml/h = 1µg/kg/min.',
  },
  {
    name: 'Morfina', concentration: '10mg/ml (ampoulas 10mg/1ml)', diluents: ['NaCl 0.9%', 'G5%', 'Água para injectáveis'],
    standardDilutions: [
      { dose: '10mg', volume: '10 ml NaCl', finalConc: '1 mg/ml' },
      { dose: '50mg', volume: '50 ml NaCl', finalConc: '1 mg/ml' },
      { dose: '100mg', volume: '100 ml NaCl', finalConc: '1 mg/ml' },
    ],
    infusionRate: 'Analgesia: 1-10mg/h. PCA: 1mg/bolus, lockout 5-10 min', maxRate: 'Titular pela resposta clínica',
    stabilityRoom: '24 horas', stabilityFridge: '7 dias', lightProtection: true, filterRequired: false,
    warnings: ['Depressor respiratório — ter naloxona disponível', 'Evitar em insuficiência renal grave (acumulação de M6G)', 'Náuseas e vómitos frequentes'],
    notes: 'Acumulação em insuficiência renal. Preferir fentanil em DRC avançada.',
  },
  {
    name: 'Piperacilina/Tazobactam', concentration: '4.5g/pó (4g pip + 0.5g taz)', diluents: ['NaCl 0.9%', 'G5%'],
    standardDilutions: [
      { dose: '4.5g', volume: '100 ml', finalConc: '45 mg/ml' },
      { dose: '4.5g (inf. prolongada)', volume: '250 ml', finalConc: '18 mg/ml' },
    ],
    infusionRate: 'Standard: 30 min. Infusão prolongada: 4 horas (melhora cobertura PK/PD)', maxRate: 'Sem máximo definido',
    stabilityRoom: '12 horas', stabilityFridge: '24 horas', lightProtection: false, filterRequired: false,
    warnings: ['Instabilidade após reconstituição — preparar próximo da administração', 'Ajuste em DRC (TFG < 40)'],
    notes: 'Infusão prolongada (4h) é padrão em UCI para agentes multirresistentes.',
  },
  {
    name: 'Heparina não fraccionada', concentration: '5000 UI/ml', diluents: ['NaCl 0.9%'],
    standardDilutions: [
      { dose: '25.000 UI', volume: '500 ml NaCl', finalConc: '50 UI/ml' },
      { dose: '25.000 UI', volume: '250 ml NaCl', finalConc: '100 UI/ml' },
    ],
    infusionRate: 'Bólus: 80 UI/kg. Manutenção: 18 UI/kg/h (ajustar por aPTT)', maxRate: 'Titular pelo aPTT (alvo 60-100s)',
    stabilityRoom: '24 horas', stabilityFridge: '24 horas', lightProtection: false, filterRequired: false,
    warnings: ['Monitorizar aPTT 6h após início e 6h após cada ajuste', 'Trombocitopenia induzida por heparina (TIH)', 'Antagonista: Sulfato de protamina 1mg/100UI heparina'],
    notes: 'Nomograma de ajuste recomendado. Ver protocolo local.',
  },
  {
    name: 'Propofol', concentration: '10mg/ml (emulsão 1%) ou 20mg/ml (2%)', diluents: ['Não diluir habitualmente. Se necessário: G5% apenas'],
    standardDilutions: [
      { dose: '200mg', volume: '20 ml (1%)', finalConc: '10 mg/ml' },
      { dose: '500mg (1%)', volume: '50 ml seringa', finalConc: '10 mg/ml' },
    ],
    infusionRate: 'Sedação leve: 0.3-4 mg/kg/h. Anestesia: 4-12 mg/kg/h', maxRate: '4 mg/kg/h por > 48h (risco PRIS)',
    stabilityRoom: '6 horas após abertura', stabilityFridge: 'Não refrigerar após abertura', lightProtection: false, filterRequired: true,
    warnings: ['PRIS (Propofol Infusion Syndrome) > 4mg/kg/h por > 48h', 'Contém soja e ovo — alergia', 'Técnica asséptica rigorosa', 'Dor na injecção — pré-medicar com lidocaína'],
    notes: 'Descartar resíduos 6h após abertura. Substituir sistema cada 12h.',
  },
]

const QUICK_REF = [
  { drug: 'Dopamina', conc: '200 mg em 50 mL SGD 5%', result: '4 mg/mL', note: 'Risco de extravasamento — via central preferida' },
  { drug: 'Noradrenalina', conc: '4 mg em 50 mL SF', result: '80 mcg/mL', note: 'Sempre via central; titular para PAM > 65 mmHg' },
  { drug: 'Adrenalina', conc: '1 mg em 50 mL SF', result: '20 mcg/mL', note: 'Preparação de emergência — infusão contínua' },
  { drug: 'Insulina', conc: '50 UI em 50 mL SF', result: '1 UI/mL', note: 'Nunca misturar com outras drogas; monitorizar glicemia horária' },
  { drug: 'Nitroglicerina', conc: '50 mg em 50 mL SGD 5%', result: '1 mg/mL', note: 'Titular para alívio de dor ou PA desejada; fotossensível' },
  { drug: 'Vasopressina', conc: '20 UI em 50 mL SF', result: '0.4 UI/mL', note: 'Choque séptico: 0.03-0.04 UI/min fixo' },
]

const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 14 }

function DrugDetail({ drug, onBack }: { drug: DrugProtocol; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 13, color: '#64748b', cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>← Voltar</button>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ background: '#0d6e42', padding: '18px 22px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', margin: '0 0 4px' }}>{drug.name}</h2>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-mono)' }}>{drug.concentration}</div>
        </div>
        <div style={{ padding: '10px 20px', background: '#fbfaf8', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #e9eaec' }}>
          {drug.lightProtection && <span style={{ fontSize: 10, background: '#fef9c3', color: '#713f12', border: '1px solid #fde68a', borderRadius: 4, padding: '3px 8px' }}>🌑 PROTEGER DA LUZ</span>}
          {drug.filterRequired && <span style={{ fontSize: 10, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 4, padding: '3px 8px' }}>🔽 FILTRO OBRIGATÓRIO</span>}
          <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '3px 8px' }}>🌡 TA: {drug.stabilityRoom}</span>
          <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '3px 8px' }}>❄ Frio: {drug.stabilityFridge}</span>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9eaec' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Diluentes compatíveis</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {drug.diluents.map(d => <span key={d} style={{ fontSize: 12.5, background: '#f0fdf4', color: '#0d6e42', border: '1px solid #bbf7d0', borderRadius: 4, padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>{d}</span>)}
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9eaec' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Diluições standard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#e9eaec', borderRadius: 6, overflow: 'hidden' }}>
            {drug.standardDilutions.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'white' }}>
                {[{ l: 'Dose', v: d.dose }, { l: 'Volume', v: d.volume }, { l: 'Conc. final', v: d.finalConc }].map(({ l, v }, j) => (
                  <div key={l} style={{ padding: '9px 11px', borderRight: j < 2 ? '1px solid #e9eaec' : 'none' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12.5, color: '#0b1120', fontWeight: j === 2 ? 700 : 400 }}>{v}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {drug.infusionRate && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9eaec' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Velocidade de perfusão</div>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.65, margin: 0 }}>{drug.infusionRate}</p>
            {drug.maxRate && <div style={{ marginTop: 6, fontSize: 12, color: '#c53030', fontFamily: 'var(--font-mono)' }}>MÁX: {drug.maxRate}</div>}
          </div>
        )}
        {drug.warnings.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9eaec', background: '#fffbeb' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>⚠ Atenção</div>
            {drug.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#d97706', flexShrink: 0, fontSize: 12 }}>•</span>
                <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{w}</span>
              </div>
            ))}
          </div>
        )}
        {drug.notes && (
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Notas clínicas</div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, margin: 0 }}>{drug.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function IVReference() {
  const [selected, setSelected] = useState<DrugProtocol | null>(null)
  const [search, setSearch] = useState('')
  const filtered = IV_DRUGS.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  if (selected) return <DrugDetail drug={selected} onBack={() => setSelected(null)} />

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar fármaco IV…"
        style={{ width: '100%', maxWidth: 400, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,260px), 1fr))', gap: 1, background: '#e9eaec', border: '1px solid #e9eaec', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        {filtered.map(drug => (
          <button key={drug.name} onClick={() => setSelected(drug)} style={{ background: 'white', border: 'none', padding: '16px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15.5, color: '#0b1120' }}>{drug.name}</div>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {drug.lightProtection && <span style={{ fontSize: 11 }}>🌑</span>}
                {drug.filterRequired && <span style={{ fontSize: 11 }}>🔽</span>}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{drug.concentration}</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13.5 }}>Nenhum fármaco encontrado para "{search}".</div>}

      {!search.trim() && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Preparações rápidas comuns em UCI / Urgência</div>
          <div style={{ ...card, padding: '4px 18px' }}>
            {QUICK_REF.map((r, i) => (
              <div key={r.drug} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,140px) minmax(120px,160px) 1fr', gap: 8, padding: '12px 0', borderBottom: i < QUICK_REF.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120' }}>{r.drug}</div>
                <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'var(--font-mono)' }}>
                  <div>{r.conc}</div>
                  <div style={{ color: '#1d4ed8', fontWeight: 700, marginTop: 2 }}>→ {r.result}</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#854d0e', lineHeight: 1.6 }}>
        ⚕️ Confirma sempre com o Resumo das Características do Medicamento (RCM) e com o protocolo da tua instituição. Velocidades e diluições podem variar por doente e contexto.
      </div>
    </div>
  )
}
