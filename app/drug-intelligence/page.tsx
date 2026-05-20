'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'

type FormularyStatus = 'approved' | 'restricted' | 'non_formulary' | 'under_review'
type ShortageLevel   = 'critical'  | 'severe'     | 'moderate'      | 'resolved'

interface FormularyDrug {
  id: string; user_id?: string
  name: string; generic: string; class: string; atc: string
  form: string; strength: string; status: FormularyStatus
  restricted_to: string; alternatives: string[]
  unit_cost: number; monthly_usage: number; stock_days: number
  ddd_per_100: number | null; last_reviewed: string
}

interface Shortage {
  id: string; user_id?: string
  drug: string; generic: string; severity: ShortageLevel
  since: string; expected_resolution: string; reason: string
  alternatives: string[]; affected_units: string[]; notes: string
}

const STATUS_META: Record<FormularyStatus, { label: string; color: string; bg: string }> = {
  approved:      { label: 'Aprovado',         color: '#16a34a', bg: '#dcfce7' },
  restricted:    { label: 'Restrito',         color: '#d97706', bg: '#fef3c7' },
  non_formulary: { label: 'Fora formulário',  color: '#dc2626', bg: '#fee2e2' },
  under_review:  { label: 'Em revisão',       color: '#7c3aed', bg: '#ede9fe' },
}
const SHORTAGE_META: Record<ShortageLevel, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'Crítica',   color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  severe:   { label: 'Severa',    color: '#d97706', bg: '#fef3c7', icon: '🟠' },
  moderate: { label: 'Moderada',  color: '#ca8a04', bg: '#fefce8', icon: '🟡' },
  resolved: { label: 'Resolvida', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
}
const CLASS_OPTIONS = ['Antibióticos','Anticoagulantes','Analgésicos','Anti-hipertensores','Antidiabéticos','Oncologia','Antifúngicos','Antivirais','Outro']
const fmtEur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

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

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }

