'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'team' | 'schedule' | 'config'
type Shift = 'manha' | 'tarde' | 'noite'
type MemberStatus = 'on_shift' | 'break' | 'off' | 'sick' | 'vacation'

interface TeamMember {
  id: string
  name: string
  role: string
  status: MemberStatus
  phone?: string
  unit?: string
  on_call?: boolean
}

interface ShiftAssignment {
  id: string
  team_member_id: string
  member_name?: string
  member_role?: string
  date: string
  shift: Shift
  notes?: string
}

interface ShiftTimeCfg { start: string; end: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = ['manha', 'tarde', 'noite']

const SHIFT_META: Record<Shift, { label: string; color: string; bg: string; border: string; dot: string }> = {
  manha: { label: 'Manhã',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  tarde: { label: 'Tarde',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  noite: { label: 'Noite',  color: '#6d28d9', bg: '#faf5ff', border: '#e9d5ff', dot: '#7c3aed' },
}

const ROLE_LABELS: Record<string, string> = {
  nurse: 'Enfermeiro(a)', caregiver: 'Ajudante Ação Direta',
  pharmacist: 'Farmacêutico(a)', admin: 'Administrativo(a)',
  doctor: 'Médico(a)', physiotherapist: 'Fisioterapeuta',
  psychologist: 'Psicólogo(a)', social_worker: 'Assist. Social',
  coordinator: 'Coordenador(a)', director: 'Diretor(a) Técnico(a)', other: 'Outro',
}

const ROLE_COLORS: Record<string, string> = {
  nurse: '#0891b2', caregiver: '#059669', pharmacist: '#7c3aed',
  admin: '#64748b', doctor: '#dc2626', physiotherapist: '#0284c7',
  psychologist: '#d97706', social_worker: '#16a34a', coordinator: '#2563eb',
  director: '#1d4ed8', other: '#374151',
}

const STATUS_CFG: Record<MemberStatus, { label: string; color: string; dot: string }> = {
  on_shift: { label: 'Em serviço', color: '#16a34a', dot: '#4ade80' },
  break:    { label: 'Pausa',      color: '#d97706', dot: '#fbbf24' },
  off:      { label: 'Fora',       color: '#64748b', dot: '#94a3b8' },
  sick:     { label: 'Baixa',      color: '#dc2626', dot: '#f87171' },
  vacation: { label: 'Férias',     color: '#0284c7', dot: '#38bdf8' },
}

const STATUS_CYCLE: MemberStatus[] = ['on_shift', 'break', 'off', 'sick', 'vacation']

const DAY_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

const DEFAULT_TIMES: Record<Shift, ShiftTimeCfg> = {
  manha: { start: '07:00', end: '14:00' },
  tarde: { start: '14:00', end: '21:00' },
  noite: { start: '21:00', end: '07:00' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: Date) => d.toISOString().slice(0, 10)

function getWeekDates(base: Date): Date[] {
  const mon = new Date(base)
  const day = mon.getDay()
  mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

function loadTimeCfg(): Record<Shift, ShiftTimeCfg> {
  try {
    const raw = localStorage.getItem('phlox_shift_times')
    if (raw) return { ...DEFAULT_TIMES, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_TIMES }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function ChevronLeft() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
}
function ChevronRight() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>
}

const inp: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box', background: 'white',
}
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EquipaPage() {
  const { user, supabase } = useAuth()

  const [tab, setTab] = useState<Tab>('team')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [shifts, setShifts] = useState<ShiftAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [timeCfg, setTimeCfg] = useState<Record<Shift, ShiftTimeCfg>>(DEFAULT_TIMES)

  // Team
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [editMemberId, setEditMemberId] = useState<string | null>(null)
  const [mForm, setMForm] = useState({ name: '', role: 'nurse', unit: '', phone: '', status: 'off' as MemberStatus, on_call: false })
  const [savingMember, setSavingMember] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Schedule
  const [weekBase, setWeekBase] = useState(new Date())
  const [schedView, setSchedView] = useState<'week' | 'list'>('week')
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [sForm, setSForm] = useState({ team_member_id: '', date: fmt(new Date()), shift: 'manha' as Shift, notes: '' })
  const [savingShift, setSavingShift] = useState(false)

  const weekDates = getWeekDates(weekBase)
  const weekStart = fmt(weekDates[0])
  const weekEnd   = fmt(weekDates[6])
  const today     = fmt(new Date())

  useEffect(() => { setTimeCfg(loadTimeCfg()) }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: tm }, { data: sh }] = await Promise.all([
      supabase.from('team_members').select('*').eq('user_id', user.id).order('name'),
      supabase.from('shift_assignments').select('*').eq('user_id', user.id).gte('date', weekStart).lte('date', weekEnd),
    ])
    const mems = (tm || []) as TeamMember[]
    setMembers(mems)
    const mMap: Record<string, TeamMember> = {}
    mems.forEach(m => { mMap[m.id] = m })
    setShifts((sh || []).map((s: unknown) => {
      const sa = s as ShiftAssignment
      return { ...sa, member_name: mMap[sa.team_member_id]?.name || '—', member_role: mMap[sa.team_member_id]?.role }
    }))
    setLoading(false)
  }, [user, supabase, weekStart, weekEnd])

  useEffect(() => { load() }, [load])

  // ── Team actions ──────────────────────────────────────────────────────────

  function openNewMember() {
    setMForm({ name: '', role: 'nurse', unit: '', phone: '', status: 'off', on_call: false })
    setEditMemberId(null)
    setShowMemberForm(true)
  }

  function openEditMember(m: TeamMember) {
    setMForm({ name: m.name, role: m.role, unit: m.unit || '', phone: m.phone || '', status: m.status, on_call: m.on_call || false })
    setEditMemberId(m.id)
    setShowMemberForm(true)
  }

  async function saveMember() {
    if (!user || !mForm.name.trim()) return
    setSavingMember(true)
    const payload = { ...mForm, user_id: user.id }
    if (editMemberId) {
      await supabase.from('team_members').update(payload).eq('id', editMemberId).eq('user_id', user.id)
    } else {
      await supabase.from('team_members').insert(payload)
    }
    setSavingMember(false)
    setShowMemberForm(false)
    load()
  }

  async function deleteMember(id: string) {
    if (!confirm('Remover membro da equipa?')) return
    await supabase.from('team_members').delete().eq('id', id).eq('user_id', user!.id)
    if (selectedId === id) setSelectedId(null)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  async function setMemberStatus(m: TeamMember, status: MemberStatus) {
    await supabase.from('team_members').update({ status }).eq('id', m.id).eq('user_id', user!.id)
    setMembers(prev => prev.map(p => p.id === m.id ? { ...p, status } : p))
  }

  function cycleStatus(m: TeamMember, e: React.MouseEvent) {
    e.stopPropagation()
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(m.status) + 1) % STATUS_CYCLE.length]
    setMemberStatus(m, next)
  }

