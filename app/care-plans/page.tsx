'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { printDoc, type PrintRecord, type PrintSection } from '@/lib/print'

interface Patient { id: string; name: string; room_number?: string; age?: number }

interface CarePlan {
  id?: string
  patient_id: string
  last_updated: string
  mobility?: string
  hygiene?: string
  nutrition_plan?: string
  skin_care?: string
  fall_prevention: string[]
  pressure_ulcer_prevention: string[]
  medication_notes?: string
  behavioral_notes?: string
  family_visit_schedule?: string
  goals: string[]
  diet_type?: string
  diet_texture?: string
  fluid_restriction: boolean
  fluid_restriction_ml?: number
  positioning_schedule?: string
}

const MOBILITY_OPTIONS = ['Independente', 'Supervisão', 'Ajuda parcial', 'Dependente total', 'Cadeira de rodas', 'Acamado']
const HYGIENE_OPTIONS = ['Independente', 'Supervisão', 'Ajuda parcial', 'Dependente total', 'Banho assistido', 'Banho na cama']
const DIET_TYPES = ['Normal', 'Hipossódica', 'Hipoglicídica', 'Hipoproteica', 'Hipercalórica', 'Vegetariana', 'Diabética', 'Outra']
const DIET_TEXTURES = ['Normal', 'Mole', 'Triturada', 'Liquidificada', 'Pastosa', 'Picada']
const FALL_PREVENTION_OPTIONS = [
  'Grades laterais na cama', 'Calçado antiderrapante', 'Auxiliar de marcha', 'Iluminação noturna',
  'Campanhas ao alcance', 'Tapete antiderrapante WC', 'Supervisão na mobilização', 'Alarme de cama',
  'Barras de apoio WC', 'Avaliação Morse regular',
]
const PU_PREVENTION_OPTIONS = [
  'Mudança de posição cada 2h', 'Colchão anti-escaras', 'Almofada de gel', 'Proteção de calcanhares',
  'Hidratação cutânea diária', 'Vigilância de zonas de pressão', 'Registo de posicionamentos',
  'Avaliação Braden regular', 'Roupa de cama sem pregas', 'Aporte nutricional adequado',
]

const EMPTY_PLAN: Omit<CarePlan, 'patient_id'> = {
  last_updated: new Date().toISOString().slice(0, 10),
  mobility: '',
  hygiene: '',
  nutrition_plan: '',
  skin_care: '',
  fall_prevention: [],
  pressure_ulcer_prevention: [],
  medication_notes: '',
  behavioral_notes: '',
  family_visit_schedule: '',
  goals: [],
  diet_type: '',
  diet_texture: '',
  fluid_restriction: false,
  fluid_restriction_ml: undefined,
  positioning_schedule: '',
}

