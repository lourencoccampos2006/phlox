'use client'

// /apoio-psicossocial — NOVO 2026-08-11. Auditoria direta contra o serviço
// "orienta o cliente e/ou o seu responsável através do apoio psico-social e
// encaminha para profissionais especializados os casos mais complexos" de um
// centro de dia real: não existia NADA disto no Phlox — sem tabela, sem
// página. supabase/sprint130_diabetic_prep_psychosocial.sql
// (psychosocial_notes) — por aplicar.
//
// DECISÃO DO FERNANDO 2026-08-11: só a equipa vê isto. Nunca em
// app/api/family-portal/route.ts, nunca em /perfil, nunca em /familia — dados
// sensíveis, a abrir com calma mais tarde se fizer sentido.
//
// Sinal automático (não é IA, é aritmética simples sobre care_records.mood.level,
// já registado em cada turno): destaca quem teve humor baixo persistente nos
// últimos 14 dias — uma SUGESTÃO de rever, nunca uma nota criada sozinha.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string; room_number: string | null }
interface Note {
  id: string; patient_id: string; date: string; note: string
  referred_to: string | null; referral_status: string | null; referral_date: string | null
  created_at: string
}

const REFERRAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sugerido:  { label: 'Sugerido',  color: '#64748b', bg: '#f8fafc' },
  agendado:  { label: 'Agendado',  color: '#b45309', bg: '#fffbeb' },
  em_curso:  { label: 'Em curso',  color: '#1d4ed8', bg: '#eff6ff' },
  concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
}
const REFERRAL_OPTIONS = ['Psicologia', 'Psiquiatria', 'Assistente Social (externo)', 'Terapia Ocupacional', 'Outro especialista']

