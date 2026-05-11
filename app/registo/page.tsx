'use client'

// ─── PHLOX REGISTO DE SAÚDE ──────────────────────────────────────────────────
// O repositório central de memória clínica de um perfil.
// Análises, vacinas, documentos, parâmetros vitais — tudo num só lugar.
// Nunca mais procurar a folha A4 da última análise de sangue.
// Importa de PDF, foto, ou registo manual. Guarda para sempre.

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type Section = 'labs' | 'vaccines' | 'vitals' | 'documents'
type Profile = { id: string; name: string; type: 'self' | 'family' | 'patient' }

interface LabRecord {
  id: string; date: string; lab_name: string | null
  values: { name: string; value: string; unit: string; status: string; reference: string }[]
  ai_summary: string | null; flags: string[] | null; profile_name: string | null
}

interface VaccineRecord {
  id: string; vaccine_name: string; date_given: string | null
  next_due: string | null; dose_number: number | null; notes: string | null; profile_name: string | null
}

interface VitalRecord {
  id: string; date: string; vital_type: string
  value_1: number | null; value_2: number | null; unit: string | null; notes: string | null
}

interface HealthDoc {
  id: string; date: string | null; doc_type: string; title: string
  issuer: string | null; specialty: string | null; summary: string | null; profile_name: string | null
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  NORMAL:        { color: '#0d6e42', bg: '#d1fae5', label: 'Normal' },
  ALTO:          { color: '#b45309', bg: '#fef9c3', label: 'Alto' },
  BAIXO:         { color: '#1d4ed8', bg: '#eff6ff', label: 'Baixo' },
  CRITICO_ALTO:  { color: '#991b1b', bg: '#fee2e2', label: 'Crítico ↑' },
  CRITICO_BAIXO: { color: '#991b1b', bg: '#fee2e2', label: 'Crítico ↓' },
}

const VITAL_TYPES = [
  { id: 'bp',      label: 'Tensão Arterial',    unit: 'mmHg',  placeholder: '120 / 80',    dual: true },
  { id: 'hr',      label: 'Frequência Cardíaca', unit: 'bpm',   placeholder: '72',          dual: false },
  { id: 'glucose', label: 'Glicemia',            unit: 'mg/dL', placeholder: '95',          dual: false },
  { id: 'weight',  label: 'Peso',                unit: 'kg',    placeholder: '70.5',        dual: false },
  { id: 'spo2',    label: 'SpO2',                unit: '%',     placeholder: '98',          dual: false },
  { id: 'temp',    label: 'Temperatura',          unit: '°C',    placeholder: '36.8',        dual: false },
]

const DOC_TYPES = [
  { id: 'prescription', label: 'Receita médica' },
  { id: 'report',       label: 'Relatório médico' },
  { id: 'exam',         label: 'Exame (análise/imagem)' },
  { id: 'discharge',    label: 'Nota de alta' },
  { id: 'referral',     label: 'Carta de referenciação' },
  { id: 'other',        label: 'Outro documento' },
]

function SectionTab({ id, label, count, active, onClick }: { id: Section; label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: active ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: -1, whiteSpace: 'nowrap' }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? 'var(--ink)' : 'var(--ink-4)' }}>({count})</span>
      )}
    </button>
  )
}

