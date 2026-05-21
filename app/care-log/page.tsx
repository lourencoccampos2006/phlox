'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

type ShiftType = 'morning' | 'afternoon' | 'night'
type MoodLevel = 1 | 2 | 3 | 4 | 5
type AppetiteLevel = 'good' | 'fair' | 'poor' | 'refused'
type ContinenceUrinary = 'normal' | 'incontinence' | 'catheter' | 'retention'
type ContinenceBowel = 'normal' | 'constipation' | 'diarrhea' | 'none'
type SkinIntegrity = 'intact' | 'redness' | 'wound' | 'ulcer'

interface Patient { id: string; name: string; age?: number }

interface CareRecord {
  id: string; patient_id: string; patient_name?: string
  date: string; shift: ShiftType; recorded_by?: string
  bp_systolic?: number; bp_diastolic?: number; heart_rate?: number
  temperature?: number; spo2?: number; weight?: number; glucose?: number
  breakfast_pct?: number; lunch_pct?: number; dinner_pct?: number
  fluid_ml?: number; appetite?: AppetiteLevel
  urinary?: ContinenceUrinary; bowel?: ContinenceBowel
  mood?: MoodLevel; behavior_notes?: string
  skin?: SkinIntegrity; skin_notes?: string
  activities?: string; notes?: string
  created_at: string
}

const SHIFT_META: Record<ShiftType, { label: string; icon: string; hours: string; color: string }> = {
  morning:   { label: 'Manhã',  icon: '🌅', hours: '08:00–16:00', color: '#d97706' },
  afternoon: { label: 'Tarde',  icon: '🌆', hours: '16:00–00:00', color: '#7c3aed' },
  night:     { label: 'Noite',  icon: '🌙', hours: '00:00–08:00', color: '#0284c7' },
}

const MOOD_META: Record<number, { label: string; icon: string; color: string }> = {
  1: { label: 'Muito agitado', icon: '😣', color: '#dc2626' },
  2: { label: 'Ansioso',       icon: '😟', color: '#d97706' },
  3: { label: 'Neutro',        icon: '😐', color: '#64748b' },
  4: { label: 'Bem-disposto',  icon: '🙂', color: '#0284c7' },
  5: { label: 'Muito bem',     icon: '😊', color: '#16a34a' },
}

function getShiftFromHour(): ShiftType {
  const h = new Date().getHours()
  if (h >= 8 && h < 16) return 'morning'
  if (h >= 16) return 'afternoon'
  return 'night'
}

const BLANK: Omit<CareRecord, 'id' | 'patient_id' | 'patient_name' | 'created_at'> = {
  date: new Date().toISOString().slice(0, 10),
  shift: getShiftFromHour(),
  recorded_by: '',
  bp_systolic: undefined, bp_diastolic: undefined, heart_rate: undefined,
  temperature: undefined, spo2: undefined, weight: undefined, glucose: undefined,
  breakfast_pct: undefined, lunch_pct: undefined, dinner_pct: undefined,
  fluid_ml: undefined, appetite: undefined,
  urinary: undefined, bowel: undefined,
  mood: undefined, behavior_notes: '',
  skin: undefined, skin_notes: '',
  activities: '', notes: '',
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }

function VitalInput({ label, value, unit, onChange, step, min, max, placeholder }: { label: string; value?: number; unit: string; onChange: (v: number | undefined) => void; step?: string; min?: number; max?: number; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number" step={step || '1'} min={min} max={max}
          value={value ?? ''} placeholder={placeholder || '—'}
          onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
          style={{ ...inputStyle, minHeight: 42 }}
        />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  )
}

function PctSlider({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  const pct = value ?? 0
  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={labelStyle}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value !== undefined ? `${value}%` : '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[0, 25, 50, 75, 100].map(v => (
          <button key={v} onClick={() => onChange(v === value ? undefined : v)}
            style={{ flex: 1, minWidth: 44, padding: '8px 4px', border: `2px solid ${value === v ? color : '#e2e8f0'}`, borderRadius: 8, background: value === v ? color + '18' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: value === v ? 700 : 400, color: value === v ? color : '#64748b', fontFamily: 'inherit', transition: 'all 0.1s' }}>
            {v}%
          </button>
        ))}
      </div>
    </div>
  )
}

