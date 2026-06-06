'use client'

// /estagio/[id]/doente/[pid] — Ficha do doente com timeline de evolução SOAP.

import { useState, useEffect, useCallback, use } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'

interface Followup {
  id: string; followup_date: string; shift: string|null
  subjective: string|null; objective: string|null; assessment: string|null; plan: string|null
  vitals: any; discussed_with_supervisor: boolean; supervisor_feedback: string|null
  created_at: string
}

type DTab = 'evolucao' | 'procedimentos' | 'medicacao' | 'objetivos'

export default function DoentePage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id: internshipId, pid: patientId } = use(params)
  const { user, supabase } = useAuth() as any
  const [patient, setPatient] = useState<any>(null)
  const [followups, setFollowups] = useState<Followup[]>([])
  const [procedures, setProcedures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [aiResult, setAiResult] = useState<{ title: string; ddx?: any; text?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dtab, setDtab] = useState<DTab>('evolucao')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: pat } = await supabase.from('internship_patients').select('*').eq('id', patientId).single()
    setPatient(pat)
    const { data: fups } = await supabase.from('patient_followups').select('*').eq('internship_patient_id', patientId).order('followup_date', { ascending: false })
    setFollowups(fups || [])
    const { data: procs } = await supabase.from('internship_procedures').select('*').eq('patient_id', patientId).order('performed_at', { ascending: false })
    setProcedures(procs || [])
    setLoading(false)
  }, [user, supabase, patientId])

  useEffect(() => { load() }, [load])

  async function addFollowup(row: any) {
    const headers = await auth()
    await fetch('/api/internship/resource', { method: 'POST', headers, body: JSON.stringify({
      table: 'patient_followups', data: { ...row, internship_patient_id: patientId },
    }) })
    load()
    setShowAdd(false)
  }

  async function addProcedure(row: any) {
    const headers = await auth()
    await fetch('/api/internship/resource', { method: 'POST', headers, body: JSON.stringify({
      table: 'internship_procedures', data: { ...row, internship_id: internshipId, patient_id: patientId },
    }) })
    load()
  }

  async function delProcedure(rid: string) {
    const headers = await auth()
    await fetch(`/api/internship/resource?table=internship_procedures&id=${rid}`, { method: 'DELETE', headers })
    load()
  }

  // Atualiza campos do doente (medicação, objetivos, learning)
  async function updatePatient(patch: any) {
    const headers = await auth()
    await fetch('/api/internship/resource', { method: 'PATCH', headers, body: JSON.stringify({ table: 'internship_patients', id: patientId, data: patch }) })
    setPatient((p: any) => ({ ...p, ...patch }))
  }

  async function aiDdx() {
    setBusy(true); setAiResult(null)
    const headers = await auth()
    const r = await fetch('/api/internship/ai', { method: 'POST', headers, body: JSON.stringify({ action: 'suggest_diagnosis', patient_id: patientId }) })
    const j = await r.json()
    setBusy(false)
    if (j.error) alert(j.error); else setAiResult({ title: 'Diagnóstico diferencial', ddx: j })
  }

  async function aiCase() {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/internship/ai', { method: 'POST', headers, body: JSON.stringify({ action: 'generate_case', patient_id: patientId }) })
    const j = await r.json()
    setBusy(false)
    if (j.error) alert(j.error); else setAiResult({ title: 'Caso clínico gerado', text: 'Caso criado com base neste doente — vê a tab Casos da rotação.' })
  }

  async function improveNote(text: string) {
    setBusy(true); setAiResult(null)
    const headers = await auth()
    const r = await fetch('/api/internship/ai', { method: 'POST', headers, body: JSON.stringify({ action: 'improve_note', note_text: text }) })
    const j = await r.json()
    setBusy(false)
    if (j.error) alert(j.error); else setAiResult({ title: 'Feedback da IA', text: j.improved || j.feedback || j.result || JSON.stringify(j) })
  }

  if (loading || !patient) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  return (
    <main style={{ padding: '20px clamp(12px, 3vw, 28px)', maxWidth: 1100, margin: '0 auto' }}>
      <Link href={`/estagio/${internshipId}`} style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>← Voltar ao estágio</Link>

      {/* Header do doente */}
      <header style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, marginTop: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>{patient.initials || '—'}</h1>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {patient.age && `${patient.age} anos`} {patient.sex && `· ${patient.sex}`}
              {patient.admission_date && ` · admissão ${new Date(patient.admission_date).toLocaleDateString('pt-PT')}`}
            </div>
            {patient.diagnosis && <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 8 }}>{patient.diagnosis}</div>}
            {patient.chief_complaint && <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{patient.chief_complaint}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={aiDdx} disabled={busy} style={btn('ghost')}>🧠 DDx IA</button>
            <button onClick={aiCase} disabled={busy} style={btn('ghost')}>📋 Gerar caso IA</button>
          </div>
        </div>

        {patient.background && (
          <div style={{ marginTop: 12, padding: 10, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {patient.background}
          </div>
        )}
      </header>

      {/* Tabs da ficha */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 14, overflowX: 'auto' }}>
        {([['evolucao', `📈 Evolução (${followups.length})`], ['procedimentos', `⚙️ Procedimentos (${procedures.length})`], ['medicacao', '💊 Medicação'], ['objetivos', '🎯 Objetivos']] as [DTab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setDtab(t)} style={{
            padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 13, fontWeight: 600, color: dtab === t ? ACCENT : '#6b7280',
            borderBottom: `2px solid ${dtab === t ? ACCENT : 'transparent'}`, marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {/* EVOLUÇÃO */}
      {dtab === 'evolucao' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Evolução SOAP</button>
          </div>
          {followups.length === 0 ? (
            <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 10, padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              Sem evoluções. Adiciona a primeira nota SOAP.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {followups.map((f: Followup) => (
                <div key={f.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {new Date(f.followup_date).toLocaleDateString('pt-PT')} {f.shift && `· ${f.shift}`}
                    </span>
                    {f.discussed_with_supervisor && <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#065f46', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>discutido</span>}
                  </div>
                  {f.subjective && <SoapBlock label="S — Subjectivo" color="#1d4ed8" text={f.subjective} />}
                  {f.objective && <SoapBlock label="O — Objectivo" color="#7c3aed" text={f.objective} />}
                  {f.assessment && <SoapBlock label="A — Avaliação" color="#b45309" text={f.assessment} />}
                  {f.plan && <SoapBlock label="P — Plano" color="#0d6e42" text={f.plan} />}
                  {f.supervisor_feedback && (
                    <div style={{ marginTop: 8, padding: 8, background: '#fef3c7', borderRadius: 6, fontSize: 12 }}>
                      <b>Feedback supervisor:</b> {f.supervisor_feedback}
                    </div>
                  )}
                  {(f.subjective || f.objective || f.assessment || f.plan) && (
                    <button onClick={() => improveNote(`${f.subjective || ''}\n${f.objective || ''}\n${f.assessment || ''}\n${f.plan || ''}`)} disabled={busy} style={{ ...btn('ghost'), marginTop: 8, fontSize: 11, padding: '4px 10px' }}>
                      🤖 Pedir feedback IA
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROCEDIMENTOS deste doente */}
      {dtab === 'procedimentos' && <PatientProcedures procedures={procedures} onAdd={addProcedure} onDel={delProcedure} />}

      {/* MEDICAÇÃO */}
      {dtab === 'medicacao' && (
        <EditableField label="Medicação atual deste doente" placeholder="ramipril 5mg, AAS 100mg, atorvastatina 40mg…" initial={patient.current_meds || ''} onSave={v => updatePatient({ current_meds: v })} />
      )}

      {/* OBJETIVOS deste doente */}
      {dtab === 'objetivos' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <EditableField label="Objetivos de aprendizagem com este doente" placeholder="Dominar interpretação do ECG inferior, perceber indicação de PCI primária, treinar comunicação de diagnóstico…" initial={patient.goals || ''} onSave={v => updatePatient({ goals: v })} />
          <EditableField label="O que aprendi" placeholder="Notas livres do que retiveste deste caso" initial={patient.learning_points || ''} onSave={v => updatePatient({ learning_points: v })} />
        </div>
      )}

      {/* Resultado IA legível */}
      {aiResult && (
        <div onClick={() => setAiResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 22, maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{aiResult.title}</h3>
              <button onClick={() => setAiResult(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            {aiResult.ddx ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {(aiResult.ddx.differential || []).map((d: any, i: number) => {
                  const c = d.probability === 'alta' ? '#dc2626' : d.probability === 'média' ? '#d97706' : '#6b7280'
                  return (
                    <div key={i} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{d.dx}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase' }}>{d.probability}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{d.reason}</div>
                    </div>
                  )
                })}
                {aiResult.ddx.next_steps?.length > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Próximos passos</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#374151', lineHeight: 1.7 }}>
                      {aiResult.ddx.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiResult.text}</div>
            )}
          </div>
        </div>
      )}

      {showAdd && <FollowupModal onClose={() => setShowAdd(false)} onSave={addFollowup} />}
    </main>
  )
}

// Procedimentos efetuados NESTE doente
function PatientProcedures({ procedures, onAdd, onDel }: { procedures: any[]; onAdd: (r: any) => void; onDel: (id: string) => void }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('assisted')
  const LEVELS: Record<string, string> = { observed: 'Observei', assisted: 'Assisti', performed_supervised: 'Fiz com supervisão', performed_alone: 'Fiz sozinho' }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: punção venosa, algaliação, ECG…" style={{ ...input, flex: 1, minWidth: 160 }} />
        <select value={level} onChange={e => setLevel(e.target.value)} style={input}>
          {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => { if (name.trim()) { onAdd({ procedure_name: name.trim(), level }); setName('') } }} style={btn('primary')}>+ Registar</button>
      </div>
      {procedures.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 10, padding: 18, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Sem procedimentos registados neste doente.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {procedures.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.procedure_name}</span>
                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{LEVELS[p.level] || p.level}</span>
              </div>
              <button onClick={() => onDel(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>Apagar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Campo de texto editável com guardar
function EditableField({ label, placeholder, initial, onSave }: { label: string; placeholder: string; initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setV(initial) }, [initial])
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <textarea value={v} onChange={e => { setV(e.target.value); setSaved(false) }} rows={4} placeholder={placeholder} style={{ ...input, resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 8 }}>
        {saved && <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>Guardado ✓</span>}
        <button onClick={() => { onSave(v); setSaved(true) }} style={btn('primary')}>Guardar</button>
      </div>
    </div>
  )
}

function SoapBlock({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}

function FollowupModal({ onClose, onSave }: { onClose: () => void; onSave: (row: any) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [shift, setShift] = useState('manha')
  const [s, setS] = useState('')
  const [o, setO] = useState('')
  const [a, setA] = useState('')
  const [p, setP] = useState('')
  const [discussed, setDiscussed] = useState(false)
  return (
    <Modal title="Nova evolução SOAP" onClose={onClose} wide>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
          <Field label="Turno"><select value={shift} onChange={e => setShift(e.target.value)} style={input}><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></Field>
        </div>
        <Field label="S — Subjectivo (queixas do doente)"><textarea rows={2} value={s} onChange={e => setS(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Refere melhoria da dor torácica..." /></Field>
        <Field label="O — Objectivo (exame, vitais, exames)"><textarea rows={2} value={o} onChange={e => setO(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="TA 130/80, FC 78, apirético. Sem edema MI. Troponina 0.05..." /></Field>
        <Field label="A — Avaliação (raciocínio)"><textarea rows={2} value={a} onChange={e => setA(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="STEMI inferior pós-PCI primária dia 1, estável..." /></Field>
        <Field label="P — Plano"><textarea rows={2} value={p} onChange={e => setP(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Manter dupla antiagregação, IECA, BB. Reavaliar amanhã." /></Field>
        <label style={{ display: 'flex', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={discussed} onChange={e => setDiscussed(e.target.checked)} /> Discutido com supervisor
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ followup_date: date, shift, subjective: s, objective: o, assessment: a, plan: p, discussed_with_supervisor: discussed })} style={btn('primary')}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose, title, wide }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, maxWidth: wide ? 640 : 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 13 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
