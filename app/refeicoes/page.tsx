'use client'

// /refeicoes — Registo de refeições, dedicado. Os dados já existiam
// (care_records.nutrition, gravados via /care-log), mas enterrados como um
// separador dentro de um formulário genérico de sinais vitais — para uma
// equipa de centro de dia, cuja rotina real gira em torno das refeições,
// isso é o oposto do que precisa. Esta página mostra TODOS os utentes de
// uma vez, por refeição, com toque rápido em vez de formulário.
//
// IMPORTANTE: care_records é uma linha por (patient_id, date, shift) que
// também guarda vitais/continência/humor/pele — o upsert daqui tem de
// preservar esses campos (lê a linha existente antes de gravar), nunca
// substituir o registo inteiro só porque esta página só edita nutrição.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor, type Shift } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string; room_number?: string | null }
interface Nutrition { breakfast?: number | null; lunch?: number | null; dinner?: number | null; fluid_ml?: number | null; appetite?: string | null }
interface CareRecord { id: string; patient_id: string; date: string; shift: Shift; nutrition: Nutrition; [k: string]: any }

const SHIFT_META: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const APPETITE_OPTS = ['Bom', 'Razoável', 'Fraco', 'Recusou']
const PCT_OPTS = [0, 25, 50, 75, 100]

function pctColor(v: number) {
  if (v >= 75) return '#16a34a'
  if (v >= 40) return '#d97706'
  return '#dc2626'
}

export default function RefeicoesPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [shift, setShift] = useState<Shift>(currentShiftFor(institution))
  const [shiftTouched, setShiftTouched] = useState(false)
  useEffect(() => { if (!shiftTouched) setShift(currentShiftFor(institution)) /* eslint-disable-next-line */ }, [institution])

  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<CareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, Nutrition>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errById, setErrById] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: recs }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('care_records').select('*')).eq('date', date).eq('shift', shift),
    ])
    setPatients(pats || [])
    setRecords(recs || [])
    // Reconstrói o rascunho a partir do que já está gravado — nunca perde o que
    // outra pessoa já registou neste turno ao mudar de data/turno e voltar atrás.
    const byPatient: Record<string, Nutrition> = {}
    ;(recs || []).forEach((r: CareRecord) => { byPatient[r.patient_id] = { ...r.nutrition } })
    setDraft(byPatient)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, date, shift])

  useEffect(() => { load() }, [load])

  function setField(patientId: string, field: keyof Nutrition, value: any) {
    setDraft(d => ({ ...d, [patientId]: { ...d[patientId], [field]: value } }))
  }

  async function saveRow(patientId: string) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSavingId(patientId); setErrById(e => ({ ...e, [patientId]: '' }))
    const existing = records.find(r => r.patient_id === patientId)
    const nutrition = draft[patientId] || {}
    const { error } = await supabase.from('care_records').upsert(scope.stamp({
      // Preserva tudo o que já existia nesta linha — só a nutrição muda aqui.
      ...(existing ? { vitals: existing.vitals, continence: existing.continence, mood: existing.mood, skin: existing.skin, notes: existing.notes } : {}),
      user_id: user.id,
      patient_id: patientId,
      date,
      shift,
      nutrition: {
        breakfast: nutrition.breakfast ?? null,
        lunch: nutrition.lunch ?? null,
        dinner: nutrition.dinner ?? null,
        fluid_ml: nutrition.fluid_ml ?? null,
        appetite: nutrition.appetite || null,
      },
    }), { onConflict: 'patient_id,date,shift' })
    if (error) { setErrById(e => ({ ...e, [patientId]: reportError('refeicoes-save', error, MSG.save) })); setSavingId(null); return }
    setSavingId(null)
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const shiftOpts = shiftsFor(institution)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Refeições</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 14px' }}>
            O que cada {cfg.personNoun.toLowerCase()} comeu, por refeição — toque rápido, sem formulário.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {shiftOpts.map(s => (
                <button key={s} onClick={() => { setShiftTouched(true); setShift(s) }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${shift === s ? 'var(--ink)' : 'var(--border)'}`, background: shift === s ? 'var(--ink)' : 'white', color: shift === s ? 'white' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  {SHIFT_META[s]}
                </button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
              style={{ flex: 1, minWidth: 160, border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
            {cfg.emptyPeopleMsg}
          </div>
        ) : (
          filtered.map(p => {
            const n = draft[p.id] || {}
            const dirty = JSON.stringify(n) !== JSON.stringify(records.find(r => r.patient_id === p.id)?.nutrition || {})
            return (
              <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                    {p.room_number && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                  </div>
                  {dirty && (
                    <button onClick={() => saveRow(p.id)} disabled={savingId === p.id}
                      style={{ padding: '6px 14px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: savingId === p.id ? 'wait' : 'pointer' }}>
                      {savingId === p.id ? 'A guardar…' : 'Guardar'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {([['breakfast', 'Pequeno-almoço'], ['lunch', 'Almoço'], ['dinner', 'Jantar']] as const).map(([field, label]) => (
                    <div key={field}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {PCT_OPTS.map(v => {
                          const active = n[field] === v
                          return (
                            <button key={v} onClick={() => setField(p.id, field, active ? null : v)}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                border: `1.5px solid ${active ? pctColor(v) : 'var(--border)'}`,
                                background: active ? pctColor(v) : 'white', color: active ? 'white' : 'var(--ink-4)',
                              }}>
                              {v}%
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="droplet" size={16} color="var(--ink-4)" />
                    <input type="number" min={0} value={n.fluid_ml ?? ''} onChange={e => setField(p.id, 'fluid_ml', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="ml" style={{ width: 80, border: '1.5px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 12.5, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {APPETITE_OPTS.map(a => (
                      <button key={a} onClick={() => setField(p.id, 'appetite', n.appetite === a ? null : a)}
                        style={{ padding: '6px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${n.appetite === a ? 'var(--ink)' : 'var(--border)'}`, background: n.appetite === a ? 'var(--ink)' : 'white', color: n.appetite === a ? 'white' : 'var(--ink-4)' }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                {errById[p.id] && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{errById[p.id]}</div>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
