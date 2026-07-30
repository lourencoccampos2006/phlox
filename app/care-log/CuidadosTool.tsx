'use client'

// CuidadosTool — aba "Cuidados" do Registo do dia. Fortalece "cuidados
// básicos/enfermagem" com ESTRUTURA, não só registo pontual: health_checkins
// (sprint122) cobre "aconteceu isto hoje" — falta o outro lado, tarefas
// PLANEADAS e recorrentes por pessoa ("banho às terças e sextas", "mobilização
// todos os dias") que a equipa risca à medida que faz. Mesmo espírito de
// recurring_activities→activities (sprint108), mas para cuidados, não
// atividades de grupo. Tabelas: care_checklists (o plano) + care_checklist_logs
// (feito/não feito por dia — sprint123).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'

interface Patient { id: string; name: string; room_number?: string | null }
interface Checklist { id: string; patient_id: string; title: string; weekdays: number[] | null; active: boolean }
interface ChecklistLog { id: string; checklist_id: string; patient_id: string; date: string; done: boolean }

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CuidadosTool() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)

  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()

  const [patients, setPatients] = useState<Patient[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [logs, setLogs] = useState<ChecklistLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDays, setNewDays] = useState<number[] | null>(null) // null = todos os dias
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: cls }, { data: lgs }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('care_checklists').select('*')).eq('active', true),
      scope.filter(supabase.from('care_checklist_logs').select('id,checklist_id,patient_id,date,done')).eq('date', today),
    ])
    setPatients(pats || [])
    setChecklists(cls || [])
    setLogs(lgs || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function todaysFor(patientId: string) {
    return checklists.filter(c => c.patient_id === patientId && (!c.weekdays || c.weekdays.includes(todayWeekday)))
  }
  function logFor(checklistId: string) { return logs.find(l => l.checklist_id === checklistId) }

  async function toggle(c: Checklist) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(c.id)
    const nextDone = !existing?.done
    const { data, error } = await supabase.from('care_checklist_logs').upsert(scope.stamp({
      user_id: user.id,
      checklist_id: c.id, patient_id: c.patient_id, date: today,
      done: nextDone, done_by_id: nextDone ? user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }), { onConflict: 'checklist_id,date' }).select().single()
    if (error) { toast.error('Não foi possível atualizar', reportError('care-checklist-toggle', error, MSG.save)); return }
    setLogs(p => { const rest = p.filter(l => l.checklist_id !== c.id); return data ? [...rest, data] : rest })
  }

  function openNew(patientId: string) { setNewFor(patientId); setNewTitle(''); setNewDays(null); setErr('') }

  async function createChecklist() {
    if (!newFor || !newTitle.trim()) return
    setSaving(true); setErr('')
    const { error } = await supabase.from('care_checklists').insert(scope.stamp({
      user_id: user.id, patient_id: newFor, title: newTitle.trim().slice(0, 120), weekdays: newDays, active: true,
    }))
    if (error) { setErr(reportError('care-checklist-create', error, MSG.save)); setSaving(false); return }
    setSaving(false); setNewFor(null); setNewTitle('')
    load()
  }

  async function removeChecklist(id: string) {
    if (!confirm('Deixar de repetir esta tarefa?')) return
    const { error } = await supabase.from('care_checklists').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('care-checklist-remove', error, MSG.save)); return }
    load()
  }

  function toggleDay(d: number) {
    setNewDays(prev => {
      const base = prev || []
      return base.includes(d) ? base.filter(x => x !== d) : [...base, d].sort()
    })
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '18px clamp(14px,3vw,28px) 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Tarefas de cuidado recorrentes por pessoa — banho, higiene, mobilização. Risca à medida que fazes.</p>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
          {cfg.emptyPeopleMsg}
        </div>
      ) : (
        filtered.map(p => {
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
                  {isNew ? 'Fechar' : '+ Tarefa'}
                </button>
              </div>

              {todays.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {todays.map(c => {
                    const done = !!logFor(c.id)?.done
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                        <input type="checkbox" checked={done} onChange={() => toggle(c)} style={{ width: 17, height: 17 }} />
                        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>{c.title}</span>
                        {!c.weekdays && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>diário</span>}
                        <button onClick={() => removeChecklist(c.id)} aria-label="Remover tarefa recorrente" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {isNew && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Banho, Higiene oral, Mobilização"
                    style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
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
                  <button onClick={createChecklist} disabled={saving || !newTitle.trim()} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving || !newTitle.trim() ? 'var(--bg-3)' : 'var(--ink)', color: saving || !newTitle.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving || !newTitle.trim() ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'A criar…' : 'Criar tarefa recorrente'}
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
