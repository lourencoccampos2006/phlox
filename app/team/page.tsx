'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

type ShiftType = 'morning' | 'afternoon' | 'night' | 'off'
type RoleType  = 'pharmacist' | 'pharmacist_director' | 'nurse' | 'coordinator' | 'doctor' | 'administrator' | 'intern'
type MemberStatus = 'on_shift' | 'break' | 'off' | 'sick' | 'vacation'

interface TeamMember {
  id: string; user_id?: string
  name: string; role: RoleType; unit: string; phone: string
  shift: ShiftType; shift_start: string; shift_end: string
  on_call: boolean; status: MemberStatus
  vacation_days: number; next_training: string
  tasks_done: number; tasks_total: number
}

const ROLE_META: Record<RoleType, { label: string; color: string }> = {
  pharmacist:          { label: 'Farmacêutico',          color: '#2563eb' },
  pharmacist_director: { label: 'Dir. Farmácia',         color: '#7c3aed' },
  nurse:               { label: 'Enfermeiro',             color: '#0891b2' },
  coordinator:         { label: 'Coordenador',           color: '#059669' },
  doctor:              { label: 'Médico',                 color: '#dc2626' },
  administrator:       { label: 'Administrador',         color: '#64748b' },
  intern:              { label: 'Interno/Estagiário',    color: '#d97706' },
}
const SHIFT_META: Record<ShiftType, { label: string; color: string; icon: string }> = {
  morning:   { label: 'Manhã',  color: '#d97706', icon: '🌅' },
  afternoon: { label: 'Tarde',  color: '#7c3aed', icon: '🌆' },
  night:     { label: 'Noite',  color: '#0284c7', icon: '🌙' },
  off:       { label: 'Folga',  color: '#94a3b8', icon: '🏠' },
}
const STATUS_META: Record<MemberStatus, { label: string; color: string; dot: string }> = {
  on_shift: { label: 'Em serviço', color: '#16a34a', dot: '#4ade80' },
  break:    { label: 'Pausa',      color: '#d97706', dot: '#fbbf24' },
  off:      { label: 'Fora',       color: '#64748b', dot: '#94a3b8' },
  sick:     { label: 'Baixa',      color: '#dc2626', dot: '#f87171' },
  vacation: { label: 'Férias',     color: '#0284c7', dot: '#38bdf8' },
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(520px,100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const { user, supabase } = useAuth()
  const [members, setMembers]   = useState<TeamMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [shiftFilter, setShiftFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [saving, setSaving] = useState(false)

  const BLANK: Omit<TeamMember,'id'|'user_id'> = {
    name:'', role:'pharmacist', unit:'', phone:'',
    shift:'morning', shift_start:'08:00', shift_end:'16:00',
    on_call:false, status:'off',
    vacation_days:22, next_training:'', tasks_done:0, tasks_total:0,
  }
  const [form, setForm] = useState<typeof BLANK>(BLANK)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('user_id', user.id).order('name')
    if (data) setMembers(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  // Keyboard: N = add member
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'n' || e.key === 'N') openNew()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() { setForm(BLANK); setEditMember(null); setShowModal(true) }
  function openEdit(m: TeamMember) {
    setForm({ name:m.name, role:m.role, unit:m.unit||'', phone:m.phone||'',
      shift:m.shift, shift_start:m.shift_start||'08:00', shift_end:m.shift_end||'16:00',
      on_call:m.on_call||false, status:m.status,
      vacation_days:m.vacation_days||22, next_training:m.next_training||'',
      tasks_done:m.tasks_done||0, tasks_total:m.tasks_total||0 })
    setEditMember(m); setShowModal(true)
  }
  async function save() {
    if (!user || !form.name.trim()) return
    setSaving(true)
    const payload = { ...form, user_id: user.id }
    if (editMember) await supabase.from('team_members').update(payload).eq('id', editMember.id)
    else await supabase.from('team_members').insert(payload)
    setSaving(false); setShowModal(false); load()
  }
  async function deleteMember(id: string) {
    if (!confirm('Remover membro da equipa?')) return
    await supabase.from('team_members').delete().eq('id', id)
    if (selected === id) setSelected(null)
    load()
  }
  async function updateStatus(id: string, status: MemberStatus) {
    await supabase.from('team_members').update({ status }).eq('id', id)
    load()
  }

  const filtered = members.filter(m => {
    if (shiftFilter !== 'all' && m.shift !== shiftFilter) return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    return true
  })
  const onShiftCount = members.filter(m => m.status === 'on_shift').length
  const selectedMember = selected ? members.find(m => m.id === selected) : null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link href="/cockpit" style={{ color: '#475569', textDecoration: 'none' }}>Cockpit</Link>
            <span>›</span>
            <span style={{ color: '#94a3b8' }}>Equipa</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Equipa</h1>
              <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 13 }}>Escala de turnos · Competências · Disponibilidade</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Total', value: members.length, alert: false },
                { label: 'Em serviço', value: onShiftCount, alert: false },
                { label: 'Baixas', value: members.filter(m => m.status === 'sick').length, alert: members.filter(m => m.status === 'sick').length > 0 },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${s.alert ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 64,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.alert ? '#f87171' : '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>A carregar…</div>}

        {!loading && (
          <>
            <div className="team-filters" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, minHeight: 42 }}>
                <option value="all">Todos os turnos</option>
                {(Object.keys(SHIFT_META) as ShiftType[]).map(k => <option key={k} value={k}>{SHIFT_META[k].label}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, minHeight: 42 }}>
                <option value="all">Todos os estados</option>
                {(Object.keys(STATUS_META) as MemberStatus[]).map(k => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
              </select>
              <span style={{ color: '#64748b', fontSize: 13 }}>{filtered.length} membros</span>
              <button onClick={openNew} style={{ marginLeft: 'auto', padding: '11px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, minHeight: 44, whiteSpace: 'nowrap' }}>
                + Adicionar membro
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              {/* List */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Equipa vazia</div>
                    <div style={{ fontSize: 13 }}>Adiciona os membros da equipa para gerir turnos e competências.</div>
                    <button onClick={openNew} style={{ marginTop: 16, padding: '10px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Adicionar membro</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(m => {
                      const rm  = ROLE_META[m.role]
                      const sm  = SHIFT_META[m.shift]
                      const stm = STATUS_META[m.status]
                      const isSelected = selected === m.id
                      const taskPct = m.tasks_total > 0 ? Math.round(m.tasks_done / m.tasks_total * 100) : 0

                      return (
                        <div key={m.id} onClick={() => setSelected(isSelected ? null : m.id)} style={{
                          background: isSelected ? '#f0fdf4' : '#fff', borderRadius: 10,
                          border: `1px solid ${isSelected ? '#86efac' : '#e2e8f0'}`,
                          padding: '13px 16px', cursor: 'pointer',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                              background: rm.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 15, fontWeight: 700, color: rm.color, position: 'relative',
                            }}>
                              {m.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                              <span
                                title={`Estado: ${stm.label} — clica para mudar`}
                                onClick={e => {
                                  e.stopPropagation()
                                  const cycle: MemberStatus[] = ['on_shift', 'break', 'off', 'sick', 'vacation']
                                  const next = cycle[(cycle.indexOf(m.status) + 1) % cycle.length]
                                  updateStatus(m.id, next)
                                }}
                                style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: stm.dot, border: '2px solid #fff', cursor: 'pointer' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
                                <span style={{ background: rm.color + '18', color: rm.color, padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{rm.label}</span>
                                {m.on_call && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>🔔 Prevenção</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: '#64748b' }}>{m.unit || '—'}</span>
                                <span style={{ fontSize: 12, color: sm.color }}>{sm.icon} {sm.label} {m.shift !== 'off' ? `${m.shift_start}–${m.shift_end}` : ''}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ background: stm.color + '18', color: stm.color, padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{stm.label}</span>
                              {m.tasks_total > 0 && (
                                <div style={{ marginTop: 5 }}>
                                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{m.tasks_done}/{m.tasks_total} tarefas</div>
                                  <div style={{ background: '#f1f5f9', borderRadius: 3, height: 4, width: 70, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${taskPct}%`, background: taskPct === 100 ? '#16a34a' : '#2563eb', borderRadius: 3 }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => openEdit(m)} style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, minHeight: 38 }}>✏️</button>
                              <button onClick={() => deleteMember(m.id)} style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, minHeight: 38 }}>✕</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedMember && (
                <div className="team-detail-panel" style={{ width: 280, flexShrink: 0, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, alignSelf: 'flex-start', position: 'sticky', top: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedMember.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{ROLE_META[selectedMember.role].label}</div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    {selectedMember.phone && <div>📱 {selectedMember.phone}</div>}
                    <div>{SHIFT_META[selectedMember.shift].icon} {SHIFT_META[selectedMember.shift].label}{selectedMember.shift !== 'off' ? ` ${selectedMember.shift_start}–${selectedMember.shift_end}` : ''}</div>
                    <div>🏖️ {selectedMember.vacation_days} dias de férias</div>
                    {selectedMember.next_training && <div>🎓 {selectedMember.next_training}</div>}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>ALTERAR ESTADO</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                      {(Object.keys(STATUS_META) as MemberStatus[]).map(s => {
                        const meta = STATUS_META[s]
                        const active = selectedMember.status === s
                        return (
                          <button key={s} onClick={() => updateStatus(selectedMember.id, s)} style={{
                            padding: '6px 8px', borderRadius: 7, border: `1px solid ${active ? meta.color + '50' : '#f1f5f9'}`,
                            background: active ? meta.color + '12' : '#f8fafc', cursor: 'pointer',
                            fontSize: 11, fontWeight: active ? 700 : 400, color: active ? meta.color : '#64748b',
                            fontFamily: 'inherit',
                          }}>
                            {meta.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══ MEMBER MODAL ══════════════════════════════════════════════════════ */}
      {showModal && (
        <Modal title={editMember ? 'Editar membro' : 'Adicionar membro'} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome completo *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Dra. Ana Costa" />
            </div>
            <div className="team-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Função</label>
                <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleType }))}>
                  {(Object.keys(ROLE_META) as RoleType[]).map(k => <option key={k} value={k}>{ROLE_META[k].label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Serviço/Unidade</label>
                <input style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Ex: UCI, Medicina Interna" />
              </div>
            </div>
            <div className="team-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ex: 916 234 567" />
              </div>
              <div>
                <label style={labelStyle}>Turno</label>
                <select style={inputStyle} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value as ShiftType }))}>
                  {(Object.keys(SHIFT_META) as ShiftType[]).map(k => <option key={k} value={k}>{SHIFT_META[k].label}</option>)}
                </select>
              </div>
            </div>
            {form.shift !== 'off' && (
              <div className="team-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Início do turno</label>
                  <input style={inputStyle} type="time" value={form.shift_start} onChange={e => setForm(f => ({ ...f, shift_start: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Fim do turno</label>
                  <input style={inputStyle} type="time" value={form.shift_end} onChange={e => setForm(f => ({ ...f, shift_end: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="team-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Estado atual</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MemberStatus }))}>
                  {(Object.keys(STATUS_META) as MemberStatus[]).map(k => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Dias de férias restantes</label>
                <input style={inputStyle} type="number" min="0" max="30" value={form.vacation_days} onChange={e => setForm(f => ({ ...f, vacation_days: parseInt(e.target.value)||0 }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Próxima formação</label>
              <input style={inputStyle} value={form.next_training} onChange={e => setForm(f => ({ ...f, next_training: e.target.value }))} placeholder="Ex: Vancomicina AUC 2026-05-28" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={form.on_call} onChange={e => setForm(f => ({ ...f, on_call: e.target.checked }))} />
              Em prevenção / plantão
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: '9px 18px', background: saving ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'A guardar…' : editMember ? 'Guardar alterações' : 'Adicionar membro'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <style>{`
        @media(max-width:640px){
          .team-filters{flex-direction:column;align-items:stretch!important}
          .team-filters select{width:100%;font-size:16px!important}
          .team-filters button{margin-left:0!important;width:100%}
          .team-form-grid{grid-template-columns:1fr!important}
          .team-detail-panel{width:100%!important;position:static!important}
        }
        input:focus,textarea:focus,select:focus{border-color:#1d4ed8!important;outline:none;box-shadow:0 0 0 3px #1d4ed818}
      `}</style>
    </div>
  )
}
