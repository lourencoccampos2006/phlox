'use client'

// /calendario — Calendário pessoal do Phlox. Vista de mês + lista próximos eventos.
// CRUD simples; exporta para Apple/Google Calendar via .ics.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { downloadICS } from '@/lib/ics'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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
  outcome?: string | null
  outcome_at?: string | null
  /** Eventos DERIVADOS (toma de medicação, medicação a acabar) — só leitura,
   *  não vivem na BD, vêm da medicação registada. Não editáveis/elimináveis. */
  derived?: 'med_dose' | 'med_runout'
}

interface MedRow {
  id: string; name: string; dose?: string | null
  reminder_times?: string[] | null
  pills_remaining?: number | null; pills_per_day?: number | null; stock_updated_at?: string | null; created_at?: string
}

const KIND_META: Record<CalEvent['kind'], { label: string; color: string; icon: string }> = {
  consulta:  { label: 'Consulta',  color: 'var(--ink-2)', icon: 'stethoscope' },
  exame:     { label: 'Exame',     color: 'var(--green)', icon: 'flask' },
  medicacao: { label: 'Medicação', color: 'var(--green)', icon: 'pill' },
  lembrete:  { label: 'Lembrete',  color: 'var(--amber)', icon: 'megaphone' },
  event:     { label: 'Evento',    color: 'var(--ink-3)', icon: 'pin' },
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}

