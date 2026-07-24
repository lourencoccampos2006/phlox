'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import RegistoDoDia from './RegistoDoDia'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import { flagReading, VITAL_LEVEL_COLOR, VITAL_LABEL } from '@/lib/vitalRanges'

// O /care-log é agora a fusão "Registo do dia" (abas: registo + hidratação +
// feridas + atividades, adaptadas por instituição). O formulário de registo em si
// é o CareLogTool (exportado abaixo), usado como a aba "Registo".
export default function CareLogPage() { return <RegistoDoDia /> }

type Shift = 'manha' | 'tarde' | 'noite'

interface Patient { id: string; name: string; age?: number; room_number?: string; conditions?: string | null }

interface CareRecord {
  id: string
  patient_id: string
  patient_name?: string
  date: string
  shift: Shift
  recorded_by?: string
  vitals: { bp_sys?: number; bp_dia?: number; hr?: number; temp?: number; spo2?: number; glucose?: number; weight?: number }
  nutrition: { breakfast?: number; lunch?: number; dinner?: number; fluid_ml?: number; appetite?: string }
  continence: { urinary?: string; bowel?: string }
  mood: { level?: number; activities?: string; behavior?: string }
  skin: { integrity?: string; description?: string }
  notes?: string
  created_at: string
}

const SHIFTS: Record<Shift, { label: string; hours: string; color: string; bg: string }> = {
  manha: { label: 'Manhã',  hours: '07:00–14:00', color: '#d97706', bg: '#fffbeb' },
  tarde: { label: 'Tarde',  hours: '14:00–21:00', color: '#2563eb', bg: '#eff6ff' },
  noite: { label: 'Noite',  hours: '21:00–07:00', color: '#4f46e5', bg: '#f5f3ff' },
}

// Turnos: fonte única em lib/institutionConfig (shiftsFor / currentShiftFor).
// Um centro de dia não tem turno da noite — não o mostramos nem o derivamos.

const MOOD_OPTS = [
  { v: 1, label: 'Agitado',      color: '#dc2626' },
  { v: 2, label: 'Ansioso',      color: '#d97706' },
  { v: 3, label: 'Neutro',       color: '#6b7280' },
  { v: 4, label: 'Bem-disposto', color: '#2563eb' },
  { v: 5, label: 'Muito bem',    color: '#16a34a' },
]

const APPETITE_OPTS = ['Bom', 'Razoável', 'Fraco', 'Recusou']
const URINARY_OPTS = ['Continente', 'Incontinente', 'Algaliado', 'Retenção']
const BOWEL_OPTS = ['Normal', 'Obstipação', 'Diarreia', 'Sem registo']
const SKIN_OPTS = ['Íntegra', 'Rubor', 'Ferida', 'Escara']

function pctColor(v: number) {
  if (v >= 75) return '#16a34a'
  if (v >= 40) return '#d97706'
  return '#dc2626'
}