type RecordTab = 'vitals' | 'nutrition' | 'continence' | 'mood' | 'skin' | 'notes'

export default function CareLogPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<CareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [activeTab, setActiveTab] = useState<RecordTab>('vitals')
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, r] = await Promise.all([
      supabase.from('patients').select('id, name, age').eq('user_id', user.id).order('name'),
      supabase.from('care_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ])
    if (p.data) setPatients(p.data)
    if (r.data) setRecords(r.data)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!user || !patientId) return
    setSaving(true)
    const pat = patients.find(p => p.id === patientId)
    await supabase.from('care_records').insert({
      ...form,
      user_id: user.id,
      patient_id: patientId,
      patient_name: pat?.name || '',
    })
    setSaving(false)
    setForm({ ...BLANK, date: form.date, shift: form.shift, recorded_by: form.recorded_by })
    load()
  }

  const patientRecords = records.filter(r => r.patient_id === patientId).slice(0, 20)
  const todayCount = records.filter(r => r.date === new Date().toISOString().slice(0,10)).length

  const TABS: { key: RecordTab; label: string; icon: string }[] = [
    { key: 'vitals',     label: 'Sinais Vitais',  icon: '❤️' },
    { key: 'nutrition',  label: 'Nutrição',        icon: '🍽️' },
    { key: 'continence', label: 'Continência',     icon: '💧' },
    { key: 'mood',       label: 'Bem-estar',       icon: '😊' },
    { key: 'skin',       label: 'Pele',            icon: '🩹' },
    { key: 'notes',      label: 'Notas',           icon: '📝' },
  ]

  const sh = SHIFT_META[form.shift]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>

      {/* Page header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link href="/cockpit" style={{ color: '#475569', textDecoration: 'none' }}>Cockpit</Link>
            <span>›</span><span style={{ color: '#94a3b8' }}>Registos Diários</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Registos Diários de Cuidados</h1>
              <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 13 }}>Sinais vitais · Nutrição · Continência · Bem-estar · Pele</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Registos hoje', value: todayCount },
                { label: 'Total', value: records.length },
                { label: 'Residentes', value: new Set(records.map(r => r.patient_id)).size },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>A carregar…</div>
        ) : (
          <div className="care-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

            {/* LEFT: Form */}
            <div>
              {/* Record controls */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 14 }}>
                <div className="care-controls" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Residente</label>
                    <select style={{ ...inputStyle, minHeight: 44 }} value={patientId} onChange={e => setPatientId(e.target.value)}>
                      <option value="">Seleccionar residente…</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Data</label>
                    <input style={{ ...inputStyle, minHeight: 44 }} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Turno</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(Object.keys(SHIFT_META) as ShiftType[]).map(k => {
                        const sm = SHIFT_META[k]; const active = form.shift === k
                        return (
                          <button key={k} onClick={() => setForm(f => ({ ...f, shift: k }))}
                            style={{ padding: '10px 12px', border: `2px solid ${active ? sm.color : '#e2e8f0'}`, borderRadius: 8, background: active ? sm.color + '15' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, color: active ? sm.color : '#64748b', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 44 }}>
                            {sm.icon} {sm.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Registado por</label>
                    <input style={{ ...inputStyle, minHeight: 44 }} value={form.recorded_by || ''} onChange={e => setForm(f => ({ ...f, recorded_by: e.target.value }))} placeholder="Nome do profissional" />
                  </div>
                </div>
              </div>

              {/* Section tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto' }}>
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ padding: '8px 14px', border: `1.5px solid ${activeTab === t.key ? '#1d4ed8' : '#e2e8f0'}`, borderRadius: 8, background: activeTab === t.key ? '#1d4ed818' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.key ? 700 : 400, color: activeTab === t.key ? '#1d4ed8' : '#64748b', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 40, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>

              {/* Section content */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' }}>

                {activeTab === 'vitals' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Sinais Vitais</div>
                    <div className="care-vitals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Pressão Arterial</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="number" min={60} max={250} value={form.bp_systolic ?? ''} placeholder="120" onChange={e => setForm(f => ({ ...f, bp_systolic: e.target.value ? parseInt(e.target.value) : undefined }))} style={{ ...inputStyle, minHeight: 42 }} />
                          <span style={{ color: '#94a3b8', fontSize: 16, flexShrink: 0 }}>/</span>
                          <input type="number" min={40} max={150} value={form.bp_diastolic ?? ''} placeholder="80" onChange={e => setForm(f => ({ ...f, bp_diastolic: e.target.value ? parseInt(e.target.value) : undefined }))} style={{ ...inputStyle, minHeight: 42 }} />
                          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>mmHg</span>
                        </div>
                        {form.bp_systolic && form.bp_diastolic && (
                          <div style={{ fontSize: 11, marginTop: 4, color: form.bp_systolic >= 140 ? '#dc2626' : form.bp_systolic < 90 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                            {form.bp_systolic >= 140 ? '⚠ Hipertensão' : form.bp_systolic < 90 ? '⚠ Hipotensão' : '✓ Normal'}
                          </div>
                        )}
                      </div>
                      <VitalInput label="Freq. Cardíaca" value={form.heart_rate} unit="bpm" min={30} max={250} onChange={v => setForm(f => ({ ...f, heart_rate: v }))} />
                      <VitalInput label="Temperatura" value={form.temperature} unit="°C" step="0.1" min={34} max={42} onChange={v => setForm(f => ({ ...f, temperature: v }))} />
                      <VitalInput label="SpO₂" value={form.spo2} unit="%" min={50} max={100} onChange={v => setForm(f => ({ ...f, spo2: v }))} />
                      <VitalInput label="Glicemia" value={form.glucose} unit="mg/dL" min={20} max={600} onChange={v => setForm(f => ({ ...f, glucose: v }))} />
                      <VitalInput label="Peso" value={form.weight} unit="kg" step="0.1" min={20} max={200} onChange={v => setForm(f => ({ ...f, weight: v }))} />
                    </div>
                    {/* Alert flags */}
                    {((form.temperature ?? 0) >= 37.8 || (form.spo2 ?? 100) < 94 || (form.glucose ?? 80) > 250 || (form.glucose ?? 80) < 70) && (
                      <div style={{ marginTop: 14, padding: '12px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626', marginBottom: 4 }}>⚠ Atenção — Valores alterados</div>
                        <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.6 }}>
                          {(form.temperature ?? 0) >= 37.8 && <div>Temperatura {form.temperature}°C — febre confirmada (&ge;37,8°C)</div>}
                          {(form.spo2 ?? 100) < 94 && <div>SpO₂ {form.spo2}% — abaixo do valor de referência (&lt;94%)</div>}
                          {(form.glucose ?? 80) > 250 && <div>Glicemia {form.glucose} mg/dL — hiperglicemia significativa</div>}
                          {(form.glucose ?? 80) < 70 && <div>Glicemia {form.glucose} mg/dL — hipoglicemia (&lt;70 mg/dL)</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'nutrition' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Nutrição e Hidratação</div>
                    <div className="care-nut-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                      <PctSlider label="Pequeno-almoço" value={form.breakfast_pct} onChange={v => setForm(f => ({ ...f, breakfast_pct: v }))} />
                      <PctSlider label="Almoço" value={form.lunch_pct} onChange={v => setForm(f => ({ ...f, lunch_pct: v }))} />
                      <PctSlider label="Jantar" value={form.dinner_pct} onChange={v => setForm(f => ({ ...f, dinner_pct: v }))} />
                    </div>
                    <div className="care-nut-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <VitalInput label="Ingestão hídrica" value={form.fluid_ml} unit="mL" min={0} max={5000} onChange={v => setForm(f => ({ ...f, fluid_ml: v }))} />
                      <div>
                        <label style={labelStyle}>Apetite</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([['good','Bom','#16a34a'],['fair','Razoável','#d97706'],['poor','Fraco','#dc2626'],['refused','Recusou','#7f1d1d']] as const).map(([v, l, c]) => {
                            const active = form.appetite === v
                            return (
                              <button key={v} onClick={() => setForm(f => ({ ...f, appetite: v }))}
                                style={{ flex: 1, padding: '10px 6px', border: `2px solid ${active ? c : '#e2e8f0'}`, borderRadius: 8, background: active ? c + '15' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400, color: active ? c : '#64748b', fontFamily: 'inherit', minHeight: 44 }}>
                                {l}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'continence' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Continência</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <label style={labelStyle}>Função urinária</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {([['normal','Normal','#16a34a'],['incontinence','Incontinência','#d97706'],['catheter','Algaliado','#0284c7'],['retention','Retenção','#dc2626']] as const).map(([v,l,c]) => {
                            const active = form.urinary === v
                            return (
                              <button key={v} onClick={() => setForm(f => ({ ...f, urinary: v }))}
                                style={{ width: '100%', padding: '11px 14px', border: `2px solid ${active ? c : '#e2e8f0'}`, borderRadius: 8, background: active ? c + '12' : '#f8fafc', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, color: active ? c : '#374151', fontFamily: 'inherit', textAlign: 'left', minHeight: 44 }}>
                                {active ? '◉' : '○'} {l}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Função intestinal</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {([['normal','Normal','#16a34a'],['constipation','Obstipação','#d97706'],['diarrhea','Diarreia','#dc2626'],['none','Sem registo','#64748b']] as const).map(([v,l,c]) => {
                            const active = form.bowel === v
                            return (
                              <button key={v} onClick={() => setForm(f => ({ ...f, bowel: v }))}
                                style={{ width: '100%', padding: '11px 14px', border: `2px solid ${active ? c : '#e2e8f0'}`, borderRadius: 8, background: active ? c + '12' : '#f8fafc', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, color: active ? c : '#374151', fontFamily: 'inherit', textAlign: 'left', minHeight: 44 }}>
                                {active ? '◉' : '○'} {l}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'mood' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Bem-estar e Comportamento</div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={labelStyle}>Estado de humor</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([1,2,3,4,5] as MoodLevel[]).map(v => {
                          const m = MOOD_META[v]; const active = form.mood === v
                          return (
                            <button key={v} onClick={() => setForm(f => ({ ...f, mood: v }))}
                              style={{ flex: 1, padding: '12px 8px', border: `2px solid ${active ? m.color : '#e2e8f0'}`, borderRadius: 10, background: active ? m.color + '15' : '#fff', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                              <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                              <div style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? m.color : '#64748b', lineHeight: 1.2 }}>{m.label}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Actividades realizadas</label>
                      <input style={{ ...inputStyle, minHeight: 42, marginBottom: 12 }} value={form.activities || ''} onChange={e => setForm(f => ({ ...f, activities: e.target.value }))} placeholder="Ex: Fisioterapia, animação, visita familiar, caminhada…" />
                    </div>
                    <div>
                      <label style={labelStyle}>Observações comportamentais</label>
                      <textarea style={{ ...inputStyle, height: 80, resize: 'vertical' } as React.CSSProperties} value={form.behavior_notes || ''} onChange={e => setForm(f => ({ ...f, behavior_notes: e.target.value }))} placeholder="Agitação, recusa de cuidados, comunicação, socialização…" />
                    </div>
                  </div>
                )}

                {activeTab === 'skin' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Integridade da Pele</div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Estado da pele</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {([
                          ['intact',   'Íntegra',           '#16a34a', 'Sem lesões visíveis'],
                          ['redness',  'Eritema / Rubor',   '#d97706', 'Área vermelha sem perda de integridade'],
                          ['wound',    'Ferida',            '#dc2626', 'Lesão cutânea (ferida, abrasão)'],
                          ['ulcer',    'Úlcera de pressão', '#7f1d1d', 'Úlcera por pressão — grau a definir'],
                        ] as const).map(([v,l,c,d]) => {
                          const active = form.skin === v
                          return (
                            <button key={v} onClick={() => setForm(f => ({ ...f, skin: v }))}
                              style={{ padding: '12px 14px', border: `2px solid ${active ? c : '#e2e8f0'}`, borderRadius: 10, background: active ? c + '12' : '#f8fafc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: active ? c : '#374151', marginBottom: 2 }}>{active ? '◉' : '○'} {l}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{d}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Localização e descrição</label>
                      <textarea style={{ ...inputStyle, height: 80, resize: 'vertical' } as React.CSSProperties} value={form.skin_notes || ''} onChange={e => setForm(f => ({ ...f, skin_notes: e.target.value }))} placeholder="Ex: Úlcera grau II no sacro 3cm×2cm; eritema no calcanhar direito…" />
                    </div>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Notas de Enfermagem / Cuidado</div>
                    <textarea
                      style={{ ...inputStyle, height: 200, resize: 'vertical' } as React.CSSProperties}
                      value={form.notes || ''}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Observações gerais do turno, intercorrências, comunicações à família, decisões tomadas…"
                    />
                  </div>
                )}
              </div>

              {/* Save */}
              <button onClick={save} disabled={saving || !patientId}
                style={{ marginTop: 14, width: '100%', padding: '14px', background: saving ? '#94a3b8' : (!patientId ? '#e2e8f0' : '#1d4ed8'), color: (!patientId || saving) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, cursor: (!patientId || saving) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' }}>
                {saving ? 'A guardar…' : `Guardar registo — ${sh.icon} Turno ${sh.label} · ${form.date}`}
              </button>
            </div>

            {/* RIGHT: Recent records */}
            <div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', position: 'sticky', top: 76 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Registos Recentes</div>
                  {patientId && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{patients.find(p => p.id === patientId)?.name}</div>}
                </div>
                <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                  {(patientId ? patientRecords : records.slice(0, 20)).length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 13 }}>Sem registos{patientId ? ' para este residente' : ''}.</div>
                    </div>
                  ) : (patientId ? patientRecords : records.slice(0, 20)).map(r => {
                    const sm = SHIFT_META[r.shift as ShiftType] || SHIFT_META.morning
                    return (
                      <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.date}</div>
                          <span style={{ fontSize: 11, color: sm.color, fontWeight: 600 }}>{sm.icon} {sm.label}</span>
                        </div>
                        {!patientId && r.patient_name && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{r.patient_name}</div>}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {r.bp_systolic && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#374151', padding: '1px 7px', borderRadius: 6 }}>{r.bp_systolic}/{r.bp_diastolic} mmHg</span>}
                          {r.temperature && <span style={{ fontSize: 11, background: (r.temperature >= 37.8) ? '#fee2e2' : '#f1f5f9', color: (r.temperature >= 37.8) ? '#dc2626' : '#374151', padding: '1px 7px', borderRadius: 6 }}>{r.temperature}°C</span>}
                          {r.spo2 && <span style={{ fontSize: 11, background: r.spo2 < 94 ? '#fee2e2' : '#f1f5f9', color: r.spo2 < 94 ? '#dc2626' : '#374151', padding: '1px 7px', borderRadius: 6 }}>{r.spo2}%</span>}
                          {r.glucose && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#374151', padding: '1px 7px', borderRadius: 6 }}>GL {r.glucose}</span>}
                          {r.mood && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 6, background: '#f1f5f9' }}>{MOOD_META[r.mood]?.icon}</span>}
                        </div>
                        {r.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <style>{`
        @media(max-width:900px){
          .care-layout{grid-template-columns:1fr!important}
          .care-controls{grid-template-columns:1fr 1fr!important}
          .care-vitals-grid{grid-template-columns:1fr 1fr!important}
          .care-nut-grid{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:640px){
          .care-controls{grid-template-columns:1fr!important}
          .care-vitals-grid{grid-template-columns:1fr 1fr!important}
          .care-nut-grid{grid-template-columns:1fr!important}
          .care-nut-row{grid-template-columns:1fr!important}
        }
        input:focus,textarea:focus,select:focus{border-color:#1d4ed8!important;outline:none;box-shadow:0 0 0 3px #1d4ed818}
      `}</style>
    </div>
  )
}
