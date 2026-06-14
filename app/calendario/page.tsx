'use client'

// /calendario — Calendário pessoal do Phlox. Vista de mês + lista próximos eventos.
// CRUD simples; exporta para Apple/Google Calendar via .ics.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { downloadICS } from '@/lib/ics'

interface CalEvent {
  id: string
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  all_day: boolean
  kind: 'consulta' | 'exame' | 'medicacao' | 'lembrete' | 'event'
  location?: string | null
  remind_minutes_before?: number | null
}

const KIND_META: Record<CalEvent['kind'], { label: string; color: string; icon: string }> = {
  consulta:  { label: 'Consulta',  color: '#1d4ed8', icon: '🩺' },
  exame:     { label: 'Exame',     color: '#0d6e42', icon: '🔬' },
  medicacao: { label: 'Medicação', color: '#0891b2', icon: '💊' },
  lembrete:  { label: 'Lembrete',  color: '#b45309', icon: '🔔' },
  event:     { label: 'Evento',    color: '#475569', icon: '📌' },
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}

export default function CalendarioPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState<Partial<CalEvent> | null>(null)
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString()
    const until = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString()
    const { data, error } = await supabase.from('cal_events')
      .select('*').eq('user_id', user.id)
      .gte('starts_at', since).lt('starts_at', until)
      .order('starts_at', { ascending: true })
    if (error) { if (/relation .*cal_events.* does not exist/i.test(error.message)) setMissing(true); setEvents([]) }
    else { setMissing(false); setEvents(data || []) }
    setLoading(false)
  }, [user, supabase, month])

  useEffect(() => { load() }, [load])

  function openNew(date?: Date) {
    const start = date || new Date()
    if (date) { start.setHours(9, 0, 0, 0) }
    setEdit({
      title: '', kind: 'consulta',
      starts_at: start.toISOString(),
      all_day: false, remind_minutes_before: 60,
    })
    setShowForm(true)
  }

  async function save() {
    if (!edit?.title?.trim() || !edit?.starts_at) { toast.error('Faltam dados', 'Título e data são obrigatórios.'); return }
    const payload = {
      user_id: user.id,
      title: edit.title.trim().slice(0, 200),
      description: edit.description?.trim() || null,
      starts_at: new Date(edit.starts_at).toISOString(),
      ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : null,
      all_day: !!edit.all_day,
      kind: edit.kind || 'event',
      location: edit.location?.trim() || null,
      remind_minutes_before: edit.remind_minutes_before ?? null,
    }
    if ((edit as any).id) {
      await supabase.from('cal_events').update(payload).eq('id', (edit as any).id)
      toast.success('Evento atualizado')
    } else {
      await supabase.from('cal_events').insert(payload)
      toast.success('Evento criado')
    }
    setShowForm(false); setEdit(null); load()
  }

  async function del(id: string) {
    if (!confirm('Eliminar evento?')) return
    await supabase.from('cal_events').delete().eq('id', id)
    setEvents(p => p.filter(e => e.id !== id))
    toast.info('Eliminado')
  }

  function exportMonthICS() {
    const monthEvents = events.filter(e => {
      const d = new Date(e.starts_at)
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
    })
    if (monthEvents.length === 0) { toast.info('Sem eventos neste mês'); return }
    downloadICS(monthEvents.map(e => ({
      title: e.title,
      description: e.description || undefined,
      location: e.location || undefined,
      start: e.starts_at,
      end: e.ends_at || undefined,
      durationMin: e.ends_at ? undefined : 30,
      alarmMinBefore: e.remind_minutes_before ?? undefined,
    })), `phlox-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.ics`, 'Phlox Calendário')
    toast.success('Calendário exportado')
  }

  // ── grelha do mês ──
  const monthLabel = month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  const firstWeekday = (month.getDay() + 6) % 7 // segunda=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: { date?: Date; events: CalEvent[] }[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ events: [] })
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(month.getFullYear(), month.getMonth(), d)
    const dayEvents = events.filter(e => {
      const ed = new Date(e.starts_at)
      return ed.getFullYear() === day.getFullYear() && ed.getMonth() === day.getMonth() && ed.getDate() === day.getDate()
    })
    cells.push({ date: day, events: dayEvents })
  }
  while (cells.length % 7) cells.push({ events: [] })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcoming = events.filter(e => new Date(e.starts_at) >= today).slice(0, 8)

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Calendário</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>O meu calendário</h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0' }}>Consultas, exames, medicações, lembretes — num só sítio. Exporta para Apple/Google Calendar.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => openNew()} style={primaryBtn}>＋ Novo</button>
            <button onClick={exportMonthICS} style={secondaryBtn}>↓ .ics</button>
          </div>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5 }}>
            Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.
          </div>
        ) : (
          <>
            {/* Navegação mês */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={navBtn}>‹</button>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#0b1120', textTransform: 'capitalize' }}>{monthLabel}</div>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={navBtn}>›</button>
            </div>

            {/* Grelha */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((c, i) => {
                  const isToday = c.date && c.date.getTime() === today.getTime()
                  return (
                    <div key={i} onClick={() => c.date && openNew(c.date)}
                      style={{
                        minHeight: 90, padding: 6,
                        borderRight: (i % 7 !== 6) ? '1px solid #f1f5f9' : 'none',
                        borderBottom: '1px solid #f1f5f9',
                        background: c.date ? (isToday ? '#f0fdf4' : 'white') : '#fafbfc',
                        cursor: c.date ? 'pointer' : 'default', position: 'relative',
                      }}>
                      {c.date && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? '#15803d' : '#475569', textAlign: 'right', marginBottom: 3 }}>{c.date.getDate()}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {c.events.slice(0, 3).map(e => {
                              const m = KIND_META[e.kind]
                              return (
                                <div key={e.id} onClick={ev => { ev.stopPropagation(); setEdit(e); setShowForm(true) }}
                                  style={{ background: m.color + '14', color: m.color, fontSize: 10.5, padding: '2px 5px', borderRadius: 4, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.icon} {e.title}
                                </div>
                              )
                            })}
                            {c.events.length > 3 && <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>+{c.events.length - 3}</div>}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Próximos eventos */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120', marginBottom: 10 }}>Próximos eventos</div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 8 }} />)}</div>
              ) : upcoming.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sem eventos próximos. Clica num dia para criar.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upcoming.map(e => {
                    const m = KIND_META[e.kind]
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'white', border: `1px solid ${m.color}22`, borderLeft: `4px solid ${m.color}`, borderRadius: 9 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                            {new Date(e.starts_at).toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {e.location ? ` · ${e.location}` : ''}
                          </div>
                        </div>
                        <button onClick={() => { setEdit(e); setShowForm(true) }} style={ghostBtn}>Editar</button>
                        <button onClick={() => del(e.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', fontSize: 16, color: '#94a3b8', cursor: 'pointer' }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center' }}>
          <Link href="/guardados" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>Ver guardados</Link>
        </div>
      </div>

      {/* Form modal */}
      {showForm && edit && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) { setShowForm(false); setEdit(null) } }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#0b1120' }}>{(edit as any).id ? 'Editar evento' : 'Novo evento'}</div>
              <button onClick={() => { setShowForm(false); setEdit(null) }} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
            </div>
            <div style={{ padding: '14px 20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label style={lbl}>Título</label>
                <input value={edit.title || ''} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="Ex: Consulta de cardiologia" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(Object.keys(KIND_META) as CalEvent['kind'][]).map(k => {
                    const m = KIND_META[k]
                    const active = edit.kind === k
                    return (
                      <button key={k} type="button" onClick={() => setEdit({ ...edit, kind: k })}
                        style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', border: `1.5px solid ${active ? m.color : '#e5e7eb'}`, background: active ? m.color + '14' : 'white', color: active ? m.color : '#64748b', cursor: 'pointer' }}>
                        {m.icon} {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Início</label>
                  <input type="datetime-local" value={edit.starts_at ? toLocalInput(new Date(edit.starts_at)) : ''} onChange={e => setEdit({ ...edit, starts_at: e.target.value })} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Fim (opcional)</label>
                  <input type="datetime-local" value={edit.ends_at ? toLocalInput(new Date(edit.ends_at)) : ''} onChange={e => setEdit({ ...edit, ends_at: e.target.value })} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Local</label>
                <input value={edit.location || ''} onChange={e => setEdit({ ...edit, location: e.target.value })} placeholder="Ex: Hospital Garcia de Orta" style={inp} />
              </div>
              <div>
                <label style={lbl}>Notas</label>
                <textarea rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder="Notas, contactos, lista de perguntas…" style={{ ...inp, resize: 'vertical', minHeight: 70 }} />
              </div>
              <div>
                <label style={lbl}>Lembrar-me</label>
                <select value={edit.remind_minutes_before ?? ''} onChange={e => setEdit({ ...edit, remind_minutes_before: e.target.value ? Number(e.target.value) : null })} style={inp as any}>
                  <option value="">Sem lembrete</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 dia antes</option>
                  <option value={2880}>2 dias antes</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {(edit as any).id && (
                  <button onClick={() => del((edit as any).id)} style={{ padding: '11px 14px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Eliminar</button>
                )}
                <button onClick={save} style={{ flex: 1, padding: '11px 14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const secondaryBtn: React.CSSProperties = { padding: '9px 14px', background: 'white', color: '#0b1120', border: '1px solid #e5e7eb', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const ghostBtn: React.CSSProperties = { padding: '6px 11px', background: 'white', color: '#64748b', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const navBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 18, color: '#475569' }