export default function RegistoPage() {
  const { user, supabase } = useAuth()
  const [section, setSection] = useState<Section>('labs')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [labs, setLabs] = useState<LabRecord[]>([])
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([])
  const [vitals, setVitals] = useState<VitalRecord[]>([])
  const [docs, setDocs] = useState<HealthDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // New vital form
  const [newVital, setNewVital] = useState({ type: 'bp', v1: '', v2: '', notes: '', date: new Date().toISOString().split('T')[0] })
  // New vaccine form
  const [newVax, setNewVax] = useState({ name: '', date_given: new Date().toISOString().split('T')[0], next_due: '', dose: '', notes: '' })
  // New doc form
  const [newDoc, setNewDoc] = useState({ type: 'report', title: '', date: '', issuer: '', specialty: '', summary: '' })

  // Load profiles (self + family + patients)
  useEffect(() => {
    if (!user) return
    const selfProfile: Profile = { id: 'self', name: user.name || user.email || 'Eu', type: 'self' }
    setProfiles([selfProfile])
    setSelectedProfile(selfProfile)

    Promise.all([
      supabase.from('family_profiles').select('id, name').eq('user_id', user.id),
      supabase.from('patients').select('id, name').eq('user_id', user.id),
    ]).then(([{ data: fam }, { data: pat }]) => {
      const all: Profile[] = [
        selfProfile,
        ...(fam || []).map((f: any) => ({ id: f.id, name: f.name, type: 'family' as const })),
        ...(pat || []).map((p: any) => ({ id: p.id, name: p.name, type: 'patient' as const })),
      ]
      setProfiles(all)
    })
  }, [user, supabase])

  const load = useCallback(async () => {
    if (!user || !selectedProfile) return
    setLoading(true)
    const pid = selectedProfile.id === 'self' ? null : selectedProfile.id
    const pidFilter = pid ? { profile_id: pid } : { profile_id: null }

    const [{ data: labData }, { data: vaxData }, { data: vitalData }, { data: docData }] = await Promise.all([
      supabase.from('lab_records').select('*').eq('user_id', user.id)
        .is('profile_id', pid).order('date', { ascending: false }).limit(50),
      supabase.from('vaccine_records').select('*').eq('user_id', user.id)
        .is('profile_id', pid).order('date_given', { ascending: false }).limit(50),
      supabase.from('vital_records').select('*').eq('user_id', user.id)
        .is('profile_id', pid).order('date', { ascending: false }).limit(100),
      supabase.from('health_documents').select('*').eq('user_id', user.id)
        .is('profile_id', pid).order('date', { ascending: false }).limit(50),
    ])

    setLabs(labData || [])
    setVaccines(vaxData || [])
    setVitals(vitalData || [])
    setDocs(docData || [])
    setLoading(false)
  }, [user, supabase, selectedProfile])

  useEffect(() => { load() }, [load])

  // Import labs from PDF/text using AI
  const importLabs = async (text: string) => {
    if (!user || !text.trim()) return
    setImporting(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ text, profile: selectedProfile }),
      })
      const data = await res.json()
      if (data.values && data.values.length > 0) {
        const pid = selectedProfile?.id === 'self' ? null : selectedProfile?.id
        await supabase.from('lab_records').insert({
          user_id: user.id,
          profile_id: pid || null,
          profile_name: selectedProfile?.name || null,
          date: data.date || new Date().toISOString().split('T')[0],
          lab_name: data.lab_name || null,
          values: data.values,
          ai_summary: data.summary || null,
          flags: data.flags || [],
          source: 'import',
          raw_text: text.slice(0, 5000),
        })
        await load()
      }
    } catch {}
    setImporting(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let text = ''
      if (file.type === 'application/pdf') {
        // For PDFs, read as base64 and send to AI for extraction
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        const base64 = btoa(binary)
        // Send to labs API with pdf flag
        const { data: sd } = await supabase.auth.getSession()
        const res = await fetch('/api/labs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
          body: JSON.stringify({ pdf_base64: base64, mode: 'labs', source: section === 'labs' ? 'pdf' : 'import' }),
        })
        const data = await res.json()
        if (data.values?.length) {
          const pid = selectedProfile?.id === 'self' ? null : selectedProfile?.id
          await supabase.from('lab_records').insert({
            user_id: user?.id, profile_id: pid || null,
            profile_name: selectedProfile?.name || null,
            date: data.date || new Date().toISOString().split('T')[0],
            lab_name: data.lab_name || file.name.replace('.pdf', ''),
            values: data.values, ai_summary: data.summary || null,
            flags: data.flags || [], source: 'pdf',
          })
          await load()
        }
        e.target.value = ''
        setImporting(false)
        return
      } else {
        text = await file.text()
      }
      await importLabs(text)
    } catch (err) {
      console.error('File upload error:', err)
    }
    e.target.value = ''
  }

  const saveVital = async () => {
    if (!user || !newVital.v1) return
    const vt = VITAL_TYPES.find(v => v.id === newVital.type)!
    const pid = selectedProfile?.id === 'self' ? null : selectedProfile?.id
    await supabase.from('vital_records').insert({
      user_id: user.id, profile_id: pid || null,
      profile_name: selectedProfile?.name || null,
      date: newVital.date, vital_type: newVital.type,
      value_1: parseFloat(newVital.v1) || null,
      value_2: newVital.v2 ? parseFloat(newVital.v2) : null,
      unit: vt.unit, notes: newVital.notes || null,
    })
    setNewVital({ type: 'bp', v1: '', v2: '', notes: '', date: new Date().toISOString().split('T')[0] })
    setAdding(false)
    await load()
  }

  const saveVaccine = async () => {
    if (!user || !newVax.name) return
    const pid = selectedProfile?.id === 'self' ? null : selectedProfile?.id
    await supabase.from('vaccine_records').insert({
      user_id: user.id, profile_id: pid || null,
      profile_name: selectedProfile?.name || null,
      vaccine_name: newVax.name, date_given: newVax.date_given || null,
      next_due: newVax.next_due || null,
      dose_number: newVax.dose ? parseInt(newVax.dose) : null,
      notes: newVax.notes || null,
    })
    setNewVax({ name: '', date_given: new Date().toISOString().split('T')[0], next_due: '', dose: '', notes: '' })
    setAdding(false)
    await load()
  }

  const saveDoc = async () => {
    if (!user || !newDoc.title) return
    const pid = selectedProfile?.id === 'self' ? null : selectedProfile?.id
    await supabase.from('health_documents').insert({
      user_id: user.id, profile_id: pid || null,
      profile_name: selectedProfile?.name || null,
      doc_type: newDoc.type, title: newDoc.title,
      date: newDoc.date || null, issuer: newDoc.issuer || null,
      specialty: newDoc.specialty || null, summary: newDoc.summary || null,
    })
    setNewDoc({ type: 'report', title: '', date: '', issuer: '', specialty: '', summary: '' })
    setAdding(false)
    await load()
  }

  const input_s = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }
  const label_s = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 5, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Registo de Saúde</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 4 }}>
                {selectedProfile?.name || 'A minha saúde'}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: 0 }}>
                Análises, vacinas, parâmetros vitais e documentos — tudo num só lugar, para sempre.
              </p>
            </div>

            {/* Profile selector */}
            <select
              onChange={e => {
                const found = profiles.find(p => p.id === e.target.value)
                if (found) setSelectedProfile(found)
              }}
              value={selectedProfile?.id || 'self'}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer' }}>
              {profiles.filter(p => p.type === 'self').map(p => <option key={p.id} value={p.id}>{p.name} (eu)</option>)}
              {profiles.filter(p => p.type === 'family').length > 0 && (
                <>
                  <option disabled>── Família ──</option>
                  {profiles.filter(p => p.type === 'family').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </>
              )}
              {profiles.filter(p => p.type === 'patient').length > 0 && (
                <>
                  <option disabled>── Doentes ──</option>
                  {profiles.filter(p => p.type === 'patient').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </>
              )}
            </select>
          </div>

          {/* Section tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            <SectionTab id="labs" label="Análises" count={labs.length} active={section === 'labs'} onClick={() => setSection('labs')} />
            <SectionTab id="vaccines" label="Vacinas" count={vaccines.length} active={section === 'vaccines'} onClick={() => setSection('vaccines')} />
            <SectionTab id="vitals" label="Parâmetros Vitais" count={vitals.length} active={section === 'vitals'} onClick={() => setSection('vitals')} />
            <SectionTab id="documents" label="Documentos" count={docs.length} active={section === 'documents'} onClick={() => setSection('documents')} />
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* ── LABS ────────────────────────────────────────────────────────── */}
        {section === 'labs' && (
          <div>
            {/* Import actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input ref={fileRef} type="file" accept=".txt,.pdf,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {importing ? 'A importar...' : 'Importar análise (PDF/TXT)'}
              </button>
              <Link href="/labs" style={{ padding: '9px 14px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                Analisar e guardar →
              </Link>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
              </div>
            ) : labs.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Sem análises guardadas</div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
                  Importa o PDF ou texto das tuas análises — o Phlox interpreta automaticamente e guarda no teu historial.
                </p>
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '10px 22px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  Importar primeira análise →
                </button>
              </div>
            ) : labs.map(lab => (
              <div key={lab.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{lab.lab_name || 'Análise clínica'}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 2 }}>
                      {new Date(lab.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {lab.profile_name && <span> · {lab.profile_name}</span>}
                    </div>
                  </div>
                  {lab.flags && lab.flags.length > 0 && (
                    <div className="badge badge-red">{lab.flags.length} valor{lab.flags.length > 1 ? 'es' : ''} alterado{lab.flags.length > 1 ? 's' : ''}</div>
                  )}
                </div>

                {lab.ai_summary && (
                  <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid var(--border)', fontSize: 13, color: '#1d4ed8', lineHeight: 1.6 }}>
                    {lab.ai_summary}
                  </div>
                )}

                <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {((lab.values || []) as any[]).map((v: any, i: number) => {
                    const s = STATUS_STYLE[v.status] || STATUS_STYLE.NORMAL
                    return (
                      <div key={i} style={{ padding: '6px 10px', background: s.bg, border: `1px solid ${s.bg}`, borderRadius: 6, minWidth: 90 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{v.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{v.value} <span style={{ fontSize: 10, fontWeight: 400 }}>{v.unit}</span></div>
                        <div style={{ fontSize: 9, color: s.color, opacity: 0.7, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{s.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VACCINES ────────────────────────────────────────────────────── */}
        {section === 'vaccines' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setAdding(!adding)}
                style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                + Registar vacina
              </button>
              <Link href="/vaccines" style={{ padding: '9px 14px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                Ver calendário PNV →
              </Link>
            </div>

            {adding && (
              <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Nova vacina</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label_s}>Nome da vacina *</label>
                    <input value={newVax.name} onChange={e => setNewVax(p=>({...p,name:e.target.value}))} placeholder="Ex: Gripe, COVID-19, Tétano" style={input_s} />
                  </div>
                  <div>
                    <label style={label_s}>Data de administração</label>
                    <input type="date" value={newVax.date_given} onChange={e => setNewVax(p=>({...p,date_given:e.target.value}))} style={input_s} />
                  </div>
                  <div>
                    <label style={label_s}>Próxima dose (se aplicável)</label>
                    <input type="date" value={newVax.next_due} onChange={e => setNewVax(p=>({...p,next_due:e.target.value}))} style={input_s} />
                  </div>
                  <div>
                    <label style={label_s}>Nº da dose</label>
                    <input type="number" value={newVax.dose} onChange={e => setNewVax(p=>({...p,dose:e.target.value}))} placeholder="1" style={input_s} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={label_s}>Notas</label>
                  <input value={newVax.notes} onChange={e => setNewVax(p=>({...p,notes:e.target.value}))} placeholder="Ex: Reacção leve no local de injecção" style={input_s} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveVaccine} disabled={!newVax.name}
                    style={{ padding: '9px 18px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: newVax.name ? 1 : 0.5 }}>
                    Guardar
                  </button>
                  <button onClick={() => setAdding(false)}
                    style={{ padding: '9px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {vaccines.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: 'var(--ink-4)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Sem vacinas registadas</div>
                <div style={{ fontSize: 13 }}>Regista as vacinas para ter o teu historial vacinal sempre acessível.</div>
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {vaccines.map((vax, i) => (
                  <div key={vax.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderBottom: i < vaccines.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{vax.vaccine_name}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                        {vax.date_given && `Tomada em ${new Date(vax.date_given).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {vax.dose_number && <span> · Dose {vax.dose_number}</span>}
                      </div>
                      {vax.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{vax.notes}</div>}
                    </div>
                    {vax.next_due && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Próxima</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: new Date(vax.next_due) < new Date() ? '#dc2626' : '#0d6e42', fontFamily: 'var(--font-mono)' }}>
                          {new Date(vax.next_due).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── VITALS ───────────────────────────────────────────────────────── */}
        {section === 'vitals' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setAdding(!adding)}
                style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                + Registar parâmetro
              </button>
            </div>

            {adding && (
              <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Novo parâmetro vital</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label_s}>Tipo</label>
                    <select value={newVital.type} onChange={e => setNewVital(p=>({...p,type:e.target.value}))} style={{ ...input_s, background: 'white' }}>
                      {VITAL_TYPES.map(v => <option key={v.id} value={v.id}>{v.label} ({v.unit})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label_s}>
                      {VITAL_TYPES.find(v=>v.id===newVital.type)?.dual ? 'Sistólica' : 'Valor'} *
                    </label>
                    <input type="number" value={newVital.v1} onChange={e => setNewVital(p=>({...p,v1:e.target.value}))}
                      placeholder={VITAL_TYPES.find(v=>v.id===newVital.type)?.placeholder || ''} style={input_s} />
                  </div>
                  {VITAL_TYPES.find(v=>v.id===newVital.type)?.dual && (
                    <div>
                      <label style={label_s}>Diastólica *</label>
                      <input type="number" value={newVital.v2} onChange={e => setNewVital(p=>({...p,v2:e.target.value}))} placeholder="80" style={input_s} />
                    </div>
                  )}
                  <div>
                    <label style={label_s}>Data</label>
                    <input type="date" value={newVital.date} onChange={e => setNewVital(p=>({...p,date:e.target.value}))} style={input_s} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={label_s}>Notas</label>
                  <input value={newVital.notes} onChange={e => setNewVital(p=>({...p,notes:e.target.value}))} placeholder="Ex: Em jejum, antes da medicação" style={input_s} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveVital} disabled={!newVital.v1}
                    style={{ padding: '9px 18px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: newVital.v1 ? 1 : 0.5 }}>
                    Guardar
                  </button>
                  <button onClick={() => setAdding(false)}
                    style={{ padding: '9px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {vitals.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: 'var(--ink-4)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Sem registos</div>
                <div style={{ fontSize: 13 }}>Regista tensão arterial, glicemia, peso, SpO2 e outros parâmetros ao longo do tempo.</div>
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {vitals.map((v, i) => {
                  const vt = VITAL_TYPES.find(x => x.id === v.vital_type)
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderBottom: i < vitals.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{vt?.label || v.vital_type}</div>
                        {v.notes && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{v.notes}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400 }}>
                          {v.value_1}{v.value_2 ? `/${v.value_2}` : ''} <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', fontWeight: 400 }}>{v.unit}</span>
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                          {new Date(v.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS ───────────────────────────────────────────────────── */}
        {section === 'documents' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setAdding(!adding)}
                style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                + Adicionar documento
              </button>
            </div>

            {adding && (
              <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Novo documento</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label_s}>Tipo</label>
                    <select value={newDoc.type} onChange={e => setNewDoc(p=>({...p,type:e.target.value}))} style={{ ...input_s, background: 'white' }}>
                      {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label_s}>Título / Descrição *</label>
                    <input value={newDoc.title} onChange={e => setNewDoc(p=>({...p,title:e.target.value}))} placeholder="Ex: Relatório de cardiologia" style={input_s} />
                  </div>
                  <div>
                    <label style={label_s}>Data</label>
                    <input type="date" value={newDoc.date} onChange={e => setNewDoc(p=>({...p,date:e.target.value}))} style={input_s} />
                  </div>
                  <div>
                    <label style={label_s}>Emitido por</label>
                    <input value={newDoc.issuer} onChange={e => setNewDoc(p=>({...p,issuer:e.target.value}))} placeholder="Ex: Hospital Santa Maria, Dr. Silva" style={input_s} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={label_s}>Resumo (opcional)</label>
                  <textarea value={newDoc.summary} onChange={e => setNewDoc(p=>({...p,summary:e.target.value}))} placeholder="Cola o texto do documento ou escreve um resumo..." rows={3}
                    style={{ ...input_s, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveDoc} disabled={!newDoc.title}
                    style={{ padding: '9px 18px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: newDoc.title ? 1 : 0.5 }}>
                    Guardar
                  </button>
                  <button onClick={() => setAdding(false)}
                    style={{ padding: '9px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {docs.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: 'var(--ink-4)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Sem documentos</div>
                <div style={{ fontSize: 13 }}>Guarda receitas, relatórios médicos, cartas de referenciação e notas de alta.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docs.map(doc => {
                  const dt = DOC_TYPES.find(d => d.id === doc.doc_type)
                  return (
                    <div key={doc.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{doc.title}</span>
                            <span className="badge badge-mono">{dt?.label || doc.doc_type}</span>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                            {doc.issuer && <span>{doc.issuer}</span>}
                            {doc.date && <span>{doc.issuer ? ' · ' : ''}{new Date(doc.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          </div>
                          {doc.summary && <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 5 }}>{doc.summary.slice(0, 200)}{doc.summary.length > 200 ? '...' : ''}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}