export default function ApoioPsicossocialPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [moodFlags, setMoodFlags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [search, setSearch] = useState('')
  const [openFor, setOpenFor] = useState<string | null>(null)

  const [newNote, setNewNote] = useState('')
  const [newReferTo, setNewReferTo] = useState('')
  const [newReferStatus, setNewReferStatus] = useState('')
  const [newReferDate, setNewReferDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const [pats, nts, cr] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('psychosocial_notes').select('*')).order('date', { ascending: false }),
      scope.filter(supabase.from('care_records').select('patient_id,mood')).gte('date', since14),
    ])
    if (nts.error && /does not exist|schema cache/i.test(nts.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setNotes((nts.data || []) as Note[])

    // Humor baixo persistente: pelo menos 4 registos nos últimos 14 dias, média <= 2 (de 5).
    const byPatient: Record<string, number[]> = {}
    ;((cr.data || []) as any[]).forEach(r => {
      const lvl = r.mood?.level
      if (typeof lvl === 'number') (byPatient[r.patient_id] ||= []).push(lvl)
    })
    const flags = new Set<string>()
    Object.entries(byPatient).forEach(([pid, levels]) => {
      if (levels.length >= 4 && levels.reduce((a, b) => a + b, 0) / levels.length <= 2) flags.add(pid)
    })
    setMoodFlags(flags)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function notesFor(patientId: string) { return notes.filter(n => n.patient_id === patientId) }
  function openNoteEditor(patientId: string) { setOpenFor(patientId); setNewNote(''); setNewReferTo(''); setNewReferStatus(''); setNewReferDate('') }

  async function saveNote() {
    if (!openFor || !newNote.trim()) return
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSaving(true)
    const { data, error } = await supabase.from('psychosocial_notes').insert(scope.stamp({
      user_id: user.id, patient_id: openFor, note: newNote.trim().slice(0, 2000),
      referred_to: newReferTo || null, referral_status: newReferTo ? (newReferStatus || 'sugerido') : null,
      referral_date: newReferDate || null, recorded_by_id: user.id,
    })).select().single()
    setSaving(false)
    if (error) { toast.error('Não foi possível guardar', reportError('psicossocial-note-create', error, MSG.save)); return }
    if (data) setNotes(prev => [data, ...prev])
    setOpenFor(null)
  }

  async function advanceReferral(n: Note) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const order = ['sugerido', 'agendado', 'em_curso', 'concluido']
    const idx = order.indexOf(n.referral_status || 'sugerido')
    if (idx === order.length - 1) return
    const next = order[idx + 1]
    const { error } = await supabase.from('psychosocial_notes').update({ referral_status: next }).eq('id', n.id)
    if (error) { toast.error('Não atualizado', reportError('psicossocial-referral-advance', error, MSG.save)); return }
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, referral_status: next } : x))
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const flaggedFirst = [...filtered].sort((a, b) => (moodFlags.has(b.id) ? 1 : 0) - (moodFlags.has(a.id) ? 1 : 0))

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Para ativar o apoio psico-social, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint130_diabetic_prep_psychosocial.sql</code> no Supabase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Apoio psico-social</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>Notas de acompanhamento e encaminhamento a especialistas — só visível à equipa.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
          style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', maxWidth: 280 }} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
        ) : flaggedFirst.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>{cfg.emptyPeopleMsg}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {flaggedFirst.map(p => {
              const pNotes = notesFor(p.id)
              const flagged = moodFlags.has(p.id)
              const isOpen = openFor === p.id
              return (
                <div key={p.id} style={{ background: 'white', border: `1px solid ${flagged ? '#c4b5fd' : 'var(--border)'}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                      {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                      {pNotes.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 10 }}>{pNotes.length} nota{pNotes.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <button onClick={() => isOpen ? setOpenFor(null) : openNoteEditor(p.id)} style={{ padding: '6px 12px', background: isOpen ? 'var(--bg-3)' : 'var(--ink)', color: isOpen ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {isOpen ? 'Fechar' : '+ Nota'}
                    </button>
                  </div>

                  {flagged && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 11px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8 }}>
                      <Icon name="alert" size={13} color="#7c3aed" />
                      <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 600 }}>Humor em baixo persistente nos últimos 14 dias — pode valer a pena um acompanhamento.</span>
                    </div>
                  )}

                  {pNotes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {pNotes.slice(0, 5).map(n => (
                        <div key={n.id} style={{ borderTop: '1px solid var(--bg-3)', paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{new Date(n.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</div>
                            {n.referral_status && (
                              <button onClick={() => advanceReferral(n)} disabled={n.referral_status === 'concluido'} style={{ fontSize: 10.5, fontWeight: 700, color: REFERRAL_STATUS[n.referral_status].color, background: REFERRAL_STATUS[n.referral_status].bg, border: `1px solid ${REFERRAL_STATUS[n.referral_status].color}33`, borderRadius: 6, padding: '2px 8px', cursor: n.referral_status === 'concluido' ? 'default' : 'pointer' }}>
                                {n.referred_to} · {REFERRAL_STATUS[n.referral_status].label}{n.referral_status !== 'concluido' ? ' →' : ''}
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>{n.note}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea autoFocus value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder="Nota de acompanhamento…"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <select value={newReferTo} onChange={e => setNewReferTo(e.target.value)} style={{ flex: '1 1 200px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                          <option value="">Sem encaminhamento</option>
                          {REFERRAL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {newReferTo && (
                          <>
                            <select value={newReferStatus} onChange={e => setNewReferStatus(e.target.value)} style={{ flex: '1 1 130px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                              {Object.entries(REFERRAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input type="date" value={newReferDate} onChange={e => setNewReferDate(e.target.value)} style={{ flex: '1 1 140px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
                          </>
                        )}
                      </div>
                      <button onClick={saveNote} disabled={saving || !newNote.trim()} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving || !newNote.trim() ? 'var(--bg-3)' : 'var(--ink)', color: saving || !newNote.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving || !newNote.trim() ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'A guardar…' : 'Guardar nota'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
