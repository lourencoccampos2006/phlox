'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { conditionRisk, riskScore as calcRiskScore } from '@/lib/riskScore'

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  return lines.map(line => {
    const fields: string[] = []
    let inQuotes = false, field = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuotes = !inQuotes }
      else if ((c === ',' || c === ';') && !inQuotes) { fields.push(field.trim().replace(/^"|"$/g, '')); field = '' }
      else { field += c }
    }
    fields.push(field.trim().replace(/^"|"$/g, ''))
    return fields
  })
}

function detectMapping(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  headers.forEach((h, i) => {
    const l = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (!m.name && /^(nome|name|doente|residente|utente|paciente)/.test(l)) m.name = i
    else if (!m.age && /idade|age|anos$/.test(l)) m.age = i
    else if (!m.sex && /^(sexo|sex|genero|gender)/.test(l)) m.sex = i
    else if (!m.room && /quarto|room|cama|bed|unidade/.test(l)) m.room = i
    else if (!m.admission && /admiss|entrada|internamento/.test(l)) m.admission = i
    else if (!m.conditions && /diagnos|condicao|patolog|doenca|proble/.test(l)) m.conditions = i
    else if (!m.allergies && /alergi|allerg/.test(l)) m.allergies = i
    else if (!m.weight && /^(peso|weight)/.test(l)) m.weight = i
    else if (!m.contact && /contacto|contact|emergencia|familiar/.test(l)) m.contact = i
  })
  return m
}

interface Patient {
  id: string
  name: string
  age: number | null
  sex: string | null
  conditions: string | null
  allergies: string | null
  meds_count?: number
  alerts?: number
  updated_at?: string
}