export default function CalendarioPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [meds, setMeds] = useState<MedRow[]>([])
  const [showMeds, setShowMeds] = useState(true)   // sobreposição de medicação ligada por defeito
  const [followupDraft, setFollowupDraft] = useState<Record<string, string>>({})
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

    // Medicação do utilizador → alimenta a sobreposição de tomas + "a acabar".
    // Tolerante a colunas que ainda não existam (esquemas antigos).
    try {
      let m = await supabase.from('personal_meds')
        .select('id,name,dose,reminder_times,pills_remaining,pills_per_day,stock_updated_at,created_at')
        .eq('user_id', user.id)
      if (m.error) m = await supabase.from('personal_meds').select('id,name,dose,reminder_times').eq('user_id', user.id)
      setMeds(m.data || [])
    } catch { setMeds([]) }

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

  // Calendário inteligente: guarda o desfecho ("como correu") de um evento passado.
  async function saveOutcome(id: string, outcome: string) {
    const txt = outcome.trim()
    if (!txt) return
    await supabase.from('cal_events').update({ outcome: txt, outcome_at: new Date().toISOString() }).eq('id', id)
    setEvents(p => p.map(e => e.id === id ? { ...e, outcome: txt, outcome_at: new Date().toISOString() } : e))
    setFollowupDraft(d => { const n = { ...d }; delete n[id]; return n })
    toast.success('Registado', 'Obrigado por dizer como correu.')
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
      const { error } = await supabase.from('cal_events').update(payload).eq('id', (edit as any).id)
      if (error) { toast.error('Não guardado', reportError('calendario-save-update', error, MSG.save)); return }
      toast.success('Evento atualizado')
    } else {
      const { error } = await supabase.from('cal_events').insert(payload)
      if (error) { toast.error('Não guardado', reportError('calendario-save-insert', error, MSG.save)); return }
      toast.success('Evento criado')
    }
    setShowForm(false); setEdit(null); load()
  }

  async function del(id: string) {
    if (!confirm('Eliminar evento?')) return
    const { error } = await supabase.from('cal_events').delete().eq('id', id)
    if (error) { toast.error('Não eliminado', reportError('calendario-delete', error, MSG.save)); return }
    setEvents(p => p.filter(e => e.id !== id))
    toast.info('Eliminado')
  }

  function exportMonthICS() {
    // Exporta os eventos reais + os lembretes de "medicação a acabar" (úteis no
    // calendário externo). As tomas diárias ficam de fora — seriam centenas de
    // entradas; quem quer lembretes de toma usa as notificações do /mymeds.
    const monthEvents = allEvents.filter(e => {
      if (e.derived === 'med_dose') return false
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

  // ── eventos DERIVADOS da medicação (só leitura) ──
  // Tomas: para cada med com reminder_times, cria um evento por horário em cada
  // dia do intervalo visível. "A acabar": calcula a data de fim do stock.
  const derivedEvents = useMemo<CalEvent[]>(() => {
    if (!showMeds || meds.length === 0) return []
    const out: CalEvent[] = []
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    for (const med of meds) {
      // 1) Tomas diárias (a partir dos horários definidos no /mymeds)
      const times = (med.reminder_times || []).filter(Boolean)
      if (times.length) {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          for (const t of times) {
            const [h, mi] = t.split(':').map(Number)
            if (isNaN(h)) continue
            const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi || 0)
            out.push({
              id: `dose-${med.id}-${when.toISOString()}`, derived: 'med_dose',
              title: `${med.name}${med.dose ? ` ${med.dose}` : ''}`,
              starts_at: when.toISOString(), all_day: false, kind: 'medicacao',
            })
          }
        }
      }
      // 2) Medicação a acabar (do stock countdown, sprint87)
      if (med.pills_remaining != null && med.pills_per_day && med.pills_per_day > 0) {
        const setAt = med.stock_updated_at || med.created_at
        const base = setAt ? new Date(setAt) : new Date()
        const daysLeft = Math.floor((med.pills_remaining || 0) / med.pills_per_day)
        const runout = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysLeft, 9, 0)
        if (runout >= start && runout <= end) {
          out.push({
            id: `runout-${med.id}`, derived: 'med_runout',
            title: `${med.name} acaba`, description: 'Repor o stock — a tua medicação está a terminar.',
            starts_at: runout.toISOString(), all_day: true, kind: 'lembrete',
          })
        }
      }
    }
    return out
  }, [meds, month, showMeds])

  const allEvents = useMemo(() => [...events, ...derivedEvents], [events, derivedEvents])

  // ── Follow-up "como correu?" — eventos passados (consulta/exame/event) sem
  // desfecho registado. O calendário pergunta e tu respondes num campo. Fecha o
  // ciclo: marcar → acontecer → registar como correu.
  const needsFollowup = useMemo(() => {
    const now = Date.now()
    return events
      .filter(e => !e.outcome && new Date(e.starts_at).getTime() < now && ['consulta', 'exame', 'event'].includes(e.kind))
      .filter(e => now - new Date(e.starts_at).getTime() < 14 * 86400000) // só dos últimos 14 dias
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, 5)
  }, [events])

  // ── grelha do mês ──
  const monthLabel = month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  const firstWeekday = (month.getDay() + 6) % 7 // segunda=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: { date?: Date; events: CalEvent[] }[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ events: [] })
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(month.getFullYear(), month.getMonth(), d)
    const dayEvents = allEvents.filter(e => {
      const ed = new Date(e.starts_at)
      return ed.getFullYear() === day.getFullYear() && ed.getMonth() === day.getMonth() && ed.getDate() === day.getDate()
    }).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    cells.push({ date: day, events: dayEvents })
  }
  while (cells.length % 7) cells.push({ events: [] })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const now = new Date()
  // "Próximos eventos" mostra os reais + medicação a acabar (não a torrente de tomas
  // diárias, que poluiria a lista). As tomas vêem-se na grelha.
  const upcoming = allEvents
    .filter(e => new Date(e.starts_at) >= now && e.derived !== 'med_dose')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 8)

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Calendário</span>
        </BarraDeTrabalho>
      }
    >
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Calendário</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, letterSpacing: '-0.02em', margin: 0 }}>O meu calendário</h1>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: '5px 0 0' }}>Consultas, exames, medicações, lembretes — num só sítio. Exporta para Apple/Google Calendar.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowMeds(s => !s)} title="Mostrar/ocultar tomas e medicação a acabar"
              style={{ ...secondaryBtn, background: showMeds ? 'var(--green-light)' : 'white', borderColor: showMeds ? 'var(--green-mid)' : 'var(--border)', color: showMeds ? 'var(--green)' : 'var(--ink-4)' }}>
              💊 Medicação {showMeds ? 'on' : 'off'}
            </button>
            <button onClick={() => openNew()} style={primaryBtn}>＋ Novo</button>
            <button onClick={exportMonthICS} style={secondaryBtn}>Pôr no calendário</button>
          </div>
        </div>

        {/* Follow-up inteligente: "como correu?" para eventos passados sem desfecho */}
        {!missing && needsFollowup.length > 0 && (
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-xl)', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span>💬</span> Como correu?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {needsFollowup.map(e => (
                <div key={e.id} style={{ background: 'white', border: '1px solid var(--badge-green-bg)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 6 }}>
                    {KIND_META[e.kind]?.icon} {e.title}
                    <span style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-5)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)' }}>
                      {new Date(e.starts_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={followupDraft[e.id] || ''}
                      onChange={ev => setFollowupDraft(d => ({ ...d, [e.id]: ev.target.value }))}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveOutcome(e.id, followupDraft[e.id] || '') }}
                      placeholder="Ex: correu bem, médico ajustou a medicação…"
                      style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 11px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    <button onClick={() => saveOutcome(e.id, followupDraft[e.id] || '')} disabled={!(followupDraft[e.id] || '').trim()}
                      style={{ padding: '8px 14px', background: (followupDraft[e.id] || '').trim() ? 'var(--green-3)' : 'var(--border)', color: (followupDraft[e.id] || '').trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: (followupDraft[e.id] || '').trim() ? 'pointer' : 'default' }}>
                      Guardar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {missing ? (
          <div style={{ background: 'var(--badge-amber-bg)', border: '1.5px solid var(--badge-amber-border)', borderRadius: 'var(--r-xl)', padding: 24, color: 'var(--amber)', fontSize: 'var(--t-dado)' }}>
            Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.
          </div>
        ) : (
          <>
            {/* Navegação mês */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={navBtn}>‹</button>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', textTransform: 'capitalize' }}>{monthLabel}</div>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={navBtn}>›</button>
            </div>

            {/* Grelha */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} style={{ padding: '8px 6px', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((c, i) => {
                  const isToday = c.date && c.date.getTime() === today.getTime()
                  return (
                    <div key={i} onClick={() => c.date && openNew(c.date)}
                      style={{
                        minHeight: 90, padding: 6,
                        borderRight: (i % 7 !== 6) ? '1px solid var(--bg-3)' : 'none',
                        borderBottom: '1px solid var(--bg-3)',
                        background: c.date ? (isToday ? 'var(--badge-green-bg)' : 'white') : 'var(--bg-2)',
                        cursor: c.date ? 'pointer' : 'default', position: 'relative',
                      }}>
                      {c.date && (
                        <>
                          <div style={{ fontSize: 'var(--t-meta)', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--green)' : 'var(--ink-3)', textAlign: 'right', marginBottom: 3 }}>{c.date.getDate()}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {c.events.slice(0, 3).map(e => {
                              const m = KIND_META[e.kind]
                              const t = e.derived ? '' : new Date(e.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                              return (
                                <div key={e.id}
                                  onClick={ev => { ev.stopPropagation(); if (e.derived) { window.location.href = '/mymeds' } else { setEdit(e); setShowForm(true) } }}
                                  title={e.derived === 'med_dose' ? 'Toma de medicação · abrir Os meus medicamentos' : e.derived === 'med_runout' ? 'Medicação a acabar · abrir Os meus medicamentos' : e.title}
                                  style={{ background: m.color + (e.derived ? '0d' : '14'), color: m.color, fontSize: 'var(--t-micro)', padding: '2px 5px', borderRadius: 'var(--r)', fontWeight: 'var(--peso-forte)' as any, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: e.derived === 'med_runout' ? `1px solid ${m.color}66` : 'none', opacity: e.derived === 'med_dose' ? 0.85 : 1 }}>
                                  <Icon name={m.icon} size={15} />  {e.title}
                                </div>
                              )
                            })}
                            {c.events.length > 3 && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontWeight: 'var(--peso-forte)' as any }}>+{c.events.length - 3}</div>}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Próximos eventos */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '16px 20px' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 10 }}>Próximos eventos</div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 'var(--r-md)' }} />)}</div>
              ) : upcoming.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>Sem eventos próximos. Clica num dia para criar.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upcoming.map(e => {
                    const m = KIND_META[e.kind]
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'white', border: `1px solid ${m.color}22`, borderLeft: `4px solid ${m.color}`, borderRadius: 'var(--r-lg)' }}>
                        <Icon name={m.icon} size={20} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                            {new Date(e.starts_at).toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {e.location ? ` · ${e.location}` : ''}
                          </div>
                        </div>
                        {e.derived
                          ? <Link href="/mymeds" style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Medicação</Link>
                          : <>
                              <button onClick={() => { setEdit(e); setShowForm(true) }} style={ghostBtn}>Editar</button>
                              <button onClick={() => del(e.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', fontSize: 'var(--t-destaque)', color: 'var(--ink-5)', cursor: 'pointer' }}>×</button>
                            </>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 14, textAlign: 'center' }}>
          <Link href="/guardados" style={{ color: 'var(--ink-2)', fontWeight: 'var(--peso-corpo)' as any, textDecoration: 'none' }}>Ver guardados</Link>
        </div>
      </div>

      {/* Form modal */}
      {showForm && edit && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) { setShowForm(false); setEdit(null) } }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)' }}>{(edit as any).id ? 'Editar evento' : 'Novo evento'}</div>
              <button onClick={() => { setShowForm(false); setEdit(null) }} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-4)' }}>×</button>
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
                        style={{ padding: '6px 11px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)', border: `1.5px solid ${active ? m.color : 'var(--border)'}`, background: active ? m.color + '14' : 'white', color: active ? m.color : 'var(--ink-4)', cursor: 'pointer' }}>
                        <Icon name={m.icon} size={15} />  {m.label}
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
                  <button onClick={() => del((edit as any).id)} style={{ padding: '11px 14px', background: 'white', color: 'var(--red)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Eliminar</button>
                )}
                <button onClick={save} style={{ flex: 1, padding: '11px 14px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Mesa>
  )
}

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const secondaryBtn: React.CSSProperties = { padding: '9px 14px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const ghostBtn: React.CSSProperties = { padding: '6px 11px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const navBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 'var(--r-lg)', background: 'white', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-3)' }
