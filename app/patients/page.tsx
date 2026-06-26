'use client'

// /patients — REFEITA DO ZERO (2026-06-26). A página bandeira das instituições:
//  • partilhada por organização (toda a equipa vê os mesmos utentes — org_id)
//  • dados REAIS: contagem de medicação e alertas (ocorrências abertas) por pessoa,
//    e se já tem registo do dia hoje — antes os crachás existiam mas sem dados
//  • filtros rápidos (com alertas · polimedicados · sem registo hoje)
//  • adicionar (um a um) + importar CSV (deteção de colunas) + remover
//  • vocabulário por instituição (utente / residente / doente)
//  • visual adaptado ao tom (centro de dia/lar = quente; clínica/CSP = sóbrio)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { riskScore as calcRiskScore } from '@/lib/riskScore'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  return lines.map(line => {
    const fields: string[] = []; let inQuotes = false, field = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') inQuotes = !inQuotes
      else if ((c === ',' || c === ';') && !inQuotes) { fields.push(field.trim().replace(/^"|"$/g, '')); field = '' }
      else field += c
    }
    fields.push(field.trim().replace(/^"|"$/g, '')); return fields
  })
}
function detectMapping(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  headers.forEach((h, i) => {
    const l = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (m.name === undefined && /^(nome|name|doente|residente|utente|paciente)/.test(l)) m.name = i
    else if (m.age === undefined && /idade|age|anos$/.test(l)) m.age = i
    else if (m.sex === undefined && /^(sexo|sex|genero|gender)/.test(l)) m.sex = i
    else if (m.room === undefined && /quarto|room|cama|bed|unidade/.test(l)) m.room = i
    else if (m.admission === undefined && /admiss|entrada|internamento/.test(l)) m.admission = i
    else if (m.conditions === undefined && /diagnos|condicao|patolog|doenca|proble/.test(l)) m.conditions = i
    else if (m.allergies === undefined && /alergi|allerg/.test(l)) m.allergies = i
    else if (m.weight === undefined && /^(peso|weight)/.test(l)) m.weight = i
    else if (m.contact === undefined && /contacto|contact|emergencia|familiar/.test(l)) m.contact = i
  })
  return m
}

interface Patient {
  id: string; name: string; age: number | null; sex: string | null
  conditions: string | null; allergies: string | null
  room_number?: string | null; creatinine?: number | null; weight?: number | null
  updated_at?: string
}

type FilterKey = 'all' | 'alerts' | 'poly' | 'no_log'

