// @ts-nocheck
'use client'

// /estagio/[id] — Página completa do estágio com tabs:
//   1. Dashboard (resumo + horas + objectivos)
//   2. Doentes (lista + ficha de cada)
//   3. Diário (log de turnos)
//   4. Objectivos (checklist com nível)
//   5. Procedimentos (logbook)
//   6. Casos (apresentações)
//   7. Relatórios (gera com IA)
//   8. Reflexões (modelo Gibbs)
//   9. Avaliações (supervisor)

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'

type Tab = 'dashboard'|'doentes'|'diario'|'objectivos'|'procedimentos'|'casos'|'relatorios'|'reflexoes'|'avaliacoes'|'horas'

interface Patient {
  id: string; initials: string|null; age: number|null; sex: string|null
  diagnosis: string|null; chief_complaint: string|null; status: string
  admission_date: string|null; discharge_date: string|null
}
interface LogEntry {
  id: string; entry_date: string; shift: string|null; hours: number|null
  what_was_done: string|null; learning: string|null; highlights: string|null
  difficulties: string|null; mood: number|null
}
interface Objective {
  id: string; category: string|null; title: string; level: string; status: string; required: boolean
}
interface Procedure {
  id: string; procedure_name: string; level: string; performed_at: string; patient_id: string|null
  supervisor: string|null; outcome: string|null
}
interface Case {
  id: string; title: string; presentation_date: string|null; final_diagnosis: string|null; ai_assisted: boolean
}
interface Report {
  id: string; kind: string; title: string; ai_assisted: boolean; created_at: string
}