  // ── Schedule actions ─────────────────────────────────────────────────────

  function openShiftForm(date?: string) {
    setSForm({ team_member_id: '', date: date || fmt(new Date()), shift: 'manha', notes: '' })
    setShowShiftForm(true)
  }

  async function saveShift() {
    if (!user || !sForm.team_member_id) return
    setSavingShift(true)
    const { error } = await supabase.from('shift_assignments').insert({
      user_id: user.id, team_member_id: sForm.team_member_id,
      date: sForm.date, shift: sForm.shift, notes: sForm.notes || null,
    })
    if (!error) { setShowShiftForm(false); load() }
    setSavingShift(false)
  }

  async function removeShift(id: string) {
    await supabase.from('shift_assignments').delete().eq('id', id).eq('user_id', user!.id)
    setShifts(p => p.filter(s => s.id !== id))
  }

  const [copying, setCopying] = useState(false)
  // Copia a escala da semana anterior para esta (escalas repetem-se → poupa imenso tempo)
  async function copyPreviousWeek() {
    if (!user || copying) return
    const prevStart = new Date(weekDates[0]); prevStart.setDate(prevStart.getDate() - 7)
    const prevEnd = new Date(weekDates[6]); prevEnd.setDate(prevEnd.getDate() - 7)
    setCopying(true)
    try {
      const { data: prev } = await supabase.from('shift_assignments').select('team_member_id,date,shift,notes')
        .eq('user_id', user.id).gte('date', fmt(prevStart)).lte('date', fmt(prevEnd))
      if (!prev || prev.length === 0) { alert('A semana anterior não tem escala para copiar.'); return }
      // chaves já existentes nesta semana (evitar duplicar)
      const existing = new Set(shifts.map(s => `${s.team_member_id}|${s.date}|${s.shift}`))
      const rows = prev.map((p: any) => {
        const d = new Date(p.date + 'T12:00:00'); d.setDate(d.getDate() + 7)
        return { user_id: user.id, team_member_id: p.team_member_id, date: fmt(d), shift: p.shift, notes: p.notes || null }
      }).filter((r: any) => !existing.has(`${r.team_member_id}|${r.date}|${r.shift}`))
      if (rows.length === 0) { alert('Esta semana já tem a escala da semana anterior.'); return }
      const { error } = await supabase.from('shift_assignments').insert(rows)
      if (!error) load()
      else alert('Não foi possível copiar: ' + error.message)
    } finally { setCopying(false) }
  }

