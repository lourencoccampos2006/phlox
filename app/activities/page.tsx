'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

interface Activity {
  id: string
  title: string
  type: string
  date: string
  start_time: string
  end_time?: string
  location?: string
  responsible?: string
  description?: string
  max_participants?: number
  status: 'planned' | 'ongoing' | 'done' | 'cancelled'
  created_at: string
}

interface Participation {
  id: string
  activity_id: string
  patient_id: string
  patient_name?: string
  attended: boolean
  notes?: string
}

interface Patient {
  id: string
  name: string
  room_number?: string
}

const TYPES = [
  { id: 'gym',       label: 'Ginástica',      emoji: '🤸', color: '#22c55e' },
  { id: 'games',     label: 'Jogos',           emoji: '🎲', color: '#3b82f6' },
  { id: 'music',     label: 'Musicoterapia',   emoji: '🎵', color: '#8b5cf6' },
  { id: 'art',       label: 'Arteterapia',     emoji: '🎨', color: '#f59e0b' },
  { id: 'visit',     label: 'Visitas',         emoji: '👨‍👩‍👧', color: '#ec4899' },
  { id: 'outing',    label: 'Saída',           emoji: '🌳', color: '#10b981' },
  { id: 'religious', label: 'Religioso',       emoji: '⛪', color: '#6366f1' },
  { id: 'therapy',   label: 'Fisioterapia',    emoji: '🏃', color: '#ef4444' },
  { id: 'social',    label: 'Convívio',        emoji: '☕', color: '#d97706' },
  { id: 'reading',   label: 'Leitura',         emoji: '📚', color: '#14b8a6' },
  { id: 'other',     label: 'Outro',           emoji: '📌', color: '#6b7280' },
]