export default function DrugIntelligencePage() {
  const { user, supabase } = useAuth()
  const [tab, setTab] = useState<'formulary' | 'shortages' | 'analytics'>('formulary')
  const [formulary, setFormulary]   = useState<FormularyDrug[]>([])
  const [shortages, setShortages]   = useState<Shortage[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [showDrugModal, setShowDrugModal]     = useState(false)
  const [showShortageModal, setShowShortageModal] = useState(false)
  const [editDrug, setEditDrug]     = useState<FormularyDrug | null>(null)
  const [editShortage, setEditShortage] = useState<Shortage | null>(null)
  const [saving, setSaving]         = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!user) return
    setLoading(true)
    const [f, s] = await Promise.all([
      supabase.from('formulary').select('*').eq('user_id', user.id).order('name'),
      supabase.from('drug_shortages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (f.data) setFormulary(f.data)
    if (s.data) setShortages(s.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  // ── Formulary CRUD ─────────────────────────────────────────────────────────
  const DRUG_BLANK: Omit<FormularyDrug,'id'|'user_id'> = {
    name:'', generic:'', class: CLASS_OPTIONS[0], atc:'', form:'oral', strength:'',
    status:'approved', restricted_to:'', alternatives:[], unit_cost:0,
    monthly_usage:0, stock_days:30, ddd_per_100:null, last_reviewed: new Date().toISOString().slice(0,10),
  }
  const [drugForm, setDrugForm] = useState<typeof DRUG_BLANK>(DRUG_BLANK)

  function openNewDrug() { setDrugForm(DRUG_BLANK); setEditDrug(null); setShowDrugModal(true) }
  function openEditDrug(d: FormularyDrug) {
    setDrugForm({ name:d.name, generic:d.generic, class:d.class, atc:d.atc, form:d.form, strength:d.strength,
      status:d.status, restricted_to:d.restricted_to||'', alternatives:d.alternatives||[],
      unit_cost:d.unit_cost, monthly_usage:d.monthly_usage, stock_days:d.stock_days,
      ddd_per_100:d.ddd_per_100, last_reviewed:d.last_reviewed||'' })
    setEditDrug(d); setShowDrugModal(true)
  }

  async function saveDrug() {
    if (!user || !drugForm.name.trim()) return
    setSaving(true)
    const payload = { ...drugForm, user_id: user.id }
    if (editDrug) {
      await supabase.from('formulary').update(payload).eq('id', editDrug.id)
    } else {
      await supabase.from('formulary').insert(payload)
    }
    setSaving(false); setShowDrugModal(false); load()
  }

  async function deleteDrug(id: string) {
    if (!confirm('Remover do formulário?')) return
    await supabase.from('formulary').delete().eq('id', id)
    load()
  }

  // ── Shortage CRUD ──────────────────────────────────────────────────────────
  const SHORTAGE_BLANK: Omit<Shortage,'id'|'user_id'> = {
    drug:'', generic:'', severity:'moderate', since: new Date().toISOString().slice(0,10),
    expected_resolution:'', reason:'', alternatives:[], affected_units:[], notes:'',
  }
  const [shortageForm, setShortageForm] = useState<typeof SHORTAGE_BLANK>(SHORTAGE_BLANK)

  function openNewShortage() { setShortageForm(SHORTAGE_BLANK); setEditShortage(null); setShowShortageModal(true) }
  function openEditShortage(s: Shortage) {
    setShortageForm({ drug:s.drug, generic:s.generic||'', severity:s.severity,
      since:s.since||'', expected_resolution:s.expected_resolution||'', reason:s.reason||'',
      alternatives:s.alternatives||[], affected_units:s.affected_units||[], notes:s.notes||'' })
    setEditShortage(s); setShowShortageModal(true)
  }

  async function saveShortage() {
    if (!user || !shortageForm.drug.trim()) return
    setSaving(true)
    const payload = { ...shortageForm, user_id: user.id }
    if (editShortage) {
      await supabase.from('drug_shortages').update(payload).eq('id', editShortage.id)
    } else {
      await supabase.from('drug_shortages').insert(payload)
    }
    setSaving(false); setShowShortageModal(false); load()
  }

  async function deleteShortage(id: string) {
    if (!confirm('Remover rutura?')) return
    await supabase.from('drug_shortages').delete().eq('id', id)
    load()
  }

  const filteredFormulary = useMemo(() => formulary.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !d.generic?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [formulary, statusFilter, search])

  const activeShortages = shortages.filter(s => s.severity !== 'resolved').length
  const criticalCount   = shortages.filter(s => s.severity === 'critical').length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 22 }}>🧬</span>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Drug Intelligence Hub</h1>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Formulário hospitalar e gestão de ruturas</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Formulário', value: formulary.length },
                { label: 'Ruturas ativas', value: activeShortages, alert: criticalCount > 0 },
                { label: 'Críticas', value: criticalCount, alert: criticalCount > 0 },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${s.alert ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 80,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.alert ? '#f87171' : '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 18, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { key: 'formulary' as const, label: '📋 Formulário' },
              { key: 'shortages' as const, label: '⚠️ Ruturas', badge: activeShortages },
              { key: 'analytics' as const, label: '📊 Análise DDD & Custos' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#0f172a' : '#94a3b8',
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

        {/* ═══ FORMULARY ══════════════════════════════════════════════════════ */}
        {!loading && tab === 'formulary' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Pesquisar fármaco…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: 240, flex: 'none' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Todos os estados</option>
                {(Object.keys(STATUS_META) as FormularyStatus[]).map(k => (
                  <option key={k} value={k}>{STATUS_META[k].label}</option>
                ))}
              </select>
              <span style={{ color: '#64748b', fontSize: 13 }}>{filteredFormulary.length} fármacos</span>
              <button onClick={openNewDrug} style={{
                marginLeft: 'auto', padding: '9px 18px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}>+ Adicionar fármaco</button>
            </div>

            {filteredFormulary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Formulário vazio</div>
                <div style={{ fontSize: 13 }}>Adiciona o primeiro fármaco ao formulário hospitalar.</div>
                <button onClick={openNewDrug} style={{ marginTop: 16, padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  + Adicionar fármaco
                </button>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Nome','Classe','Estado','Stock','Custo','DDD/100CD',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFormulary.map((d, i) => {
                      const st = STATUS_META[d.status]
                      const isExp = expanded === d.id
                      return (
                        <>
                          <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', background: isExp ? '#f0f9ff' : i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}
                            onClick={() => setExpanded(isExp ? null : d.id)}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.name}</td>
                            <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.class}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ color: (d.stock_days||0) < 15 ? '#dc2626' : (d.stock_days||0) < 25 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                                {d.stock_days ?? '—'}d
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>{d.unit_cost ? fmtEur(d.unit_cost) : '—'}</td>
                            <td style={{ padding: '10px 14px' }}>{d.ddd_per_100 ?? '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => openEditDrug(d)} style={{ padding: '4px 10px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Editar</button>
                                <button onClick={() => deleteDrug(d.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✕</button>
                              </div>
                            </td>
                          </tr>
                          {isExp && (
                            <tr key={`${d.id}-exp`}>
                              <td colSpan={7} style={{ padding: '10px 14px 14px', background: '#f0f9ff' }}>
                                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                                  {d.restricted_to && <div><strong style={{ color: '#d97706' }}>Restrição:</strong> {d.restricted_to}</div>}
                                  {d.alternatives?.length > 0 && <div><strong>Alternativas:</strong> {d.alternatives.join(', ')}</div>}
                                  {d.atc && <div><strong>ATC:</strong> <code>{d.atc}</code></div>}
                                  {d.last_reviewed && <div><strong>Última revisão:</strong> {d.last_reviewed}</div>}
                                  <div><strong>Uso mensal:</strong> {d.monthly_usage} unidades</div>
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
            )}
          </div>
        )}

        {/* ═══ SHORTAGES ══════════════════════════════════════════════════════ */}
        {!loading && tab === 'shortages' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.entries(SHORTAGE_META) as [ShortageLevel, typeof SHORTAGE_META[ShortageLevel]][]).map(([level, meta]) => {
                  const count = shortages.filter(s => s.severity === level).length
                  return (
                    <div key={level} style={{ background: meta.bg, border: `1px solid ${meta.color}30`, borderRadius: 8, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>{meta.icon}</span>
                      <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                      <span style={{ background: meta.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 12, fontWeight: 700 }}>{count}</span>
                    </div>
                  )
                })}
              </div>
              <button onClick={openNewShortage} style={{
                padding: '9px 18px', background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}>+ Registar rutura</button>
            </div>

            {shortages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Sem ruturas registadas</div>
                <div style={{ fontSize: 13 }}>Quando houver uma rutura, regista aqui para notificar a equipa.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {shortages.map(s => {
                  const meta = SHORTAGE_META[s.severity]
                  const isExp = expanded === s.id
                  return (
                    <div key={s.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${meta.color}`, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                        onClick={() => setExpanded(isExp ? null : s.id)}>
                        <span style={{ fontSize: 18 }}>{meta.icon}</span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{s.drug}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>Desde {s.since}</div>
                        </div>
                        <span style={{ background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{meta.label}</span>
                        <div style={{ textAlign: 'right', fontSize: 12 }}>
                          <div style={{ color: '#64748b' }}>Resolução prevista</div>
                          <div style={{ fontWeight: 600, color: meta.color }}>{s.expected_resolution || '—'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEditShortage(s)} style={{ padding: '4px 10px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Editar</button>
                          <button onClick={() => deleteShortage(s.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                        <span style={{ color: '#94a3b8' }}>{isExp ? '▲' : '▼'}</span>
                      </div>
                      {isExp && (
                        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                          {s.reason && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}><strong>Causa:</strong> {s.reason}</p>}
                          {s.alternatives?.length > 0 && (
                            <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Alternativas:</strong> {s.alternatives.join(' · ')}</p>
                          )}
                          {s.affected_units?.length > 0 && (
                            <p style={{ margin: '0 0 8px', fontSize: 13 }}><strong>Serviços afetados:</strong> {s.affected_units.join(', ')}</p>
                          )}
                          {s.notes && <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{s.notes}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {/* ═══ ANALYTICS ══════════════════════════════════════════════════════ */}
        {!loading && tab === 'analytics' && (() => {
          const byClass: Record<string, {count:number;cost:number;ddd:number[]}> = {}
          for (const d of formulary) {
            if (!byClass[d.class]) byClass[d.class] = { count: 0, cost: 0, ddd: [] }
            byClass[d.class].count++
            byClass[d.class].cost += (d.unit_cost || 0) * (d.monthly_usage || 0)
            if (d.ddd_per_100 !== null) byClass[d.class].ddd.push(d.ddd_per_100)
          }
          const classes = Object.entries(byClass).sort((a,b) => b[1].cost - a[1].cost)
          const totalCost = classes.reduce((s,[,v]) => s + v.cost, 0)
          const maxCost = Math.max(...classes.map(([,v]) => v.cost), 1)

          const highDDD = formulary.filter(d => d.ddd_per_100 !== null && d.ddd_per_100 > 80)
          const lowStock = formulary.filter(d => d.stock_days !== null && d.stock_days < 14)
          const outOfDate = formulary.filter(d => {
            if (!d.last_reviewed) return false
            const months = (Date.now() - new Date(d.last_reviewed).getTime()) / (30 * 86400000)
            return months > 12
          })

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {formulary.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  Sem dados no formulário para análise. Adicione fármacos primeiro.
                </div>
              ) : (
                <>
                  {/* KPI strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                    {[
                      { label: 'Custo mensal total', value: fmtEur(totalCost), icon: '💶', color: '#dc2626' },
                      { label: 'Classes terapêuticas', value: classes.length, icon: '📦', color: '#2563eb' },
                      { label: 'DDD alto (>80/100PD)', value: highDDD.length, icon: '⚠️', color: '#ca8a04' },
                      { label: 'Stock crítico (<14 dias)', value: lowStock.length, icon: '📉', color: '#ea580c' },
                      { label: 'Revisão desatualizada (>1a)', value: outOfDate.length, icon: '📅', color: '#7c3aed' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Cost by class bar chart */}
                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Custo mensal por classe terapêutica</div>
                    {classes.map(([cls, data]) => (
                      <div key={cls} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{cls}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{fmtEur(data.cost)} ({data.count} fárm.)</span>
                        </div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#2563eb', borderRadius: 4, width: `${(data.cost / maxCost) * 100}%`, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Total mensal estimado</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#dc2626' }}>{fmtEur(totalCost)}</span>
                    </div>
                  </div>

                  {/* Flags */}
                  {(highDDD.length > 0 || lowStock.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {highDDD.length > 0 && (
                        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #fde68a', padding: '16px 18px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ca8a04', marginBottom: 10 }}>⚠️ DDD elevado (&gt;80/100 PD)</div>
                          {highDDD.slice(0,5).map(d => (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #fefce8', fontSize: 12 }}>
                              <span style={{ color: '#374151', fontWeight: 600 }}>{d.name}</span>
                              <span style={{ color: '#ca8a04', fontWeight: 700 }}>{d.ddd_per_100}/100PD</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {lowStock.length > 0 && (
                        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #fecaca', padding: '16px 18px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>📉 Stock crítico (&lt;14 dias)</div>
                          {lowStock.slice(0,5).map(d => (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #fef2f2', fontSize: 12 }}>
                              <span style={{ color: '#374151', fontWeight: 600 }}>{d.name}</span>
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>{d.stock_days}d</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* ═══ DRUG MODAL ═══════════════════════════════════════════════════════ */}
      {showDrugModal && (
        <Modal title={editDrug ? 'Editar fármaco' : 'Adicionar fármaco'} onClose={() => setShowDrugModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input style={inputStyle} value={drugForm.name} onChange={e => setDrugForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Vancomicina 500mg IV" />
              </div>
              <div>
                <label style={labelStyle}>Genérico</label>
                <input style={inputStyle} value={drugForm.generic} onChange={e => setDrugForm(f => ({ ...f, generic: e.target.value }))} placeholder="Ex: vancomycin" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Classe terapêutica</label>
                <select style={inputStyle} value={drugForm.class} onChange={e => setDrugForm(f => ({ ...f, class: e.target.value }))}>
                  {CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Estado no formulário</label>
                <select style={inputStyle} value={drugForm.status} onChange={e => setDrugForm(f => ({ ...f, status: e.target.value as FormularyStatus }))}>
                  {(Object.keys(STATUS_META) as FormularyStatus[]).map(k => (
                    <option key={k} value={k}>{STATUS_META[k].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Forma</label>
                <select style={inputStyle} value={drugForm.form} onChange={e => setDrugForm(f => ({ ...f, form: e.target.value }))}>
                  {['oral','IV','SC','IM','tópico','inalação','outro'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Concentração/Dose</label>
                <input style={inputStyle} value={drugForm.strength} onChange={e => setDrugForm(f => ({ ...f, strength: e.target.value }))} placeholder="Ex: 500mg" />
              </div>
              <div>
                <label style={labelStyle}>Código ATC</label>
                <input style={inputStyle} value={drugForm.atc} onChange={e => setDrugForm(f => ({ ...f, atc: e.target.value }))} placeholder="Ex: J01XA01" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Custo unitário (€)</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={drugForm.unit_cost} onChange={e => setDrugForm(f => ({ ...f, unit_cost: parseFloat(e.target.value)||0 }))} />
              </div>
              <div>
                <label style={labelStyle}>Uso mensal (unid.)</label>
                <input style={inputStyle} type="number" min="0" value={drugForm.monthly_usage} onChange={e => setDrugForm(f => ({ ...f, monthly_usage: parseInt(e.target.value)||0 }))} />
              </div>
              <div>
                <label style={labelStyle}>Stock (dias)</label>
                <input style={inputStyle} type="number" min="0" value={drugForm.stock_days} onChange={e => setDrugForm(f => ({ ...f, stock_days: parseInt(e.target.value)||0 }))} />
              </div>
            </div>
            {drugForm.status === 'restricted' && (
              <div>
                <label style={labelStyle}>Condição de restrição</label>
                <input style={inputStyle} value={drugForm.restricted_to} onChange={e => setDrugForm(f => ({ ...f, restricted_to: e.target.value }))} placeholder="Ex: MRSA confirmado — aprovação obrigatória" />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowDrugModal(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveDrug} disabled={saving || !drugForm.name.trim()} style={{ padding: '9px 18px', background: saving ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'A guardar…' : editDrug ? 'Guardar alterações' : 'Adicionar ao formulário'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ SHORTAGE MODAL ════════════════════════════════════════════════════ */}
      {showShortageModal && (
        <Modal title={editShortage ? 'Editar rutura' : 'Registar rutura'} onClose={() => setShowShortageModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Medicamento *</label>
                <input style={inputStyle} value={shortageForm.drug} onChange={e => setShortageForm(f => ({ ...f, drug: e.target.value }))} placeholder="Ex: Midazolam 5mg/ml IV" />
              </div>
              <div>
                <label style={labelStyle}>Gravidade</label>
                <select style={inputStyle} value={shortageForm.severity} onChange={e => setShortageForm(f => ({ ...f, severity: e.target.value as ShortageLevel }))}>
                  {(Object.keys(SHORTAGE_META) as ShortageLevel[]).map(k => (
                    <option key={k} value={k}>{SHORTAGE_META[k].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Data de início</label>
                <input style={inputStyle} type="date" value={shortageForm.since} onChange={e => setShortageForm(f => ({ ...f, since: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Resolução prevista</label>
                <input style={inputStyle} type="date" value={shortageForm.expected_resolution} onChange={e => setShortageForm(f => ({ ...f, expected_resolution: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Causa da rutura</label>
              <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={shortageForm.reason} onChange={e => setShortageForm(f => ({ ...f, reason: e.target.value }))} placeholder="Descreve a causa (ex: fabricante em manutenção de planta)" />
            </div>
            <div>
              <label style={labelStyle}>Alternativas aprovadas (separadas por vírgula)</label>
              <input style={inputStyle} value={shortageForm.alternatives.join(', ')} onChange={e => setShortageForm(f => ({ ...f, alternatives: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} placeholder="Ex: Diazepam IV, Lorazepam IV" />
            </div>
            <div>
              <label style={labelStyle}>Serviços afetados (separados por vírgula)</label>
              <input style={inputStyle} value={shortageForm.affected_units.join(', ')} onChange={e => setShortageForm(f => ({ ...f, affected_units: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} placeholder="Ex: UCI, Urgência, BO" />
            </div>
            <div>
              <label style={labelStyle}>Notas adicionais</label>
              <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={shortageForm.notes} onChange={e => setShortageForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowShortageModal(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveShortage} disabled={saving || !shortageForm.drug.trim()} style={{ padding: '9px 18px', background: saving ? '#94a3b8' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'A guardar…' : editShortage ? 'Guardar alterações' : 'Registar rutura'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <style>{`
        @media(max-width:768px){
          .di-form-grid{grid-template-columns:1fr!important}
          .di-tabs{overflow-x:auto!important;white-space:nowrap!important}
        }
        input:focus,textarea:focus,select:focus{border-color:#2563eb!important;outline:none;box-shadow:0 0 0 3px #2563eb18}
      `}</style>
    </div>
  )
}
