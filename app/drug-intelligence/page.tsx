'use client'
import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormularyStatus = 'approved' | 'restricted' | 'non_formulary' | 'under_review'
type ShortageLevel = 'critical' | 'severe' | 'moderate' | 'resolved'
type DrugClass = 'antibiotics' | 'anticoagulants' | 'analgesics' | 'antihypertensives' | 'antidiabetics' | 'oncology' | 'other'

interface FormularyDrug {
  id: string
  name: string
  generic: string
  class: DrugClass
  atc: string
  form: string
  strength: string
  status: FormularyStatus
  restricted_to?: string
  alternatives?: string[]
  unit_cost: number
  monthly_usage: number
  stock_days: number
  ddd_per_100: number | null
  last_reviewed: string
}

interface Shortage {
  id: string
  drug: string
  generic: string
  severity: ShortageLevel
  since: string
  expected_resolution: string
  reason: string
  alternatives: string[]
  affected_units: string[]
  notes: string
}

interface DDDEntry {
  drug: string
  atc: string
  ddd_value: number
  ddd_unit: string
  current_100: number
  prev_100: number
  trend: number
  benchmark_100: number
  flag: 'high' | 'ok' | 'low'
}

interface CostEntry {
  class: string
  budget: number
  actual: number
  prev_actual: number
  top_drug: string
  top_cost: number
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const FORMULARY: FormularyDrug[] = [
  { id: 'f1',  name: 'Vancomicina 500mg IV',     generic: 'vancomycin',     class: 'antibiotics',       atc: 'J01XA01', form: 'IV', strength: '500mg',   status: 'restricted',     restricted_to: 'MRSA confirmado ou suspeito — aprovação farmácia', alternatives: ['teicoplanin'], unit_cost: 12.40, monthly_usage: 180, stock_days: 21, ddd_per_100: 8.2,  last_reviewed: '2026-03-15' },
  { id: 'f2',  name: 'Piperacilina/Tazobactam',  generic: 'pip/tazo',       class: 'antibiotics',       atc: 'J01CR05', form: 'IV', strength: '4,5g',    status: 'approved',       alternatives: ['meropenem'], unit_cost: 7.80, monthly_usage: 320, stock_days: 18, ddd_per_100: 15.4, last_reviewed: '2026-03-15' },
  { id: 'f3',  name: 'Meropenem 1g IV',           generic: 'meropenem',      class: 'antibiotics',       atc: 'J01DH02', form: 'IV', strength: '1g',      status: 'restricted',     restricted_to: 'Infeção grave confirmada ou ESBL — prescrição justificada', unit_cost: 18.60, monthly_usage: 95, stock_days: 25, ddd_per_100: 4.1, last_reviewed: '2026-03-15' },
  { id: 'f4',  name: 'Amoxicilina/Clavulanato',  generic: 'amox/clav',      class: 'antibiotics',       atc: 'J01CR02', form: 'oral', strength: '875/125mg', status: 'approved',     unit_cost: 0.65, monthly_usage: 480, stock_days: 35, ddd_per_100: 22.8, last_reviewed: '2026-04-01' },
  { id: 'f5',  name: 'Enoxaparina 40mg SC',       generic: 'enoxaparin',     class: 'anticoagulants',    atc: 'B01AB05', form: 'SC',  strength: '40mg',    status: 'approved',       unit_cost: 2.10, monthly_usage: 950, stock_days: 28, ddd_per_100: null, last_reviewed: '2026-02-10' },
  { id: 'f6',  name: 'Varfarina 5mg oral',        generic: 'warfarin',       class: 'anticoagulants',    atc: 'B01AA03', form: 'oral', strength: '5mg',    status: 'approved',       unit_cost: 0.12, monthly_usage: 1200, stock_days: 60, ddd_per_100: null, last_reviewed: '2026-02-10' },
  { id: 'f7',  name: 'Morfina 10mg/ml IV',        generic: 'morphine',       class: 'analgesics',        atc: 'N02AA01', form: 'IV',  strength: '10mg/ml', status: 'restricted',     restricted_to: 'Dor moderada-grave — registo SIEVERT obrigatório', unit_cost: 1.85, monthly_usage: 220, stock_days: 30, ddd_per_100: null, last_reviewed: '2026-01-20' },
  { id: 'f8',  name: 'Fentanilo 50mcg/ml IV',     generic: 'fentanyl',       class: 'analgesics',        atc: 'N01AH01', form: 'IV',  strength: '50mcg/ml', status: 'restricted',    restricted_to: 'UCI/BO — anestesia/sedação', unit_cost: 3.20, monthly_usage: 140, stock_days: 22, ddd_per_100: null, last_reviewed: '2026-01-20' },
  { id: 'f9',  name: 'Metformina 850mg oral',     generic: 'metformin',      class: 'antidiabetics',     atc: 'A10BA02', form: 'oral', strength: '850mg', status: 'approved',        unit_cost: 0.08, monthly_usage: 2400, stock_days: 45, ddd_per_100: null, last_reviewed: '2026-04-05' },
  { id: 'f10', name: 'Insulina Glargina 100U/ml', generic: 'glargine',       class: 'antidiabetics',     atc: 'A10AE04', form: 'SC',  strength: '100U/ml', status: 'approved',       unit_cost: 28.50, monthly_usage: 380, stock_days: 20, ddd_per_100: null, last_reviewed: '2026-03-01' },
  { id: 'f11', name: 'Amlodipina 5mg oral',       generic: 'amlodipine',     class: 'antihypertensives', atc: 'C08CA01', form: 'oral', strength: '5mg',   status: 'approved',        unit_cost: 0.09, monthly_usage: 3100, stock_days: 60, ddd_per_100: null, last_reviewed: '2026-04-01' },
  { id: 'f12', name: 'Ramipril 5mg oral',         generic: 'ramipril',       class: 'antihypertensives', atc: 'C09AA05', form: 'oral', strength: '5mg',   status: 'approved',        unit_cost: 0.11, monthly_usage: 2800, stock_days: 55, ddd_per_100: null, last_reviewed: '2026-04-01' },
  { id: 'f13', name: 'Oxaliplatina 100mg IV',     generic: 'oxaliplatin',    class: 'oncology',          atc: 'L01XA03', form: 'IV',  strength: '100mg',  status: 'restricted',      restricted_to: 'Oncologia — protocolo FOLFOX/XELOX aprovado', unit_cost: 245.00, monthly_usage: 28, stock_days: 14, ddd_per_100: null, last_reviewed: '2026-02-28' },
  { id: 'f14', name: 'Ceftriaxone 2g IV',         generic: 'ceftriaxone',    class: 'antibiotics',       atc: 'J01DD04', form: 'IV',  strength: '2g',     status: 'approved',        unit_cost: 3.40, monthly_usage: 560, stock_days: 30, ddd_per_100: 18.9, last_reviewed: '2026-03-15' },
  { id: 'f15', name: 'Linezolida 600mg IV',       generic: 'linezolid',      class: 'antibiotics',       atc: 'J01XX08', form: 'IV',  strength: '600mg',  status: 'under_review',    restricted_to: 'VRE / MRSA grave — ID obrigatório', alternatives: ['vancomycin', 'daptomycin'], unit_cost: 89.00, monthly_usage: 12, stock_days: 15, ddd_per_100: 0.8, last_reviewed: '2026-04-10' },
]

const SHORTAGES: Shortage[] = [
  {
    id: 's1', drug: 'Midazolam 5mg/ml IV', generic: 'midazolam',
    severity: 'critical', since: '2026-04-28', expected_resolution: '2026-06-15',
    reason: 'Rutura global de fornecimento — fabricante único em manutenção de planta',
    alternatives: ['Diazepam IV (dose equivalente: 2mg midazolam = 1mg diazepam)', 'Lorazepam IV (disponível no INFARMED)'],
    affected_units: ['UCI', 'BO', 'Urgência', 'Neonatologia'],
    notes: 'Reserva estratégica em uso. Máximo 2 ampolas/doente/dia. Comunicar ao INFARMED via plataforma SINSFA.'
  },
  {
    id: 's2', drug: 'Amiodarona 150mg/3ml IV', generic: 'amiodarone',
    severity: 'severe', since: '2026-05-01', expected_resolution: '2026-05-30',
    reason: 'Atraso de distribuição — lote retido por controlo de qualidade',
    alternatives: ['Lidocaína IV para arritmias ventriculares', 'Flecainida oral se hemodinâmica estável'],
    affected_units: ['Cardiologia', 'UCI', 'Urgência'],
    notes: 'Stock para ~5 dias. Alternativas consultadas com cardiologia. Aguardar lote aprovado.'
  },
  {
    id: 's3', drug: 'Cloreto de Potássio 7,46% IV', generic: 'KCl',
    severity: 'moderate', since: '2026-05-10', expected_resolution: '2026-05-25',
    reason: 'Problema de embalagem — novo fornecedor em homologação',
    alternatives: ['Soluções de eletrólitos balanced cristalóides (Ringer lactato)'],
    affected_units: ['Medicina Interna', 'Cirurgia'],
    notes: 'Stock para 10 dias. Sem impacto clínico imediato esperado.'
  },
  {
    id: 's4', drug: 'Heparina sódica 5000 UI/ml', generic: 'heparin',
    severity: 'resolved', since: '2026-04-15', expected_resolution: '2026-05-08',
    reason: 'Ruturas pontuais resolvidas com novo contrato',
    alternatives: [],
    affected_units: [],
    notes: 'Resolvida. Stock normalizado.'
  },
]

const DDD_TABLE: DDDEntry[] = [
  { drug: 'Pip/Tazo', atc: 'J01CR05', ddd_value: 14, ddd_unit: 'g', current_100: 15.4, prev_100: 12.8, trend: 20.3, benchmark_100: 12.0, flag: 'high' },
  { drug: 'Ceftriaxone', atc: 'J01DD04', ddd_value: 2, ddd_unit: 'g', current_100: 18.9, prev_100: 19.2, trend: -1.6, benchmark_100: 20.0, flag: 'ok' },
  { drug: 'Meropenem', atc: 'J01DH02', ddd_value: 3, ddd_unit: 'g', current_100: 4.1, prev_100: 5.2, trend: -21.2, benchmark_100: 5.0, flag: 'ok' },
  { drug: 'Vancomicina', atc: 'J01XA01', ddd_value: 2, ddd_unit: 'g', current_100: 8.2, prev_100: 7.9, trend: 3.8, benchmark_100: 7.0, flag: 'high' },
  { drug: 'Amox/Clav', atc: 'J01CR02', ddd_value: 3, ddd_unit: 'g', current_100: 22.8, prev_100: 24.1, trend: -5.4, benchmark_100: 25.0, flag: 'ok' },
  { drug: 'Linezolida', atc: 'J01XX08', ddd_value: 1.2, ddd_unit: 'g', current_100: 0.8, prev_100: 1.1, trend: -27.3, benchmark_100: 1.0, flag: 'ok' },
  { drug: 'Ciprofloxacina', atc: 'J01MA02', ddd_value: 1, ddd_unit: 'g', current_100: 9.3, prev_100: 8.7, trend: 6.9, benchmark_100: 8.0, flag: 'high' },
  { drug: 'Fluconazol', atc: 'J02AC01', ddd_value: 0.2, ddd_unit: 'g', current_100: 3.2, prev_100: 3.0, trend: 6.7, benchmark_100: 3.5, flag: 'ok' },
]

const COST_DATA: CostEntry[] = [
  { class: 'Antibióticos', budget: 28000, actual: 31200, prev_actual: 29800, top_drug: 'Pip/Tazo 4,5g', top_cost: 9800 },
  { class: 'Anticoagulantes', budget: 12000, actual: 11400, prev_actual: 12200, top_drug: 'Enoxaparina 40mg', top_cost: 7900 },
  { class: 'Oncologia', budget: 45000, actual: 48600, prev_actual: 42100, top_drug: 'Oxaliplatina 100mg', top_cost: 27300 },
  { class: 'Analgésicos', budget: 8500, actual: 7900, prev_actual: 8200, top_drug: 'Morfina 10mg/ml', top_cost: 3200 },
  { class: 'Antidiabéticos', budget: 15000, actual: 14200, prev_actual: 14800, top_drug: 'Insulina Glargina', top_cost: 8600 },
  { class: 'Anti-hipertensores', budget: 6000, actual: 5400, prev_actual: 5700, top_drug: 'Amlodipina 5mg', top_cost: 1100 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<FormularyStatus, { label: string; color: string; bg: string }> = {
  approved:      { label: 'Aprovado',       color: '#16a34a', bg: '#dcfce7' },
  restricted:    { label: 'Restrito',       color: '#d97706', bg: '#fef3c7' },
  non_formulary: { label: 'Fora formulário', color: '#dc2626', bg: '#fee2e2' },
  under_review:  { label: 'Em revisão',      color: '#7c3aed', bg: '#ede9fe' },
}

const SHORTAGE_META: Record<ShortageLevel, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'Crítica',   color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  severe:   { label: 'Severa',    color: '#d97706', bg: '#fef3c7', icon: '🟠' },
  moderate: { label: 'Moderada',  color: '#ca8a04', bg: '#fefce8', icon: '🟡' },
  resolved: { label: 'Resolvida', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
}

const CLASS_LABEL: Record<DrugClass, string> = {
  antibiotics: 'Antibióticos', anticoagulants: 'Anticoagulantes',
  analgesics: 'Analgésicos', antihypertensives: 'Anti-hipertensores',
  antidiabetics: 'Antidiabéticos', oncology: 'Oncologia', other: 'Outro',
}

function fmt(n: number) { return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n) }
function fmtEur(n: number) { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n) }

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrugIntelligencePage() {
  const [tab, setTab] = useState<'formulary' | 'shortages' | 'ddd' | 'costs'>('formulary')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expandedShortage, setExpandedShortage] = useState<string | null>(null)
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null)

  const filteredFormulary = useMemo(() => FORMULARY.filter(d => {
    if (classFilter !== 'all' && d.class !== classFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !d.generic.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [classFilter, statusFilter, search])

  const totalMonthlySpend = FORMULARY.reduce((s, d) => s + d.unit_cost * d.monthly_usage, 0)
  const criticalShortages = SHORTAGES.filter(s => s.severity === 'critical').length
  const activeShortages = SHORTAGES.filter(s => s.severity !== 'resolved').length
  const highDDDs = DDD_TABLE.filter(d => d.flag === 'high').length
  const overBudgetClasses = COST_DATA.filter(c => c.actual > c.budget).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>🧬</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Drug Intelligence Hub</h1>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
                Formulário · Ruturas · Consumo DDD · Custos e orçamento
              </p>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Ruturas ativas', value: activeShortages, alert: criticalShortages > 0, sub: `${criticalShortages} críticas` },
                { label: 'DDDs elevados', value: highDDDs, alert: highDDDs > 2, sub: 'vs. benchmark' },
                { label: 'Classes s/ orç.', value: overBudgetClasses, alert: true, sub: 'a monitorizar' },
                { label: 'Gasto mensal', value: fmtEur(totalMonthlySpend), alert: false, sub: 'medicamentos' },
              ].map(({ label, value, alert, sub }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${alert ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 110,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: alert ? '#f87171' : '#fff' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 0 }}>
            {([
              { key: 'formulary', label: '📋 Formulário', count: FORMULARY.length },
              { key: 'shortages', label: '⚠️ Ruturas', count: activeShortages },
              { key: 'ddd', label: '📊 Consumo DDD', count: null },
              { key: 'costs', label: '💶 Custos', count: null },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#0f172a' : '#94a3b8',
                fontWeight: tab === t.key ? 600 : 400, fontSize: 13,
                borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                {t.count != null && (
                  <span style={{
                    background: t.count > 0 ? '#ef4444' : '#475569',
                    color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                  }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>

        {/* ═══ FORMULARY TAB ════════════════════════════════════════════════════ */}
        {tab === 'formulary' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                placeholder="Pesquisar medicamento..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 260 }}
              />
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Todas as classes</option>
                {Object.entries(CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Todos os estados</option>
                <option value="approved">Aprovado</option>
                <option value="restricted">Restrito</option>
                <option value="under_review">Em revisão</option>
              </select>
              <span style={{ color: '#64748b', fontSize: 13 }}>{filteredFormulary.length} fármacos</span>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Medicamento', 'Classe', 'Estado', 'Stock (dias)', 'Uso/mês', 'Custo unit.', 'DDD/100CD', 'Rev.'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFormulary.map((d, i) => {
                    const st = STATUS_META[d.status]
                    const isExp = expandedDrug === d.id
                    return (
                      <>
                        <tr key={d.id}
                          onClick={() => setExpandedDrug(isExp ? null : d.id)}
                          style={{
                            borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                            background: isExp ? '#f0f9ff' : i % 2 === 0 ? '#fff' : '#fafafa',
                          }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{CLASS_LABEL[d.class]}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: d.stock_days < 15 ? '#dc2626' : d.stock_days < 25 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                              {d.stock_days}d
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151' }}>{d.monthly_usage.toLocaleString('pt-PT')}</td>
                          <td style={{ padding: '10px 14px', color: '#374151' }}>{fmtEur(d.unit_cost)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {d.ddd_per_100 != null ? (
                              <span style={{ color: d.ddd_per_100 > 15 ? '#d97706' : '#374151' }}>{d.ddd_per_100}</span>
                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>{d.last_reviewed}</td>
                        </tr>
                        {isExp && (
                          <tr key={`${d.id}-exp`}>
                            <td colSpan={8} style={{ padding: '0 14px 14px 14px', background: '#f0f9ff' }}>
                              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 10 }}>
                                {d.restricted_to && (
                                  <div style={{ flex: 1, minWidth: 280 }}>
                                    <div style={{ fontWeight: 600, color: '#d97706', fontSize: 12, marginBottom: 4 }}>RESTRIÇÃO DE USO</div>
                                    <div style={{ color: '#374151', fontSize: 13 }}>{d.restricted_to}</div>
                                  </div>
                                )}
                                {d.alternatives && d.alternatives.length > 0 && (
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 4 }}>ALTERNATIVAS</div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {d.alternatives.map(a => (
                                        <span key={a} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 4 }}>CUSTO MENSAL EST.</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                                    {fmtEur(d.unit_cost * d.monthly_usage)}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 4 }}>ATC</div>
                                  <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{d.atc}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ SHORTAGES TAB ════════════════════════════════════════════════════ */}
        {tab === 'shortages' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {(['critical', 'severe', 'moderate', 'resolved'] as ShortageLevel[]).map(level => {
                const meta = SHORTAGE_META[level]
                const count = SHORTAGES.filter(s => s.severity === level).length
                return (
                  <div key={level} style={{
                    background: meta.bg, border: `1px solid ${meta.color}30`,
                    borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center',
                  }}>
                    <span>{meta.icon}</span>
                    <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                    <span style={{ background: meta.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 12, fontWeight: 700 }}>{count}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {SHORTAGES.map(s => {
                const meta = SHORTAGE_META[s.severity]
                const isExp = expandedShortage === s.id
                return (
                  <div key={s.id} style={{
                    background: '#fff', borderRadius: 12, border: `1px solid ${meta.color}40`,
                    borderLeft: `4px solid ${meta.color}`, overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedShortage(isExp ? null : s.id)}
                      style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{s.drug}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{s.generic} · Desde {s.since}</div>
                        </div>
                        <span style={{ background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right', fontSize: 12 }}>
                          <div style={{ color: '#64748b' }}>Previsão de resolução</div>
                          <div style={{ fontWeight: 600, color: meta.color }}>{s.expected_resolution}</div>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 18 }}>{isExp ? '▲' : '▼'}</div>
                      </div>
                    </div>

                    {isExp && (
                      <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 6 }}>CAUSA DA RUTURA</div>
                            <div style={{ color: '#374151', fontSize: 13 }}>{s.reason}</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 6 }}>SERVIÇOS AFETADOS</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {s.affected_units.map(u => (
                                <span key={u} style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{u}</span>
                              ))}
                              {s.affected_units.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>Nenhum (resolvida)</span>}
                            </div>
                          </div>
                        </div>
                        {s.alternatives.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontWeight: 600, color: '#374151', fontSize: 12, marginBottom: 8 }}>ALTERNATIVAS APROVADAS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {s.alternatives.map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <span style={{ color: '#16a34a', marginTop: 1 }}>✓</span>
                                  <span style={{ color: '#374151', fontSize: 13 }}>{a}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.notes && (
                          <div style={{ marginTop: 14, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#374151' }}>
                            <strong>📝 Nota:</strong> {s.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ DDD TAB ══════════════════════════════════════════════════════════ */}
        {tab === 'ddd' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>O que é o DDD/100 camas-dia?</div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
                Dose Diária Definida por 100 camas-dia é o indicador padrão WHO/ECDC para antibioterapia hospitalar.
                Permite comparar o consumo entre serviços e hospitais independentemente do tamanho.
                Benchmark nacional: Pip/Tazo &lt;12, Carbapenemos &lt;5, Vancomicina &lt;7 (DDD/100CD).
                Valores superiores ao benchmark requerem análise de stewardship.
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Antibiótico', 'ATC', 'DDD (WHO)', 'Atual/100CD', 'Mês anterior', 'Variação', 'Benchmark', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DDD_TABLE.map((d, i) => {
                    const flagColor = d.flag === 'high' ? '#d97706' : d.flag === 'low' ? '#3b82f6' : '#16a34a'
                    const flagBg = d.flag === 'high' ? '#fef3c7' : d.flag === 'low' ? '#dbeafe' : '#dcfce7'
                    const flagLabel = d.flag === 'high' ? '▲ Elevado' : d.flag === 'low' ? '▼ Baixo' : '✓ Normal'
                    return (
                      <tr key={d.drug} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.drug}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{d.atc}</td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.ddd_value} {d.ddd_unit}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: d.flag === 'high' ? '#d97706' : '#374151' }}>{d.current_100}</td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.prev_100}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ color: d.trend > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            {d.trend > 0 ? '+' : ''}{d.trend.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.benchmark_100}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: flagBg, color: flagColor, padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                            {flagLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
              <strong>⚠️ Alerta de Stewardship:</strong> Pip/Tazo (+20.3%), Vancomicina (+3.8%) e Ciprofloxacina (+6.9%) acima do benchmark.
              Recomenda-se revisão com Comissão de Antibióticos e análise de indicações na semana de 26/05.
            </div>
          </div>
        )}

        {/* ═══ COSTS TAB ════════════════════════════════════════════════════════ */}
        {tab === 'costs' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
              {COST_DATA.map(c => {
                const pct = Math.round((c.actual / c.budget) * 100)
                const over = c.actual > c.budget
                const prev_delta = ((c.actual - c.prev_actual) / c.prev_actual * 100)
                return (
                  <div key={c.class} style={{
                    background: '#fff', borderRadius: 12, border: `1px solid ${over ? '#fca5a5' : '#e2e8f0'}`,
                    borderTop: `3px solid ${over ? '#ef4444' : '#16a34a'}`, padding: 20,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{c.class}</div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Top: {c.top_drug}</div>
                      </div>
                      <div style={{
                        background: over ? '#fee2e2' : '#dcfce7',
                        color: over ? '#dc2626' : '#16a34a',
                        padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      }}>
                        {over ? '▲ ' : '✓ '}{pct}% orç.
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Real</div>
                        <div style={{ fontWeight: 700, fontSize: 18, color: over ? '#dc2626' : '#0f172a' }}>{fmtEur(c.actual)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Orçamento</div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: '#374151' }}>{fmtEur(c.budget)}</div>
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{
                        height: '100%', width: `${Math.min(pct, 100)}%`,
                        background: over ? '#ef4444' : '#16a34a',
                        borderRadius: 4,
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>Topo: {fmtEur(c.top_cost)}</span>
                      <span style={{ color: prev_delta > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {prev_delta > 0 ? '↑' : '↓'}{Math.abs(prev_delta).toFixed(1)}% vs. mês ant.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 16, fontSize: 16 }}>Resumo orçamental</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total orçado', value: fmtEur(COST_DATA.reduce((s, c) => s + c.budget, 0)), color: '#374151' },
                  { label: 'Total real (mês)', value: fmtEur(COST_DATA.reduce((s, c) => s + c.actual, 0)), color: '#0f172a' },
                  {
                    label: 'Desvio',
                    value: fmtEur(COST_DATA.reduce((s, c) => s + c.actual - c.budget, 0)),
                    color: COST_DATA.reduce((s, c) => s + c.actual - c.budget, 0) > 0 ? '#dc2626' : '#16a34a'
                  },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 22, color: item.color, marginTop: 4 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