const STATUS_CFG = {
  planned:   { label: 'Agendada',   bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  ongoing:   { label: 'Em curso',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  done:      { label: 'Concluída',  bg: '#f9fafb', color: '#4b5563', border: '#e5e7eb' },
  cancelled: { label: 'Cancelada',  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function typeFor(id: string) {
  return TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1]
}

export default function ActivitiesPage() {
  const { user, supabase } = useAuth() as any
  const [view, setView]         = useState<'today' | 'week' | 'all'>('today')
  const [activities, setActivities] = useState<Activity[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Activity | null>(null)
  const [participations, setParticipations] = useState<Participation[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [filterType, setFilterType] = useState('')

  const [form, setForm] = useState({
    title: '', type: 'gym', date: todayStr(), start_time: '10:00', end_time: '',
    location: 'Sala de convívio', responsible: '', description: '', max_participants: '',
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: acts }, { data: pats }] = await Promise.all([
      supabase.from('activities').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('start_time', { ascending: true }),
      supabase.from('patients').select('*').eq('user_id', user.id).order('name'),
    ])
    setActivities(acts || [])
    setPatients(pats || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function loadParticipation(actId: string) {
    const { data } = await supabase
      .from('activity_participations').select('*').eq('activity_id', actId)
    setParticipations(data || [])
  }

  async function selectActivity(act: Activity) {
    setSelected(act)
    await loadParticipation(act.id)
  }

  async function saveActivity() {
    if (!form.title.trim() || !user) return
    setSaving(true)
    await supabase.from('activities').insert({
      user_id: user.id, title: form.title.trim(), type: form.type,
      date: form.date, start_time: form.start_time,
      end_time: form.end_time || null, location: form.location || null,
      responsible: form.responsible || null, description: form.description || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      status: 'planned',
    })
    setSaving(false)
    setShowModal(false)
    setForm({ title: '', type: 'gym', date: todayStr(), start_time: '10:00', end_time: '', location: 'Sala de convívio', responsible: '', description: '', max_participants: '' })
    load()
  }

  async function toggleStatus(act: Activity, status: Activity['status']) {
    await supabase.from('activities').update({ status }).eq('id', act.id)
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, status } : a))
    if (selected?.id === act.id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  async function toggleParticipation(patientId: string, attended: boolean) {
    if (!selected) return
    const existing = participations.find(p => p.patient_id === patientId)
    if (existing) {
      await supabase.from('activity_participations').update({ attended }).eq('id', existing.id)
      setParticipations(prev => prev.map(p => p.patient_id === patientId ? { ...p, attended } : p))
    } else {
      const { data } = await supabase.from('activity_participations').insert({
        activity_id: selected.id, patient_id: patientId, attended,
        user_id: user.id,
      }).select().single()
      if (data) setParticipations(prev => [...prev, data])
    }
  }

  async function markAllPresent() {
    if (!selected) return
    const existingIds = new Set(participations.map(p => p.patient_id))
    const toInsert = patients.filter(p => !existingIds.has(p.id)).map(p => ({ activity_id: selected.id, patient_id: p.id, attended: true, user_id: user.id }))
    const toUpdate = participations.filter(p => !p.attended)
    if (toUpdate.length) await supabase.from('activity_participations').update({ attended: true }).in('id', toUpdate.map(p => p.id))
    let inserted: Participation[] = []
    if (toInsert.length) { const { data } = await supabase.from('activity_participations').insert(toInsert).select(); inserted = data || [] }
    setParticipations(prev => [...prev.map(p => ({ ...p, attended: true })), ...inserted])
  }

  async function deleteActivity(act: Activity) {
    if (!confirm(`Apagar a atividade "${act.title}"? Esta ação não pode ser revertida.`)) return
    await supabase.from('activity_participations').delete().eq('activity_id', act.id)
    await supabase.from('activities').delete().eq('id', act.id)
    setActivities(prev => prev.filter(a => a.id !== act.id))
    if (selected?.id === act.id) setSelected(null)
  }

  const [printingReport, setPrintingReport] = useState(false)
  async function printMonthlyReport() {
    setPrintingReport(true)
    try {
      const m = today.slice(0, 7)
      const monthActs = activities.filter(a => a.date.slice(0, 7) === m && a.status !== 'cancelled')
      const ids = monthActs.map(a => a.id)
      let parts: Participation[] = []
      if (ids.length) { const { data } = await supabase.from('activity_participations').select('*').in('activity_id', ids); parts = data || [] }
      const attendedParts = parts.filter(p => p.attended)
      // por tipo
      const byType: Record<string, { count: number; attend: number }> = {}
      monthActs.forEach(a => {
        byType[a.type] ||= { count: 0, attend: 0 }
        byType[a.type].count++
        byType[a.type].attend += attendedParts.filter(p => p.activity_id === a.id).length
      })
      // por residente
      const byPatient: Record<string, number> = {}
      attendedParts.forEach(p => { byPatient[p.patient_id] = (byPatient[p.patient_id] || 0) + 1 })
      const lowPart = patients.filter(p => (byPatient[p.id] || 0) <= 1)

      const monthLabel = new Date(today + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      printDoc({
        docTitle: 'Relatório Mensal de Animação Sociocultural',
        docSubtitle: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        institution: 'Lar / ERPI',
        meta: [
          { label: 'atividades', value: String(monthActs.length) },
          { label: 'participações', value: String(attendedParts.length) },
          { label: 'média/atividade', value: monthActs.length ? (attendedParts.length / monthActs.length).toFixed(1) : '0' },
        ],
        sections: [
          {
            heading: 'Atividades por tipo',
            records: Object.entries(byType).sort((a, b) => b[1].count - a[1].count).map(([type, v]) => ({
              title: `${typeFor(type).label} — ${v.count} sessõ${v.count !== 1 ? 'es' : 'e'}`,
              fields: [{ label: 'Participações', value: String(v.attend) }, { label: 'Média', value: (v.attend / v.count).toFixed(1) }],
            })),
          },
          {
            heading: 'Registo de sessões',
            records: monthActs.sort((a, b) => a.date.localeCompare(b.date)).map(a => ({
              title: `${new Date(a.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} — ${a.title}`,
              tags: [{ label: typeFor(a.type).label, color: '#334155' }],
              fields: [
                { label: 'Hora', value: a.start_time + (a.end_time ? `–${a.end_time}` : '') },
                { label: 'Presenças', value: String(attendedParts.filter(p => p.activity_id === a.id).length) },
                ...(a.responsible ? [{ label: 'Dinamizador', value: a.responsible }] : []),
              ],
            })),
          },
          ...(lowPart.length ? [{
            heading: 'Residentes com baixa participação (≤1 atividade)',
            records: [{ title: `${lowPart.length} residente(s)`, bullets: lowPart.map(p => `${p.name}${p.room_number ? ` · Q${p.room_number}` : ''} — ${byPatient[p.id] || 0} participaçõe(s)`) }],
          }] : []),
          { heading: 'Validação', records: [{ title: 'Responsável pela animação', fields: [{ label: 'Nome', value: '' }, { label: 'Assinatura', value: '' }, { label: 'Data', value: '' }] }] },
        ],
        footerNote: 'Relatório de animação sociocultural · Phlox',
      })
    } finally { setPrintingReport(false) }
  }

  const today = todayStr()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    const day = d.getDay()
    const mon = new Date(d)
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + i)
    return mon.toISOString().slice(0, 10)
  })

  const filtered = activities.filter(a => {
    if (filterType && a.type !== filterType) return false
    if (view === 'today') return a.date === today
    if (view === 'week') return weekDates.includes(a.date)
    return true
  })

  // Stats
  const totalThisMonth = activities.filter(a => a.date.slice(0, 7) === today.slice(0, 7)).length
  const doneThisMonth  = activities.filter(a => a.date.slice(0, 7) === today.slice(0, 7) && a.status === 'done').length
  const todayCount     = activities.filter(a => a.date === today).length

  const attendedCount  = participations.filter(p => p.attended).length

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0b1120' }}>Atividades</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Planeamento e registo de participação dos residentes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={printMonthlyReport}
            disabled={printingReport}
            style={{ padding: '10px 16px', background: '#fff', color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {printingReport ? 'A gerar…' : '🖨 Relatório mensal'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            + Nova Atividade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Hoje',           value: todayCount,      color: '#2563eb' },
          { label: 'Este mês',       value: totalThisMonth,  color: '#7c3aed' },
          { label: 'Concluídas',     value: doneThisMonth,   color: '#16a34a' },
          { label: 'Tipos distintos',value: new Set(activities.map(a => a.type)).size, color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('')}
          style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterType === '' ? '#2563eb' : '#e5e7eb'}`, background: filterType === '' ? '#eff6ff' : '#fff', color: filterType === '' ? '#2563eb' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
        >Todas</button>
        {TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id === filterType ? '' : t.id)}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterType === t.id ? t.color : '#e5e7eb'}`, background: filterType === t.id ? t.color + '15' : '#fff', color: filterType === t.id ? t.color : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >{t.emoji} {t.label}</button>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f3f4f6', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {([['today','Hoje'], ['week','Esta semana'], ['all','Todas']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: view === v ? '#fff' : 'transparent', color: view === v ? '#0b1120' : '#6b7280', fontWeight: view === v ? 600 : 400, fontSize: 13, cursor: 'pointer', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
          >{l}</button>
        ))}
      </div>

      <div className="act-grid" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16 }}>
        {/* Activity list */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>A carregar...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontWeight: 600, color: '#374151' }}>Sem atividades {view === 'today' ? 'hoje' : view === 'week' ? 'esta semana' : ''}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Clica em "+ Nova Atividade" para começar</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(act => {
                const t = typeFor(act.type)
                const s = STATUS_CFG[act.status]
                const isSelected = selected?.id === act.id
                return (
                  <div
                    key={act.id}
                    onClick={() => selectActivity(act)}
                    style={{ background: '#fff', border: `1.5px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: t.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {t.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#0b1120', fontSize: 14 }}>{act.title}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>🕐 {act.start_time}{act.end_time ? `–${act.end_time}` : ''}</span>
                        {act.location && <span>📍 {act.location}</span>}
                        {act.responsible && <span>👤 {act.responsible}</span>}
                        <span style={{ color: t.color, fontWeight: 500 }}>{t.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                      {new Date(act.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (() => {
          const t = typeFor(selected.type)
          const s = STATUS_CFG[selected.status]
          return (
            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20, position: 'sticky', top: 20, alignSelf: 'start', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{t.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0b1120' }}>{selected.title}</div>
                    <div style={{ fontSize: 12, color: t.color, fontWeight: 500 }}>{t.label}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => deleteActivity(selected)} title="Apagar atividade" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, padding: '2px 6px' }}>🗑</button>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, fontSize: 13, color: '#374151' }}>
                <div>📅 {new Date(selected.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <div>🕐 {selected.start_time}{selected.end_time ? ` – ${selected.end_time}` : ''}</div>
                {selected.location && <div>📍 {selected.location}</div>}
                {selected.responsible && <div>👤 {selected.responsible}</div>}
                {selected.description && <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', marginTop: 4, color: '#6b7280' }}>{selected.description}</div>}
              </div>

              {/* Status buttons */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(STATUS_CFG) as Activity['status'][]).map(st => (
                    <button
                      key={st}
                      onClick={() => toggleStatus(selected, st)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: `1.5px solid ${selected.status === st ? STATUS_CFG[st].color : '#e5e7eb'}`, background: selected.status === st ? STATUS_CFG[st].bg : '#fff', color: selected.status === st ? STATUS_CFG[st].color : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: selected.status === st ? 600 : 400 }}
                    >{STATUS_CFG[st].label}</button>
                  ))}
                </div>
              </div>

              {/* Participations */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Participação · <span style={{ color: '#16a34a' }}>{attendedCount} presentes</span></span>
                  {patients.length > 0 && (
                    <button onClick={markAllPresent} style={{ padding: '3px 9px', borderRadius: 5, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>✓ Todos</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {patients.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 12 }}>Sem residentes registados</div>
                  ) : patients.map(p => {
                    const part = participations.find(pp => pp.patient_id === p.id)
                    const attended = part?.attended ?? false
                    return (
                      <div
                        key={p.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: attended ? '#f0fdf4' : '#f9fafb', border: `1px solid ${attended ? '#bbf7d0' : '#e5e7eb'}` }}
                      >
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#0b1120' }}>{p.name}</span>
                          {p.room_number && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>Q.{p.room_number}</span>}
                        </div>
                        <button
                          onClick={() => toggleParticipation(p.id, !attended)}
                          style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: attended ? '#16a34a' : '#e5e7eb', color: attended ? '#fff' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                        >{attended ? '✓ Presente' : 'Ausente'}</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* New activity modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nova Atividade</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Ginástica de manhã"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm(p => ({ ...p, type: t.id }))}
                      style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${form.type === t.id ? t.color : '#e5e7eb'}`, background: form.type === t.id ? t.color + '15' : '#fff', color: form.type === t.id ? t.color : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                    >{t.emoji} {t.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Data *</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Início *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Fim</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Local</label>
                  <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Sala de convívio" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Responsável</label>
                  <input value={form.responsible} onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))} placeholder="Nome do colaborador" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Descrição</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Notas adicionais..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <button
                onClick={saveActivity}
                disabled={!form.title.trim() || saving}
                style={{ padding: '12px 20px', background: form.title.trim() ? '#2563eb' : '#e5e7eb', color: form.title.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: form.title.trim() ? 'pointer' : 'default', marginTop: 4 }}
              >{saving ? 'A guardar...' : 'Criar Atividade'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .act-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
