'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import FusionTabs from '@/components/FusionTabs'
import { RastreiosTool } from '../rastreios/page'

// /agenda é agora "Agenda e rastreios": marcações + plano de rastreios/vacinas.
export default function AgendaPage() {
  return <FusionTabs
    eyebrow="Agenda" title="Agenda e rastreios"
    subtitle="As marcações do dia e o plano de rastreios e vacinas, num só sítio."
    tabs={[
      { id: 'agenda', label: 'Agenda', icon: '📅', render: () => <AgendaTool /> },
      { id: 'rastreios', label: 'Rastreios', icon: '🧪', render: () => <RastreiosTool /> },
    ]} />
}
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc, type PrintRecord } from '@/lib/print'

type ApptType = 'consulta' | 'exame' | 'terapia' | 'visita_medica' | 'transporte' | 'reuniao' | 'vacina' | 'outro'
type ApptStatus = 'scheduled' | 'done' | 'cancelled'

interface Patient { id: string; name: string; room_number?: string | null }
interface Appt {
  id: string; patient_id?: string | null; title: string; type: ApptType
  date: string; time?: string | null; end_time?: string | null; location?: string | null
  speciality?: string | null; transport?: boolean; transport_notes?: string | null
  responsible?: string | null; status: ApptStatus; notes?: string | null
}

const TYPES: Record<ApptType, { label: string; color: string }> = {
  consulta:      { label: 'Consulta', color: '#2563eb' },
  exame:         { label: 'Exame', color: '#7c3aed' },
  terapia:       { label: 'Terapia', color: '#0891b2' },
  visita_medica: { label: 'Visita médica', color: '#0d6e42' },
  transporte:    { label: 'Transporte', color: '#d97706' },
  reuniao:       { label: 'Reunião', color: '#64748b' },
  vacina:        { label: 'Vacina', color: '#16a34a' },
  outro:         { label: 'Outro', color: '#374151' },
}
const STATUS: Record<ApptStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Agendado', color: '#1d4ed8', bg: '#eff6ff' },
  done:      { label: 'Realizado', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelado', color: '#dc2626', bg: '#fef2f2' },
}
const TYPE_KEYS = Object.keys(TYPES) as ApptType[]
const todayStr = () => new Date().toISOString().slice(0, 10)
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