export default function CarePlansPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [plans, setPlans] = useState<Record<string, CarePlan>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Patient | null>(null)
  const [form, setForm] = useState<CarePlan>({ ...EMPTY_PLAN, patient_id: '' })
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pat }, { data: cp }] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('care_plans').select('*').eq('user_id', user.id),
    ])
    setPatients(pat || [])
    const map: Record<string, CarePlan> = {}
    ;(cp || []).forEach((p: any) => { map[p.patient_id] = p })
    setPlans(map)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const openPlan = (patient: Patient) => {
    setSelected(patient)
    const existing = plans[patient.id]
    if (existing) {
      setForm({
        ...existing,
        fall_prevention: existing.fall_prevention || [],
        pressure_ulcer_prevention: existing.pressure_ulcer_prevention || [],
        goals: existing.goals || [],
      })
    } else {
      setForm({ ...EMPTY_PLAN, patient_id: patient.id, last_updated: new Date().toISOString().slice(0, 10) })
    }
    setSaveOk(false)
    setSaveError('')
  }

  const save = async () => {
    if (!user || !selected) return
    setSaving(true)
    setSaveOk(false)
    setSaveError('')
    try {
      const payload = {
        ...form,
        patient_id: selected.id,
        user_id: user.id,
        last_updated: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }
      const existing = plans[selected.id]
      let err
      if (existing?.id) {
        ({ error: err } = await supabase.from('care_plans').update(payload).eq('id', existing.id).eq('user_id', user.id))
      } else {
        ({ error: err } = await supabase.from('care_plans').insert({ ...payload, created_at: new Date().toISOString() }))
      }
      if (err) throw new Error(err.message)
      setSaveOk(true)
      setPlans(prev => ({ ...prev, [selected.id]: { ...payload, id: existing?.id } }))
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    if (!selected) return
    const p = form
    const sections: PrintSection[] = []

    const autonomyFields = [
      p.mobility && { label: 'Mobilidade', value: p.mobility },
      p.hygiene && { label: 'Higiene', value: p.hygiene },
      p.positioning_schedule && { label: 'Posicionamentos', value: p.positioning_schedule },
    ].filter(Boolean) as { label: string; value: string }[]
    const nutritionFields = [
      p.diet_type && { label: 'Tipo de dieta', value: p.diet_type },
      p.diet_texture && { label: 'Textura', value: p.diet_texture },
      p.fluid_restriction && { label: 'Restrição hídrica', value: p.fluid_restriction_ml ? `${p.fluid_restriction_ml} ml/dia` : 'Sim' },
      p.nutrition_plan && { label: 'Plano nutricional', value: p.nutrition_plan },
    ].filter(Boolean) as { label: string; value: string }[]

    sections.push({ heading: 'Perfil do residente', records: [{
      title: selected.name,
      fields: [
        { label: 'Quarto', value: selected.room_number || '—' },
        { label: 'Idade', value: selected.age ? `${selected.age} anos` : '—' },
        { label: 'Atualizado', value: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) },
      ],
    }] })
    if (autonomyFields.length) sections.push({ heading: 'Mobilidade e autonomia', records: [{ title: 'Avaliação funcional', fields: autonomyFields }] })
    if (nutritionFields.length) sections.push({ heading: 'Alimentação e nutrição', records: [{ title: 'Plano alimentar', fields: nutritionFields }] })
    if (p.fall_prevention.length) sections.push({ heading: 'Prevenção de quedas', records: [{ title: `${p.fall_prevention.length} medidas`, bullets: p.fall_prevention }] })
    if (p.pressure_ulcer_prevention.length) sections.push({ heading: 'Prevenção de úlceras de pressão', records: [{ title: `${p.pressure_ulcer_prevention.length} medidas`, bullets: p.pressure_ulcer_prevention }] })
    const noteRecords: PrintRecord[] = []
    if (p.skin_care) noteRecords.push({ title: 'Cuidados à pele', body: p.skin_care })
    if (p.medication_notes) noteRecords.push({ title: 'Notas de medicação', body: p.medication_notes })
    if (p.behavioral_notes) noteRecords.push({ title: 'Notas comportamentais', body: p.behavioral_notes })
    if (p.family_visit_schedule) noteRecords.push({ title: 'Visitas familiares', body: p.family_visit_schedule })
    if (noteRecords.length) sections.push({ heading: 'Cuidados e notas', records: noteRecords })
    if (p.goals.length) sections.push({ heading: 'Objetivos de cuidado', records: [{ title: `${p.goals.length} objetivos`, bullets: p.goals }] })
    sections.push({ heading: 'Assinaturas', records: [{ title: 'Validação', fields: [
      { label: 'Responsável', value: '' }, { label: 'Diretor Técnico', value: '' }, { label: 'Data de revisão', value: '' },
    ] }] })

    printDoc({
      docTitle: 'Plano Individual de Cuidados',
      docSubtitle: `${selected.name}${selected.room_number ? ' · Quarto ' + selected.room_number : ''}`,
      institution: 'Lar / ERPI',
      sections,
      footerNote: 'Plano individual de cuidados · Phlox',
    })
  }

  const toggle = (field: 'fall_prevention' | 'pressure_ulcer_prevention', value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    setForm(prev => ({ ...prev, goals: [...prev.goals, newGoal.trim()] }))
    setNewGoal('')
  }

  const removeGoal = (i: number) => {
    setForm(prev => ({ ...prev, goals: prev.goals.filter((_, idx) => idx !== i) }))
  }

  const filteredPatients = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.room_number || '').includes(search)
  )

  const hasPlan = (patientId: string) => !!plans[patientId]
  const planCompleteness = (patientId: string): number => {
    const p = plans[patientId]
    if (!p) return 0
    let filled = 0
    const checks = [p.mobility, p.hygiene, p.nutrition_plan, p.skin_care, p.goals?.length > 0, p.diet_type, p.fall_prevention?.length > 0, p.pressure_ulcer_prevention?.length > 0]
    checks.forEach(c => { if (c) filled++ })
    return Math.round((filled / checks.length) * 100)
  }

  if (selected) {
    const completeness = hasPlan(selected.id) ? planCompleteness(selected.id) : 0
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 820 }}>
          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
            <button onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Todos os residentes
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePrint}
                style={{ padding: '8px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding: '8px 20px', background: saving ? 'var(--bg-3)' : saveOk ? '#16a34a' : 'var(--green)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.2s' }}>
                {saving ? 'A guardar...' : saveOk ? '✓ Guardado' : 'Guardar plano'}
              </button>
            </div>
          </div>

          {saveError && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{saveError}</div>}

          {/* Resident header */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, margin: '0 0 4px' }}>{selected.name}</h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                {selected.room_number ? `Quarto ${selected.room_number}` : 'Sem quarto definido'}
                {selected.age ? ` · ${selected.age} anos` : ''}
              </div>
            </div>
            {hasPlan(selected.id) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Completude</div>
                <div style={{ width: 80, height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${completeness}%`, background: completeness >= 80 ? '#16a34a' : completeness >= 50 ? '#ca8a04' : '#dc2626', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: completeness >= 80 ? '#16a34a' : completeness >= 50 ? '#ca8a04' : '#dc2626' }}>{completeness}%</div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Mobility & Hygiene */}
            <Section title="Mobilidade e Autonomia" icon="🚶">
              <Field label="Nível de mobilidade">
                <Select value={form.mobility || ''} onChange={v => setForm(p => ({ ...p, mobility: v }))} options={['', ...MOBILITY_OPTIONS]} />
              </Field>
              <Field label="Higiene pessoal">
                <Select value={form.hygiene || ''} onChange={v => setForm(p => ({ ...p, hygiene: v }))} options={['', ...HYGIENE_OPTIONS]} />
              </Field>
              <Field label="Posicionamentos programados">
                <Textarea value={form.positioning_schedule || ''} onChange={v => setForm(p => ({ ...p, positioning_schedule: v }))} placeholder="Ex: Decúbito lateral esq. 10h, Fowler 12h..." />
              </Field>
            </Section>

            {/* Nutrition */}
            <Section title="Alimentação e Nutrição" icon="🍽️">
              <Field label="Tipo de dieta">
                <Select value={form.diet_type || ''} onChange={v => setForm(p => ({ ...p, diet_type: v }))} options={['', ...DIET_TYPES]} />
              </Field>
              <Field label="Textura">
                <Select value={form.diet_texture || ''} onChange={v => setForm(p => ({ ...p, diet_texture: v }))} options={['', ...DIET_TEXTURES]} />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" id="fr" checked={form.fluid_restriction} onChange={e => setForm(p => ({ ...p, fluid_restriction: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: '#3b82f6' }} />
                <label htmlFor="fr" style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>Restrição hídrica</label>
              </div>
              {form.fluid_restriction && (
                <Field label="Limite (ml/dia)">
                  <input type="number" value={form.fluid_restriction_ml || ''} onChange={e => setForm(p => ({ ...p, fluid_restriction_ml: parseInt(e.target.value) || undefined }))}
                    placeholder="Ex: 1500" style={inputSt} />
                </Field>
              )}
              <Field label="Plano nutricional / observações">
                <Textarea value={form.nutrition_plan || ''} onChange={v => setForm(p => ({ ...p, nutrition_plan: v }))} placeholder="Suplementação, preferências, alergias alimentares..." />
              </Field>
            </Section>

            {/* Fall prevention */}
            <Section title="Prevenção de Quedas" icon="🛡️">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FALL_PREVENTION_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => toggle('fall_prevention', opt)}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: form.fall_prevention.includes(opt) ? 700 : 400, background: form.fall_prevention.includes(opt) ? '#dbeafe' : 'var(--bg-2)', color: form.fall_prevention.includes(opt) ? '#1d4ed8' : 'var(--ink-3)', border: `1.5px solid ${form.fall_prevention.includes(opt) ? '#93c5fd' : 'var(--border)'}`, transition: 'all 0.1s' }}>
                    {form.fall_prevention.includes(opt) ? '✓ ' : ''}{opt}
                  </button>
                ))}
              </div>
            </Section>

            {/* Pressure ulcer prevention */}
            <Section title="Prevenção de Úlceras de Pressão" icon="🩹">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PU_PREVENTION_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => toggle('pressure_ulcer_prevention', opt)}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: form.pressure_ulcer_prevention.includes(opt) ? 700 : 400, background: form.pressure_ulcer_prevention.includes(opt) ? '#fef3c7' : 'var(--bg-2)', color: form.pressure_ulcer_prevention.includes(opt) ? '#92400e' : 'var(--ink-3)', border: `1.5px solid ${form.pressure_ulcer_prevention.includes(opt) ? '#fde68a' : 'var(--border)'}`, transition: 'all 0.1s' }}>
                    {form.pressure_ulcer_prevention.includes(opt) ? '✓ ' : ''}{opt}
                  </button>
                ))}
              </div>
            </Section>

            {/* Skin care */}
            <Section title="Cuidados à Pele" icon="💆">
              <Field label="Protocolo de cuidados à pele">
                <Textarea value={form.skin_care || ''} onChange={v => setForm(p => ({ ...p, skin_care: v }))} placeholder="Hidratação, feridas ativas, zonas de risco..." rows={4} />
              </Field>
            </Section>

            {/* Behavioral */}
            <Section title="Notas Comportamentais" icon="🧠">
              <Field label="Comportamento, humor, socialização">
                <Textarea value={form.behavioral_notes || ''} onChange={v => setForm(p => ({ ...p, behavioral_notes: v }))} placeholder="Preferências, rotinas, como gerir agitação, interesses..." rows={4} />
              </Field>
            </Section>

            {/* Medication notes */}
            <Section title="Notas de Medicação" icon="💊">
              <Field label="Alertas e observações de medicação">
                <Textarea value={form.medication_notes || ''} onChange={v => setForm(p => ({ ...p, medication_notes: v }))} placeholder="Dificuldade de deglutição, alergia, horários especiais..." rows={3} />
              </Field>
            </Section>

            {/* Family visits */}
            <Section title="Visitas e Família" icon="👨‍👩‍👧">
              <Field label="Horário de visitas familiares">
                <Textarea value={form.family_visit_schedule || ''} onChange={v => setForm(p => ({ ...p, family_visit_schedule: v }))} placeholder="Ex: Sábados 14h-17h (filha Maria). Autorizado pernoite..." rows={3} />
              </Field>
            </Section>

            {/* Goals — full width */}
            <div style={{ gridColumn: '1/-1', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <SectionTitle icon="🎯" title="Objetivos de Cuidado" />
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newGoal} onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGoal() } }}
                  placeholder="Adicionar objetivo (ex: Manter autonomia na higiene oral)..."
                  style={{ ...inputSt, flex: 1 }} />
                <button onClick={addGoal}
                  style={{ padding: '9px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                  + Adicionar
                </button>
              </div>
              {form.goals.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: '12px 0' }}>Nenhum objetivo definido</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.goals.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '8px 12px' }}>
                      <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{g}</span>
                      <button onClick={() => removeGoal(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#dc2626', padding: '0 2px', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 32 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body">

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Lar · Cuidados</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Planos Individuais de Cuidados</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', maxWidth: 560, lineHeight: 1.6 }}>Plano de cuidados personalizado por residente. Documento oficial para a equipa e para a ACSS.</p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: patients.length, color: 'var(--ink)', bg: 'white' },
            { label: 'Com plano', value: Object.keys(plans).length, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Sem plano', value: patients.length - Object.keys(plans).length, color: '#dc2626', bg: '#fef2f2' },
            { label: '≥80% completo', value: patients.filter(p => planCompleteness(p.id) >= 80).length, color: '#1d4ed8', bg: '#eff6ff' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--border)', borderRadius: 9, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
            </div>
          ))}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar residente ou quarto..."
          style={{ width: '100%', maxWidth: 380, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 16 }} />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
            {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />)}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>Sem residentes</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6 }}>Adiciona residentes em <strong>Residentes</strong> primeiro.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 10 }}>
            {filteredPatients.map(patient => {
              const has = hasPlan(patient.id)
              const pct = has ? planCompleteness(patient.id) : 0
              const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626'
              return (
                <div key={patient.id} onClick={() => openPlan(patient)}
                  style={{ background: 'white', border: `1.5px solid ${has ? 'var(--border)' : '#fca5a5'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{patient.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                        {patient.room_number ? `Q ${patient.room_number}` : 'Sem quarto'}
                        {patient.age ? ` · ${patient.age}a` : ''}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: has ? '#f0fdf4' : '#fee2e2', color: has ? '#16a34a' : '#dc2626', border: `1px solid ${has ? '#bbf7d0' : '#fca5a5'}` }}>
                      {has ? 'Com plano' : 'Sem plano'}
                    </span>
                  </div>
                  {has && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Completude</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: barColor }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                      </div>
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

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <SectionTitle icon={icon} title={title} />
      {children}
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', background: 'white', color: 'var(--ink)', outline: 'none' }}>
      {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
    </select>
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', lineHeight: 1.5 }} />
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px',
  fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
}
