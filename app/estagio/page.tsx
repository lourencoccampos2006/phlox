'use client'

// /estagio — Hub dos estágios do estudante.
// Lista todos os estágios (planeados / activos / completos) e permite criar novo.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'

interface Internship {
  id: string; name: string; area: string; specialty: string|null
  institution: string|null; ward: string|null; supervisor: string|null
  start_date: string; end_date: string
  hours_required: number; hours_done: number
  patients_count: number; log_entries_count: number; procedures_count: number
  status: string
}

const AREA_META: Record<string, { label: string; icon: string; color: string }> = {
  medicina:           { label: 'Medicina',           icon: '🩺', color: '#dc2626' },
  enfermagem:         { label: 'Enfermagem',         icon: '💉', color: '#0d6e42' },
  farmacia:           { label: 'Farmácia',           icon: '💊', color: '#1d4ed8' },
  fisioterapia:       { label: 'Fisioterapia',       icon: '🏃', color: '#7c3aed' },
  psicologia:         { label: 'Psicologia',         icon: '🧠', color: '#0891b2' },
  nutricao:           { label: 'Nutrição',           icon: '🥗', color: '#65a30d' },
  medicina_dentaria:  { label: 'Medicina Dentária',  icon: '🦷', color: '#be185d' },
  veterinaria:        { label: 'Veterinária',        icon: '🐾', color: '#b45309' },
  tdt:                { label: 'TDT',                icon: '🔬', color: '#374151' },
  analises_clinicas:  { label: 'Análises clínicas',  icon: '🧪', color: '#0e7490' },
  radiologia:         { label: 'Radiologia',         icon: '📡', color: '#6d28d9' },
  farmacologia:       { label: 'Farmacologia',       icon: '🧬', color: '#92400e' },
  outro:              { label: 'Outro',              icon: '📋', color: '#6b7280' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  planned:   { label: 'Planeado',  color: '#374151', bg: '#f3f4f6' },
  active:    { label: 'Activo',    color: '#065f46', bg: '#dcfce7' },
  completed: { label: 'Concluído', color: '#1e40af', bg: '#dbeafe' },
  cancelled: { label: 'Cancelado', color: '#991b1b', bg: '#fee2e2' },
}

export default function EstagioHub() {
  const { user, supabase } = useAuth() as any
  const [list, setList] = useState<Internship[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    const headers = await auth()
    const r = await fetch('/api/internship', { headers })
    const j = await r.json()
    setList(j.internships || [])
    setLoading(false)
  }, [auth])

  useEffect(() => { if (user) load() }, [user, load])

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  return (
    <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Estágio</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Gere todos os teus estágios: doentes, diário, objectivos, procedimentos, casos, relatórios IA.
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Novo estágio</button>
      </header>

      {list.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Cria o teu primeiro estágio</h2>
          <p style={{ color: '#6b7280', margin: '0 0 18px', fontSize: 14 }}>
            Escolhe a área e o local. Os objectivos do currículo são criados automaticamente.
          </p>
          <button onClick={() => setShowNew(true)} style={btn('primary')}>Começar</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {list.map(it => {
            const am = AREA_META[it.area] || AREA_META.outro
            const sm = STATUS_META[it.status] || STATUS_META.planned
            const days = Math.max(1, Math.ceil((new Date(it.end_date).getTime() - new Date(it.start_date).getTime()) / 86400000))
            const hoursPct = it.hours_required > 0 ? Math.min(100, Math.round(100 * it.hours_done / it.hours_required)) : 0
            return (
              <Link key={it.id} href={`/estagio/${it.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, cursor: 'pointer', height: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = am.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <span style={{ fontSize: 26 }}>{am.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: am.color, fontWeight: 600 }}>{am.label}{it.specialty && ` · ${it.specialty}`}</div>
                      </div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{sm.label.toUpperCase()}</span>
                  </div>

                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                    {it.institution && <div>📍 {it.institution}{it.ward && ` · ${it.ward}`}</div>}
                    {it.supervisor && <div>👤 {it.supervisor}</div>}
                    <div>📅 {new Date(it.start_date).toLocaleDateString('pt-PT')} → {new Date(it.end_date).toLocaleDateString('pt-PT')} · {days}d</div>
                  </div>

                  {it.hours_required > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
                        <span>Horas</span>
                        <span><b style={{ color: '#111827' }}>{it.hours_done}</b> / {it.hours_required}</span>
                      </div>
                      <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${hoursPct}%`, background: am.color, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                    <span>👥 <b style={{ color: '#111827' }}>{it.patients_count}</b> doentes</span>
                    <span>📝 <b style={{ color: '#111827' }}>{it.log_entries_count}</b> notas</span>
                    <span>⚙️ <b style={{ color: '#111827' }}>{it.procedures_count}</b> proc</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showNew && <NewInternshipModal supabase={supabase} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </main>
  )
}

function NewInternshipModal({ supabase, onClose, onCreated }: { supabase: any; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const inFour = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [area, setArea] = useState('medicina')
  const [specialty, setSpecialty] = useState('')
  const [institution, setInstitution] = useState('')
  const [ward, setWard] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(inFour)
  const [hoursRequired, setHoursRequired] = useState(160)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/internship', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({
        name, area, specialty: specialty || null, institution: institution || null,
        ward: ward || null, supervisor: supervisor || null, start_date: startDate, end_date: endDate,
        hours_required: hoursRequired, status: 'active',
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>Novo estágio</h3>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 6, fontSize: 12 }}>{err}</div>}
          <Field label="Nome do estágio"><input required value={name} onChange={e => setName(e.target.value)} style={input} placeholder="ex: Internamento Medicina Interna 2A" /></Field>
          <Field label="Área">
            <select value={area} onChange={e => setArea(e.target.value)} style={input}>
              {Object.entries(AREA_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Field label="Especialidade (opcional)"><input value={specialty} onChange={e => setSpecialty(e.target.value)} style={input} placeholder="cardiologia" /></Field>
            <Field label="Instituição"><input value={institution} onChange={e => setInstitution(e.target.value)} style={input} placeholder="Hospital de São João" /></Field>
            <Field label="Serviço / ala"><input value={ward} onChange={e => setWard(e.target.value)} style={input} placeholder="Internamento 2A" /></Field>
            <Field label="Supervisor"><input value={supervisor} onChange={e => setSupervisor(e.target.value)} style={input} placeholder="Dr. José Silva" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Field label="Início"><input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} style={input} /></Field>
            <Field label="Fim"><input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} style={input} /></Field>
            <Field label="Horas exigidas"><input type="number" value={hoursRequired} onChange={e => setHoursRequired(parseInt(e.target.value) || 0)} style={input} /></Field>
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
            Os objectivos curriculares da área serão criados automaticamente.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
            <button type="submit" disabled={busy || !name} style={btn('primary')}>{busy ? 'A criar…' : 'Criar estágio'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '10px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 700, fontSize: 14 }
  return { padding: '10px 18px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