export function CareLogTool() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)
  const personLower = cfg.personNoun.toLowerCase()

  const today = new Date().toISOString().slice(0, 10)

  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<CareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const sp = useSearchParams()
  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState(today)
  // useClinicPrefs arranca em 'nursing_home' e só lê o tipo real depois do 1º
  // render — re-sincronizamos o turno com a instituição enquanto não for tocado.
  const [shift, setShift] = useState<Shift>(currentShiftFor(institution))
  const [shiftTouched, setShiftTouched] = useState(false)
  const pickShift = (s: Shift) => { setShiftTouched(true); setShift(s) }
  useEffect(() => { if (!shiftTouched) setShift(currentShiftFor(institution)) /* eslint-disable-next-line */ }, [institution])
  const [recordedBy, setRecordedBy] = useState('')

  // Vitals
  const [bpSys, setBpSys] = useState('')
  const [bpDia, setBpDia] = useState('')
  const [hr, setHr] = useState('')
  const [temp, setTemp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [glucose, setGlucose] = useState('')
  const [weight, setWeight] = useState('')

  // Nutrition
  const [breakfast, setBreakfast] = useState<number | null>(null)
  const [lunch, setLunch] = useState<number | null>(null)
  const [dinner, setDinner] = useState<number | null>(null)
  const [fluidMl, setFluidMl] = useState('')
  const [appetite, setAppetite] = useState('')

  // Continence
  const [urinary, setUrinary] = useState('')
  const [bowel, setBowel] = useState('')

  // Mood + skin
  const [mood, setMood] = useState<number | null>(null)
  const [activities, setActivities] = useState('')
  const [behavior, setBehavior] = useState('')
  const [skin, setSkin] = useState('')
  const [skinNotes, setSkinNotes] = useState('')

  // Notes
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: recs }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,age,room_number,conditions')).eq('active', true).order('name'),
      scope.filter(supabase.from('care_records').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    ])
    setPatients(pats || [])
    setRecords(recs || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  // Pré-seleciona a pessoa quando se chega via ?patient= (ex.: do cockpit, tocar
  // num nome "sem registo hoje" abre logo o registo dessa pessoa).
  useEffect(() => {
    const pid = sp?.get('patient')
    if (pid && !patientId && patients.some(p => p.id === pid)) setPatientId(pid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, patients])

  useLiveData({ supabase, table: ['care_records', 'patients'], userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  function resetForm() {
    setBpSys(''); setBpDia(''); setHr(''); setTemp(''); setSpo2(''); setGlucose(''); setWeight('')
    setBreakfast(null); setLunch(null); setDinner(null); setFluidMl(''); setAppetite('')
    setUrinary(''); setBowel('')
    setMood(null); setActivities(''); setBehavior('')
    setSkin(''); setSkinNotes('')
    setNotes('')
  }

  // Último registo do residente selecionado (para pré-preenchimento)
  const lastRecord = patientId ? records.find(r => r.patient_id === patientId) : null
  function prefillFromLast() {
    const r = lastRecord; if (!r) return
    const v = r.vitals || {}, n = r.nutrition || {}, c = r.continence || {}, m = r.mood || {}, s = r.skin || {}
    setBpSys(v.bp_sys != null ? String(v.bp_sys) : ''); setBpDia(v.bp_dia != null ? String(v.bp_dia) : '')
    setHr(v.hr != null ? String(v.hr) : ''); setTemp(v.temp != null ? String(v.temp) : '')
    setSpo2(v.spo2 != null ? String(v.spo2) : ''); setGlucose(v.glucose != null ? String(v.glucose) : '')
    setWeight(v.weight != null ? String(v.weight) : '')
    setBreakfast(n.breakfast ?? null); setLunch(n.lunch ?? null); setDinner(n.dinner ?? null)
    setFluidMl(n.fluid_ml != null ? String(n.fluid_ml) : ''); setAppetite(n.appetite || '')
    setUrinary(c.urinary || ''); setBowel(c.bowel || '')
    setMood(m.level ?? null); setActivities(m.activities || ''); setBehavior(m.behavior || '')
    setSkin(s.integrity || ''); setSkinNotes(s.description || '')
    // notas NÃO se copiam — cada turno tem as suas
  }

  async function save() {
    if (!user || !patientId) return
    if (!scope.canEdit) { toast.error('Só leitura', 'A sua conta não tem permissão para registar.'); return }
    setSaving(true)
    try {
    const { error } = await supabase.from('care_records').upsert(scope.stamp({
      user_id: user.id,
      patient_id: patientId,
      date,
      shift,
      recorded_by: recordedBy || null,
      vitals: {
        bp_sys: bpSys ? parseInt(bpSys) : null,
        bp_dia: bpDia ? parseInt(bpDia) : null,
        hr: hr ? parseInt(hr) : null,
        temp: temp ? parseFloat(temp) : null,
        spo2: spo2 ? parseInt(spo2) : null,
        glucose: glucose ? parseInt(glucose) : null,
        weight: weight ? parseFloat(weight) : null,
      },
      nutrition: { breakfast: breakfast ?? null, lunch: lunch ?? null, dinner: dinner ?? null, fluid_ml: fluidMl ? parseInt(fluidMl) : null, appetite: appetite || null },
      continence: { urinary: urinary || null, bowel: bowel || null },
      mood: { level: mood ?? null, activities: activities || null, behavior: behavior || null },
      skin: { integrity: skin || null, description: skinNotes || null },
      notes: notes || null,
    }), { onConflict: 'patient_id,date,shift' })

    if (error) { toast.error('Não foi possível guardar', reportError('care-log-save', error, 'Tenta de novo.')); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    resetForm()
    load()
    } catch (e) {
      toast.error('Não foi possível guardar', reportError('care-log-save', e, 'Verifica a ligação e tenta de novo.'))
    } finally {
      setSaving(false)
    }
  }

  const pat = patients.find(p => p.id === patientId)
  const patientRecords = records.filter(r => r.patient_id === patientId)
  const todayRecords = records.filter(r => r.date === today)
  // Sinais vitais inteligentes (lib/vitalRanges, já usado em /vitals pessoal):
  // avalia cada valor contra o intervalo seguro PARA ESTA pessoa (idade/condições)
  // em vez dos limiares fixos e parciais que existiam aqui (só T.A./febre/SpO₂,
  // sem F.C. nem glicemia, sem ajustar ao idoso/diabético/DPOC).
  const vitalFlags = flagReading(
    { bp_sys: bpSys ? Number(bpSys) : undefined, bp_dia: bpDia ? Number(bpDia) : undefined, hr: hr ? Number(hr) : undefined, temp: temp ? Number(temp) : undefined, spo2: spo2 ? Number(spo2) : undefined, glucose: glucose ? Number(glucose) : undefined },
    { age: pat?.age, conditions: pat?.conditions }
  )

  // ── Registo de cuidados profissional (A4) — documento do processo ────────────
  // Imprime os registos do dia selecionado para o utente escolhido, por turno.
  function recordToPrint(r: CareRecord): PrintRecord {
    const v = r.vitals || {}, n = r.nutrition || {}, c = r.continence || {}, m = r.mood || {}, s = r.skin || {}
    const fields = [
      (v.bp_sys ? { label: 'T.A.', value: `${v.bp_sys}/${v.bp_dia ?? '—'} mmHg` } : null),
      (v.hr ? { label: 'F.C.', value: `${v.hr} bpm` } : null),
      (v.temp ? { label: 'Temp.', value: `${v.temp} ºC` } : null),
      (v.spo2 ? { label: 'SpO₂', value: `${v.spo2}%` } : null),
      (v.glucose ? { label: 'Glicemia', value: `${v.glucose} mg/dL` } : null),
      (v.weight ? { label: 'Peso', value: `${v.weight} kg` } : null),
      (n.appetite ? { label: 'Apetite', value: n.appetite } : null),
      (n.fluid_ml ? { label: 'Líquidos', value: `${n.fluid_ml} ml` } : null),
      (c.urinary ? { label: 'Urinária', value: c.urinary } : null),
      (c.bowel ? { label: 'Intestinal', value: c.bowel } : null),
      (m.level ? { label: 'Humor', value: MOOD_OPTS.find(o => o.v === m.level)?.label || String(m.level) } : null),
      (s.integrity ? { label: 'Pele', value: s.integrity } : null),
    ].filter(Boolean) as { label: string; value: string }[]
    const bullets = [m.behavior, m.activities, s.description, r.notes].filter(Boolean) as string[]
    return {
      title: `Turno ${SHIFTS[r.shift].label} (${SHIFTS[r.shift].hours})`,
      meta: r.recorded_by ? `Registado por: ${r.recorded_by}` : '',
      fields,
      bullets: bullets.length ? bullets : undefined,
    }
  }
  function printDayRecord() {
    if (!pat) return
    const dayRecs = patientRecords.filter(r => r.date === date).sort((a, b) => a.shift.localeCompare(b.shift))
    printDoc({
      docTitle: `Registo de cuidados — ${pat.name}`,
      docSubtitle: new Date(date + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (cfg.hasBeds && pat.room_number ? ` · ${cfg.roomLabel} ${pat.room_number}` : ''),
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      sections: [{
        heading: 'Registos do dia',
        records: dayRecs.length ? dayRecs.map(recordToPrint) : [{ title: 'Sem registos neste dia', body: 'Não há registos de cuidados para a data selecionada.' }],
      }],
      footerNote: 'Registo de cuidados · Phlox · Confidencial · Assinatura: __________________',
    })
  }

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8,
    fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s',
    ...extra,
  })

  return (
    <div className="carelog-tool" style={{ padding: '4px clamp(14px,3vw,28px) 40px', maxWidth: 1120, margin: '0 auto' }}>
      {/* Resumo do dia por turno — só os turnos que ESTA instituição tem.
          (O título da página vem do RegistoDoDia; não repetimos aqui.) */}
      <div className="cl-shifts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
        {shiftsFor(institution).map(s => {
          const sm = SHIFTS[s]
          const count = todayRecords.filter(r => r.shift === s).length
          return (
            <div key={s} style={{ background: sm.bg, border: `1.5px solid ${sm.color}30`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: sm.color }}>{sm.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: sm.color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>registos hoje</div>
            </div>
          )
        })}
        <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Total {cfg.personNounPlural.toLowerCase()}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0b1120', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{patients.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>registados</div>
        </div>
      </div>

      <div className="care-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Context: patient, date, shift, registered by */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, background: '#0b1120', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>1</span>
              Contexto do registo
            </div>
            <div className="cl-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.personNoun} *</label>
                <select value={patientId} onChange={e => setPatientId(e.target.value)} style={{ ...inp(), maxWidth: '100%' }}>
                  <option value="">{`Selecionar ${personLower}...`}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}{cfg.hasBeds && p.room_number ? ` — ${cfg.roomLabel[0]}.${p.room_number}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp()} />
              </div>
            </div>
            {patientId && lastRecord && (
              <button onClick={prefillFromLast} type="button"
                style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ⤵ Copiar do último registo <span style={{ fontWeight: 400, color: '#6b7280' }}>({lastRecord.date}{lastRecord.shift ? ` · ${SHIFTS[lastRecord.shift as Shift]?.label || lastRecord.shift}` : ''})</span>
              </button>
            )}
            <div className="cl-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              {/* Só os turnos desta instituição (o centro de dia não tem noite). */}
              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.hasShifts ? 'Turno' : 'Período'}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {shiftsFor(institution).map(k => {
                    const sm = SHIFTS[k]
                    return (
                      <button key={k} onClick={() => pickShift(k)} style={{ flex: 1, padding: '9px 6px', border: `1.5px solid ${shift === k ? sm.color : '#e5e7eb'}`, borderRadius: 8, background: shift === k ? sm.bg : '#fff', color: shift === k ? sm.color : '#6b7280', fontSize: 12, fontWeight: shift === k ? 700 : 400, cursor: 'pointer' }}>
                        {sm.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registado por</label>
                <input value={recordedBy} onChange={e => setRecordedBy(e.target.value)} placeholder="Nome do profissional" style={inp()} />
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, background: '#dc2626', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>2</span>
              Sinais Vitais
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>T.A. sistólica</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={bpSys} onChange={e => setBpSys(e.target.value)} placeholder="120" min={60} max={250} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>mmHg</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>T.A. diastólica</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={bpDia} onChange={e => setBpDia(e.target.value)} placeholder="80" min={40} max={150} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>mmHg</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Freq. Cardíaca</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={hr} onChange={e => setHr(e.target.value)} placeholder="72" min={30} max={250} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>bpm</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Temperatura</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={temp} onChange={e => setTemp(e.target.value)} placeholder="36.6" step="0.1" min={34} max={42} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>°C</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>SpO₂</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="98" min={50} max={100} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Glicemia</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={glucose} onChange={e => setGlucose(e.target.value)} placeholder="100" min={20} max={600} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>mg/dL</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Peso</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70" step="0.1" min={20} max={200} style={inp({ textAlign: 'center' })} />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>kg</span>
                </div>
              </div>
            </div>
            {vitalFlags.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vitalFlags.map(({ field, reading }) => {
                  const c = VITAL_LEVEL_COLOR[reading.level]
                  return (
                    <div key={field} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: c.color, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
                        {VITAL_LABEL[field]}: {reading.label} <span style={{ fontWeight: 400, color: '#94a3b8' }}>(ref. {reading.range})</span>
                      </div>
                      {reading.watch && <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2, lineHeight: 1.45 }}>{reading.watch}</div>}
                    </div>
                  )
                })}
                <div style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.4 }}>Sinal a partir de intervalos de referência — não é diagnóstico. A avaliação é do profissional.</div>
              </div>
            )}
          </div>

          {/* Nutrition */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, background: '#16a34a', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>3</span>
              Alimentação & Hidratação
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>% Refeição ingerida</div>
              <div className="cl-3col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                {([['Pequeno-almoço', breakfast, setBreakfast], ['Almoço', lunch, setLunch], ['Jantar', dinner, setDinner]] as [string, number | null, (v: number | null) => void][]).map(([label, val, setter]) => (
                  <div key={label as string}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label as string}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[0, 25, 50, 75, 100].map(pct => (
                        <button key={pct} onClick={() => setter(val === pct ? null : pct)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${val === pct ? pctColor(pct) : '#e5e7eb'}`, background: val === pct ? pctColor(pct) + '15' : '#fff', color: val === pct ? pctColor(pct) : '#9ca3af', fontSize: 11, fontWeight: val === pct ? 700 : 400, cursor: 'pointer' }}
                        >{pct}%</button>
                      ))}
                    </div>
                    {val !== null && <div style={{ fontSize: 11, marginTop: 3, color: pctColor(val), fontWeight: 600 }}>{val}% ingerido</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="cl-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Líquidos (mL)</label>
                <input type="number" value={fluidMl} onChange={e => setFluidMl(e.target.value)} placeholder="1500" min={0} max={5000} style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Apetite</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {APPETITE_OPTS.map(o => (
                    <button key={o} onClick={() => setAppetite(appetite === o ? '' : o)}
                      style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1.5px solid ${appetite === o ? '#2563eb' : '#e5e7eb'}`, background: appetite === o ? '#eff6ff' : '#fff', color: appetite === o ? '#2563eb' : '#9ca3af', fontSize: 11, fontWeight: appetite === o ? 600 : 400, cursor: 'pointer' }}
                    >{o}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Continence */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, background: '#0891b2', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>4</span>
              Eliminação
            </div>
            <div className="cl-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Urinária</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {URINARY_OPTS.map(o => (
                    <button key={o} onClick={() => setUrinary(urinary === o ? '' : o)}
                      style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 7, border: `1.5px solid ${urinary === o ? '#0891b2' : '#e5e7eb'}`, background: urinary === o ? '#ecfeff' : '#fff', color: urinary === o ? '#0891b2' : '#374151', fontSize: 13, fontWeight: urinary === o ? 600 : 400, cursor: 'pointer' }}
                    >{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Intestinal</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {BOWEL_OPTS.map(o => (
                    <button key={o} onClick={() => setBowel(bowel === o ? '' : o)}
                      style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 7, border: `1.5px solid ${bowel === o ? '#0891b2' : '#e5e7eb'}`, background: bowel === o ? '#ecfeff' : '#fff', color: bowel === o ? '#0891b2' : '#374151', fontSize: 13, fontWeight: bowel === o ? 600 : 400, cursor: 'pointer' }}
                    >{o}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mood + Skin */}
          <div className="cl-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 20, height: 20, background: '#7c3aed', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>5</span>
                Bem-estar
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {MOOD_OPTS.map(m => (
                  <button key={m.v} onClick={() => setMood(mood === m.v ? null : m.v)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${mood === m.v ? m.color : '#e5e7eb'}`, background: mood === m.v ? m.color + '15' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                  >
                    <span style={{ fontSize: 16 }}>{['😣','😟','😐','🙂','😊'][m.v - 1]}</span>
                    <span style={{ fontSize: 9, color: mood === m.v ? m.color : '#9ca3af', fontWeight: mood === m.v ? 700 : 400 }}>{m.label}</span>
                  </button>
                ))}
              </div>
              <input value={activities} onChange={e => setActivities(e.target.value)} placeholder="Atividades realizadas..." style={inp({ marginBottom: 8 })} />
              <textarea value={behavior} onChange={e => setBehavior(e.target.value)} placeholder="Notas comportamentais..." rows={2} style={{ ...inp(), resize: 'none' }} />
            </div>

            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 20, height: 20, background: '#f59e0b', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>6</span>
                Estado da Pele
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {SKIN_OPTS.map(o => (
                  <button key={o} onClick={() => setSkin(skin === o ? '' : o)}
                    style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 7, border: `1.5px solid ${skin === o ? (o === 'Íntegra' ? '#16a34a' : '#dc2626') : '#e5e7eb'}`, background: skin === o ? (o === 'Íntegra' ? '#f0fdf4' : '#fee2e2') : '#fff', color: skin === o ? (o === 'Íntegra' ? '#16a34a' : '#dc2626') : '#374151', fontSize: 13, fontWeight: skin === o ? 600 : 400, cursor: 'pointer' }}
                  >{o}</button>
                ))}
              </div>
              <textarea value={skinNotes} onChange={e => setSkinNotes(e.target.value)} placeholder="Localização, dimensão, aspeto..." rows={3} style={{ ...inp(), resize: 'none' }} />
            </div>
          </div>

          {/* Notes + Save */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, background: '#374151', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>7</span>
              Notas gerais
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observações adicionais, ocorrências, avisos para o turno seguinte..." style={{ ...inp(), resize: 'vertical', marginBottom: 16 }} />
            <button
              onClick={save}
              disabled={!patientId || saving}
              style={{ width: '100%', padding: '14px 20px', background: !patientId ? '#e5e7eb' : saved ? '#16a34a' : '#0b1120', color: !patientId ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: !patientId ? 'default' : 'pointer', transition: 'background 0.2s' }}
            >
              {saving ? 'A guardar...' : saved ? '✓ Registo guardado' : `Guardar registo — ${pat?.name || `Selecionar ${personLower}`}`}
            </button>
          </div>
        </div>

        {/* History sidebar */}
        <div style={{ position: 'sticky', top: 20, minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16, maxHeight: '85vh', overflowY: 'auto', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {pat ? `Últimos registos — ${pat.name}` : `Selecionar ${personLower} para ver histórico`}
              </div>
              {pat && (
                <button onClick={printDayRecord} title="Imprimir o registo de cuidados deste dia (A4)"
                  style={{ flexShrink: 0, padding: '4px 9px', fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Imprimir</button>
              )}
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>A carregar...</div>
            ) : patientRecords.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                {patientId ? 'Sem registos ainda' : `Seleciona ${cfg.personNounIndef}`}
              </div>
            ) : patientRecords.slice(0, 15).map(r => {
              const s = SHIFTS[r.shift as Shift] || SHIFTS.manha
              const v = r.vitals as any
              return (
                <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                    {r.recorded_by && <span style={{ fontSize: 11, color: '#6b7280' }}>· {r.recorded_by}</span>}
                  </div>
                  {v && (v.bp_sys || v.hr || v.temp) && (
                    <div style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {v.bp_sys && v.bp_dia && <span>TA {v.bp_sys}/{v.bp_dia}</span>}
                      {v.hr && <span>FC {v.hr}bpm</span>}
                      {v.temp && <span>T {v.temp}°C</span>}
                      {v.spo2 && <span>SpO₂ {v.spo2}%</span>}
                    </div>
                  )}
                  {r.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .care-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 620px) {
          .carelog-tool .cl-2col { grid-template-columns: 1fr !important; }
          .carelog-tool .cl-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