export default function EstagioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, supabase } = useAuth() as any
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const headers = await auth()
    const r = await fetch(`/api/internship/${id}`, { headers })
    const j = await r.json()
    setData(j)
    setLoading(false)
  }, [id, user, auth])

  useEffect(() => { load() }, [load])

  if (loading || !data?.internship) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  const { internship: it, patients, log, objectives, procedures, cases, reports, reflections, evaluations, hours } = data

  const objCompleted = objectives.filter((o: Objective) => o.status === 'completed' || o.status === 'validated').length
  const objPct = objectives.length > 0 ? Math.round(100 * objCompleted / objectives.length) : 0
  const hoursPct = it.hours_required > 0 ? Math.min(100, Math.round(100 * it.hours_done / it.hours_required)) : 0

  async function addRow(table: string, row: any) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/internship/resource', { method: 'POST', headers, body: JSON.stringify({ table, data: { ...row, internship_id: id } }) })
    setBusy(false)
    if (r.ok) load()
  }

  async function updateRow(table: string, rowId: string, row: any) {
    const headers = await auth()
    await fetch('/api/internship/resource', { method: 'PATCH', headers, body: JSON.stringify({ table, id: rowId, data: row }) })
    load()
  }

  async function delRow(table: string, rowId: string) {
    const headers = await auth()
    await fetch(`/api/internship/resource?table=${table}&id=${rowId}`, { method: 'DELETE', headers })
    load()
  }

  async function aiAction(action: string, payload: any) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/internship/ai', { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) })
    const j = await r.json()
    setBusy(false)
    return j
  }

  return (
    <main style={{ padding: '20px clamp(12px, 3vw, 28px)', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Link href="/estagio" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>← Todos os estágios</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{it.name}</h1>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#6b7280', marginTop: 4, flexWrap: 'wrap' }}>
            {it.institution && <span>📍 {it.institution}{it.ward && ` · ${it.ward}`}</span>}
            {it.supervisor && <span>👤 {it.supervisor}</span>}
            <span>📅 {new Date(it.start_date).toLocaleDateString('pt-PT')} → {new Date(it.end_date).toLocaleDateString('pt-PT')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto', borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {([
          ['dashboard', '📊 Dashboard'],
          ['doentes', `👥 Doentes (${patients.length})`],
          ['diario', `📝 Diário (${log.length})`],
          ['objectivos', `✅ Objectivos (${objCompleted}/${objectives.length})`],
          ['procedimentos', `⚙️ Procedimentos (${procedures.length})`],
          ['casos', `📋 Casos (${cases.length})`],
          ['relatorios', `📄 Relatórios (${reports.length})`],
          ['reflexoes', `💭 Reflexões (${reflections.length})`],
          ['avaliacoes', `⭐ Avaliações (${evaluations.length})`],
          ['horas', `⏱ Horas`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            color: tab === t ? ACCENT : '#6b7280',
            borderBottom: `2px solid ${tab === t ? ACCENT : 'transparent'}`, marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && (
        <DashboardTab it={it} objPct={objPct} objCompleted={objCompleted} objTotal={objectives.length} hoursPct={hoursPct} log={log} patients={patients} procedures={procedures} />
      )}
      {tab === 'doentes' && (
        <PatientsTab patients={patients} onAdd={(row: any) => addRow('internship_patients', row)} onUpdate={(rid, row) => updateRow('internship_patients', rid, row)} onDel={rid => delRow('internship_patients', rid)} onAiCase={async (pid) => { await aiAction('generate_case', { patient_id: pid }); alert('Caso gerado. Vai à tab Casos.') }} onAiDdx={async (pid) => { const r = await aiAction('suggest_diagnosis', { patient_id: pid }); alert(JSON.stringify(r, null, 2)) }} busy={busy} internshipId={id} />
      )}
      {tab === 'diario' && (
        <LogTab log={log} onAdd={(row: any) => addRow('internship_log_entries', row)} onUpdate={(rid, row) => updateRow('internship_log_entries', rid, row)} onDel={rid => delRow('internship_log_entries', rid)} busy={busy} internshipId={id} />
      )}
      {tab === 'objectivos' && (
        <ObjectivesTab objectives={objectives} onUpdate={(rid, row) => updateRow('internship_objectives', rid, row)} onAdd={(row: any) => addRow('internship_objectives', row)} onDel={rid => delRow('internship_objectives', rid)} />
      )}
      {tab === 'procedimentos' && (
        <ProceduresTab procedures={procedures} patients={patients} onAdd={(row: any) => addRow('internship_procedures', row)} onDel={rid => delRow('internship_procedures', rid)} />
      )}
      {tab === 'casos' && (
        <CasesTab cases={cases} />
      )}
      {tab === 'relatorios' && (
        <ReportsTab reports={reports} onGenerate={async (kind: string) => { setBusy(true); await aiAction('generate_report', { internship_id: id, kind }); setBusy(false); load() }} busy={busy} />
      )}
      {tab === 'reflexoes' && (
        <ReflectionsTab reflections={reflections} onAdd={(row: any) => addRow('internship_reflections', row)} onDel={rid => delRow('internship_reflections', rid)} />
      )}
      {tab === 'avaliacoes' && (
        <EvaluationsTab evaluations={evaluations} onAdd={(row: any) => addRow('supervisor_evaluations', row)} onDel={rid => delRow('supervisor_evaluations', rid)} />
      )}
      {tab === 'horas' && (
        <HoursTab hours={hours} required={it.hours_required} done={it.hours_done} pct={hoursPct} onAdd={(row: any) => addRow('internship_hours', row)} onDel={rid => delRow('internship_hours', rid)} />
      )}
    </main>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════

function DashboardTab({ it, objPct, objCompleted, objTotal, hoursPct, log, patients, procedures }: any) {
  const recentLog = log.slice(0, 5)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <KPI label="Objectivos" value={`${objCompleted}/${objTotal}`} pct={objPct} color={ACCENT} />
        <KPI label="Horas" value={`${it.hours_done || 0} / ${it.hours_required || 0}`} pct={hoursPct} color="#1d4ed8" />
        <KPI label="Doentes seguidos" value={patients.length.toString()} color="#7c3aed" />
        <KPI label="Procedimentos" value={procedures.length.toString()} color="#dc2626" />
      </div>

      <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Últimas notas de diário</h3>
        {recentLog.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Nenhum registo ainda. Vai à tab "Diário".</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {recentLog.map((l: LogEntry) => (
              <div key={l.id} style={{ background: '#f9fafb', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  {new Date(l.entry_date).toLocaleDateString('pt-PT')} {l.shift && `· ${l.shift}`}
                </div>
                {l.what_was_done && <div style={{ fontSize: 13, color: '#111827' }}>{l.what_was_done}</div>}
                {l.learning && <div style={{ fontSize: 12, color: '#065f46', marginTop: 4 }}>💡 {l.learning}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function KPI({ label, value, pct, color }: { label: string; value: string; pct?: number; color: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 4 }}>{value}</div>
      {pct != null && (
        <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

function PatientsTab({ patients, onAdd, onUpdate, onDel, onAiCase, onAiDdx, busy, internshipId }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Novo doente</button>
      </div>
      {patients.length === 0 ? (
        <Empty msg="Sem doentes ainda. Adiciona o primeiro doente que estás a seguir." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {patients.map((p: Patient) => (
            <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{p.initials || '—'}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, background: p.status === 'active' ? '#dcfce7' : '#f3f4f6', color: p.status === 'active' ? '#065f46' : '#6b7280', fontSize: 10, fontWeight: 700 }}>{p.status}</span>
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>{p.age ? `${p.age}a` : ''} {p.sex || ''}</div>
              {p.diagnosis && <div style={{ fontSize: 13, color: '#111827', fontWeight: 600, marginTop: 6 }}>{p.diagnosis}</div>}
              {p.chief_complaint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{p.chief_complaint}</div>}
              <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                <Link href={`/estagio/${internshipId}/doente/${p.id}`} style={{ ...btn('ghost'), fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}>Abrir</Link>
                <button onClick={() => onAiDdx(p.id)} disabled={busy} style={{ ...btn('ghost'), fontSize: 11, padding: '4px 8px' }}>🧠 DDx IA</button>
                <button onClick={() => onAiCase(p.id)} disabled={busy} style={{ ...btn('ghost'), fontSize: 11, padding: '4px 8px' }}>📋 Caso IA</button>
                <button onClick={() => { if (confirm('Eliminar?')) onDel(p.id) }} style={{ ...btn('ghost'), fontSize: 11, padding: '4px 8px', color: '#dc2626' }}>Apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <PatientFormModal onClose={() => setShowAdd(false)} onSave={r => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function PatientFormModal({ patient, onClose, onSave }: { patient?: Patient; onClose: () => void; onSave: (r: any) => void }) {
  const [initials, setInitials] = useState(patient?.initials || '')
  const [age, setAge] = useState<number | ''>(patient?.age ?? '')
  const [sex, setSex] = useState(patient?.sex || '')
  const [diagnosis, setDiagnosis] = useState(patient?.diagnosis || '')
  const [chief, setChief] = useState(patient?.chief_complaint || '')
  const [background, setBackground] = useState('')
  return (
    <Modal title="Novo doente seguido (anónimo)" onClose={onClose}>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>⚠ Apenas iniciais, idade, sexo. <b>Sem nome, sem SNS, sem PII.</b></p>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Iniciais"><input value={initials} onChange={e => setInitials(e.target.value.slice(0, 5))} placeholder="M.S." style={input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Idade"><input type="number" value={age} onChange={e => setAge(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
          <Field label="Sexo">
            <select value={sex} onChange={e => setSex(e.target.value)} style={input}>
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
        </div>
        <Field label="Queixa principal"><input value={chief} onChange={e => setChief(e.target.value)} style={input} placeholder="ex: dor torácica" /></Field>
        <Field label="Diagnóstico principal"><input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={input} placeholder="ex: STEMI inferior" /></Field>
        <Field label="História breve"><textarea rows={3} value={background} onChange={e => setBackground(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="HTA, DM2, dislipidemia. Tabagismo activo." /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ initials, age: age === '' ? null : age, sex: sex || null, diagnosis, chief_complaint: chief, background })} disabled={!initials} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

function LogTab({ log, onAdd, onUpdate, onDel, busy, internshipId }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Nota de turno</button>
      </div>
      {log.length === 0 ? <Empty msg="Sem notas. Regista o que aconteceu hoje." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {log.map((l: LogEntry) => (
            <div key={l.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{new Date(l.entry_date).toLocaleDateString('pt-PT')} {l.shift && `· ${l.shift}`} {l.hours && `· ${l.hours}h`}</span>
                <button onClick={() => { if (confirm('Apagar?')) onDel(l.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>Apagar</button>
              </div>
              {l.what_was_done && <p style={{ margin: '4px 0', fontSize: 13 }}><b>Actividades:</b> {l.what_was_done}</p>}
              {l.highlights && <p style={{ margin: '4px 0', fontSize: 13 }}><b>Destaques:</b> {l.highlights}</p>}
              {l.learning && <p style={{ margin: '4px 0', fontSize: 13, color: '#065f46' }}><b>💡 Aprendi:</b> {l.learning}</p>}
              {l.difficulties && <p style={{ margin: '4px 0', fontSize: 13, color: '#991b1b' }}><b>⚠ Dificuldades:</b> {l.difficulties}</p>}
            </div>
          ))}
        </div>
      )}
      {showAdd && <LogFormModal onClose={() => setShowAdd(false)} onSave={r => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function LogFormModal({ onClose, onSave }: { onClose: () => void; onSave: (r: any) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [shift, setShift] = useState('manha')
  const [hours, setHours] = useState<number | ''>(8)
  const [done, setDone] = useState('')
  const [learning, setLearning] = useState('')
  const [highlights, setHighlights] = useState('')
  const [difficulties, setDifficulties] = useState('')
  return (
    <Modal title="Nova nota de turno" onClose={onClose} wide>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
          <Field label="Turno">
            <select value={shift} onChange={e => setShift(e.target.value)} style={input}>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </select>
          </Field>
          <Field label="Horas"><input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value === '' ? '' : parseFloat(e.target.value))} style={input} /></Field>
        </div>
        <Field label="O que fizeste?"><textarea rows={3} value={done} onChange={e => setDone(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Acompanhei doentes na enfermaria, fiz colheitas..." /></Field>
        <Field label="Destaques / casos relevantes"><textarea rows={2} value={highlights} onChange={e => setHighlights(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <Field label="O que aprendeste?"><textarea rows={2} value={learning} onChange={e => setLearning(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <Field label="Dificuldades / dúvidas"><textarea rows={2} value={difficulties} onChange={e => setDifficulties(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ entry_date: date, shift, hours, what_was_done: done, learning, highlights, difficulties })} style={btn('primary')}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

function ObjectivesTab({ objectives, onUpdate, onAdd, onDel }: any) {
  const byCategory: Record<string, Objective[]> = {}
  for (const o of objectives) {
    const c = o.category || 'Outros'
    ;(byCategory[c] ||= []).push(o)
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {Object.keys(byCategory).length === 0 && <Empty msg="Sem objectivos. Aplica sprint71 SQL para ter as templates por área." />}
      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#374151' }}>{cat}</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {items.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: o.status === 'completed' || o.status === 'validated' ? '#f0fdf5' : '#f9fafb', borderRadius: 6 }}>
                <select value={o.status} onChange={e => onUpdate(o.id, { status: e.target.value, completed_at: ['completed','validated'].includes(e.target.value) ? new Date().toISOString() : null })} style={{ ...input, padding: '3px 6px', fontSize: 11, width: 'auto' }}>
                  <option value="pending">Por fazer</option>
                  <option value="in_progress">A fazer</option>
                  <option value="completed">Concluído</option>
                  <option value="validated">Validado</option>
                </select>
                <span style={{ flex: 1, fontSize: 13, color: '#111827', textDecoration: o.status === 'completed' || o.status === 'validated' ? 'line-through' : 'none' }}>{o.title}</span>
                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', fontSize: 10, fontWeight: 700, color: '#374151' }}>{o.level}</span>
                {o.required && <span style={{ fontSize: 10, color: '#dc2626' }}>obrigatório</span>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ProceduresTab({ procedures, patients, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  // Conta por nível
  const byLevel = procedures.reduce<Record<string, number>>((acc: any, p: Procedure) => { acc[p.level] = (acc[p.level] || 0) + 1; return acc }, {})
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['observed','assisted','performed_supervised','performed_alone'].map(l => (
            <span key={l} style={{ padding: '3px 10px', background: '#f3f4f6', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#374151' }}>
              {l.replace('_', ' ')}: <b>{byLevel[l] || 0}</b>
            </span>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Procedimento</button>
      </div>
      {procedures.length === 0 ? <Empty msg="Sem procedimentos. Adiciona o primeiro." /> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {procedures.map((p: Procedure) => (
            <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{p.procedure_name}</span>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 700 }}>{p.level}</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(p.performed_at).toLocaleDateString('pt-PT')}</span>
            </div>
          ))}
        </div>
      )}
      {showAdd && <ProcFormModal patients={patients} onClose={() => setShowAdd(false)} onSave={r => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function ProcFormModal({ patients, onClose, onSave }: any) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('observed')
  const [category, setCategory] = useState('')
  const [patientId, setPatientId] = useState('')
  const [outcome, setOutcome] = useState('')
  return (
    <Modal title="Registar procedimento" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Procedimento"><input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Cateterismo venoso periférico" style={input} /></Field>
        <Field label="Nível de participação">
          <select value={level} onChange={e => setLevel(e.target.value)} style={input}>
            <option value="observed">Observei</option>
            <option value="assisted">Ajudei</option>
            <option value="performed_supervised">Fiz com supervisão</option>
            <option value="performed_alone">Fiz sozinho</option>
          </select>
        </Field>
        <Field label="Categoria"><input value={category} onChange={e => setCategory(e.target.value)} placeholder="vascular, respiratorio, GI..." style={input} /></Field>
        <Field label="Doente associado (opcional)">
          <select value={patientId} onChange={e => setPatientId(e.target.value)} style={input}>
            <option value="">— Nenhum —</option>
            {patients.map((p: Patient) => <option key={p.id} value={p.id}>{p.initials} — {p.diagnosis || ''}</option>)}
          </select>
        </Field>
        <Field label="Outcome / observações"><textarea rows={2} value={outcome} onChange={e => setOutcome(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ procedure_name: name, level, procedure_category: category || null, patient_id: patientId || null, outcome: outcome || null, performed_at: new Date().toISOString() })} disabled={!name} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

function CasesTab({ cases }: any) {
  if (cases.length === 0) return <Empty msg="Sem casos. Na tab Doentes, clica em '📋 Caso IA' para gerar." />
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {cases.map((c: Case) => (
        <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</span>
            {c.ai_assisted && <span style={{ padding: '2px 8px', background: '#ede9fe', color: '#6d28d9', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>IA</span>}
          </div>
          {c.final_diagnosis && <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{c.final_diagnosis}</div>}
        </div>
      ))}
    </div>
  )
}

function ReportsTab({ reports, onGenerate, busy }: any) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => onGenerate('final')} disabled={busy} style={btn('primary')}>{busy ? 'A gerar…' : '📄 Gerar relatório final IA'}</button>
        <button onClick={() => onGenerate('weekly')} disabled={busy} style={btn('ghost')}>📋 Relatório semanal</button>
        <button onClick={() => onGenerate('intermediate')} disabled={busy} style={btn('ghost')}>📋 Relatório intermédio</button>
      </div>
      {reports.length === 0 ? <Empty msg="Sem relatórios. Clica num botão para gerar." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map((r: Report) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(r.created_at).toLocaleString('pt-PT')}</div>
                </div>
                {r.ai_assisted && <span style={{ padding: '2px 8px', background: '#ede9fe', color: '#6d28d9', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>IA</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReflectionsTab({ reflections, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Reflexão</button>
      </div>
      {reflections.length === 0 ? <Empty msg="Sem reflexões. Usa o modelo Gibbs para reflectir sobre experiências." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reflections.map((r: any) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{r.framework}</div>
              <div style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('pt-PT')}</div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <ReflectionFormModal onClose={() => setShowAdd(false)} onSave={r => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function ReflectionFormModal({ onClose, onSave }: any) {
  const [framework, setFramework] = useState('gibbs')
  const [description, setDescription] = useState('')
  const [feelings, setFeelings] = useState('')
  const [evaluation, setEvaluation] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [freeText, setFreeText] = useState('')
  return (
    <Modal title="Nova reflexão" onClose={onClose} wide>
      <Field label="Modelo">
        <select value={framework} onChange={e => setFramework(e.target.value)} style={input}>
          <option value="gibbs">Gibbs (estruturado)</option>
          <option value="driscoll">Driscoll (3 Qs)</option>
          <option value="free">Texto livre</option>
        </select>
      </Field>
      {framework === 'gibbs' && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <Field label="1. Descrição"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que aconteceu?" /></Field>
          <Field label="2. Sentimentos"><textarea rows={2} value={feelings} onChange={e => setFeelings(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que sentiste?" /></Field>
          <Field label="3. Avaliação"><textarea rows={2} value={evaluation} onChange={e => setEvaluation(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que foi bom/mau?" /></Field>
          <Field label="4. Análise"><textarea rows={2} value={analysis} onChange={e => setAnalysis(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Porquê? Que sentido fazes disto?" /></Field>
          <Field label="5. Conclusão"><textarea rows={2} value={conclusion} onChange={e => setConclusion(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que mais podias ter feito?" /></Field>
          <Field label="6. Plano de acção"><textarea rows={2} value={actionPlan} onChange={e => setActionPlan(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Se acontecer outra vez, o que vais fazer?" /></Field>
        </div>
      )}
      {framework === 'free' && (
        <Field label="Reflexão"><textarea rows={8} value={freeText} onChange={e => setFreeText(e.target.value)} style={{ ...input, resize: 'vertical', marginTop: 8 }} /></Field>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
        <button onClick={() => onSave({ framework, description, feelings, evaluation, analysis, conclusion, action_plan: actionPlan, free_text: freeText })} style={btn('primary')}>Guardar</button>
      </div>
    </Modal>
  )
}

function EvaluationsTab({ evaluations, onAdd, onDel }: any) {
  if (evaluations.length === 0) return <Empty msg="Sem avaliações. Pede ao supervisor que avalie via link partilhável (em breve)." />
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {evaluations.map((e: any) => (
        <div key={e.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{e.evaluator_name || 'Sem nome'} · {e.kind}</span>
            {e.overall_score && <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#065f46', fontWeight: 700 }}>{e.overall_score}/5</span>}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{e.evaluation_date}</div>
        </div>
      ))}
    </div>
  )
}

function HoursTab({ hours, required, done, pct, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Progresso</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{done} / {required} ({pct}%)</span>
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: ACCENT }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Registar horas</button>
      </div>
      {hours.length === 0 ? <Empty msg="Sem registos de horas." /> : (
        <div style={{ display: 'grid', gap: 4 }}>
          {hours.map((h: any) => (
            <div key={h.id} style={{ background: 'white', border: '1px solid #f3f4f6', padding: 8, borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{new Date(h.hours_date).toLocaleDateString('pt-PT')} {h.activity && `· ${h.activity}`}</span>
              <b>{h.hours}h</b>
            </div>
          ))}
        </div>
      )}
      {showAdd && <HoursFormModal onClose={() => setShowAdd(false)} onSave={r => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function HoursFormModal({ onClose, onSave }: any) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState<number>(8)
  const [activity, setActivity] = useState('')
  return (
    <Modal title="Registar horas" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
        <Field label="Horas"><input type="number" step="0.5" value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)} style={input} /></Field>
        <Field label="Actividade (opcional)"><input value={activity} onChange={e => setActivity(e.target.value)} placeholder="enfermaria, OR, urgência..." style={input} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ hours_date: date, hours, activity })} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════════

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, maxWidth: wide ? 640 : 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>{children}</label>
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>{msg}</div>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 13 }
  return { padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
