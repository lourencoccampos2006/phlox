'use client'
import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'afternoon' | 'night' | 'off'
type RoleType = 'pharmacist' | 'pharmacist_director' | 'nurse' | 'coordinator' | 'doctor' | 'administrator' | 'intern'
type CompetencyLevel = 'expert' | 'proficient' | 'developing' | 'not_assessed'

interface TeamMember {
  id: string
  name: string
  role: RoleType
  unit: string
  shift: ShiftType
  shift_start: string
  shift_end: string
  on_call: boolean
  status: 'on_shift' | 'break' | 'off' | 'sick' | 'vacation'
  tasks_done: number
  tasks_total: number
  competencies: Record<string, CompetencyLevel>
  next_training?: string
  vacation_days: number
  phone: string
}

interface Vacancy {
  id: string
  shift: ShiftType
  date: string
  unit: string
  role: RoleType
  urgency: 'critical' | 'urgent' | 'normal'
  covered_by?: string
}

interface Training {
  id: string
  name: string
  category: string
  date: string
  seats_total: number
  seats_taken: number
  mandatory: boolean
  enrolled: string[]
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const TEAM: TeamMember[] = [
  {
    id: 't1', name: 'Dra. Ana Costa', role: 'pharmacist_director', unit: 'Direção Farmácia', phone: '916 234 567',
    shift: 'morning', shift_start: '08:00', shift_end: '16:00', on_call: false, status: 'on_shift',
    tasks_done: 4, tasks_total: 6, vacation_days: 18,
    competencies: { 'Gestão formulário': 'expert', 'Antibioterapia': 'expert', 'Oncologia': 'proficient', 'PK clínica': 'expert' },
    next_training: 'ASHP Annual 2026-06',
  },
  {
    id: 't2', name: 'Farm. João Silva', role: 'pharmacist', unit: 'Medicina Interna', phone: '916 345 678',
    shift: 'morning', shift_start: '08:00', shift_end: '16:00', on_call: false, status: 'on_shift',
    tasks_done: 7, tasks_total: 9, vacation_days: 14,
    competencies: { 'Validação prescrições': 'expert', 'Reconciliação': 'proficient', 'PK clínica': 'developing', 'RAM': 'proficient' },
  },
  {
    id: 't3', name: 'Farm. Maria Santos', role: 'pharmacist', unit: 'UCI', phone: '916 456 789',
    shift: 'morning', shift_start: '08:00', shift_end: '16:00', on_call: false, status: 'on_shift',
    tasks_done: 5, tasks_total: 8, vacation_days: 22,
    competencies: { 'Validação prescrições': 'expert', 'PK clínica': 'expert', 'NP/TPN': 'proficient', 'Antibioterapia': 'expert' },
    next_training: 'Vancomicina AUC 2026-05-28',
  },
  {
    id: 't4', name: 'Farm. Rui Almeida', role: 'pharmacist', unit: 'Oncologia', phone: '916 567 890',
    shift: 'morning', shift_start: '08:00', shift_end: '16:00', on_call: false, status: 'break',
    tasks_done: 3, tasks_total: 7, vacation_days: 10,
    competencies: { 'Quimioterapia': 'expert', 'Antieméticos': 'expert', 'Suporte oncológico': 'proficient' },
  },
  {
    id: 't5', name: 'Farm. Inês Pereira', role: 'pharmacist', unit: 'Cirurgia', phone: '916 678 901',
    shift: 'afternoon', shift_start: '14:00', shift_end: '22:00', on_call: false, status: 'off',
    tasks_done: 0, tasks_total: 6, vacation_days: 16,
    competencies: { 'Profilaxia antibiótica': 'proficient', 'Dor pós-op': 'proficient', 'Validação prescrições': 'expert' },
  },
  {
    id: 't6', name: 'Farm. Carlos Mendes', role: 'pharmacist', unit: 'Urgência', phone: '916 789 012',
    shift: 'night', shift_start: '22:00', shift_end: '08:00', on_call: true, status: 'off',
    tasks_done: 0, tasks_total: 4, vacation_days: 8,
    competencies: { 'Urgência/Emergência': 'expert', 'Terapêutica IV': 'expert', 'RAM': 'developing' },
  },
  {
    id: 't7', name: 'Farm. Sofia Rodrigues', role: 'intern', unit: 'Rotação', phone: '916 890 123',
    shift: 'morning', shift_start: '09:00', shift_end: '17:00', on_call: false, status: 'on_shift',
    tasks_done: 2, tasks_total: 5, vacation_days: 25,
    competencies: { 'Validação prescrições': 'developing', 'Reconciliação': 'not_assessed' },
  },
  {
    id: 't8', name: 'Farm. Paulo Fernandes', role: 'pharmacist', unit: 'Farmácia Ambulatório', phone: '916 901 234',
    shift: 'morning', shift_start: '08:30', shift_end: '16:30', on_call: false, status: 'sick',
    tasks_done: 0, tasks_total: 0, vacation_days: 12,
    competencies: { 'Dispensa ambulatório': 'expert', 'Aconselhamento': 'expert', 'Oncologia oral': 'proficient' },
  },
]

const VACANCIES: Vacancy[] = [
  { id: 'v1', shift: 'afternoon', date: '2026-05-21', unit: 'UCI', role: 'pharmacist', urgency: 'critical', covered_by: undefined },
  { id: 'v2', shift: 'night', date: '2026-05-22', unit: 'Urgência', role: 'pharmacist', urgency: 'urgent', covered_by: 'Farm. Carlos Mendes' },
  { id: 'v3', shift: 'morning', date: '2026-05-23', unit: 'Medicina Interna', role: 'pharmacist', urgency: 'normal', covered_by: undefined },
]

const TRAININGS: Training[] = [
  { id: 'tr1', name: 'Vancomicina AUC-guided dosing', category: 'Antibioterapia', date: '2026-05-28', seats_total: 8, seats_taken: 5, mandatory: true, enrolled: ['t2', 't3', 't5', 't6', 't7'] },
  { id: 'tr2', name: 'Nutrição Parentérica ASPEN 2022', category: 'Nutrição clínica', date: '2026-06-04', seats_total: 6, seats_taken: 3, mandatory: false, enrolled: ['t3', 't4', 't7'] },
  { id: 'tr3', name: 'Reconciliação de medicação na admissão', category: 'Segurança', date: '2026-06-11', seats_total: 10, seats_taken: 7, mandatory: true, enrolled: ['t1', 't2', 't3', 't5', 't7', 't8', 't4'] },
  { id: 'tr4', name: 'Citotóxicos — manuseamento seguro', category: 'Oncologia', date: '2026-06-18', seats_total: 6, seats_taken: 2, mandatory: true, enrolled: ['t4', 't7'] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<RoleType, { label: string; color: string }> = {
  pharmacist:          { label: 'Farmacêutico', color: '#2563eb' },
  pharmacist_director: { label: 'Dir. Farmácia', color: '#7c3aed' },
  nurse:               { label: 'Enfermeiro', color: '#0891b2' },
  coordinator:         { label: 'Coordenador', color: '#059669' },
  doctor:              { label: 'Médico', color: '#dc2626' },
  administrator:       { label: 'Administrador', color: '#64748b' },
  intern:              { label: 'Interno/Estagiário', color: '#d97706' },
}

const SHIFT_META: Record<ShiftType, { label: string; color: string; icon: string }> = {
  morning:   { label: 'Manhã', color: '#d97706', icon: '🌅' },
  afternoon: { label: 'Tarde', color: '#7c3aed', icon: '🌆' },
  night:     { label: 'Noite', color: '#0284c7', icon: '🌙' },
  off:       { label: 'Folga', color: '#94a3b8', icon: '🏠' },
}

const STATUS_META: Record<TeamMember['status'], { label: string; color: string; dot: string }> = {
  on_shift: { label: 'Em serviço', color: '#16a34a', dot: '#4ade80' },
  break:    { label: 'Pausa', color: '#d97706', dot: '#fbbf24' },
  off:      { label: 'Fora', color: '#64748b', dot: '#94a3b8' },
  sick:     { label: 'Baixa', color: '#dc2626', dot: '#f87171' },
  vacation: { label: 'Férias', color: '#0284c7', dot: '#38bdf8' },
}

const COMP_META: Record<CompetencyLevel, { label: string; color: string; w: number }> = {
  expert:       { label: 'Perito', color: '#16a34a', w: 100 },
  proficient:   { label: 'Proficiente', color: '#2563eb', w: 70 },
  developing:   { label: 'Em desenvolvimento', color: '#d97706', w: 40 },
  not_assessed: { label: 'Não avaliado', color: '#94a3b8', w: 10 },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [tab, setTab] = useState<'roster' | 'vacancies' | 'competencies' | 'training'>('roster')
  const [shiftFilter, setShiftFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  const filteredTeam = useMemo(() => TEAM.filter(m => {
    if (shiftFilter !== 'all' && m.shift !== shiftFilter) return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    return true
  }), [shiftFilter, statusFilter])

  const onShiftCount = TEAM.filter(m => m.status === 'on_shift').length
  const sickCount = TEAM.filter(m => m.status === 'sick').length
  const openVacancies = VACANCIES.filter(v => !v.covered_by).length
  const mandatoryTrainingBacklog = TRAININGS.filter(t => t.mandatory && t.seats_taken < t.seats_total * 0.8).length

  const selectedTeamMember = selectedMember ? TEAM.find(m => m.id === selectedMember) : null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#064e3b', color: '#fff', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>👥</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Gestão de Equipa</h1>
              </div>
              <p style={{ margin: 0, color: '#6ee7b7', fontSize: 13 }}>
                Turnos · Vagas · Competências · Formação contínua
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Em serviço hoje', value: onShiftCount, color: '#4ade80' },
                { label: 'Vagas abertas', value: openVacancies, color: openVacancies > 0 ? '#f87171' : '#4ade80' },
                { label: 'Baixas', value: sickCount, color: sickCount > 0 ? '#fbbf24' : '#4ade80' },
                { label: 'Formação a preencher', value: mandatoryTrainingBacklog, color: '#fbbf24' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '10px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6ee7b7' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {([
              { key: 'roster', label: '📅 Escala de turno' },
              { key: 'vacancies', label: '🔔 Vagas', badge: openVacancies },
              { key: 'competencies', label: '⭐ Competências' },
              { key: 'training', label: '🎓 Formação', badge: mandatoryTrainingBacklog },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#064e3b' : '#6ee7b7',
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

        {/* ═══ ROSTER TAB ═══════════════════════════════════════════════════════ */}
        {tab === 'roster' && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Member list */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                  <option value="all">Todos os turnos</option>
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                  <option value="night">Noite</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                  <option value="all">Todos os estados</option>
                  <option value="on_shift">Em serviço</option>
                  <option value="break">Pausa</option>
                  <option value="off">Fora</option>
                  <option value="sick">Baixa</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredTeam.map(m => {
                  const rm = ROLE_META[m.role]
                  const sm = SHIFT_META[m.shift]
                  const stm = STATUS_META[m.status]
                  const isSelected = selectedMember === m.id
                  const taskPct = m.tasks_total > 0 ? Math.round(m.tasks_done / m.tasks_total * 100) : 0

                  return (
                    <div key={m.id}
                      onClick={() => setSelectedMember(isSelected ? null : m.id)}
                      style={{
                        background: isSelected ? '#f0fdf4' : '#fff',
                        borderRadius: 10, border: `1px solid ${isSelected ? '#86efac' : '#e2e8f0'}`,
                        padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: rm.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700, color: rm.color,
                          position: 'relative',
                        }}>
                          {m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          <span style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 10, height: 10, borderRadius: '50%',
                            background: stm.dot, border: '2px solid #fff',
                          }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
                            <span style={{ background: rm.color + '20', color: rm.color, padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                              {rm.label}
                            </span>
                            {m.on_call && (
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                                🔔 Prevenção
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{m.unit}</span>
                            <span style={{ fontSize: 12, color: sm.color }}>{sm.icon} {sm.label} {m.shift !== 'off' ? `${m.shift_start}–${m.shift_end}` : ''}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ background: stm.color + '20', color: stm.color, padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                            {stm.label}
                          </span>
                          {m.tasks_total > 0 && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                                {m.tasks_done}/{m.tasks_total} tarefas
                              </div>
                              <div style={{ background: '#f1f5f9', borderRadius: 4, height: 4, width: 80, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${taskPct}%`, background: taskPct === 100 ? '#16a34a' : '#2563eb', borderRadius: 4 }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detail panel */}
            {selectedTeamMember && (
              <div style={{
                width: 300, flexShrink: 0, background: '#fff', borderRadius: 12,
                border: '1px solid #e2e8f0', padding: 20, alignSelf: 'flex-start',
                position: 'sticky', top: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{selectedTeamMember.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{ROLE_META[selectedTeamMember.role].label} · {selectedTeamMember.unit}</div>
                  </div>
                  <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>📱</span><span style={{ color: '#374151' }}>{selectedTeamMember.phone}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{SHIFT_META[selectedTeamMember.shift].icon}</span>
                    <span>{SHIFT_META[selectedTeamMember.shift].label}
                      {selectedTeamMember.shift !== 'off' ? ` ${selectedTeamMember.shift_start}–${selectedTeamMember.shift_end}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>🏖️</span><span style={{ color: '#374151' }}>{selectedTeamMember.vacation_days} dias de férias restantes</span>
                  </div>
                  {selectedTeamMember.next_training && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>🎓</span><span style={{ color: '#374151' }}>{selectedTeamMember.next_training}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 10 }}>COMPETÊNCIAS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(selectedTeamMember.competencies).map(([comp, level]) => {
                      const cm = COMP_META[level]
                      return (
                        <div key={comp}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: '#374151' }}>{comp}</span>
                            <span style={{ color: cm.color, fontWeight: 600 }}>{cm.label}</span>
                          </div>
                          <div style={{ background: '#f1f5f9', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${cm.w}%`, background: cm.color, borderRadius: 4 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button style={{
                  width: '100%', marginTop: 16, padding: '9px', background: '#064e3b', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  Editar perfil
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ VACANCIES TAB ════════════════════════════════════════════════════ */}
        {tab === 'vacancies' && (
          <div style={{ maxWidth: 700 }}>
            {openVacancies > 0 && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#991b1b', fontSize: 13 }}>
                <strong>⚠️ {openVacancies} {openVacancies === 1 ? 'vaga não coberta' : 'vagas não cobertas'}</strong> — require ação imediata ou contacto de prevenção.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {VACANCIES.map(v => {
                const urgencyColor = v.urgency === 'critical' ? '#dc2626' : v.urgency === 'urgent' ? '#d97706' : '#2563eb'
                const urgencyBg = v.urgency === 'critical' ? '#fee2e2' : v.urgency === 'urgent' ? '#fef3c7' : '#dbeafe'
                return (
                  <div key={v.id} style={{
                    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${urgencyColor}`, padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            {SHIFT_META[v.shift].icon} {SHIFT_META[v.shift].label}
                          </span>
                          <span style={{ fontWeight: 600, color: '#374151' }}>{v.unit}</span>
                          <span style={{ background: urgencyBg, color: urgencyColor, padding: '1px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                            {v.urgency === 'critical' ? '🔴 Crítico' : v.urgency === 'urgent' ? '🟠 Urgente' : '🔵 Normal'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {v.date} · {ROLE_META[v.role].label}
                        </div>
                      </div>
                      <div>
                        {v.covered_by ? (
                          <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                            ✓ Coberta por {v.covered_by}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ padding: '6px 14px', background: '#064e3b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                              Atribuir
                            </button>
                            <button style={{ padding: '6px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                              Contactar prevenção
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button style={{
              marginTop: 20, padding: '10px 20px', background: '#f1f5f9', color: '#374151',
              border: '1px dashed #cbd5e1', borderRadius: 10, cursor: 'pointer', fontSize: 14, width: '100%',
            }}>
              + Registar nova vaga
            </button>
          </div>
        )}

        {/* ═══ COMPETENCIES TAB ═════════════════════════════════════════════════ */}
        {tab === 'competencies' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', fontSize: 15 }}>
              Matriz de competências da equipa
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', minWidth: 160 }}>
                      Membro
                    </th>
                    {Array.from(new Set(TEAM.flatMap(m => Object.keys(m.competencies)))).map(comp => (
                      <th key={comp} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {comp}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAM.map((m, i) => {
                    const allComps = Array.from(new Set(TEAM.flatMap(m => Object.keys(m.competencies))))
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 16px', fontWeight: 600, fontSize: 12 }}>
                          <div>{m.name.split(' ').slice(0, 2).join(' ')}</div>
                          <div style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}>{ROLE_META[m.role].label}</div>
                        </td>
                        {allComps.map(comp => {
                          const level = m.competencies[comp]
                          if (!level) return <td key={comp} style={{ padding: '8px 10px', textAlign: 'center', color: '#e2e8f0' }}>—</td>
                          const cm = COMP_META[level]
                          return (
                            <td key={comp} style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                                background: cm.color,
                              }} title={cm.label} />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16 }}>
              {Object.entries(COMP_META).map(([level, meta]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
                  <span style={{ color: '#64748b' }}>{meta.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TRAINING TAB ═════════════════════════════════════════════════════ */}
        {tab === 'training' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
            {TRAININGS.map(tr => {
              const pct = Math.round(tr.seats_taken / tr.seats_total * 100)
              const enrolledMembers = TEAM.filter(m => tr.enrolled.includes(m.id))
              return (
                <div key={tr.id} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${tr.mandatory ? '#dc2626' : '#2563eb'}`, padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{tr.name}</span>
                        {tr.mandatory && (
                          <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            Obrigatório
                          </span>
                        )}
                        <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '1px 8px', borderRadius: 8, fontSize: 11 }}>
                          {tr.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>📅 {tr.date} · {tr.seats_taken}/{tr.seats_total} inscritos</div>
                      <div style={{ marginTop: 8, background: '#f1f5f9', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct < 50 ? '#d97706' : '#16a34a', borderRadius: 4 }} />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {enrolledMembers.map(m => (
                          <span key={m.id} style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                            {m.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button style={{
                      padding: '8px 16px', background: '#064e3b', color: '#fff', border: 'none',
                      borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0,
                    }}>
                      Inscrever
                    </button>
                  </div>
                </div>
              )
            })}

            <button style={{
              padding: '12px 20px', background: '#f1f5f9', color: '#374151',
              border: '1px dashed #cbd5e1', borderRadius: 10, cursor: 'pointer', fontSize: 14,
            }}>
              + Adicionar ação de formação
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