function AgendaTool() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [view, setView] = useState<'hoje' | 'proximas' | 'todas'>('hoje')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const blank = { patient_id: '', title: '', type: 'consulta' as ApptType, date: todayStr(), time: '', location: '', speciality: '', transport: false, transport_notes: '', responsible: '', notes: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, a] = await Promise.all([
      supabase.from('patients').select('id,name,room_number').eq('user_id', user.id).order('name'),
      supabase.from('appointments').select('*').eq('user_id', user.id).order('date').order('time'),
    ])
    setPatients(p.data || [])
    if (a.error) { setTableMissing(true); setAppts([]) }
    else { setTableMissing(false); setAppts(a.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['appointments', 'patients'], userId: user?.id, onChange: load })

  const nameOf = (id?: string | null) => id ? (patients.find(p => p.id === id)?.name || 'Residente') : 'Lar'
  const roomOf = (id?: string | null) => { const r = id && patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }

  function openNew() { setForm(blank); setEditId(null); setShowForm(true) }
  function openEdit(a: Appt) { setForm({ patient_id: a.patient_id || '', title: a.title, type: a.type, date: a.date, time: a.time || '', location: a.location || '', speciality: a.speciality || '', transport: !!a.transport, transport_notes: a.transport_notes || '', responsible: a.responsible || '', notes: a.notes || '' }); setEditId(a.id); setShowForm(true) }
  async function save() {
    if (!user || !form.title.trim() || !form.date) return
    setSaving(true)
    const payload = { ...form, user_id: user.id, patient_id: form.patient_id || null, updated_at: new Date().toISOString() }
    if (editId) await supabase.from('appointments').update(payload).eq('id', editId).eq('user_id', user.id)
    else await supabase.from('appointments').insert(payload)
    setSaving(false); setShowForm(false); load()
  }
  async function setStatus(a: Appt, status: ApptStatus) {
    await supabase.from('appointments').update({ status }).eq('id', a.id).eq('user_id', user.id)
    setAppts(prev => prev.map(x => x.id === a.id ? { ...x, status } : x))
  }
  async function remove(a: Appt) {
    if (!confirm('Eliminar este agendamento?')) return
    await supabase.from('appointments').delete().eq('id', a.id).eq('user_id', user.id)
    setAppts(prev => prev.filter(x => x.id !== a.id))
  }

  const today = todayStr()
  const visible = appts.filter(a => {
    if (view === 'hoje') return a.date === today && a.status !== 'cancelled'
    if (view === 'proximas') return a.date >= today && a.status === 'scheduled'
    return true
  })
  // group by date
  const groups = new Map<string, Appt[]>()
  visible.forEach(a => { if (!groups.has(a.date)) groups.set(a.date, []); groups.get(a.date)!.push(a) })
  const dates = Array.from(groups.keys()).sort()

  const stats = {
    hoje: appts.filter(a => a.date === today && a.status === 'scheduled').length,
    transportes: appts.filter(a => a.date === today && a.transport && a.status === 'scheduled').length,
    semana: appts.filter(a => a.date >= today && a.date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) && a.status === 'scheduled').length,
  }

  function fmtDate(d: string) {
    const dt = new Date(d + 'T12:00:00')
    if (d === today) return 'Hoje'
    if (d === new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return 'Amanhã'
    return dt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Folha de transportes do dia — para o motorista/coordenação
  function printTransports() {
    const list = appts.filter(a => a.date === today && a.transport && a.status === 'scheduled')
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    if (list.length === 0) { alert('Sem transportes agendados para hoje.'); return }
    const records: PrintRecord[] = list.map(a => ({
      title: `${a.time || '--:--'} · ${nameOf(a.patient_id)}${roomOf(a.patient_id) ? ` (${roomOf(a.patient_id)})` : ''}`,
      fields: [
        { label: 'Motivo', value: `${TYPES[a.type].label}${a.speciality ? ' — ' + a.speciality : ''}` },
        { label: 'Destino', value: a.location || '—' },
        ...(a.responsible ? [{ label: 'Acompanhante', value: a.responsible }] : []),
      ],
      ...(a.transport_notes ? { body: a.transport_notes } : {}),
    }))
    printDoc({
      docTitle: 'Folha de Transportes',
      docSubtitle: new Date(today + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      institution: 'Lar / ERPI',
      meta: [{ label: 'transportes', value: String(list.length) }],
      sections: [{ heading: 'Saídas de hoje', records }],
      footerNote: 'Folha de transportes · Phlox',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Agenda</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Agenda Clínica & Transportes</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Consultas, exames, terapias, visitas e transportes — por residente, num só sítio.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={printTransports} style={{ padding: '10px 14px', background: 'white', border: `1.5px solid ${stats.transportes ? '#d97706' : 'var(--border)'}`, color: stats.transportes ? '#d97706' : 'var(--ink-4)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>🚐 Folha de transportes{stats.transportes ? ` (${stats.transportes})` : ''}</button>
            <button onClick={openNew} style={{ padding: '10px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Agendar</button>
          </div>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Base de dados por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint19_agenda.sql</strong> no Supabase para ativar a agenda.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { n: stats.hoje, l: 'Hoje', c: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe' },
                { n: stats.transportes, l: 'Transportes hoje', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
                { n: stats.semana, l: 'Próximos 7 dias', c: '#0d6e42', bg: '#f0fdf4', bd: '#bbf7d0' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 130px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['hoje', 'proximas', 'todas'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${view === v ? '#0d6e42' : 'var(--border)'}`, background: view === v ? '#eef6f1' : 'white', color: view === v ? '#0d6e42' : 'var(--ink-4)', fontSize: 12.5, fontWeight: view === v ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {v === 'hoje' ? 'Hoje' : v === 'proximas' ? 'Próximas' : 'Todas'}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}</div>
            ) : dates.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 44, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 6 }}>{view === 'hoje' ? 'Nada agendado para hoje' : 'Sem agendamentos'}</div>
                <button onClick={openNew} style={{ marginTop: 8, padding: '9px 18px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)' }}>Agendar primeiro</button>
              </div>
            ) : dates.map(d => (
              <div key={d} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{fmtDate(d)}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{groups.get(d)!.length}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groups.get(d)!.sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(a => {
                    const tc = TYPES[a.type]; const st = STATUS[a.status]
                    return (
                      <div key={a.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${tc.color}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: a.status === 'cancelled' ? 0.55 : 1 }}>
                        <div style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: tc.color, fontFamily: 'var(--font-mono)' }}>{a.time || '—'}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.title}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: tc.color, background: tc.color + '14', padding: '1px 7px', borderRadius: 5 }}>{tc.label}</span>
                            {a.transport && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: 5 }}>Transporte</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>
                            {nameOf(a.patient_id)} {roomOf(a.patient_id)}{a.location ? ` · ${a.location}` : ''}{a.responsible ? ` · ${a.responsible}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                          {a.status === 'scheduled' ? (
                            <>
                              <button onClick={() => setStatus(a, 'done')} title="Marcar realizado" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                              </button>
                              <button onClick={() => openEdit(a)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 6 }}>{st.label}</span>
                          )}
                          <button onClick={() => remove(a)} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16 }}>×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{editId ? 'Editar agendamento' : 'Novo agendamento'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span style={lbl}>Título *</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Consulta de Cardiologia" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Tipo</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>{TYPE_KEYS.map(t => <option key={t} value={t}>{TYPES[t].label}</option>)}</select></div>
                <div><span style={lbl}>Residente</span><select value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })} style={inp}><option value="">Evento do lar</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Data *</span><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Hora</span><input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Local</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Hospital, clínica..." style={inp} /></div>
                <div><span style={lbl}>Responsável</span><input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} style={inp} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>
                <input type="checkbox" checked={form.transport} onChange={e => setForm({ ...form, transport: e.target.checked })} /> Precisa de transporte
              </label>
              {form.transport && <div><span style={lbl}>Notas de transporte</span><input value={form.transport_notes} onChange={e => setForm({ ...form, transport_notes: e.target.value })} placeholder="Ambulância, cadeira de rodas, hora de saída..." style={inp} /></div>}
              <div><span style={lbl}>Notas</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <button onClick={save} disabled={saving || !form.title.trim()} style={{ padding: '11px', background: (!form.title.trim() || saving) ? 'var(--bg-3)' : '#0d6e42', color: (!form.title.trim() || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!form.title.trim() || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar agendamento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