export default function PatientsPage() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const cfg = institutionConfig(institution)
  const noun = cfg.personNoun.toLowerCase()
  const nounPlural = cfg.personNounPlural.toLowerCase()
  const nounCap = cfg.personNounPlural
  const warm = institution === 'day_care' || institution === 'nursing_home'
  const accent = warm ? '#0d9488' : '#1d4ed8'
  const accentSoft = warm ? '#f0fdfa' : '#eff6ff'

  const [patients, setPatients] = useState<Patient[]>([])
  const [medsCount, setMedsCount] = useState<Record<string, number>>({})
  const [alertCount, setAlertCount] = useState<Record<string, number>>({})
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const blankP = { name: '', age: '', sex: '', weight: '', height: '', creatinine: '', conditions: '', allergies: '', notes: '', room_number: '', admission_date: '', emergency_contact: '' }
  const [newP, setNewP] = useState(blankP)

  const [showImport, setShowImport] = useState(false)
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: string[][]; mapping: Record<string, number> } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(0)
  const [importError, setImportError] = useState('')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!user) return
    // utentes da ORGANIZAÇÃO (ou do próprio, se conta individual)
    const { data: pats } = await scope.filter(
      supabase.from('patients').select('id,name,age,sex,conditions,allergies,room_number,creatinine,weight,updated_at').eq('active', true)
    ).order('name')
    const list = (pats || []) as Patient[]
    setPatients(list)
    const ids = list.map(p => p.id)
    if (ids.length) {
      // dados REAIS por utente: nº de medicação, ocorrências abertas, registo de hoje
      const [meds, inc, care] = await Promise.all([
        supabase.from('patient_meds').select('patient_id').in('patient_id', ids).eq('active', true),
        supabase.from('incidents').select('patient_id').in('patient_id', ids).eq('status', 'open'),
        supabase.from('care_records').select('patient_id').in('patient_id', ids).eq('date', today),
      ])
      const mc: Record<string, number> = {}; (meds.data || []).forEach((m: any) => { mc[m.patient_id] = (mc[m.patient_id] || 0) + 1 })
      const ac: Record<string, number> = {}; (inc.data || []).forEach((i: any) => { ac[i.patient_id] = (ac[i.patient_id] || 0) + 1 })
      setMedsCount(mc); setAlertCount(ac)
      setLoggedToday(new Set((care.data || []).map((c: any) => c.patient_id)))
    } else { setMedsCount({}); setAlertCount({}); setLoggedToday(new Set()) }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, table: ['patients', 'patient_meds', 'incidents', 'care_records'], filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'n' || e.key === 'N') && isPro) setShowAdd(true)
    }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [isPro])

  // ── ações ──
  async function addPatient() {
    if (!newP.name.trim() || !user) return
    setAdding(true)
    const { data, error } = await supabase.from('patients').insert(scope.stamp({
      user_id: user.id, name: newP.name.trim(), active: true,
      age: newP.age ? parseInt(newP.age) : null, sex: newP.sex || null,
      weight: newP.weight ? parseFloat(newP.weight) : null, height: newP.height ? parseInt(newP.height) : null,
      creatinine: newP.creatinine ? parseFloat(newP.creatinine) : null,
      conditions: newP.conditions.trim() || null, allergies: newP.allergies.trim() || null,
      notes: newP.notes.trim() || null, room_number: newP.room_number.trim() || null,
      admission_date: newP.admission_date || null, emergency_contact: newP.emergency_contact.trim() || null,
    })).select().single()
    if (error) console.error('addPatient:', error.message)
    setNewP(blankP); setAdding(false)
    if (data) router.push(`/patients/${data.id}`)
  }

  async function deletePatient(id: string, name: string) {
    if (!user) return
    if (!confirm(`Remover ${name}? Esta ação é permanente e apaga todos os dados associados.`)) return
    await supabase.from('patients').delete().eq('id', id)
    load()
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string)
        if (rows.length < 2) { setImportError('Ficheiro vazio ou inválido.'); return }
        const [headers, ...dataRows] = rows
        const mapping = detectMapping(headers)
        if (mapping.name === undefined) { setImportError('Não consegui detetar a coluna "Nome". Confirma o cabeçalho.'); return }
        setImportPreview({ headers, rows: dataRows.filter(r => r[mapping.name]?.trim()), mapping }); setImportError('')
      } catch { setImportError('Erro ao ler o ficheiro. É um CSV válido?') }
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }

  async function doImport() {
    if (!importPreview || !user) return
    setImportLoading(true); setImportDone(0)
    const { rows, mapping } = importPreview
    const get = (row: string[], k: string) => (mapping[k] !== undefined ? (row[mapping[k]] || '') : '').trim()
    let done = 0
    for (const row of rows) {
      const name = get(row, 'name'); if (!name) continue
      await supabase.from('patients').insert(scope.stamp({
        user_id: user.id, name, active: true,
        age: parseInt(get(row, 'age')) || null,
        sex: get(row, 'sex').toUpperCase().startsWith('M') ? 'M' : get(row, 'sex').toUpperCase().startsWith('F') ? 'F' : null,
        weight: parseFloat(get(row, 'weight')) || null,
        conditions: get(row, 'conditions') || null, allergies: get(row, 'allergies') || null,
        room_number: get(row, 'room') || null, admission_date: get(row, 'admission') || null,
        emergency_contact: get(row, 'contact') || null,
      }))
      done++; setImportDone(done)
    }
    setImportLoading(false); setShowImport(false); setImportPreview(null); load()
  }

  // ── derivados ──
  const relativeDate = (iso?: string | null) => {
    if (!iso) return ''
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d === 0 ? 'hoje' : d === 1 ? 'ontem' : d < 7 ? `há ${d} dias` : d < 30 ? `há ${Math.floor(d / 7)} sem.` : `há ${Math.floor(d / 30)} meses`
  }
  const crCl = (p: Patient) => {
    if (!p.creatinine || !p.age || !p.weight || !p.sex) return null
    return Math.round(((140 - p.age) * p.weight * (p.sex === 'F' ? 0.85 : 1)) / (72 * p.creatinine))
  }

  const counts = useMemo(() => ({
    alerts: patients.filter(p => (alertCount[p.id] || 0) > 0).length,
    poly: patients.filter(p => (medsCount[p.id] || 0) >= 5).length,
    no_log: patients.filter(p => !loggedToday.has(p.id)).length,
  }), [patients, alertCount, medsCount, loggedToday])

  const visible = useMemo(() => patients
    .filter(p => {
      if (search && !(p.name.toLowerCase().includes(search.toLowerCase()) || (p.conditions || '').toLowerCase().includes(search.toLowerCase()))) return false
      if (filter === 'alerts') return (alertCount[p.id] || 0) > 0
      if (filter === 'poly') return (medsCount[p.id] || 0) >= 5
      if (filter === 'no_log') return !loggedToday.has(p.id)
      return true
    })
    .sort((a, b) => {
      const ar = calcRiskScore({ ...a, alerts: alertCount[a.id], meds_count: medsCount[a.id] } as any)
      const br = calcRiskScore({ ...b, alerts: alertCount[b.id], meds_count: medsCount[b.id] } as any)
      if (br !== ar) return br - ar
      return (alertCount[b.id] || 0) - (alertCount[a.id] || 0)
    }), [patients, search, filter, alertCount, medsCount, loggedToday])

  if (!user) return null

  // ── paywall ──
  if (!isPro) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body">
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🧑‍🤝‍🧑</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Gestão de {nounPlural}</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
            Fichas com medicação, diagnósticos e função renal — partilhadas por toda a equipa. Faz parte do plano Pro e Institucional.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: accent, color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 9, fontSize: 14, fontWeight: 700 }}>Ver planos →</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, fontWeight: 700, marginBottom: 6 }}>{nounCap}</div>
            <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(26px,4vw,34px)' : 'clamp(22px,3vw,28px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>
              {loading ? '—' : `${patients.length} ${patients.length === 1 ? noun : nounPlural}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setShowImport(true); setImportPreview(null); setImportError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 15px', background: 'white', color: accent, border: `1.5px solid ${accent}`, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              ↑ Importar
            </button>
            <button onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: accent, color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              + Novo {noun}
            </button>
          </div>
        </div>

        {/* Pesquisa + filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${noun} ou diagnóstico…`}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px 10px 38px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['all', `Todos`, patients.length],
              ['alerts', 'Com alertas', counts.alerts],
              ['poly', 'Polimedicados', counts.poly],
              ['no_log', 'Sem registo hoje', counts.no_log],
            ] as [FilterKey, string, number][]).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding: '8px 12px', borderRadius: 999, border: `1.5px solid ${filter === k ? accent : '#e2e8f0'}`, background: filter === k ? accentSoft : 'white', color: filter === k ? accent : '#475569', fontSize: 12.5, fontWeight: filter === k ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {label}{n > 0 ? ` · ${n}` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 12 }} />)}</div>
        ) : visible.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed #e2e8f0', borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
            {search || filter !== 'all' ? (
              <>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>Nenhum {noun} corresponde ao filtro.</div>
                <button onClick={() => { setSearch(''); setFilter('all') }} style={{ fontSize: 13, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 34, marginBottom: 12 }}>🧑‍🤝‍🧑</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', marginBottom: 8 }}>{cfg.emptyPeopleMsg}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Adicione o primeiro {noun}, ou importe de uma folha (CSV).</div>
                <button onClick={() => setShowAdd(true)} style={{ background: accent, color: 'white', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{cfg.addPersonCta} →</button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {visible.map(p => {
              const mc = medsCount[p.id] || 0, ac = alertCount[p.id] || 0
              const rs = calcRiskScore({ ...p, alerts: ac, meds_count: mc } as any)
              const cr = crCl(p)
              const logged = loggedToday.has(p.id)
              return (
                <div key={p.id} className="pt-card" style={{ position: 'relative', background: 'white', border: '1px solid #e9eaec', borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <Link href={`/patients/${p.id}`} style={{ display: 'block', padding: '16px 18px', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: accentSoft, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[p.age ? `${p.age}a` : null, p.sex, p.room_number ? `Q ${p.room_number}` : null].filter(Boolean).join(' · ') || 'Sem dados'}
                        </div>
                      </div>
                      {rs >= 45 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rs >= 70 ? '#991b1b' : '#854d0e', background: rs >= 70 ? '#fee2e2' : '#fef9c3', border: `1px solid ${rs >= 70 ? '#fecaca' : '#fde68a'}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{rs >= 70 ? 'CRÍTICO' : 'ALTO'}</span>}
                    </div>

                    {/* crachás reais */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
                      {ac > 0 && <Badge color="#991b1b" bg="#fee2e2" border="#fca5a5">{ac} {ac === 1 ? 'alerta' : 'alertas'}</Badge>}
                      {mc >= 5 && <Badge color="#854d0e" bg="#fef9c3" border="#fde68a">Polimedicado</Badge>}
                      {p.allergies && <Badge color="#dc2626" bg="#fee2e2" border="#fca5a5">⚠ Alergia</Badge>}
                      {cr != null && cr < 60 && <Badge color={cr < 30 ? '#991b1b' : '#b45309'} bg={cr < 30 ? '#fee2e2' : '#fef3c7'} border={cr < 30 ? '#fca5a5' : '#fde68a'}>CrCl {cr}</Badge>}
                      {mc > 0 && <Badge color="#475569" bg="#f1f5f9" border="#e2e8f0">{mc} med.</Badge>}
                    </div>
                    {p.conditions && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 10, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.conditions}</div>}
                  </Link>

                  {/* rodapé: registo de hoje + remover */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: logged ? '#15803d' : '#94a3b8' }}>
                      {logged ? '✓ Com registo hoje' : '○ Sem registo hoje'}
                    </span>
                    <button onClick={() => deletePatient(p.id, p.name)} title={`Remover ${noun}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}>Remover</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: novo */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title={`Novo ${noun}`} accent={accent}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo *" autoFocus style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={newP.age} onChange={e => setNewP(p => ({ ...p, age: e.target.value }))} placeholder="Idade" type="number" min="0" max="120" style={inp} />
              <select value={newP.sex} onChange={e => setNewP(p => ({ ...p, sex: e.target.value }))} style={{ ...inp, background: 'white', color: newP.sex ? '#0b1120' : '#94a3b8' }}>
                <option value="">Sexo</option><option value="M">Masculino</option><option value="F">Feminino</option>
              </select>
            </div>
            <div className="pt-3col">
              <input value={newP.weight} onChange={e => setNewP(p => ({ ...p, weight: e.target.value }))} placeholder="Peso (kg)" type="number" step="0.1" style={inp} />
              <input value={newP.height} onChange={e => setNewP(p => ({ ...p, height: e.target.value }))} placeholder="Altura (cm)" type="number" style={inp} />
              <input value={newP.creatinine} onChange={e => setNewP(p => ({ ...p, creatinine: e.target.value }))} placeholder="Creat. (mg/dL)" type="number" step="0.01" style={inp} />
            </div>
            <input value={newP.conditions} onChange={e => setNewP(p => ({ ...p, conditions: e.target.value }))} placeholder="Diagnósticos (ex: HTA, DM2, FA)" style={inp} />
            <input value={newP.allergies} onChange={e => setNewP(p => ({ ...p, allergies: e.target.value }))} placeholder="Alergias medicamentosas" style={inp} />
            <div className="pt-3col" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <input value={newP.room_number} onChange={e => setNewP(p => ({ ...p, room_number: e.target.value }))} placeholder={cfg.roomLabel || 'Sala / lugar'} style={inp} />
              <input value={newP.admission_date} onChange={e => setNewP(p => ({ ...p, admission_date: e.target.value }))} placeholder="Admissão" type="date" style={inp} />
            </div>
            <input value={newP.emergency_contact} onChange={e => setNewP(p => ({ ...p, emergency_contact: e.target.value }))} placeholder="Contacto de emergência (nome e telefone)" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={addPatient} disabled={!newP.name.trim() || adding} style={{ flex: 1, background: accent, color: 'white', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, cursor: newP.name.trim() ? 'pointer' : 'not-allowed', opacity: newP.name.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>{adding ? 'A criar…' : 'Criar ficha →'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 14, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal: importar */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)} title={`Importar ${nounPlural}`} accent={accent} wide>
          {!importPreview ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${accent}`, borderRadius: 12, padding: '38px 24px', cursor: 'pointer', background: accentSoft, gap: 10 }}>
                <span style={{ fontSize: 32 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>Selecionar ficheiro CSV</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Exportado do Excel ou de outro sistema · até 500 {nounPlural}</span>
                <input type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{ display: 'none' }} />
              </label>
              {importError && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>{importError}</div>}
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Primeira linha = cabeçalho. Exemplo:</div>
                <code style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.7 }}>Nome, Idade, Sexo, {cfg.roomLabel || 'Sala'}, Diagnósticos, Alergias<br/>Maria Silva, 82, F, 12A, HTA; DM2, Penicilina</code>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#15803d', fontWeight: 700 }}>
                {importPreview.rows.length} {importPreview.rows.length === 1 ? noun : nounPlural} · colunas: {Object.keys(importPreview.mapping).join(', ')}
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto', maxHeight: 260, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>{importPreview.headers.map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>{importPreview.rows.slice(0, 8).map((row, i) => <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>{row.map((c, j) => <td key={j} style={{ padding: '7px 10px', color: '#475569', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {importLoading && <div style={{ padding: 11, background: accentSoft, borderRadius: 8, marginBottom: 12, fontSize: 13, color: accent, fontWeight: 700 }}>A importar… {importDone}/{importPreview.rows.length}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doImport} disabled={importLoading} style={{ flex: 1, padding: 12, background: importLoading ? '#94a3b8' : accent, color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: importLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{importLoading ? 'A importar…' : `Importar ${importPreview.rows.length} →`}</button>
                <button onClick={() => { setImportPreview(null); setImportError('') }} disabled={importLoading} style={{ padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>Voltar</button>
              </div>
            </>
          )}
        </Modal>
      )}

      <style>{`
        .pt-card:hover { border-color: ${accent}66 !important; transform: translateY(-2px); }
        .pt-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        @media (max-width: 480px) { .pt-3col { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  )
}

function Badge({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
}

function Modal({ children, onClose, title, accent, wide }: { children: React.ReactNode; onClose: () => void; title: string; accent: string; wide?: boolean }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 26, width: '100%', maxWidth: wide ? 620 : 520, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(8,12,24,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }
