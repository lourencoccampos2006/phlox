'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

type Severity = 'sentinel' | 'serious' | 'moderate' | 'minor' | 'near_miss'
type EventType = 'medication_error' | 'near_miss' | 'adr' | 'fall' | 'infection' | 'procedure' | 'other'
type EventStatus = 'open' | 'under_review' | 'closed'

interface SafetyEvent {
  id: string; user_id?: string
  date: string; type: EventType; severity: Severity
  unit: string; description: string; drug: string
  status: EventStatus; harm: boolean
}

interface Intervention {
  id: string; user_id?: string
  type: string; count: number; accepted: number; value_eur: number
  date: string; notes: string
}

const SEV_META: Record<Severity, { label: string; color: string; bg: string }> = {
  sentinel:  { label: 'Sentinela', color: '#dc2626', bg: '#fee2e2' },
  serious:   { label: 'Grave',     color: '#d97706', bg: '#fef3c7' },
  moderate:  { label: 'Moderado',  color: '#ca8a04', bg: '#fefce8' },
  minor:     { label: 'Menor',     color: '#0284c7', bg: '#e0f2fe' },
  near_miss: { label: 'Near-miss', color: '#7c3aed', bg: '#ede9fe' },
}
const TYPE_META: Record<EventType, { label: string; icon: string }> = {
  medication_error: { label: 'Erro de medicação', icon: '💊' },
  near_miss:        { label: 'Near-miss',          icon: '🔶' },
  adr:              { label: 'RAM',                icon: '⚠️' },
  fall:             { label: 'Queda',              icon: '🚶' },
  infection:        { label: 'IACS',               icon: '🦠' },
  procedure:        { label: 'Procedimento',       icon: '🔪' },
  other:            { label: 'Outro',              icon: '📋' },
}
const INTERVENTION_TYPES = [
  'Ajuste de dose (renal)','Substituição genérico','Interação detetada','Dose incorreta',
  'Via de administração','Duplicação terapêutica','Reconciliação admissão','De-escalada antibiótica',
  'Profilaxia não indicada','Monitorização laboratorial','Outra',
]

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(560px,100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

export default function QualityPage() {
  const { user, supabase } = useAuth()
  const [tab, setTab] = useState<'events' | 'interventions' | 'analytics'>('events')
  const [events, setEvents]               = useState<SafetyEvent[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [sevFilter, setSevFilter]         = useState('all')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [showEventModal, setShowEventModal]               = useState(false)
  const [showInterventionModal, setShowInterventionModal] = useState(false)
  const [editEvent, setEditEvent]         = useState<SafetyEvent | null>(null)
  const [editIntervention, setEditIntervention] = useState<Intervention | null>(null)
  const [saving, setSaving]               = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    const [ev, iv] = await Promise.all([
      supabase.from('safety_events').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('pharma_interventions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    if (ev.data) setEvents(ev.data)
    if (iv.data) setInterventions(iv.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  // ── Event CRUD ─────────────────────────────────────────────────────────────
  const EVENT_BLANK = { date: new Date().toISOString().slice(0,10), type: 'medication_error' as EventType, severity: 'moderate' as Severity, unit: '', description: '', drug: '', status: 'open' as EventStatus, harm: false }
  const [eventForm, setEventForm] = useState<typeof EVENT_BLANK>(EVENT_BLANK)

  function openNewEvent() { setEventForm(EVENT_BLANK); setEditEvent(null); setShowEventModal(true) }
  function openEditEvent(e: SafetyEvent) {
    setEventForm({ date: e.date, type: e.type, severity: e.severity, unit: e.unit||'', description: e.description||'', drug: e.drug||'', status: e.status, harm: e.harm||false })
    setEditEvent(e); setShowEventModal(true)
  }
  async function saveEvent() {
    if (!user || !eventForm.description.trim()) return
    setSaving(true)
    const payload = { ...eventForm, user_id: user.id }
    if (editEvent) await supabase.from('safety_events').update(payload).eq('id', editEvent.id)
    else await supabase.from('safety_events').insert(payload)
    setSaving(false); setShowEventModal(false); load()
  }
  async function deleteEvent(id: string) {
    if (!confirm('Remover evento?')) return
    await supabase.from('safety_events').delete().eq('id', id)
    load()
  }
  async function closeEvent(id: string) {
    await supabase.from('safety_events').update({ status: 'closed' }).eq('id', id)
    load()
  }

  // ── Intervention CRUD ──────────────────────────────────────────────────────
  const IV_BLANK = { type: INTERVENTION_TYPES[0], count: 1, accepted: 1, value_eur: 0, date: new Date().toISOString().slice(0,10), notes: '' }
  const [ivForm, setIvForm] = useState<typeof IV_BLANK>(IV_BLANK)

  function openNewIv() { setIvForm(IV_BLANK); setEditIntervention(null); setShowInterventionModal(true) }
  function openEditIv(iv: Intervention) {
    setIvForm({ type: iv.type, count: iv.count, accepted: iv.accepted, value_eur: iv.value_eur||0, date: iv.date, notes: iv.notes||'' })
    setEditIntervention(iv); setShowInterventionModal(true)
  }
  async function saveIv() {
    if (!user) return
    setSaving(true)
    const payload = { ...ivForm, user_id: user.id }
    if (editIntervention) await supabase.from('pharma_interventions').update(payload).eq('id', editIntervention.id)
    else await supabase.from('pharma_interventions').insert(payload)
    setSaving(false); setShowInterventionModal(false); load()
  }
  async function deleteIv(id: string) {
    if (!confirm('Remover intervenção?')) return
    await supabase.from('pharma_interventions').delete().eq('id', id)
    load()
  }

  const filteredEvents = events.filter(e => {
    if (sevFilter !== 'all' && e.severity !== sevFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    return true
  })
  const openCount = events.filter(e => e.status !== 'closed').length
  const totalIv   = interventions.reduce((s, i) => s + i.count, 0)
  const totalAccepted = interventions.reduce((s, i) => s + i.accepted, 0)
  const totalValue = interventions.reduce((s, i) => s + (i.value_eur||0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 22 }}>📊</span>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Central de Qualidade</h1>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Eventos de segurança e intervenções farmacêuticas</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Eventos abertos', value: openCount, alert: openCount > 0 },
                { label: 'Intervenções', value: totalIv },
                { label: 'Valor gerado', value: `€${(totalValue/1000).toFixed(1)}k`, alert: false },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${s.alert ? '#f87171' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 8, padding: '8px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.alert ? '#f87171' : '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 18, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { key: 'events' as const,        label: '🚨 Eventos de segurança', badge: openCount },
              { key: 'interventions' as const, label: '💡 Intervenções' },
              { key: 'analytics' as const,     label: '📈 Indicadores KPI' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#1e3a5f' : '#94a3b8',
                fontWeight: tab === t.key ? 600 : 400, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                {'badge' in t && (t.badge ?? 0) > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>A carregar…</div>}

        {/* ═══ EVENTS ════════════════════════════════════════════════════════ */}
        {!loading && tab === 'events' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                <option value="all">Todas as severidades</option>
                {(Object.keys(SEV_META) as Severity[]).map(k => <option key={k} value={k}>{SEV_META[k].label}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                <option value="all">Todos os estados</option>
                <option value="open">Abertos</option>
                <option value="under_review">Em análise</option>
                <option value="closed">Fechados</option>
              </select>
              <span style={{ color: '#64748b', fontSize: 13 }}>{filteredEvents.length} eventos</span>
              <button onClick={openNewEvent} style={{ marginLeft: 'auto', padding: '9px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                + Registar evento
              </button>
            </div>

            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Sem eventos registados</div>
                <div style={{ fontSize: 13 }}>Regista eventos de segurança para rastreabilidade e melhoria contínua.</div>
                <button onClick={openNewEvent} style={{ marginTop: 16, padding: '10px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Registar evento</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredEvents.map(ev => {
                  const sm = SEV_META[ev.severity]
                  const tm = TYPE_META[ev.type]
                  const isExp = expanded === ev.id
                  return (
                    <div key={ev.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${sm.color}`, overflow: 'hidden' }}>
                      <div style={{ padding: '13px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                        onClick={() => setExpanded(isExp ? null : ev.id)}>
                        <span style={{ fontSize: 18 }}>{tm.icon}</span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{tm.label}</span>
                            <span style={{ background: sm.bg, color: sm.color, padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{sm.label}</span>
                            {ev.harm && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>Com dano</span>}
                            {ev.unit && <span style={{ color: '#94a3b8', fontSize: 12 }}>{ev.unit}</span>}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2, overflow: isExp ? undefined : 'hidden', textOverflow: 'ellipsis', whiteSpace: isExp ? undefined : 'nowrap', maxWidth: 500 }}>
                            {ev.description}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {ev.drug && <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{ev.drug}</span>}
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{ev.date}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                            background: ev.status === 'closed' ? '#dcfce7' : ev.status === 'under_review' ? '#fef3c7' : '#fee2e2',
                            color: ev.status === 'closed' ? '#16a34a' : ev.status === 'under_review' ? '#d97706' : '#dc2626',
                          }}>
                            {ev.status === 'closed' ? 'Fechado' : ev.status === 'under_review' ? 'Em análise' : 'Aberto'}
                          </span>
                          <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                            {ev.status !== 'closed' && (
                              <button onClick={() => closeEvent(ev.id)} style={{ padding: '3px 8px', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Fechar</button>
                            )}
                            <button onClick={() => openEditEvent(ev)} style={{ padding: '3px 8px', background: '#f1f5f9', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✏️</button>
                            <button onClick={() => deleteEvent(ev.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✕</button>
                          </div>
                          <span style={{ color: '#94a3b8', fontSize: 14 }}>{isExp ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ INTERVENTIONS ═════════════════════════════════════════════════ */}
        {!loading && tab === 'interventions' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Total de intervenções', value: totalIv, color: '#2563eb' },
                { label: 'Taxa de aceitação', value: totalIv > 0 ? `${Math.round(totalAccepted/totalIv*100)}%` : '—', color: '#16a34a' },
                { label: 'Valor económico (€)', value: totalValue.toLocaleString('pt-PT'), color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px', borderTop: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={openNewIv} style={{ padding: '9px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                + Registar intervenção
              </button>
            </div>

            {interventions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Sem intervenções registadas</div>
                <div style={{ fontSize: 13 }}>Regista as tuas intervenções farmacêuticas para demonstrar o teu impacto clínico.</div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Tipo','Data','Total','Aceites','Aceite %','Valor €',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {interventions.map((iv, i) => {
                      const rate = iv.count > 0 ? Math.round(iv.accepted / iv.count * 100) : 0
                      return (
                        <tr key={iv.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{iv.type}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{iv.date}</td>
                          <td style={{ padding: '10px 14px' }}>{iv.count}</td>
                          <td style={{ padding: '10px 14px' }}>{iv.accepted}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: rate >= 85 ? '#16a34a' : '#d97706', fontWeight: 600 }}>{rate}%</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>€{(iv.value_eur||0).toLocaleString('pt-PT')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => openEditIv(iv)} style={{ padding: '3px 8px', background: '#f1f5f9', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✏️</button>
                              <button onClick={() => deleteIv(iv.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ ANALYTICS ══════════════════════════════════════════════════════ */}
        {!loading && tab === 'analytics' && (() => {
          const acceptRate = totalIv > 0 ? Math.round((totalAccepted / totalIv) * 100) : 0
          const harmCount = events.filter(e => e.harm).length
          const openEvents = events.filter(e => e.status === 'open').length
          const closedEvents = events.filter(e => e.status === 'closed').length
          const byType: Record<string, number> = {}
          for (const e of events) { byType[e.type] = (byType[e.type] || 0) + 1 }
          const maxType = Math.max(...Object.values(byType), 1)
          const ivByType: Record<string, number> = {}
          for (const iv of interventions) { ivByType[iv.type || 'Outro'] = (ivByType[iv.type || 'Outro'] || 0) + iv.count }
          const maxIv = Math.max(...Object.values(ivByType), 1)

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(events.length === 0 && interventions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  Sem dados para análise. Registe eventos de segurança e intervenções primeiro.
                </div>
              ) : (
                <>
                  {/* KPI summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                    {[
                      { label: 'Taxa de aceitação', value: `${acceptRate}%`, icon: '✅', color: acceptRate >= 85 ? '#16a34a' : acceptRate >= 70 ? '#ca8a04' : '#dc2626', sub: 'Benchmark ESCP: ≥85%' },
                      { label: 'Valor gerado', value: `€${totalValue.toFixed(0)}`, icon: '💶', color: '#16a34a', sub: 'Total acumulado' },
                      { label: 'Eventos c/ dano', value: harmCount, icon: '🩺', color: harmCount > 0 ? '#dc2626' : '#16a34a', sub: `de ${events.length} eventos` },
                      { label: 'Taxa de resolução', value: events.length ? `${Math.round((closedEvents / events.length) * 100)}%` : '—', icon: '🔒', color: '#2563eb', sub: `${closedEvents} fechados` },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 3 }}>{k.label}</div>
                        {k.sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Events by type */}
                    {Object.keys(byType).length > 0 && (
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Eventos por tipo</div>
                        {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
                          <div key={type} style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{type.replace(/_/g,' ')}</span>
                              <span style={{ fontSize: 12, color: '#64748b' }}>{count}</span>
                            </div>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#1e3a5f', borderRadius: 3, width: `${(count / maxType) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Interventions by type */}
                    {Object.keys(ivByType).length > 0 && (
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Intervenções por tipo</div>
                        {Object.entries(ivByType).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
                          <div key={type} style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{type}</span>
                              <span style={{ fontSize: 12, color: '#64748b' }}>{count} interv.</span>
                            </div>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#0d9488', borderRadius: 3, width: `${(count / maxIv) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* ═══ EVENT MODAL ═══════════════════════════════════════════════════════ */}
      {showEventModal && (
        <Modal title={editEvent ? 'Editar evento' : 'Registar evento de segurança'} onClose={() => setShowEventModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tipo de evento</label>
                <select style={inputStyle} value={eventForm.type} onChange={e => setEventForm(f => ({ ...f, type: e.target.value as EventType }))}>
                  {(Object.keys(TYPE_META) as EventType[]).map(k => <option key={k} value={k}>{TYPE_META[k].label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Severidade</label>
                <select style={inputStyle} value={eventForm.severity} onChange={e => setEventForm(f => ({ ...f, severity: e.target.value as Severity }))}>
                  {(Object.keys(SEV_META) as Severity[]).map(k => <option key={k} value={k}>{SEV_META[k].label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Data</label>
                <input style={inputStyle} type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Serviço</label>
                <input style={inputStyle} value={eventForm.unit} onChange={e => setEventForm(f => ({ ...f, unit: e.target.value }))} placeholder="Ex: Medicina Interna" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Descrição do evento *</label>
              <textarea style={{ ...inputStyle, height: 88, resize: 'vertical' }} value={eventForm.description}
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreve o que aconteceu, contexto e medidas tomadas" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Medicamento envolvido</label>
                <input style={inputStyle} value={eventForm.drug} onChange={e => setEventForm(f => ({ ...f, drug: e.target.value }))} placeholder="Ex: Insulina" />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select style={inputStyle} value={eventForm.status} onChange={e => setEventForm(f => ({ ...f, status: e.target.value as EventStatus }))}>
                  <option value="open">Aberto</option>
                  <option value="under_review">Em análise</option>
                  <option value="closed">Fechado</option>
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={eventForm.harm} onChange={e => setEventForm(f => ({ ...f, harm: e.target.checked }))} />
              Ocorreu dano ao doente
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEventModal(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveEvent} disabled={saving || !eventForm.description.trim()} style={{ padding: '9px 18px', background: saving ? '#94a3b8' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'A guardar…' : editEvent ? 'Guardar alterações' : 'Registar evento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ INTERVENTION MODAL ════════════════════════════════════════════════ */}
      {showInterventionModal && (
        <Modal title={editIntervention ? 'Editar intervenção' : 'Registar intervenção'} onClose={() => setShowInterventionModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Tipo de intervenção</label>
              <select style={inputStyle} value={ivForm.type} onChange={e => setIvForm(f => ({ ...f, type: e.target.value }))}>
                {INTERVENTION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Data</label>
                <input style={inputStyle} type="date" value={ivForm.date} onChange={e => setIvForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Nº total</label>
                <input style={inputStyle} type="number" min="1" value={ivForm.count} onChange={e => setIvForm(f => ({ ...f, count: parseInt(e.target.value)||1 }))} />
              </div>
              <div>
                <label style={labelStyle}>Nº aceites</label>
                <input style={inputStyle} type="number" min="0" value={ivForm.accepted} onChange={e => setIvForm(f => ({ ...f, accepted: parseInt(e.target.value)||0 }))} />
              </div>
              <div>
                <label style={labelStyle}>Valor est. (€)</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={ivForm.value_eur} onChange={e => setIvForm(f => ({ ...f, value_eur: parseFloat(e.target.value)||0 }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={ivForm.notes} onChange={e => setIvForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInterventionModal(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveIv} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94a3b8' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'A guardar…' : editIntervention ? 'Guardar' : 'Registar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <style>{`
        @media(max-width:768px){
          .quality-form-grid{grid-template-columns:1fr!important}
          .quality-stats{grid-template-columns:1fr 1fr!important}
        }
        input:focus,textarea:focus,select:focus{border-color:#1e3a5f!important;outline:none;box-shadow:0 0 0 3px #1e3a5f18}
      `}</style>
    </div>
  )
}