  function byDayShift(date: string, sk: Shift) { return shifts.filter(s => s.date === date && s.shift === sk) }

  const gaps = weekDates.filter(d => SHIFTS.some(sk => byDayShift(fmt(d), sk).length === 0)).length

  // ── Config ────────────────────────────────────────────────────────────────

  function updateTimeCfg(sk: Shift, field: 'start' | 'end', val: string) {
    const next = { ...timeCfg, [sk]: { ...timeCfg[sk], [field]: val } }
    setTimeCfg(next)
    try { localStorage.setItem('phlox_shift_times', JSON.stringify(next)) } catch { /* ignore */ }
  }

  function resetTimeCfg() {
    setTimeCfg({ ...DEFAULT_TIMES })
    try { localStorage.setItem('phlox_shift_times', JSON.stringify(DEFAULT_TIMES)) } catch { /* ignore */ }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = members.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const selectedMember = selectedId ? members.find(m => m.id === selectedId) : undefined
  const onShift = members.filter(m => m.status === 'on_shift').length

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} style={{
      padding: '7px 16px', borderRadius: 8, fontFamily: 'var(--font-sans)',
      border: `1.5px solid ${tab === t ? '#1d4ed8' : 'var(--border)'}`,
      background: tab === t ? '#eff6ff' : 'white',
      color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
      fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
    }}>{label}</button>
  )

  const btnPrimary: React.CSSProperties = {
    padding: '10px 18px', background: '#1d4ed8', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    display: 'flex', alignItems: 'center', gap: 7,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body">

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Organização</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,3vw,28px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Equipa & Escalas</h1>
          </div>
          {tab === 'team' && <button onClick={openNewMember} style={btnPrimary}><PlusIcon /> Adicionar</button>}
          {tab === 'schedule' && <button onClick={() => openShiftForm()} style={btnPrimary}><PlusIcon /> Marcar turno</button>}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {tabBtn('team', 'Equipa')}
          {tabBtn('schedule', 'Escalas')}
          {tabBtn('config', 'Configurar turnos')}
        </div>

        {/* ══════════════════════════════════════════════════════ TEAM ══ */}
        {tab === 'team' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Total',      value: members.length,                                c: 'var(--ink)' },
                { label: 'Em serviço', value: onShift,                                       c: '#16a34a'    },
                { label: 'Baixas',     value: members.filter(m => m.status === 'sick').length,     c: '#dc2626'    },
                { label: 'Férias',     value: members.filter(m => m.status === 'vacation').length, c: '#0284c7'    },
              ].map(k => (
                <div key={k.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: k.c, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." style={{ ...inp, width: 200, flex: '0 1 200px' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...sel, width: 170, flex: '0 1 170px' }}>
                <option value="all">Todos os estados</option>
                {(Object.keys(STATUS_CFG) as MemberStatus[]).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 10 }} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* List */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {filtered.length === 0 ? (
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>
                        {members.length === 0 ? 'Equipa vazia' : 'Sem resultados'}
                      </div>
                      {members.length === 0 && (
                        <button onClick={openNewMember} style={{ marginTop: 10, padding: '9px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                          Adicionar primeiro membro
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filtered.map(m => {
                        const rc = ROLE_COLORS[m.role] || '#374151'
                        const st = STATUS_CFG[m.status] || STATUS_CFG.off
                        const isSel = selectedId === m.id
                        return (
                          <div key={m.id} onClick={() => setSelectedId(isSel ? null : m.id)}
                            style={{ background: isSel ? '#f0f9ff' : 'white', border: `1.5px solid ${isSel ? '#93c5fd' : 'var(--border)'}`, borderRadius: 10, padding: '11px 15px', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              {/* Avatar */}
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: rc + '18', color: rc, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                                {m.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                <button title={`${st.label} · clica para avançar`}
                                  onClick={e => cycleStatus(m, e)}
                                  style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: st.dot, border: '2px solid white', cursor: 'pointer', padding: 0 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{m.name}</span>
                                  <span style={{ background: rc + '15', color: rc, padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                    {ROLE_LABELS[m.role] || m.role}
                                  </span>
                                  {m.on_call && (
                                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                      Prevenção
                                    </span>
                                  )}
                                </div>
                                {(m.unit || m.phone) && (
                                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                                    {[m.unit, m.phone].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                              <span style={{ flexShrink: 0, background: st.color + '15', color: st.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                {st.label}
                              </span>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => openEditMember(m)} style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', alignItems: 'center' }}>
                                  <EditIcon />
                                </button>
                                <button onClick={() => deleteMember(m.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                                  <TrashIcon />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Detail panel — desktop only */}
                {selectedMember && (
                  <div className="team-detail" style={{ width: 250, flexShrink: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18, position: 'sticky', top: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{selectedMember.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{ROLE_LABELS[selectedMember.role] || selectedMember.role}</div>
                      </div>
                      <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-5)', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                    {selectedMember.phone && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>{selectedMember.phone}</div>}
                    {selectedMember.unit  && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>{selectedMember.unit}</div>}
                    <Lbl>Alterar estado</Lbl>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                      {(Object.keys(STATUS_CFG) as MemberStatus[]).map(s => {
                        const st = STATUS_CFG[s]
                        const active = selectedMember.status === s
                        return (
                          <button key={s} onClick={() => setMemberStatus(selectedMember, s)} style={{
                            padding: '6px 8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            border: `1px solid ${active ? st.color + '60' : 'var(--border)'}`,
                            background: active ? st.color + '12' : 'var(--bg-2)',
                            fontSize: 11, fontWeight: active ? 700 : 400,
                            color: active ? st.color : 'var(--ink-4)',
                          }}>{st.label}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════ SCHEDULE ══ */}
        {tab === 'schedule' && (
          <>
            {/* Week nav */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
                  style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronLeft />
                </button>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', minWidth: 190, textAlign: 'center' }}>
                  {weekDates[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
                  style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight />
                </button>
                <button onClick={() => setWeekBase(new Date())}
                  style={{ padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>
                  Hoje
                </button>
                <button onClick={copyPreviousWeek} disabled={copying} title="Copiar a escala da semana anterior"
                  style={{ padding: '5px 11px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', fontSize: 11, fontWeight: 700, cursor: copying ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', color: '#2563eb' }}>
                  {copying ? 'A copiar…' : '⤵ Copiar semana anterior'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>{shifts.length}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Turnos</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: gaps > 0 ? '#dc2626' : '#16a34a', lineHeight: 1 }}>{gaps}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lacunas</div>
                </div>
              </div>
            </div>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['week', 'list'] as const).map(v => (
                <button key={v} onClick={() => setSchedView(v)} style={{
                  padding: '6px 14px', borderRadius: 7, fontFamily: 'var(--font-sans)',
                  border: `1.5px solid ${schedView === v ? '#1d4ed8' : 'var(--border)'}`,
                  background: schedView === v ? '#eff6ff' : 'white',
                  color: schedView === v ? '#1d4ed8' : 'var(--ink-4)',
                  fontSize: 12, fontWeight: schedView === v ? 700 : 400, cursor: 'pointer',
                }}>
                  {v === 'week' ? 'Semana' : 'Lista'}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
              </div>
            ) : schedView === 'week' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weekDates.map((d, di) => {
                  const ds = fmt(d)
                  const isToday = ds === today
                  return (
                    <div key={ds} style={{ background: 'white', border: `1.5px solid ${isToday ? '#3b82f6' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '9px 14px', background: isToday ? '#eff6ff' : 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#1d4ed8' : 'var(--ink)' }}>{DAY_PT[di]}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                          {isToday && <span style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase' }}>Hoje</span>}
                        </div>
                        <button onClick={() => openShiftForm(ds)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
                          <PlusIcon size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                        {SHIFTS.map((sk, si) => {
                          const sm = SHIFT_META[sk]
                          const tc = timeCfg[sk]
                          const ss = byDayShift(ds, sk)
                          return (
                            <div key={sk} style={{ padding: '8px 10px', borderLeft: si > 0 ? '1px solid var(--border)' : 'none', minHeight: 56 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: sm.dot }} />
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sm.color, fontWeight: 700, textTransform: 'uppercase' }}>{sm.label}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-5)' }}>{tc.start}–{tc.end}</span>
                              </div>
                              {ss.length === 0 ? (
                                <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.18)', fontStyle: 'italic' }}>vazio</div>
                              ) : ss.map(s => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, padding: '3px 6px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 5, gap: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 }}>{s.member_name}</span>
                                  <button onClick={() => removeShift(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(0,0,0,0.2)', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shifts.length === 0 ? (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)' }}>Sem turnos esta semana</div>
                  </div>
                ) : [...shifts].sort((a, b) => a.date.localeCompare(b.date) || (SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift))).map(s => {
                  const sm = SHIFT_META[s.shift]
                  const tc = timeCfg[s.shift]
                  const d = new Date(s.date + 'T12:00:00')
                  return (
                    <div key={s.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.member_name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>{ROLE_LABELS[s.member_role || ''] || s.member_role}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sm.color }}>{sm.label} · {tc.start}–{tc.end}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 1 }}>{d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      </div>
                      <button onClick={() => removeShift(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-5)', padding: '0 4px', flexShrink: 0 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ═════════════════════════════════════════════════════ CONFIG ══ */}
        {tab === 'config' && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 460 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', fontWeight: 400, marginBottom: 5 }}>Horários dos turnos</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>
              Define os horários reais da tua unidade. Guardados localmente neste dispositivo.
            </div>
            {SHIFTS.map((sk, i) => {
              const sm = SHIFT_META[sk]
              const tc = timeCfg[sk]
              return (
                <div key={sk} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: i < SHIFTS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: sm.color }}>{sm.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Lbl>Início</Lbl>
                      <input type="time" value={tc.start} onChange={e => updateTimeCfg(sk, 'start', e.target.value)} style={inp} />
                    </div>
                    <div>
                      <Lbl>Fim</Lbl>
                      <input type="time" value={tc.end} onChange={e => updateTimeCfg(sk, 'end', e.target.value)} style={inp} />
                    </div>
                  </div>
                </div>
              )
            })}
            <button onClick={resetTimeCfg} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>
              Repor predefinições
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════ MEMBER FORM ══ */}
        {showMemberForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowMemberForm(false) }}>
            <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, padding: '22px 22px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>
                  {editMemberId ? 'Editar membro' : 'Adicionar membro'}
                </h2>
                <button onClick={() => setShowMemberForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                  <Lbl>Nome completo *</Lbl>
                  <input value={mForm.name} onChange={e => setMForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Ana Costa" style={inp} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Lbl>Função</Lbl>
                    <select value={mForm.role} onChange={e => setMForm(p => ({ ...p, role: e.target.value }))} style={sel}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl>Serviço / Unidade</Lbl>
                    <input value={mForm.unit} onChange={e => setMForm(p => ({ ...p, unit: e.target.value }))} placeholder="Ex: Medicina Interna" style={inp} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Lbl>Telefone</Lbl>
                    <input value={mForm.phone} onChange={e => setMForm(p => ({ ...p, phone: e.target.value }))} placeholder="916 234 567" style={inp} />
                  </div>
                  <div>
                    <Lbl>Estado atual</Lbl>
                    <select value={mForm.status} onChange={e => setMForm(p => ({ ...p, status: e.target.value as MemberStatus }))} style={sel}>
                      {(Object.keys(STATUS_CFG) as MemberStatus[]).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>
                  <input type="checkbox" checked={mForm.on_call} onChange={e => setMForm(p => ({ ...p, on_call: e.target.checked }))} />
                  Em prevenção / plantão
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowMemberForm(false)} style={{ padding: '9px 16px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>Cancelar</button>
                <button onClick={saveMember} disabled={savingMember || !mForm.name.trim()}
                  style={{ padding: '9px 20px', background: !mForm.name.trim() || savingMember ? 'var(--bg-3)' : '#1d4ed8', color: !mForm.name.trim() || savingMember ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !mForm.name.trim() || savingMember ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingMember ? 'A guardar...' : editMemberId ? 'Guardar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ SHIFT FORM ══ */}
        {showShiftForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowShiftForm(false) }}>
            <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, padding: '22px 22px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Marcar Turno</h2>
                <button onClick={() => setShowShiftForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                  <Lbl>Funcionário *</Lbl>
                  <select value={sForm.team_member_id} onChange={e => setSForm(p => ({ ...p, team_member_id: e.target.value }))} style={sel}>
                    <option value="">Selecionar...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} — {ROLE_LABELS[m.role] || m.role}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Lbl>Data</Lbl>
                    <input type="date" value={sForm.date} onChange={e => setSForm(p => ({ ...p, date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <Lbl>Turno</Lbl>
                    <select value={sForm.shift} onChange={e => setSForm(p => ({ ...p, shift: e.target.value as Shift }))} style={sel}>
                      {SHIFTS.map(k => <option key={k} value={k}>{SHIFT_META[k].label} ({timeCfg[k].start}–{timeCfg[k].end})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Lbl>Notas</Lbl>
                  <input value={sForm.notes} onChange={e => setSForm(p => ({ ...p, notes: e.target.value }))} placeholder="Substituição, formação..." style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowShiftForm(false)} style={{ padding: '9px 16px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-4)' }}>Cancelar</button>
                <button onClick={saveShift} disabled={savingShift || !sForm.team_member_id}
                  style={{ padding: '9px 20px', background: !sForm.team_member_id || savingShift ? 'var(--bg-3)' : '#1d4ed8', color: !sForm.team_member_id || savingShift ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !sForm.team_member_id || savingShift ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingShift ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`
        @media(max-width:640px){
          .team-detail{display:none!important}
        }
        input:focus,select:focus{border-color:#1d4ed8!important;outline:none;box-shadow:0 0 0 3px #1d4ed818}
      `}</style>
    </div>
  )
}
