'use client'

// /preparacao-medicacao — NOVO 2026-08-11. Auditoria direta contra o serviço
// "preparação em unidoses" de um centro de dia real: /mar já regista a TOMA
// (dar o medicamento) com grau de auditoria alto, mas o ato físico de
// preparar o pastilheiro/blister da semana nunca tinha registo nenhum em
// lado nenhum — nem tabela, nem página. Esta ferramenta gera a grelha de
// preparação a partir dos dados que JÁ EXISTEM (patient_meds.shifts, a
// mesma fonte que /mar usa) — não pede para reintroduzir nada.
//
// Uma coluna por turno (só os turnos que alguém dessa pessoa realmente usa —
// esconder colunas vazias), uma linha por dia da semana, um toque marca
// "preparado". supabase/sprint130_diabetic_prep_psychosocial.sql
// (medication_prep_logs) — por aplicar.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string; room_number: string | null }
interface Med { id: string; patient_id: string; name: string; dose: string | null; shifts: string[] | null; active: boolean }
interface PrepLog { id: string; patient_id: string; weekday: number; shift: string; packed: boolean }

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SHIFTS = ['manha', 'tarde', 'noite'] as const
const SHIFT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

export default function PreparacaoMedicacaoPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [weekStart, setWeekStart] = useState(() => fmtDate(startOfWeek(new Date())))
  const [patients, setPatients] = useState<Patient[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [logs, setLogs] = useState<PrepLog[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [pats, mds, lgs] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('patient_meds').select('id,patient_id,name,dose,shifts')).eq('active', true),
      scope.filter(supabase.from('medication_prep_logs').select('id,patient_id,weekday,shift,packed')).eq('week_start', weekStart),
    ])
    if (lgs.error && /does not exist|schema cache/i.test(lgs.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setMeds(mds.data || [])
    setLogs(lgs.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, weekStart])

  useEffect(() => { load() }, [load])

  function medsFor(patientId: string) { return meds.filter(m => m.patient_id === patientId) }
  // Turnos realmente usados por esta pessoa — esconder colunas vazias (ninguém
  // toma nada de noite? a coluna "Noite" nem aparece, menos para preparar de vez).
  function shiftsFor(patientId: string): string[] {
    const ms = medsFor(patientId)
    if (ms.some(m => !m.shifts || m.shifts.length === 0)) return [...SHIFTS] // sem turno definido = todos
    const used = new Set<string>()
    ms.forEach(m => (m.shifts || []).forEach(s => used.add(s)))
    return SHIFTS.filter(s => used.has(s))
  }
  function logFor(patientId: string, weekday: number, shift: string) { return logs.find(l => l.patient_id === patientId && l.weekday === weekday && l.shift === shift) }

  async function toggle(patientId: string, weekday: number, shift: string) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(patientId, weekday, shift)
    const nextPacked = !existing?.packed
    const { data, error } = await supabase.from('medication_prep_logs').upsert(scope.stamp({
      user_id: user.id, patient_id: patientId, week_start: weekStart, weekday, shift,
      packed: nextPacked, packed_by_id: nextPacked ? user.id : null, packed_at: nextPacked ? new Date().toISOString() : null,
    }), { onConflict: 'patient_id,week_start,weekday,shift' }).select().single()
    if (error) { toast.error('Não foi possível marcar', reportError('prep-toggle', error, MSG.save)); return }
    setLogs(prev => { const rest = prev.filter(l => !(l.patient_id === patientId && l.weekday === weekday && l.shift === shift)); return data ? [...rest, data] : rest })
  }

  function weekLabel() {
    const d0 = new Date(weekStart + 'T12:00:00')
    const d6 = new Date(d0); d6.setDate(d6.getDate() + 6)
    return `${d0.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} – ${d6.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`
  }
  function shiftWeek(delta: number) {
    const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + delta * 7)
    setWeekStart(fmtDate(d))
  }

  const filtered = patients.filter(p => (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())) && medsFor(p.id).length > 0)

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Para ativar a preparação em unidoses, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint130_diabetic_prep_psychosocial.sql</code> no Supabase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Preparação da medicação</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>A grelha de quem preparou o pastilheiro de cada {cfg.personNoun.toLowerCase()}, dia a dia.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => shiftWeek(-1)} aria-label="Semana anterior" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>‹</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', minWidth: 130, textAlign: 'center' }}>{weekLabel()}</span>
            <button onClick={() => shiftWeek(1)} aria-label="Semana seguinte" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>›</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
          style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', maxWidth: 280 }} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>
            Ninguém com medicação ativa para preparar.
          </div>
        ) : (
          filtered.map(p => {
            const isOpen = open === p.id
            const ms = medsFor(p.id)
            const shifts = shiftsFor(p.id)
            const packedCount = WEEKDAY_LABELS.reduce((n, _, wd) => n + shifts.filter(s => logFor(p.id, wd, s)?.packed).length, 0)
            const totalCount = WEEKDAY_LABELS.length * shifts.length
            return (
              <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpen(isOpen ? null : p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                    {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                    <span style={{ fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 10 }}>{ms.length} medicamento{ms.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: packedCount === totalCount ? '#16a34a' : 'var(--ink-4)' }}>{packedCount}/{totalCount} preparado{packedCount !== 1 ? 's' : ''}</span>
                    <Icon name="chevron" size={13} color="var(--ink-4)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--bg-3)', padding: '12px 16px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {ms.map(m => <span key={m.id} style={{ fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--bg-2)', borderRadius: 6, padding: '3px 9px' }}>{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>)}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: shifts.length * 90 + 90 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dia</th>
                            {shifts.map(s => <th key={s} style={{ padding: '6px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{SHIFT_LABEL[s]}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {WEEKDAY_LABELS.map((label, wd) => (
                            <tr key={wd}>
                              <td style={{ padding: '5px 8px', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', borderTop: '1px solid var(--bg-3)' }}>
                                <span className="prep-weekday-full">{label}</span><span className="prep-weekday-short">{WEEKDAY_SHORT[wd]}</span>
                              </td>
                              {shifts.map(s => {
                                const packed = !!logFor(p.id, wd, s)?.packed
                                return (
                                  <td key={s} style={{ padding: '5px 8px', textAlign: 'center', borderTop: '1px solid var(--bg-3)' }}>
                                    <button onClick={() => toggle(p.id, wd, s)} aria-label={`${label} · ${SHIFT_LABEL[s]}`} style={{
                                      width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                                      border: `1.5px solid ${packed ? '#16a34a' : 'var(--border)'}`, background: packed ? '#f0fdf4' : 'white',
                                      color: packed ? '#16a34a' : 'var(--ink-4)', fontSize: 14, fontWeight: 800,
                                    }}>{packed ? '✓' : ''}</button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <style>{`.prep-weekday-short{display:none} @media (max-width:480px){.prep-weekday-full{display:none} .prep-weekday-short{display:inline}}`}</style>
    </div>
  )
}