export default function PatientsPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const { institution } = useClinicPrefs()
  const isNursingHome = institution === 'nursing_home'
  // Vocabulário vem do institutionConfig: lar→"residente", centro de dia→"utente",
  // farmácia→"utente", resto→"doente". Mantém tudo consistente entre páginas.
  const _cfg = institutionConfig(institution)
  const patientLabel = _cfg.personNoun.toLowerCase()
  const patientLabelPlural = _cfg.personNounPlural.toLowerCase()
  const patientLabelCap = _cfg.personNounPlural
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', sex: '', weight: '', height: '', creatinine: '', conditions: '', allergies: '', notes: '', room_number: '', admission_date: '', emergency_contact: '' })
  const [showImport, setShowImport] = useState(false)
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: string[][]; mapping: Record<string, number> } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(0)
  const [importError, setImportError] = useState('')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setPatients(data || [])
    setLoading(false)
  }, [user, supabase])

  // Keyboard: N = new patient
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'n' || e.key === 'N') && isPro) setShowAdd(true)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isPro])

  useEffect(() => { load() }, [load])

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const rows = parseCSV(text)
        if (rows.length < 2) { setImportError('Ficheiro vazio ou inválido'); return }
        const [headers, ...dataRows] = rows
        const mapping = detectMapping(headers)
        if (mapping.name === undefined) { setImportError('Não foi possível detetar a coluna "Nome". Verifica se o cabeçalho está correto.'); return }
        setImportPreview({ headers, rows: dataRows.filter(r => r[mapping.name]?.trim()), mapping })
        setImportError('')
      } catch { setImportError('Erro ao ler ficheiro. Verifica se é um CSV válido.') }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const doImport = async () => {
    if (!importPreview || !user) return
    setImportLoading(true); setImportDone(0)
    const { rows, mapping } = importPreview
    const get = (row: string[], k: string) => (mapping[k] !== undefined ? (row[mapping[k]] || '') : '').trim()
    let done = 0
    for (const row of rows) {
      const name = get(row, 'name')
      if (!name) continue
      await supabase.from('patients').insert({
        user_id: user.id, name,
        age: parseInt(get(row, 'age')) || null,
        sex: get(row, 'sex').toUpperCase().startsWith('M') ? 'M' : get(row, 'sex').toUpperCase().startsWith('F') ? 'F' : null,
        weight: parseFloat(get(row, 'weight')) || null,
        conditions: get(row, 'conditions') || null,
        allergies: get(row, 'allergies') || null,
        notes: null,
        room_number: get(row, 'room') || null,
        admission_date: get(row, 'admission') || null,
        emergency_contact: get(row, 'contact') || null,
      })
      done++; setImportDone(done)
    }
    setImportLoading(false); setShowImport(false); setImportPreview(null); load()
  }

  const addPatient = async () => {
    if (!newP.name.trim() || !user) return
    setAdding(true)
    const { data, error } = await supabase.from('patients').insert({
      user_id: user.id,
      name: newP.name.trim(),
      age: newP.age ? parseInt(newP.age) : null,
      sex: newP.sex || null,
      weight: newP.weight ? parseFloat(newP.weight) : null,
      height: newP.height ? parseInt(newP.height) : null,
      creatinine: newP.creatinine ? parseFloat(newP.creatinine) : null,
      conditions: newP.conditions.trim() || null,
      allergies: newP.allergies.trim() || null,
      notes: newP.notes.trim() || null,
      room_number: newP.room_number.trim() || null,
      admission_date: newP.admission_date || null,
      emergency_contact: newP.emergency_contact.trim() || null,
    }).select().single()
    if (error) console.error('addPatient error:', error.message)
    if (data) {
      router.push(`/patients/${data.id}`)
    }
    setNewP({ name: '', age: '', sex: '', weight: '', height: '', creatinine: '', conditions: '', allergies: '', notes: '', room_number: '', admission_date: '', emergency_contact: '' })
    setAdding(false)
  }

  const deletePatient = async (id: string, name: string) => {
    if (!user) return
    if (!confirm(`Remover ${name}? Esta ação é permanente e apaga todos os dados associados.`)) return
    await supabase.from('patients').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  // Risco por condições — fonte ÚNICA partilhada com o /rounds (@/lib/riskScore),
  // para o score ser idêntico nas duas páginas (antes divergiam).
  const conditionRiskScore = (p: Patient): number => conditionRisk(p as any)

  const relativeDate = (iso: string | null | undefined): string => {
    if (!iso) return ''
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (diff === 0) return 'hoje'
    if (diff === 1) return 'ontem'
    if (diff < 7) return `há ${diff} dias`
    if (diff < 30) return `há ${Math.floor(diff / 7)} sem.`
    return `há ${Math.floor(diff / 30)} meses`
  }

  const filtered = patients
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.conditions || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      // Ordena pelo MESMO score do /rounds (fonte única). Desempate por nº de alertas.
      const ar = calcRiskScore(a as any), br = calcRiskScore(b as any)
      if (br !== ar) return br - ar
      return (b.alerts || 0) - (a.alerts || 0)
    })

  const riskBadge = (p: Patient) => {
    if (p.alerts && p.alerts > 0) return { label: `${p.alerts} alerta${p.alerts > 1 ? 's' : ''}`, bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
    if (p.meds_count && p.meds_count >= 5) return { label: 'Polimedicado', bg: '#fef9c3', color: '#854d0e', border: '#fde68a' }
    return null
  }

  const gfrBadge = (p: Patient) => {
    if (!(p as any).creatinine || !(p as any).age || !(p as any).weight || !(p as any).sex) return null
    const crCl = Math.round(((140 - (p as any).age) * (p as any).weight * ((p as any).sex === 'F' ? 0.85 : 1)) / (72 * (p as any).creatinine))
    if (crCl >= 60) return null
    if (crCl >= 30) return { label: `CrCl ${crCl}`, bg: '#fef3c7', color: '#b45309', border: '#fde68a' }
    return { label: `CrCl ${crCl} ⚠`, bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>


      {/* ── Header clínico ───────────────────────────────────────────────── */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link href="/cockpit" style={{ color: '#475569', textDecoration: 'none' }}>Cockpit</Link>
            <span>›</span>
            <span style={{ color: '#64748b' }}>{patientLabelCap}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
                {loading ? '—' : `${patients.length} ${patients.length === 1 ? patientLabel : patientLabelPlural}`}
              </h1>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {isNursingHome ? 'Ordenados por risco · Gestão do lar' : 'Ordenados por risco · Phlox Rounds'}
              </div>
            </div>
            {isPro && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {isNursingHome && (
                  <button onClick={() => { setShowImport(true); setImportPreview(null); setImportError('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    Importar CSV
                  </button>
                )}
                <button onClick={() => setShowAdd(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Novo {patientLabel}
                  <kbd style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>N</kbd>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {!isPro ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#1d4ed8" opacity="0.12"/>
              <path d="M14 6v16M7 14h14" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Gestão de Doentes</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
              Cria perfis clínicos para os teus doentes com medicação, diagnósticos e função renal. O Phlox AI responde com contexto real de cada doente.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Activar Pro →
            </Link>
          </div>
        ) : (
          <>
            {/* Modal novo doente */}
            {showAdd && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: 'white', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{`Novo ${patientLabel}`}</div>
                    <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nome completo *" autoFocus
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input value={newP.age} onChange={e => setNewP(p => ({ ...p, age: e.target.value }))}
                        placeholder="Idade" type="number" min="0" max="120"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <select value={newP.sex} onChange={e => setNewP(p => ({ ...p, sex: e.target.value }))}
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', color: newP.sex ? 'var(--ink)' : 'var(--ink-4)' }}>
                        <option value="">Sexo</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div className="patient-form-3col">
                      <input value={newP.weight} onChange={e => setNewP(p => ({ ...p, weight: e.target.value }))}
                        placeholder="Peso (kg)" type="number" step="0.1"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <input value={newP.height} onChange={e => setNewP(p => ({ ...p, height: e.target.value }))}
                        placeholder="Altura (cm)" type="number"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <input value={newP.creatinine} onChange={e => setNewP(p => ({ ...p, creatinine: e.target.value }))}
                        placeholder="Creat. (mg/dL)" type="number" step="0.01"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                    <input value={newP.conditions} onChange={e => setNewP(p => ({ ...p, conditions: e.target.value }))}
                      placeholder="Diagnósticos (ex: HTA, DM2, FA, IRC G3)"
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                    <input value={newP.allergies} onChange={e => setNewP(p => ({ ...p, allergies: e.target.value }))}
                      placeholder="Alergias medicamentosas"
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                    {isNursingHome && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 2 }}>Informações do lar</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <input value={newP.room_number} onChange={e => setNewP(p => ({ ...p, room_number: e.target.value }))}
                            placeholder="Quarto / Cama (ex: 12A)"
                            style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                          <input value={newP.admission_date} onChange={e => setNewP(p => ({ ...p, admission_date: e.target.value }))}
                            placeholder="Data de admissão" type="date"
                            style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                        </div>
                        <input value={newP.emergency_contact} onChange={e => setNewP(p => ({ ...p, emergency_contact: e.target.value }))}
                          placeholder="Contacto de emergência (nome e telefone)"
                          style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <button onClick={addPatient} disabled={!newP.name.trim() || adding}
                      style={{ flex: 1, background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: newP.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', opacity: newP.name.trim() ? 1 : 0.5 }}>
                      {adding ? 'A criar...' : 'Criar perfil →'}
                    </button>
                    <button onClick={() => setShowAdd(false)}
                      style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CSV Import Modal */}
            {showImport && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
                  <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#0d9488', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Importar residentes</div>
                      <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                      Importa residentes a partir de um ficheiro <strong>CSV ou Excel exportado como CSV</strong>. O sistema detetará automaticamente as colunas: Nome, Idade, Sexo, Quarto, Diagnósticos, Alergias, etc.
                    </div>
                  </div>

                  <div style={{ padding: '20px 28px' }}>
                    {!importPreview ? (
                      <div>
                        <label style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '2px dashed #0d9488', borderRadius: 12, padding: '40px 24px', cursor: 'pointer',
                          background: '#f0fdfa', gap: 12,
                        }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488' }}>Clica para selecionar o ficheiro</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>CSV exportado do Excel ou outro sistema · Máx. 500 residentes</div>
                          </div>
                          <input type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{ display: 'none' }} />
                        </label>
                        {importError && (
                          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>{importError}</div>
                        )}
                        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Formato esperado (primeira linha = cabeçalho):</div>
                          <code style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.8 }}>
                            Nome, Idade, Sexo, Quarto, Data Admissão, Diagnósticos, Alergias<br/>
                            Maria Silva, 82, F, 12A, 2025-03-01, HTA; DM2; IC, Penicilina<br/>
                            João Santos, 78, M, 7B, 2024-11-15, DPOC; DM2, Nenhuma
                          </code>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>✅</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{importPreview.rows.length} {patientLabel}{importPreview.rows.length !== 1 ? 's' : ''} encontrado{importPreview.rows.length !== 1 ? 's' : ''}</div>
                            <div style={{ fontSize: 11, color: '#16a34a' }}>Colunas detetadas: {Object.keys(importPreview.mapping).join(', ')}</div>
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                                {importPreview.headers.map((h, i) => (
                                  <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.rows.slice(0, 10).map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {row.map((cell, j) => (
                                    <td key={j} style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importPreview.rows.length > 10 && (
                            <div style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                              + {importPreview.rows.length - 10} mais residentes não mostrados
                            </div>
                          )}
                        </div>
                        {importLoading && (
                          <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                            A importar... {importDone}/{importPreview.rows.length} residentes
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={doImport} disabled={importLoading}
                            style={{ flex: 1, padding: '12px', background: importLoading ? '#94a3b8' : '#0d9488', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: importLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                            {importLoading ? 'A importar...' : `Importar ${importPreview.rows.length} ${patientLabelPlural} →`}
                          </button>
                          <button onClick={() => { setImportPreview(null); setImportError('') }} disabled={importLoading}
                            style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
                            Voltar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou diagnóstico..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 14px 11px 40px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
            </div>

            {/* Stats */}
            {patients.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
                {[
                  { label: patientLabelCap, value: patients.length, color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'Com alertas', value: patients.filter(p => p.alerts && p.alerts > 0).length, color: '#991b1b', bg: '#fee2e2' },
                  { label: 'Polimedicados', value: patients.filter(p => p.meds_count && p.meds_count >= 5).length, color: '#854d0e', bg: '#fef9c3' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.color, fontWeight: 400 }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
                {search ? (
                  <>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 8 }}>Nenhum doente corresponde a "{search}"</div>
                    <button onClick={() => setSearch('')} style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>Limpar pesquisa</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{_cfg.emptyPeopleMsg}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>{isNursingHome ? 'Adiciona o primeiro residente do lar.' : `Cria o primeiro perfil de ${patientLabel}.`}</div>
                    <button onClick={() => setShowAdd(true)}
                      style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {_cfg.addPersonCta} →
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {filtered.map((patient, i) => {
                  const badge = riskBadge(patient)
                  return (
                    <div key={patient.id} style={{ display: 'flex', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                    <Link href={`/patients/${patient.id}`}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textDecoration: 'none', transition: 'background 0.1s' }}
                      className="patient-row">
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{patient.name}</span>
                          {isNursingHome && (patient as any).room_number && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                              Q {(patient as any).room_number}
                            </span>
                          )}
                          {badge && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                              {badge.label}
                            </span>
                          )}
                          {(() => { const g = gfrBadge(patient); return g ? (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: g.color, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em', flexShrink: 0 }}>
                              {g.label}
                            </span>
                          ) : null })()}
                          {patient.allergies && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 3, padding: '2px 6px', flexShrink: 0 }}>
                              ⚠ ALERGIA
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[
                            patient.age ? `${patient.age}a` : null,
                            patient.sex === 'M' ? 'M' : patient.sex === 'F' ? 'F' : null,
                            patient.conditions,
                          ].filter(Boolean).join(' · ') || 'Sem informação clínica'}
                        </div>
                      </div>
                      {/* Meds count + date + arrow */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {(patient.meds_count || 0) > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>
                              {patient.meds_count} med.
                            </span>
                          )}
                          {(() => { const rs = calcRiskScore(patient as any); if (rs >= 45) return <span title={`Risco ${rs}/100 — igual ao do Rounds`} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rs >= 70 ? '#991b1b' : '#854d0e', background: rs >= 70 ? '#fee2e2' : '#fef9c3', border: `1px solid ${rs >= 70 ? '#fecaca' : '#fde68a'}`, borderRadius: 3, padding: '2px 5px', letterSpacing: '0.06em' }}>{rs >= 70 ? 'CRÍTICO' : 'ALTO'} · {rs}</span>; return null })()}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                        {patient.updated_at && (
                          <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                            {relativeDate(patient.updated_at)}
                          </span>
                        )}
                      </div>
                    </Link>
                    <button
                      onClick={e => { e.preventDefault(); deletePatient(patient.id, patient.name) }}
                      title={`Remover ${patientLabel}`}
                      style={{ padding: '16px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', opacity: 0.4, fontSize: 16, flexShrink: 0, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                    >×</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .patient-row:hover { background: #eff6ff !important; }
        .patient-form-3col {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 480px) {
          .patient-form-3col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}