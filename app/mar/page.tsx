'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import Link from 'next/link'

// Centro de dia: badge de "onde se toma" cada medicamento (ponte casa↔centro).
function LocBadge({ loc }: { loc?: string | null }) {
  if (loc === 'casa') return <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: 99 }}>🏠 em casa</span>
  if (loc === 'ambos') return <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 99 }}>casa + centro</span>
  return <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '1px 7px', borderRadius: 99 }}>no centro</span>
}

interface Patient {
  id: string; name: string; age: number | null; room_number: string | null
  conditions: string | null; allergies: string | null
}
interface PatientMed { id: string; name: string; dose: string | null; frequency: string | null; indication: string | null; shifts?: string[] | null; take_location?: 'centro' | 'casa' | 'ambos' | null }
type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held' | null
interface AdminRecord {
  id?: string; patient_id: string; med_id: string; shift: Shift; date: string
  status: AdminStatus; notes: string; recorded_by: string; recorded_at: string
}

const SHIFTS: Record<Shift, { label: string; time: string; color: string; light: string; border: string }> = {
  manha: { label: 'Manhã',  time: '07–14h', color: '#d97706', light: '#fffbeb', border: '#fde68a' },
  tarde: { label: 'Tarde',  time: '14–21h', color: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
  noite: { label: 'Noite',  time: '21–07h', color: '#7c3aed', light: '#faf5ff', border: '#ddd6fe' },
}
const STATUS_CFG = {
  administered: { label: 'Administrado', short: '✓', color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  refused:      { label: 'Recusado',     short: '✗', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
  held:         { label: 'Suspenso',     short: '⏸', color: '#92400e', bg: '#fff7ed', border: '#fed7aa' },
}

const ANTICOAG = ['varfarina','acenocumarol','warfarin','rivaroxabano','apixabano','dabigatrano','heparina','enoxaparina']
const NSAID    = ['ibuprofeno','diclofenac','naproxeno','meloxicam','piroxicam','indometacina','celecoxib']
const SSRI     = ['fluoxetina','sertralina','paroxetina','citalopram','escitalopram','fluvoxamina']
const MAOI     = ['fenelzina','tranilcipromina','moclobemida','rasagilina','selegilina']
const DIGOXIN  = ['digoxina']
const AMIO     = ['amiodarona']

function allergyWarning(allergies: string | null, med: string): string | null {
  if (!allergies) return null
  const tokens = allergies.toLowerCase().split(/[,;/\s]+/).filter(t => t.length >= 4)
  const hit = tokens.find(t => med.toLowerCase().includes(t) || t.includes(med.toLowerCase().split(' ')[0]))
  return hit ? `Alergia documentada "${hit}" — confirmar antes de administrar` : null
}
function interactionWarnings(med: string, others: string[]): string[] {
  const n = med.toLowerCase(); const o = others.map(x => x.toLowerCase())
  const has = (terms: string[]) => o.some(x => terms.some(t => x.includes(t)))
  const is = (terms: string[]) => terms.some(t => n.includes(t))
  const w: string[] = []
  if (is(NSAID) && has(ANTICOAG))    w.push('AINE + anticoagulante — risco de hemorragia grave')
  if (is(ANTICOAG) && has(NSAID))    w.push('Anticoagulante + AINE — risco de hemorragia grave')
  if (is(SSRI) && has(MAOI))         w.push('ISRS + IMAO — risco de síndrome serotoninérgica')
  if (is(MAOI) && has(SSRI))         w.push('IMAO + ISRS — risco de síndrome serotoninérgica')
  if (is(DIGOXIN) && has(AMIO))      w.push('Digoxina + amiodarona — risco de toxicidade')
  if (is(AMIO) && has(DIGOXIN))      w.push('Amiodarona + digoxina — risco de toxicidade')
  return w
}

// Med é devido neste turno? (shifts vazio/null = todos os turnos, compat. retro)
function dueInShift(med: { shifts?: string[] | null }, shift: Shift): boolean {
  return !med.shifts || med.shifts.length === 0 || med.shifts.includes(shift)
}

function getToday() { return new Date().toISOString().split('T')[0] }
function getCurrentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function AdminCell({ record, isSaving, onChange }: { record: AdminRecord | null; isSaving: boolean; onChange: (s: AdminStatus, notes: string) => void }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(record?.notes || '')

  if (record?.status) {
    const cfg = STATUS_CFG[record.status]
    return (
      <>
        <button onClick={() => setOpen(true)} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 7, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isSaving ? 0.5 : 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.short}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '0.02em' }}>{cfg.label}</div>
            {record.recorded_at && <div style={{ fontSize: 9, color: '#94a3b8' }}>{fmtTime(record.recorded_at)}{record.recorded_by ? ` · ${record.recorded_by.split(' ')[0]}` : ''}</div>}
          </div>
        </button>
        {open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 20 }}
            onClick={() => setOpen(false)}>
            <div style={{ background: 'white', borderRadius: 14, padding: 20, width: '100%', maxWidth: 300, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Alterar registo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {(Object.keys(STATUS_CFG) as NonNullable<AdminStatus>[]).map(st => {
                  const c = STATUS_CFG[st]
                  return (
                    <button key={st} onClick={() => { onChange(st, notes); setOpen(false) }}
                      style={{ padding: '10px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 700, color: c.color }}>
                      {c.short} {c.label}
                    </button>
                  )
                })}
                <button onClick={() => { onChange(null, ''); setOpen(false) }}
                  style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 12, color: '#64748b' }}>
                  Limpar registo
                </button>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Observação (opcional)"
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none' }} />
              {record.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Nota actual: {record.notes}</div>}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', opacity: isSaving ? 0.5 : 1 }}>
      {(Object.keys(STATUS_CFG) as NonNullable<AdminStatus>[]).map(st => {
        const c = STATUS_CFG[st]
        return (
          <button key={st} onClick={() => onChange(st, '')}
            style={{ padding: '8px 12px', minHeight: 38, border: `1px solid ${c.border}`, borderRadius: 7, background: c.bg, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: c.color, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {c.short} {c.label}
          </button>
        )
      })}
    </div>
  )
}

export default function MARPage() {
  const { user, supabase } = useAuth()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const cfg = institutionConfig(institution)
  const isDayCare = institution === 'day_care'   // ponte casa↔centro só faz sentido aqui
  const isPro = ['pro', 'clinic'].includes(user?.plan || '')

  const [patients, setPatients]               = useState<Patient[]>([])
  const [loadErr, setLoadErr]                 = useState('')
  const [selectedId, setSelectedId]           = useState('')
  const [meds, setMeds]                       = useState<PatientMed[]>([])
  const [date, setDate]                       = useState(getToday())
  const [shift, setShift]                     = useState<Shift>(getCurrentShift())
  const [records, setRecords]                 = useState<AdminRecord[]>([])
  const [saving, setSaving]                   = useState<string | null>(null)
  const [pendingWarn, setPendingWarn]         = useState<{ medId: string; status: AdminStatus; notes: string; messages: string[] } | null>(null)
  const [omissions, setOmissions]             = useState<{ name: string; id: string; missing: number }[]>([])
  const [allMedsMap, setAllMedsMap]           = useState<Record<string, PatientMed[]>>({})
  const [allDayRecs, setAllDayRecs]           = useState<{ patient_id: string; med_id: string; shift: Shift; status: string }[]>([])
  const [showOmitDetail, setShowOmitDetail]   = useState(false)
  const [liveTick, setLiveTick]               = useState(0)

  // Live updates: refresh MAR records when changed elsewhere or on return to app
  useLiveData({ supabase, table: 'mar_records', userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, enabled: !!user && isPro, onChange: () => setLiveTick(t => t + 1) })

  const selectedPatient = patients.find(p => p.id === selectedId) ?? null

  // printMARSheet via ref para o atalho de teclado usar sempre a versão fresca
  // (o handler é registado uma vez com deps []).
  const printRef = useRef<() => void>(() => {})

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setShift('manha')
      else if (e.key === '2') setShift('tarde')
      else if (e.key === '3') setShift('noite')
      else if (e.key === 'p' || e.key === 'P') printRef.current()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  useEffect(() => {
    if (!user || !isPro) return
    scope.filter(supabase.from('patients').select('id, name, age, room_number, conditions, allergies')).order('name')
      .then(({ data, error }: any) => { setLoadErr(error ? 'Não foi possível carregar os doentes. Verifica a ligação e recarrega.' : ''); setPatients(data || []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPro, supabase, scope.orgId, scope.userId])

  useEffect(() => {
    if (!selectedId) { setMeds([]); return }
    // select('*') para incluir take_location sem rebentar se a coluna ainda não
    // tiver sido migrada (sprint86) na base de dados em produção.
    supabase.from('patient_meds').select('*')
      .eq('patient_id', selectedId).eq('active', true)
      .then(({ data }: any) => setMeds(data || []))
  }, [selectedId, supabase])

  useEffect(() => {
    if (!selectedId || !date) return
    supabase.from('mar_records').select('*')
      .eq('patient_id', selectedId).eq('date', date).eq('shift', shift)
      .then(({ data }) => setRecords(data || []))
  }, [selectedId, date, shift, supabase, liveTick])

  // Compute omissions across all patients
  useEffect(() => {
    if (!user || !isPro || !patients.length) return
    const ids = patients.map(p => p.id)
    Promise.all([
      supabase.from('patient_meds').select('id, patient_id, name, dose, frequency, shifts').eq('active', true).in('patient_id', ids),
      supabase.from('mar_records').select('patient_id, med_id, shift, status').eq('date', date).in('patient_id', ids),
    ]).then(([{ data: allMeds }, { data: dayRecs }]) => {
      const medsArr: any[] = allMeds || []
      const recsArr = dayRecs || []
      const medsMap: Record<string, PatientMed[]> = {}
      medsArr.forEach((m: any) => { if (!medsMap[m.patient_id]) medsMap[m.patient_id] = []; medsMap[m.patient_id].push(m) })
      setAllMedsMap(medsMap)
      setAllDayRecs(recsArr)
      const omit = patients.map(p => {
        const dueMeds = (medsMap[p.id] || []).filter(m => dueInShift(m, shift))
        const doneIds = new Set(recsArr.filter((r: any) => r.patient_id === p.id && r.shift === shift).map((r: any) => r.med_id))
        const missing = dueMeds.filter(m => !doneIds.has(m.id)).length
        return { name: p.name, id: p.id, missing }
      }).filter(o => o.missing > 0).sort((a, b) => b.missing - a.missing)
      setOmissions(omit)
    })
  }, [patients, date, shift, user, isPro, supabase, liveTick])

  const getRecord = (medId: string) => records.find(r => r.med_id === medId && r.shift === shift) ?? null

  // ── Folha de MAR profissional (A4) — documento de auditoria ──────────────────
  // Um registo por pessoa, com cada medicação devida no turno e o seu estado.
  // Doses por administrar aparecem destacadas (é o que a Segurança Social verifica).
  const STATUS_PT: Record<string, string> = { administered: 'Administrado', refused: 'Recusado', held: 'Suspenso' }
  function printMARSheet() {
    const sl = SHIFTS[shift]
    let totalDue = 0, totalDone = 0, totalMissing = 0
    const records: PrintRecord[] = patients.map(p => {
      const due = (allMedsMap[p.id] || []).filter(m => dueInShift(m, shift))
      const recByMed: Record<string, string> = {}
      allDayRecs.filter(r => r.patient_id === p.id && r.shift === shift).forEach(r => { recByMed[r.med_id] = r.status })
      totalDue += due.length
      const bullets = due.map(m => {
        const st = recByMed[m.id]
        if (st) { totalDone++; return `${m.name}${m.dose ? ` ${m.dose}` : ''} — ${STATUS_PT[st] || st}` }
        totalMissing++; return `${m.name}${m.dose ? ` ${m.dose}` : ''} — ☐ POR ADMINISTRAR`
      })
      const missing = due.filter(m => !recByMed[m.id]).length
      return {
        title: p.name,
        meta: [cfg.hasBeds && p.room_number ? `${cfg.roomLabel} ${p.room_number}` : '', p.age ? `${p.age} anos` : ''].filter(Boolean).join(' · '),
        tags: missing > 0 ? [{ label: `${missing} por dar`, color: '#b91c1c' }] : [{ label: 'Completo', color: '#16a34a' }],
        bullets: bullets.length ? bullets : ['Sem medicação para este turno.'],
      }
    }).filter(r => r.bullets[0] !== 'Sem medicação para este turno.')

    printDoc({
      docTitle: 'Registo de Administração de Medicação (MAR)',
      docSubtitle: `Turno ${sl.label} (${sl.time}) · ${new Date(date + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      meta: [
        { label: cfg.personNounPlural, value: String(records.length) },
        { label: 'Doses devidas', value: String(totalDue) },
        { label: 'Administradas', value: String(totalDone) },
        { label: 'Por administrar', value: String(totalMissing) },
      ],
      sections: [{ heading: `${cfg.personNounPlural} — turno ${sl.label}`, records }],
      footerNote: 'Documento gerado pelo Phlox · Confidencial · Assinatura do responsável: __________________',
    })
  }
  printRef.current = printMARSheet

  const doAdmin = async (medId: string, status: AdminStatus, notes: string) => {
    if (!user || !selectedId) return
    setSaving(medId)
    const existing = getRecord(medId)
    const base = scope.stamp({ patient_id: selectedId, user_id: user.id, med_id: medId, shift, date, status, notes, recorded_by: (user as any).name || user.email || '', recorded_at: new Date().toISOString() })
    if (!status && existing) {
      await supabase.from('mar_records').delete().eq('id', (existing as any).id)
      setRecords(p => p.filter(r => !(r.med_id === medId && r.shift === shift)))
    } else if (existing) {
      const { data } = await supabase.from('mar_records').update({ status, notes, recorded_at: base.recorded_at }).eq('id', (existing as any).id).select().single()
      if (data) setRecords(p => p.map(r => r.med_id === medId && r.shift === shift ? data : r))
    } else if (status) {
      const { data } = await supabase.from('mar_records').insert(base).select().single()
      if (data) setRecords(p => [...p, data])
    }
    setSaving(null)
  }

  const handleAdmin = async (medId: string, status: AdminStatus, notes: string) => {
    if (status === 'administered' && !getRecord(medId) && selectedPatient) {
      const med = meds.find(m => m.id === medId)
      if (med) {
        const otherAdministered = records.filter(r => r.shift === shift && r.status === 'administered' && r.med_id !== medId).map(r => meds.find(m => m.id === r.med_id)?.name || '').filter(Boolean)
        const messages = [...(allergyWarning(selectedPatient.allergies, med.name) ? [allergyWarning(selectedPatient.allergies, med.name)!] : []), ...interactionWarnings(med.name, otherAdministered)]
        if (messages.length) { setPendingWarn({ medId, status, notes, messages }); return }
      }
    }
    await doAdmin(medId, status, notes)
  }

  const shiftMeds = meds.filter(m => dueInShift(m, shift))
  const otherShiftMeds = meds.filter(m => !dueInShift(m, shift))

  const administerAllPending = async () => {
    const pending = shiftMeds.filter(m => !getRecord(m.id))
    if (!pending.length || !user || !selectedId) return
    const now = new Date().toISOString()
    const inserts = pending.map(m => ({ patient_id: selectedId, user_id: user.id, med_id: m.id, shift, date, status: 'administered', notes: '', recorded_by: (user as any).name || user.email || '', recorded_at: now }))
    const { data } = await supabase.from('mar_records').insert(inserts).select()
    if (data) setRecords(p => [...p, ...data])
  }

  const shiftMedIds  = new Set(shiftMeds.map(m => m.id))
  const administered = records.filter(r => r.shift === shift && r.status === 'administered' && shiftMedIds.has(r.med_id)).length
  const totalMeds    = shiftMeds.length
  const pendingCount = totalMeds - records.filter(r => r.shift === shift && r.status && shiftMedIds.has(r.med_id)).length
  const sl           = SHIFTS[shift]

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>MAR</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#0f172a', marginBottom: 14 }}>Registo de Administração de Medicação</div>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>Regista cada administração por turno. Sinaliza omissões, recusas e alertas de segurança automaticamente.</p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#2563eb', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Ver planos →</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>

      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 54, zIndex: 40 }}>
        <div className="page-container mar-top" style={{ paddingTop: 10, paddingBottom: 10 }}>
          {/* Row 1: title + secondary actions */}
          <div className="mar-top-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>MAR</span>
            <span className="mar-badge" style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 4 }}>Reg. Administração</span>
            <div style={{ flex: 1 }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', color: '#374151', minWidth: 0 }} />
            <button onClick={printMARSheet} className="mar-print" title="Folha de MAR de todos os utentes para este turno (A4, para auditoria)"
              style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
              🖨 Folha de MAR
            </button>
            <Link href="/handover" className="mar-passagem"
              style={{ padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Passagem →
            </Link>
          </div>
          {/* Row 2: shift segmented control (full-width on mobile) */}
          <div className="mar-shifts" style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, gap: 2, marginTop: 8 }}>
            {(['manha', 'tarde', 'noite'] as Shift[]).map(s => (
              <button key={s} onClick={() => setShift(s)}
                style={{ flex: 1, padding: '7px 14px', background: shift === s ? SHIFTS[s].color : 'transparent', color: shift === s ? 'white' : '#64748b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, transition: 'all 0.1s' }}>
                {SHIFTS[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Omissions banner */}
      {omissions.length > 0 && (
        <div style={{ background: omissions.length >= 3 ? '#fee2e2' : '#fffbeb', borderBottom: `1px solid ${omissions.length >= 3 ? '#fca5a5' : '#fde68a'}` }}>
          <div className="page-container" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: omissions.length >= 3 ? '#991b1b' : '#92400e' }}>
                {omissions.reduce((s, o) => s + o.missing, 0)} doses em falta — {sl.label}
              </span>
              {omissions.slice(0, 5).map(o => (
                <button key={o.id} onClick={() => setSelectedId(o.id)}
                  style={{ padding: '2px 9px', background: 'white', border: `1px solid ${omissions.length >= 3 ? '#fca5a5' : '#fde68a'}`, borderRadius: 12, fontSize: 11, color: omissions.length >= 3 ? '#991b1b' : '#92400e', cursor: 'pointer', fontWeight: 600 }}>
                  {o.name} ({o.missing})
                </button>
              ))}
              <button onClick={() => setShowOmitDetail(x => !x)}
                style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {showOmitDetail ? '▲ Fechar' : '▼ Detalhe'}
              </button>
            </div>
            {showOmitDetail && (
              <div style={{ marginTop: 8, background: 'white', border: '1px solid #fde68a', borderRadius: 8, overflow: 'hidden' }}>
                {omissions.map(o => {
                  const pMeds = (allMedsMap[o.id] || []).filter(m => dueInShift(m, shift))
                  const missing = pMeds.filter(m => !allDayRecs.find(r => r.med_id === m.id && r.shift === shift))
                  return (
                    <div key={o.id} style={{ padding: '9px 14px', borderBottom: '1px solid #fef9c3', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => setSelectedId(o.id)}
                        style={{ fontSize: 13, fontWeight: 700, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 100, textAlign: 'left' }}>
                        {o.name} →
                      </button>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {missing.map(m => (
                          <span key={m.id} style={{ padding: '1px 7px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 4, fontSize: 11, color: '#92400e' }}>
                            {m.name}{m.dose ? ` ${m.dose}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="page-container page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Aviso recuperável: distinguir "falhou a carregar" de "sem doentes" —
            crítico no MAR, onde um ecrã vazio nunca pode parecer "nada a dar". */}
        {loadErr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ color: '#b91c1c', fontSize: 18 }}>⚠</span>
            <span style={{ flex: 1, fontSize: 13.5, color: '#991b1b' }}>{loadErr}</span>
            <button onClick={() => window.location.reload()} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Recarregar</button>
          </div>
        )}

        {/* Patient selector + info card */}
        <div className="mar-selector" style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr auto' : '1fr', gap: 10, alignItems: 'start' }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              style={{ flex: 1, minWidth: 200, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', color: selectedId ? '#0f172a' : '#94a3b8', background: 'white' }}>
              <option value="">Selecionar {cfg.personNoun.toLowerCase()}...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.room_number ? ` — Quarto ${p.room_number}` : ''}{p.age ? ` (${p.age}a)` : ''}</option>
              ))}
            </select>
            {selectedPatient && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedPatient.room_number && <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 9px', borderRadius: 5 }}>Qt. {selectedPatient.room_number}</span>}
                {selectedPatient.allergies && <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#faf5ff', border: '1px solid #ddd6fe', padding: '3px 9px', borderRadius: 5 }}>⚠ {selectedPatient.allergies}</span>}
                {selectedPatient.conditions && <span style={{ fontSize: 11, color: '#64748b', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPatient.conditions}</span>}
              </div>
            )}
          </div>
          {selectedId && pendingCount > 0 && (
            <button onClick={administerAllPending}
              style={{ padding: '9px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', height: '100%' }}>
              ✓ Todos em falta ({pendingCount})
            </button>
          )}
        </div>

        {/* MAR content */}
        {!selectedId ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>💊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Seleciona um {cfg.personNoun.toLowerCase()}</div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
              O MAR regista cada administração de medicação por turno. Cada registo fica assinado com o teu nome e hora.
            </p>
          </div>
        ) : meds.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Sem medicamentos ativos para este {cfg.personNoun.toLowerCase()}</div>
            <Link href={`/patients/${selectedId}`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
              Adicionar medicamentos →
            </Link>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Shift header */}
            <div style={{ background: sl.light, borderBottom: `1px solid ${sl.border}`, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: sl.color }}>Turno da {sl.label} · {sl.time}</span>
                <span style={{ fontSize: 12, color: sl.color, opacity: 0.7 }}>
                  {new Date(date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: administered === totalMeds ? '#059669' : sl.color }}>
                  {administered}/{totalMeds}
                </span>
                <div style={{ width: 80, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalMeds > 0 ? (administered / totalMeds) * 100 : 0}%`, background: administered === totalMeds ? '#059669' : sl.color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div className="mar-header-row" style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 260px', gap: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px' }}>
              {['Medicamento', 'Dose', 'Frequência', 'Registo'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {/* Rows — só medicação devida neste turno */}
            {shiftMeds.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                Sem medicação prescrita para o turno da {sl.label}.
              </div>
            ) : shiftMeds.map((med, i) => {
              const rec = getRecord(med.id)
              const isSaving = saving === med.id
              const isAdministered = rec?.status === 'administered'
              return (
                <div key={med.id} className="mar-med-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 110px 260px', gap: 0,
                  padding: '13px 16px',
                  borderBottom: i < shiftMeds.length - 1 ? '1px solid #f1f5f9' : 'none',
                  alignItems: 'center',
                  background: isAdministered ? '#fafffe' : 'white',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'opacity 0.15s, background 0.2s',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isAdministered ? '#16a34a' : '#0f172a', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {med.name}
                      {isDayCare && <LocBadge loc={med.take_location} />}
                    </div>
                    {med.indication && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{med.indication}</div>}
                    {isDayCare && med.take_location === 'casa' && <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>A família dá em casa — não administrar no centro.</div>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{med.dose || '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{med.frequency || '—'}</div>
                  <div>
                    <AdminCell record={rec} isSaving={isSaving} onChange={(s, n) => handleAdmin(med.id, s, n)} />
                    {rec?.notes && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{rec.notes}</div>}
                  </div>
                </div>
              )
            })}

            {/* Medicação de outros turnos (informativo, não conta para omissões) */}
            {otherShiftMeds.length > 0 && (
              <details style={{ borderTop: '1px solid #f1f5f9' }}>
                <summary style={{ padding: '10px 16px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', listStyle: 'none', fontWeight: 600 }}>
                  + {otherShiftMeds.length} med. de outros turnos (não devida agora)
                </summary>
                {otherShiftMeds.map(med => (
                  <div key={med.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid #f8fafc', opacity: 0.7 }}>
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600, flex: 1 }}>{med.name}{med.dose ? ` · ${med.dose}` : ''}</span>
                    <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{(med.shifts || []).map(s => SHIFTS[s as Shift]?.label || s).join(', ')}</span>
                  </div>
                ))}
              </details>
            )}

            {/* Footer summary */}
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {(Object.keys(STATUS_CFG) as NonNullable<AdminStatus>[]).map(st => {
                const count = records.filter(r => r.shift === shift && r.status === st).length
                const c = STATUS_CFG[st]
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                    <span style={{ fontSize: 11, color: '#64748b' }}>{c.label}: <strong style={{ color: '#374151' }}>{count}</strong></span>
                  </div>
                )
              })}
              <div style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }}>
                {user?.email}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety modal */}
      {pendingWarn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#991b1b' }}>Alerta de segurança</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {pendingWarn.messages.map((msg, i) => (
                <div key={i} style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', lineHeight: 1.5, fontWeight: 600 }}>
                  {msg}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              Confirma que verificaste esta situação com o clínico responsável antes de administrar.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => { const pw = pendingWarn; setPendingWarn(null); await doAdmin(pw.medId, pw.status, pw.notes) }}
                style={{ flex: 1, padding: 11, background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                Confirmar mesmo assim
              </button>
              <button onClick={() => setPendingWarn(null)}
                style={{ padding: '11px 16px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .mar-header-row { display: none !important; }
          .mar-med-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            padding: 14px 16px !important;
          }
          .mar-badge { display: none !important; }
          .mar-print { display: none !important; }
          .mar-selector { grid-template-columns: 1fr !important; }
        }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white !important; }
          .page-container { max-width: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
