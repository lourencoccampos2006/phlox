'use client'
import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'medication_error' | 'near_miss' | 'adr' | 'fall' | 'infection' | 'procedure' | 'other'
type Severity = 'sentinel' | 'serious' | 'moderate' | 'minor' | 'near_miss'
type Period = 'current' | 'prev'

interface SafetyEvent {
  id: string
  date: string
  type: EventType
  severity: Severity
  unit: string
  description: string
  drug?: string
  status: 'open' | 'under_review' | 'closed'
  harm: boolean
}

interface InterventionStat {
  type: string
  count: number
  accepted: number
  value_eur: number
}

interface KPI {
  id: string
  label: string
  value: number
  unit: string
  target: number
  prev: number
  category: 'safety' | 'efficiency' | 'clinical' | 'regulatory'
  higher_is_better: boolean
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const SAFETY_EVENTS: SafetyEvent[] = [
  { id: 'e1', date: '2026-05-19', type: 'medication_error', severity: 'serious', unit: 'Medicina Interna', description: 'Administração de dose 10× superior de insulina — confusão entre 10U e 100U. Doente monitorizado, sem hipoglicemia grave.', drug: 'Insulina', status: 'under_review', harm: false },
  { id: 'e2', date: '2026-05-18', type: 'near_miss', severity: 'near_miss', unit: 'UCI', description: 'Seringas de heparina e amiodarona identificadas na mesma bandeja — detetado antes da administração pelo enfermeiro de turno.', drug: 'Heparina / Amiodarona', status: 'closed', harm: false },
  { id: 'e3', date: '2026-05-16', type: 'adr', severity: 'moderate', unit: 'Cardiologia', description: 'Reação anafilática grau 2 após vancomicina — síndrome do homem vermelho. Infusão muito rápida (30 min em vez de 60 min).', drug: 'Vancomicina', status: 'closed', harm: true },
  { id: 'e4', date: '2026-05-15', type: 'medication_error', severity: 'minor', unit: 'Cirurgia', description: 'Antibiótico profilático (cefazolina) administrado 45 min após incisão em vez de 30 min antes. Reforço do protocolo pré-op em curso.', drug: 'Cefazolina', status: 'closed', harm: false },
  { id: 'e5', date: '2026-05-14', type: 'medication_error', severity: 'serious', unit: 'Pediatria', description: 'Dose de paracetamol calculada por kg de adulto em vez de peso pediátrico. Detetado antes da administração.', drug: 'Paracetamol', status: 'closed', harm: false },
  { id: 'e6', date: '2026-05-12', type: 'near_miss', severity: 'near_miss', unit: 'Urgência', description: 'Prescrição de metformina para doente com CrCl 25 mL/min contraindicado. Identificado pelo farmacêutico na validação.', drug: 'Metformina', status: 'closed', harm: false },
  { id: 'e7', date: '2026-05-10', type: 'adr', severity: 'moderate', unit: 'Reumatologia', description: 'Hepatotoxicidade (ALT 3×LSN) após 3 semanas de metotrexato. Doseamento de ALT não realizado antes do início da terapêutica.', drug: 'Metotrexato', status: 'under_review', harm: true },
]

const INTERVENTIONS: InterventionStat[] = [
  { type: 'Ajuste de dose (renal)', count: 34, accepted: 32, value_eur: 4200 },
  { type: 'Substituição genérico', count: 28, accepted: 26, value_eur: 3800 },
  { type: 'Interação detetada', count: 19, accepted: 17, value_eur: 8500 },
  { type: 'Dose incorreta',      count: 15, accepted: 14, value_eur: 2100 },
  { type: 'Via de administração', count: 11, accepted: 10, value_eur: 1400 },
  { type: 'Duplicação terapêutica', count: 8, accepted: 8, value_eur: 1950 },
  { type: 'Reconciliação admissão', count: 42, accepted: 39, value_eur: 5600 },
  { type: 'De-escalada antibiótica', count: 23, accepted: 20, value_eur: 6200 },
]

const KPIS: KPI[] = [
  { id: 'k1',  label: 'Taxa de interceção de erros', value: 94.2, unit: '%', target: 95, prev: 91.8, category: 'safety', higher_is_better: true },
  { id: 'k2',  label: 'Erros com dano (por 1000 doses)', value: 0.8, unit: '/1000', target: 1.0, prev: 1.1, category: 'safety', higher_is_better: false },
  { id: 'k3',  label: 'Taxa de aceitação intervenções', value: 88.6, unit: '%', target: 85, prev: 86.2, category: 'clinical', higher_is_better: true },
  { id: 'k4',  label: 'Conciliação na admissão', value: 78.3, unit: '%', target: 90, prev: 71.5, category: 'clinical', higher_is_better: true },
  { id: 'k5',  label: 'Conformidade ajuste renal', value: 91.4, unit: '%', target: 95, prev: 88.9, category: 'clinical', higher_is_better: true },
  { id: 'k6',  label: 'Prescrições validadas no dia', value: 96.8, unit: '%', target: 98, prev: 95.1, category: 'efficiency', higher_is_better: true },
  { id: 'k7',  label: 'Tempo médio de validação', value: 14.2, unit: 'min', target: 15, prev: 16.8, category: 'efficiency', higher_is_better: false },
  { id: 'k8',  label: 'DDD antibióticos/100CD', value: 62.4, unit: 'DDD', target: 55, prev: 67.1, category: 'clinical', higher_is_better: false },
  { id: 'k9',  label: 'Notificações RAM ao INFARMED', value: 12, unit: 'notif', target: 10, prev: 9, category: 'regulatory', higher_is_better: true },
  { id: 'k10', label: 'Desvio orçamental', value: 8.4, unit: '%', target: 5, prev: 5.2, category: 'efficiency', higher_is_better: false },
  { id: 'k11', label: 'Taxa de de-escalada antibiótica', value: 63.0, unit: '%', target: 70, prev: 58.4, category: 'clinical', higher_is_better: true },
  { id: 'k12', label: 'Conformidade profilaxia VTE', value: 87.5, unit: '%', target: 95, prev: 84.0, category: 'clinical', higher_is_better: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, { label: string; icon: string }> = {
  medication_error: { label: 'Erro de medicação', icon: '💊' },
  near_miss:        { label: 'Near-miss', icon: '🔶' },
  adr:              { label: 'RAM', icon: '⚠️' },
  fall:             { label: 'Queda', icon: '🚶' },
  infection:        { label: 'IACS', icon: '🦠' },
  procedure:        { label: 'Procedimento', icon: '🔪' },
  other:            { label: 'Outro', icon: '📋' },
}

const SEV_META: Record<Severity, { label: string; color: string; bg: string }> = {
  sentinel:  { label: 'Sentinela', color: '#dc2626', bg: '#fee2e2' },
  serious:   { label: 'Grave',     color: '#d97706', bg: '#fef3c7' },
  moderate:  { label: 'Moderado',  color: '#ca8a04', bg: '#fefce8' },
  minor:     { label: 'Menor',     color: '#0284c7', bg: '#e0f2fe' },
  near_miss: { label: 'Near-miss', color: '#7c3aed', bg: '#ede9fe' },
}

const CAT_COLOR: Record<KPI['category'], string> = {
  safety: '#dc2626', clinical: '#2563eb', efficiency: '#16a34a', regulatory: '#7c3aed',
}

function kpiStatus(kpi: KPI) {
  const ok = kpi.higher_is_better ? kpi.value >= kpi.target : kpi.value <= kpi.target
  const borderline = kpi.higher_is_better
    ? kpi.value >= kpi.target * 0.95 && kpi.value < kpi.target
    : kpi.value > kpi.target && kpi.value <= kpi.target * 1.05
  if (ok) return { color: '#16a34a', label: '✓ Meta', bg: '#dcfce7' }
  if (borderline) return { color: '#d97706', label: '~ Perto', bg: '#fef3c7' }
  return { color: '#dc2626', label: '✗ Abaixo', bg: '#fee2e2' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QualityPage() {
  const [tab, setTab] = useState<'kpis' | 'events' | 'interventions' | 'report'>('kpis')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  const filteredKPIs = useMemo(() => KPIS.filter(k => catFilter === 'all' || k.category === catFilter), [catFilter])
  const filteredEvents = useMemo(() => SAFETY_EVENTS.filter(e => sevFilter === 'all' || e.severity === sevFilter), [sevFilter])

  const totalInterventionValue = INTERVENTIONS.reduce((s, i) => s + i.value_eur, 0)
  const totalInterventions = INTERVENTIONS.reduce((s, i) => s + i.count, 0)
  const acceptanceRate = Math.round(INTERVENTIONS.reduce((s, i) => s + i.accepted, 0) / totalInterventions * 100)
  const metKPIs = KPIS.filter(k => {
    const ok = k.higher_is_better ? k.value >= k.target : k.value <= k.target
    return ok
  }).length
  const highDDDs = 3
  const overBudgetClasses = 3

  function simulateReport() {
    setReportGenerating(true)
    setReportDone(false)
    setTimeout(() => { setReportGenerating(false); setReportDone(true) }, 2200)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>📊</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Central de Qualidade</h1>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
                Segurança · Indicadores · Intervenções · Relatório mensal
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'KPIs na meta', value: `${metKPIs}/${KPIS.length}`, color: metKPIs >= 8 ? '#4ade80' : '#f87171' },
                { label: 'Eventos abertos', value: SAFETY_EVENTS.filter(e => e.status !== 'closed').length, color: '#f87171' },
                { label: 'Intervenções (mês)', value: totalInterventions, color: '#94a3b8' },
                { label: 'Valor gerado', value: `€${(totalInterventionValue/1000).toFixed(1)}k`, color: '#4ade80' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '10px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {([
              { key: 'kpis', label: '📈 Indicadores' },
              { key: 'events', label: '🚨 Eventos', badge: SAFETY_EVENTS.filter(e => e.status !== 'closed').length },
              { key: 'interventions', label: '💡 Intervenções' },
              { key: 'report', label: '📄 Relatório' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#1e3a5f' : '#94a3b8',
                fontWeight: tab === t.key ? 600 : 400, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                {'badge' in t && t.badge > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>

        {/* ═══ KPIs TAB ═════════════════════════════════════════════════════════ */}
        {tab === 'kpis' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {(['all', 'safety', 'clinical', 'efficiency', 'regulatory'] as const).map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: catFilter === c ? CAT_COLOR[c as KPI['category']] ?? '#0f172a' : '#f1f5f9',
                  color: catFilter === c ? '#fff' : '#374151', fontWeight: catFilter === c ? 600 : 400,
                }}>
                  {c === 'all' ? 'Todos' : c === 'safety' ? 'Segurança' : c === 'clinical' ? 'Clínico' : c === 'efficiency' ? 'Eficiência' : 'Regulatório'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {filteredKPIs.map(k => {
                const st = kpiStatus(k)
                const delta = k.value - k.prev
                const pct = k.higher_is_better
                  ? Math.min((k.value / k.target) * 100, 100)
                  : Math.min((k.target / k.value) * 100, 100)
                return (
                  <div key={k.id} style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                    borderTop: `3px solid ${CAT_COLOR[k.category]}`, padding: '18px 20px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1, lineHeight: 1.3 }}>{k.label}</div>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{k.value}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{k.unit}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, marginLeft: 4,
                        color: (k.higher_is_better ? delta > 0 : delta < 0) ? '#16a34a' : '#dc2626',
                      }}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLOR[k.category], borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      Meta: {k.target}{k.unit} · Anterior: {k.prev}{k.unit}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ EVENTS TAB ═══════════════════════════════════════════════════════ */}
        {tab === 'events' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Todas as severidades</option>
                {(Object.keys(SEV_META) as Severity[]).map(s => (
                  <option key={s} value={s}>{SEV_META[s].label}</option>
                ))}
              </select>
              <span style={{ color: '#64748b', fontSize: 13, marginLeft: 4 }}>{filteredEvents.length} eventos · Maio 2026</span>
              <div style={{ marginLeft: 'auto' }}>
                <button style={{
                  padding: '8px 16px', background: '#1e3a5f', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>+ Registar evento</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredEvents.map(ev => {
                const sm = SEV_META[ev.severity]
                const em = EVENT_META[ev.type]
                const isExp = expandedEvent === ev.id
                return (
                  <div key={ev.id} style={{
                    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${sm.color}`, overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedEvent(isExp ? null : ev.id)}
                      style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{em.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{em.label}</span>
                          <span style={{ background: sm.bg, color: sm.color, padding: '1px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{sm.label}</span>
                          {ev.harm && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Com dano</span>}
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>{ev.unit}</span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExp ? 'normal' : 'nowrap' }}>
                          {ev.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                        {ev.drug && <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{ev.drug}</span>}
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{ev.date}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                          background: ev.status === 'closed' ? '#dcfce7' : ev.status === 'under_review' ? '#fef3c7' : '#fee2e2',
                          color: ev.status === 'closed' ? '#16a34a' : ev.status === 'under_review' ? '#d97706' : '#dc2626',
                        }}>
                          {ev.status === 'closed' ? 'Fechado' : ev.status === 'under_review' ? 'Em análise' : 'Aberto'}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 16 }}>{isExp ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ padding: '10px 18px 16px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.6 }}>{ev.description}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Abrir análise
                          </button>
                          <button style={{ padding: '6px 14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Notificar ao INFARMED
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ INTERVENTIONS TAB ════════════════════════════════════════════════ */}
        {tab === 'interventions' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total de intervenções', value: totalInterventions, icon: '💡', color: '#2563eb' },
                { label: 'Taxa de aceitação', value: `${acceptanceRate}%`, icon: '✅', color: '#16a34a' },
                { label: 'Valor económico estimado', value: `€${totalInterventionValue.toLocaleString('pt-PT')}`, icon: '💶', color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                  borderTop: `3px solid ${s.color}`, padding: '20px 24px',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <span style={{ fontSize: 32 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', fontSize: 15 }}>
                Intervenções farmacêuticas — Maio 2026
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tipo de intervenção', 'Total', 'Aceites', 'Aceite %', 'Valor estimado'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INTERVENTIONS.sort((a, b) => b.count - a.count).map((iv, i) => {
                    const rate = Math.round(iv.accepted / iv.count * 100)
                    return (
                      <tr key={iv.type} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{iv.type}</td>
                        <td style={{ padding: '10px 16px' }}>{iv.count}</td>
                        <td style={{ padding: '10px 16px' }}>{iv.accepted}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, width: 60, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${rate}%`, background: rate >= 85 ? '#16a34a' : '#d97706', borderRadius: 4 }} />
                            </div>
                            <span style={{ color: rate >= 85 ? '#16a34a' : '#d97706', fontWeight: 600 }}>{rate}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#16a34a' }}>€{iv.value_eur.toLocaleString('pt-PT')}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>TOTAL</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{totalInterventions}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{INTERVENTIONS.reduce((s, i) => s + i.accepted, 0)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>{acceptanceRate}%</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>€{totalInterventionValue.toLocaleString('pt-PT')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ REPORT TAB ═══════════════════════════════════════════════════════ */}
        {tab === 'report' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Relatório Mensal de Qualidade — Maio 2026
              </div>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                O relatório é gerado automaticamente a partir dos dados do mês. Inclui: indicadores de desempenho,
                análise de eventos, intervenções farmacêuticas, DDD de antibioterapia e recomendações de melhoria.
                Formato PDF pronto para Comissão de Qualidade e Conselho de Administração.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                {[
                  { section: 'Indicadores de desempenho', items: `${metKPIs}/${KPIS.length} na meta` },
                  { section: 'Eventos de segurança', items: `${SAFETY_EVENTS.length} registados` },
                  { section: 'Intervenções farmacêuticas', items: `${totalInterventions} (${acceptanceRate}% aceites)` },
                  { section: 'Análise de antibioterapia DDD', items: `${highDDDs} acima de benchmark` },
                  { section: 'Recomendações de melhoria', items: 'Geradas por IA' },
                  { section: 'Análise de custos', items: `${overBudgetClasses} classes s/ orçamento` },
                ].map(s => (
                  <div key={s.section} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: '#16a34a', fontSize: 16 }}>✓</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{s.section}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{s.items}</div>
                    </div>
                  </div>
                ))}
              </div>

              {!reportDone && (
                <button
                  onClick={simulateReport}
                  disabled={reportGenerating}
                  style={{
                    width: '100%', padding: '14px', background: reportGenerating ? '#94a3b8' : '#1e3a5f',
                    color: '#fff', border: 'none', borderRadius: 10, cursor: reportGenerating ? 'wait' : 'pointer',
                    fontSize: 15, fontWeight: 700,
                  }}>
                  {reportGenerating ? '⏳ A gerar relatório PDF...' : '📄 Gerar Relatório PDF — Maio 2026'}
                </button>
              )}

              {reportDone && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 16, marginBottom: 4 }}>Relatório gerado com sucesso</div>
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                    Relatório_Qualidade_Maio_2026.pdf · 847 KB
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button style={{ padding: '9px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                      ⬇️ Descarregar PDF
                    </button>
                    <button style={{ padding: '9px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                      📧 Enviar por email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
