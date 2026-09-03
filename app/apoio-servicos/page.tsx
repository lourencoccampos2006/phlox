'use client'

// /apoio-servicos — RECONSTRUÍDO 2026-08-07 (auditoria: a versão anterior era
// só um quadro de pedidos avulsos, "inútil" nas palavras do Fernando — não
// ajudava a organizar TRANSPORTES que se repetem toda a semana).
//
// Agora tem duas partes:
//  1) Transportes recorrentes (principal) — por utente, um horário fixo que se
//     repete ("fisioterapia toda terça e quinta"), com checkbox de feito hoje.
//     Mesmo padrão de weekdays de app/care-log/CuidadosTool.tsx. Isto é
//     DIFERENTE do transporte já coberto em /agenda: lá é por MARCAÇÃO datada
//     (uma vez); aqui é um plano que se repete sozinho, sem reintroduzir cada
//     semana.
//  2) Roupa & outros (secundário) — o quadro pedido→em curso→concluído que já
//     existia (support_services), mantido tal como estava, só sem "transporte"
//     como opção (isso agora vive na parte 1).
//
// Tabelas novas: support_transport_schedules + support_transport_logs
// (supabase/sprint126_support_transport_schedules.sql — por aplicar).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string; room_number?: string | null }
interface Schedule { id: string; patient_id: string; label: string; weekdays: number[] | null; time: string | null; notes: string | null }
interface ScheduleLog { id: string; schedule_id: string; date: string; done: boolean }
interface Service {
  id: string; patient_id: string | null; kind: 'roupa' | 'outro'
  date: string; status: 'pedido' | 'em_curso' | 'concluido'; notes: string | null
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STATUS_META: Record<Service['status'], { label: string; color: string; bg: string }> = {
  pedido:    { label: 'Pedido',    color: '#b45309', bg: '#fffbeb' },
  em_curso:  { label: 'Em curso',  color: '#1d4ed8', bg: '#eff6ff' },
  concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
}

export default function ApoioServicosPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)

  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()

  const [patients, setPatients] = useState<Patient[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [logs, setLogs] = useState<ScheduleLog[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newDays, setNewDays] = useState<number[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Roupa & outros — secundário, tal como estava.
  const [services, setServices] = useState<Service[]>([])
  const [showNewSvc, setShowNewSvc] = useState(false)
  const [newSvcKind, setNewSvcKind] = useState<Service['kind']>('roupa')
  const [newSvcPatient, setNewSvcPatient] = useState('')
  const [newSvcNotes, setNewSvcNotes] = useState('')
  const [svcSaving, setSvcSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [pats, sch, lgs, svcs] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('support_transport_schedules').select('*')).eq('active', true),
      scope.filter(supabase.from('support_transport_logs').select('id,schedule_id,date,done')).eq('date', today),
      scope.filter(supabase.from('support_services').select('*')).in('kind', ['roupa', 'outro']).neq('status', 'concluido').order('created_at', { ascending: false }),
    ])
    // As duas tabelas do par, não só a primeira: uma migração aplicada pela
    // metade deixava a outra a falhar em silêncio a cada visita (foi o caso
    // do par support_recurring_* aqui em baixo).
    const emFalta = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')
    if (emFalta(sch.error) || emFalta(lgs.error)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setSchedules(sch.data || [])
    setLogs(lgs.data || [])
    setServices(svcs.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function todaysFor(patientId: string) {
    return schedules.filter(s => s.patient_id === patientId && (!s.weekdays || s.weekdays.includes(todayWeekday)))
  }
  function logFor(scheduleId: string) { return logs.find(l => l.schedule_id === scheduleId) }
  function nameOf(patientId: string | null) { return patients.find(p => p.id === patientId)?.name || null }

  async function toggle(s: Schedule) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(s.id)
    const nextDone = !existing?.done
    const { data, error } = await supabase.from('support_transport_logs').upsert(scope.stamp({
      user_id: user.id, schedule_id: s.id, patient_id: s.patient_id, date: today,
      done: nextDone, done_by_id: nextDone ? user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }), { onConflict: 'schedule_id,date' }).select().single()
    if (error) { toast.error('Não foi possível atualizar', reportError('support-transport-toggle', error, MSG.save)); return }
    setLogs(p => { const rest = p.filter(l => l.schedule_id !== s.id); return data ? [...rest, data] : rest })
  }

  function openNew(patientId: string) { setNewFor(patientId); setNewLabel(''); setNewTime(''); setNewDays(null); setErr('') }

  async function createSchedule() {
    if (!newFor || !newLabel.trim()) return
    setSaving(true); setErr('')
    const { error } = await supabase.from('support_transport_schedules').insert(scope.stamp({
      user_id: user.id, patient_id: newFor, label: newLabel.trim().slice(0, 120),
      weekdays: newDays, time: newTime || null, active: true,
    }))
    if (error) { setErr(reportError('support-transport-create', error, MSG.save)); setSaving(false); return }
    setSaving(false); setNewFor(null); setNewLabel(''); setNewTime('')
    load()
  }

  async function removeSchedule(id: string) {
    if (!confirm('Deixar de repetir este transporte?')) return
    const { error } = await supabase.from('support_transport_schedules').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('support-transport-remove', error, MSG.save)); return }
    load()
  }

  function toggleDay(d: number) {
    setNewDays(prev => { const base = prev || []; return base.includes(d) ? base.filter(x => x !== d) : [...base, d].sort() })
  }

  async function createService() {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSvcSaving(true)
    const { error } = await supabase.from('support_services').insert(scope.stamp({
      user_id: user.id, patient_id: newSvcPatient || null, kind: newSvcKind, status: 'pedido',
      notes: newSvcNotes.trim() ? newSvcNotes.trim().slice(0, 500) : null, requested_by_id: user.id,
    }))
    if (error) { toast.error('Não foi possível publicar', reportError('support-services-create', error, MSG.save)); setSvcSaving(false); return }
    setSvcSaving(false); setShowNewSvc(false); setNewSvcPatient(''); setNewSvcNotes(''); setNewSvcKind('roupa')
    load()
  }
  async function advanceService(s: Service) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const next: Service['status'] = s.status === 'pedido' ? 'em_curso' : 'concluido'
    const patch: any = { status: next }
    if (next === 'concluido') { patch.completed_by_id = user.id; patch.completed_at = new Date().toISOString() }
    const { error } = await supabase.from('support_services').update(patch).eq('id', s.id)
    if (error) { toast.error('Não atualizado', reportError('support-services-advance', error, MSG.save)); return }
    load()
  }
  async function removeService(id: string) {
    const { error } = await supabase.from('support_services').delete().eq('id', id)
    if (error) { toast.error('Não eliminado', reportError('support-services-delete', error, MSG.save)); return }
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const svcColumns: Service['status'][] = ['pedido', 'em_curso']

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Para ativar os transportes recorrentes, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint126_support_transport_schedules.sql</code> no Supabase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Serviços de apoio</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>Transportes, roupa e serviços complementares que se repetem toda a semana, e outros pedidos.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* ── Transportes recorrentes ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transportes recorrentes</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
              style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>{cfg.emptyPeopleMsg}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(p => {
                const todays = todaysFor(p.id)
                const isNew = newFor === p.id
                return (
                  <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                        {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                      </div>
                      <button onClick={() => isNew ? setNewFor(null) : openNew(p.id)} style={{ padding: '6px 12px', background: isNew ? 'var(--bg-3)' : 'var(--ink)', color: isNew ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {isNew ? 'Fechar' : '+ Transporte'}
                      </button>
                    </div>

                    {todays.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                        {todays.map(s => {
                          const done = !!logFor(s.id)?.done
                          return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                              <input type="checkbox" checked={done} onChange={() => toggle(s)} style={{ width: 17, height: 17 }} />
                              <Icon name="route" size={14} color={done ? '#16a34a' : 'var(--ink-4)'} />
                              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
                                {s.label}{s.time ? ` · ${s.time}` : ''}
                              </span>
                              {!s.weekdays && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>diário</span>}
                              <button onClick={() => removeSchedule(s.id)} aria-label="Remover transporte recorrente" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isNew && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: Fisioterapia, Recolha ao domicílio, Consulta regular"
                          style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                        <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} placeholder="Hora (opcional)"
                          style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', width: 130 }} />
                        <div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Quando</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button onClick={() => setNewDays(null)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays === null ? 'var(--ink)' : 'var(--border)'}`, background: newDays === null ? 'var(--ink)' : 'white', color: newDays === null ? 'white' : 'var(--ink-4)' }}>Todos os dias</button>
                            {WEEKDAY_LABELS.map((label, d) => (
                              <button key={d} onClick={() => toggleDay(d)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays?.includes(d) ? 'var(--ink)' : 'var(--border)'}`, background: newDays?.includes(d) ? 'var(--ink)' : 'white', color: newDays?.includes(d) ? 'white' : 'var(--ink-4)' }}>{label}</button>
                            ))}
                          </div>
                        </div>
                        {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
                        <button onClick={createSchedule} disabled={saving || !newLabel.trim()} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving || !newLabel.trim() ? 'var(--bg-3)' : 'var(--ink)', color: saving || !newLabel.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving || !newLabel.trim() ? 'not-allowed' : 'pointer' }}>
                          {saving ? 'A criar…' : 'Criar transporte recorrente'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Roupa recorrente + Serviços de fim de semana/noite (2026-08-11) ── */}
        <RecurringServiceBoard title="Roupa recorrente" kinds={[{ id: 'roupa', label: 'Roupa' }]} icon="shirt" patients={patients} search={search} />
        <RecurringServiceBoard title="Serviços de fim de semana / noite" kinds={[
          { id: 'higiene_fds', label: 'Higiene · fim de semana' },
          { id: 'alimentacao_fds', label: 'Alimentação · fim de semana' },
          { id: 'reforco_noite', label: 'Reforço alimentar · noite (2ª-6ª)' },
        ]} icon="clock" patients={patients} search={search} />

        {/* ── Roupa & outros (secundário) ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Roupa & outros</div>
            <button onClick={() => setShowNewSvc(v => !v)} style={{ padding: '7px 13px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-3)' }}>
              {showNewSvc ? 'Cancelar' : '+ Novo pedido'}
            </button>
          </div>

          {showNewSvc && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setNewSvcKind('roupa')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newSvcKind === 'roupa' ? 'var(--ink)' : 'var(--border)'}`, background: newSvcKind === 'roupa' ? 'var(--ink)' : 'white', color: newSvcKind === 'roupa' ? 'white' : 'var(--ink-3)' }}>
                  <Icon name="shirt" size={15} color={newSvcKind === 'roupa' ? 'white' : 'var(--ink-3)'} /> Tratamento de roupa
                </button>
                <button onClick={() => setNewSvcKind('outro')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newSvcKind === 'outro' ? 'var(--ink)' : 'var(--border)'}`, background: newSvcKind === 'outro' ? 'var(--ink)' : 'white', color: newSvcKind === 'outro' ? 'white' : 'var(--ink-3)' }}>
                  <Icon name="package" size={15} color={newSvcKind === 'outro' ? 'white' : 'var(--ink-3)'} /> Outro
                </button>
              </div>
              <select value={newSvcPatient} onChange={e => setNewSvcPatient(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}>
                <option value="">Sem {cfg.personNoun.toLowerCase()} associado</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={newSvcNotes} onChange={e => setNewSvcNotes(e.target.value)} placeholder="Detalhe (opcional)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <button onClick={createService} disabled={svcSaving} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: svcSaving ? 'wait' : 'pointer' }}>
                {svcSaving ? 'A publicar…' : 'Publicar pedido'}
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {svcColumns.map(colStatus => {
              const items = services.filter(s => s.status === colStatus)
              return (
                <div key={colStatus}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: STATUS_META[colStatus].color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
                    {STATUS_META[colStatus].label} ({items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.length === 0 && <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '16px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 12 }}>Nada aqui.</div>}
                    {items.map(s => (
                      <div key={s.id} style={{ background: STATUS_META[s.status].bg, border: `1px solid ${STATUS_META[s.status].color}33`, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                            <Icon name={s.kind === 'roupa' ? 'shirt' : 'package'} size={14} color="var(--ink)" /> {s.kind === 'roupa' ? 'Tratamento de roupa' : 'Outro'}
                          </div>
                          <button onClick={() => removeService(s.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15, padding: 0 }}>×</button>
                        </div>
                        {nameOf(s.patient_id) && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{nameOf(s.patient_id)}</div>}
                        {s.notes && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{s.notes}</div>}
                        <button onClick={() => advanceService(s)} style={{ marginTop: 8, padding: '5px 11px', background: 'white', border: `1px solid ${STATUS_META[s.status].color}`, color: STATUS_META[s.status].color, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {s.status === 'pedido' ? 'Assumir →' : 'Concluir ✓'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quadro de serviço recorrente genérico ──────────────────────────────────
// Novo 2026-08-11 — mesma forma que "Transportes recorrentes" acima (uma
// coisa que se repete em certos dias, um toque marca feito), mas sobre a
// tabela nova support_recurring_services/logs (sprint131) e parametrizável
// por "kind" — serve tanto para roupa recorrente como para os serviços de
// fim de semana/noite, sem duplicar a lógica três vezes.
interface RecPatient { id: string; name: string; room_number?: string | null }
interface RecSchedule { id: string; patient_id: string; kind: string; label: string | null; weekdays: number[] | null; time: string | null }
interface RecLog { id: string; schedule_id: string; date: string; done: boolean }

function RecurringServiceBoard({ title, kinds, icon, patients, search }: {
  title: string; kinds: { id: string; label: string }[]; icon: string; patients: RecPatient[]; search: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()
  const kindIds = kinds.map(k => k.id)

  const [schedules, setSchedules] = useState<RecSchedule[]>([])
  const [logs, setLogs] = useState<RecLog[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newKind, setNewKind] = useState(kindIds[0])
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newDays, setNewDays] = useState<number[] | null>(kindIds[0] === 'roupa' ? null : [0, 6])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Em série e não em paralelo de propósito: se a primeira tabela não existe,
    // a segunda também não vale a pena — disparar as duas ao mesmo tempo só
    // garante um 400 extra na consola a cada carregamento, ruído que esconde os
    // erros a sério de quem anda a procurar problemas.
    //
    // E as DUAS têm de ser verificadas: a migração pode ter sido aplicada só
    // pela metade (foi o que aconteceu — support_recurring_services existia e
    // support_recurring_logs não), e a guarda que só olhava para a primeira
    // deixava a segunda falhar em silêncio a cada visita.
    const emFalta = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')
    const sch = await scope.filter(supabase.from('support_recurring_services').select('id,patient_id,kind,label,weekdays,time')).in('kind', kindIds).eq('active', true)
    if (emFalta(sch.error)) { setNeedsSetup(true); setLoading(false); return }
    const lgs = await scope.filter(supabase.from('support_recurring_logs').select('id,schedule_id,date,done')).eq('date', today)
    if (emFalta(lgs.error)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setSchedules(sch.data || [])
    setLogs(lgs.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function todaysFor(patientId: string) { return schedules.filter(s => s.patient_id === patientId && (!s.weekdays || s.weekdays.includes(todayWeekday))) }
  function logFor(scheduleId: string) { return logs.find(l => l.schedule_id === scheduleId) }
  function kindLabel(kind: string) { return kinds.find(k => k.id === kind)?.label || kind }

  async function toggle(s: RecSchedule) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(s.id)
    const nextDone = !existing?.done
    const { data, error } = await supabase.from('support_recurring_logs').upsert({
      schedule_id: s.id, patient_id: s.patient_id, date: today,
      done: nextDone, done_by_id: nextDone ? user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }, { onConflict: 'schedule_id,date' }).select().single()
    if (error) { toast.error('Não foi possível atualizar', reportError('recurring-service-toggle', error, MSG.save)); return }
    setLogs(p => { const rest = p.filter(l => l.schedule_id !== s.id); return data ? [...rest, data] : rest })
  }

  function openNew(patientId: string) { setNewFor(patientId); setNewKind(kindIds[0]); setNewLabel(''); setNewTime(''); setNewDays(kindIds[0] === 'roupa' ? null : [0, 6]) }
  function toggleDay(d: number) { setNewDays(prev => { const base = prev || []; return base.includes(d) ? base.filter(x => x !== d) : [...base, d].sort() }) }

  async function createSchedule() {
    if (!newFor) return
    setSaving(true)
    const { error } = await supabase.from('support_recurring_services').insert(scope.stamp({
      user_id: user.id, patient_id: newFor, kind: newKind, label: newLabel.trim().slice(0, 120) || null,
      weekdays: newDays, time: newTime || null, active: true, recorded_by_id: user.id,
    }))
    setSaving(false)
    if (error) { toast.error('Não foi possível criar', reportError('recurring-service-create', error, MSG.save)); return }
    setNewFor(null); load()
  }
  async function removeSchedule(id: string) {
    if (!confirm('Deixar de repetir este serviço?')) return
    const { error } = await supabase.from('support_recurring_services').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('recurring-service-remove', error, MSG.save)); return }
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const anyScheduled = schedules.length > 0

  if (needsSetup) {
    return (
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
        Para ativar "{title}", aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint131_recurring_services.sql</code> no Supabase.
      </div>
    )
  }

  if (loading) return <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      {!anyScheduled && !newFor ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Nada agendado ainda. Escolha {kinds.length === 1 ? 'a pessoa' : 'a pessoa e o tipo'} abaixo.
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => {
          const todays = todaysFor(p.id)
          const isNew = newFor === p.id
          return (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                <button onClick={() => isNew ? setNewFor(null) : openNew(p.id)} style={{ padding: '6px 12px', background: isNew ? 'var(--bg-3)' : 'var(--ink)', color: isNew ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {isNew ? 'Fechar' : '+ Adicionar'}
                </button>
              </div>
              {todays.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {todays.map(s => {
                    const done = !!logFor(s.id)?.done
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                        <input type="checkbox" checked={done} onChange={() => toggle(s)} style={{ width: 17, height: 17 }} />
                        <Icon name={icon} size={14} color={done ? '#16a34a' : 'var(--ink-4)'} />
                        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
                          {kindLabel(s.kind)}{s.label ? ` · ${s.label}` : ''}{s.time ? ` · ${s.time}` : ''}
                        </span>
                        <button onClick={() => removeSchedule(s.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              {isNew && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kinds.length > 1 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {kinds.map(k => (
                        <button key={k.id} onClick={() => setNewKind(k.id)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newKind === k.id ? 'var(--ink)' : 'var(--border)'}`, background: newKind === k.id ? 'var(--ink)' : 'white', color: newKind === k.id ? 'white' : 'var(--ink-4)' }}>{k.label}</button>
                      ))}
                    </div>
                  )}
                  <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nota (opcional)"
                    style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} placeholder="Hora (opcional)"
                    style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', width: 130 }} />
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Quando</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => setNewDays(null)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays === null ? 'var(--ink)' : 'var(--border)'}`, background: newDays === null ? 'var(--ink)' : 'white', color: newDays === null ? 'white' : 'var(--ink-4)' }}>Todos os dias</button>
                      {WEEKDAY_LABELS.map((label, d) => (
                        <button key={d} onClick={() => toggleDay(d)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays?.includes(d) ? 'var(--ink)' : 'var(--border)'}`, background: newDays?.includes(d) ? 'var(--ink)' : 'white', color: newDays?.includes(d) ? 'white' : 'var(--ink-4)' }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={createSchedule} disabled={saving} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving ? 'var(--bg-3)' : 'var(--ink)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'A criar…' : 'Criar'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
