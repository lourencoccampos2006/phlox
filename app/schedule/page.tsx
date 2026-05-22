'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

interface TeamMember {
  id: string
  name: string
  role: string
  status?: string
}

interface ShiftAssignment {
  id: string
  team_member_id: string
  member_name?: string
  member_role?: string
  date: string
  shift: 'manha' | 'tarde' | 'noite'
  notes?: string
}

const SHIFT_CFG = {
  manha: { label: 'Manhã',  hours: '07:00–14:00', color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  tarde: { label: 'Tarde',  hours: '14:00–21:00', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  noite: { label: 'Noite',  hours: '21:00–07:00', color: '#6d28d9', bg: '#faf5ff', border: '#e9d5ff', dot: '#7c3aed' },
}

const ROLE_LABELS: Record<string, string> = {
  nurse: 'Enfermeiro(a)', caregiver: 'Ajudante Ação Direta', pharmacist: 'Farmacêutico(a)',
  admin: 'Administrativo(a)', doctor: 'Médico(a)', physiotherapist: 'Fisioterapeuta',
  psychologist: 'Psicólogo(a)', social_worker: 'Assist. Social', coordinator: 'Coordenador(a)',
  director: 'Diretor(a) Técnico(a)', other: 'Outro',
}

function getWeekDates(base: Date): Date[] {
  const mon = new Date(base)
  const day = mon.getDay()
  mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const DAY_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function SchedulePage() {
  const { user, supabase } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [shifts, setShifts] = useState<ShiftAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekBase, setWeekBase] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ team_member_id: '', date: fmt(new Date()), shift: 'manha' as const, notes: '' })
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'week' | 'list'>('week')

  const weekDates = getWeekDates(weekBase)
  const weekStart = fmt(weekDates[0])
  const weekEnd = fmt(weekDates[6])
  const today = fmt(new Date())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: tm }, { data: sh }] = await Promise.all([
      supabase.from('team_members').select('id,name,role,status').eq('user_id', user.id).order('name'),
      supabase.from('shift_assignments').select('*').eq('user_id', user.id).gte('date', weekStart).lte('date', weekEnd),
    ])
    const members = tm || []
    setMembers(members)
    const mMap: Record<string, TeamMember> = {}
    members.forEach((m: TeamMember) => { mMap[m.id] = m })
    setShifts((sh || []).map((s: any) => ({
      ...s,
      member_name: mMap[s.team_member_id]?.name || '—',
      member_role: mMap[s.team_member_id]?.role,
    })))
    setLoading(false)
  }, [user, supabase, weekStart, weekEnd])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!user || !form.team_member_id) return
    setSaving(true)
    const { error } = await supabase.from('shift_assignments').insert({
      user_id: user.id, team_member_id: form.team_member_id,
      date: form.date, shift: form.shift, notes: form.notes || null,
    })
    if (!error) { setShowForm(false); setForm({ team_member_id: '', date: fmt(new Date()), shift: 'manha', notes: '' }); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('shift_assignments').delete().eq('id', id).eq('user_id', user!.id)
    setShifts(p => p.filter(s => s.id !== id))
  }

  const byDayShift = (date: string, shiftType: string) => shifts.filter(s => s.date === date && s.shift === shiftType)

  const gaps = weekDates.filter(d => {
    const ds = fmt(d)
    return byDayShift(ds, 'manha').length === 0 || byDayShift(ds, 'tarde').length === 0 || byDayShift(ds, 'noite').length === 0
  }).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Equipa</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Escalas de Serviço</h1>
          </div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '10px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Marcar turno
          </button>
        </div>

        {/* Week nav */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', minWidth: 180, textAlign: 'center' }}>
              {weekDates[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button onClick={() => setWeekBase(new Date())} style={{ padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>Hoje</button>
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
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 7, border: `1.5px solid ${view === v ? '#1d4ed8' : 'var(--border)'}`, background: view === v ? '#eff6ff' : 'white', color: view === v ? '#1d4ed8' : 'var(--ink-4)', fontSize: 12, fontWeight: view === v ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {v === 'week' ? 'Semana' : 'Lista'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}</div>
        ) : view === 'week' ? (
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
                    <button onClick={() => { setForm(p => ({ ...p, date: ds })); setShowForm(true) }} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>+</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                    {(['manha', 'tarde', 'noite'] as const).map((sk, si) => {
                      const sc = SHIFT_CFG[sk]
                      const ss = byDayShift(ds, sk)
                      return (
                        <div key={sk} style={{ padding: '8px 10px', borderLeft: si > 0 ? '1px solid var(--border)' : 'none', minHeight: 60 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sc.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sc.label}</span>
                          </div>
                          {ss.length === 0 ? (
                            <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.2)', fontStyle: 'italic' }}>vazio</div>
                          ) : ss.map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, padding: '3px 6px', background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 5, gap: 4 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.member_name}</div>
                              </div>
                              <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(0,0,0,0.2)', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
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
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)' }}>Sem turnos esta semana</div>
              </div>
            ) : [...shifts].sort((a, b) => a.date.localeCompare(b.date) || (['manha','tarde','noite'].indexOf(a.shift) - ['manha','tarde','noite'].indexOf(b.shift))).map(s => {
              const sc = SHIFT_CFG[s.shift]
              const d = new Date(s.date + 'T12:00:00')
              return (
                <div key={s.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.member_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>{ROLE_LABELS[s.member_role || ''] || s.member_role}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sc.color }}>{sc.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 1 }}>{d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  </div>
                  <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-5)', padding: '0 4px', flexShrink: 0 }}>×</button>
                </div>
              )
            })}
          </div>
        )}

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, padding: '22px 22px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Marcar Turno</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                  <Lbl>Funcionário *</Lbl>
                  <select value={form.team_member_id} onChange={e => setForm(p => ({ ...p, team_member_id: e.target.value }))} style={selSt}>
                    <option value="">Selecionar...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} — {ROLE_LABELS[m.role] || m.role}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Lbl>Data</Lbl>
                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inpSt} />
                  </div>
                  <div>
                    <Lbl>Turno</Lbl>
                    <select value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value as any }))} style={selSt}>
                      {Object.entries(SHIFT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.hours})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Lbl>Notas</Lbl>
                  <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Substituição, formação..." style={inpSt} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>Cancelar</button>
                <button onClick={save} disabled={saving || !form.team_member_id} style={{ padding: '9px 20px', background: (!form.team_member_id || saving) ? 'var(--bg-3)' : '#1d4ed8', color: (!form.team_member_id || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (!form.team_member_id || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>
}
const inpSt: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }
const selSt: React.CSSProperties = { ...inpSt, cursor: 'pointer', background: 'white' }
