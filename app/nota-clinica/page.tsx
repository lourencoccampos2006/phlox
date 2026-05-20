'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Patient {
  id: string
  name: string
  age: number | null
  sex: string | null
  weight: number | null
  creatinine: number | null
  conditions: string | null
  allergies: string | null
}

interface PatientMed {
  id: string
  name: string
  dose: string | null
  frequency: string | null
}

interface SOAPNote {
  subjective: string
  objective: string
  assessment: string
  plan: string
  monitoring: string
  follow_up: string
  pcne_code?: string
}

export default function NotaClinicaPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientMeds, setPatientMeds] = useState<PatientMed[]>([])
  const [noteType, setNoteType] = useState<'soap' | 'evolucao' | 'alta' | 'interconsulta'>('soap')
  const [context, setContext] = useState('')
  const [findings, setFindings] = useState('')
  const [result, setResult] = useState<SOAPNote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [savedNotes, setSavedNotes] = useState<{ id: string; created_at: string; note_type: string; content: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!user || !isPro) return
    supabase.from('patients').select('id, name, age, sex, weight, creatinine, conditions, allergies')
      .eq('user_id', user.id).order('name', { ascending: true })
      .then(({ data }) => setPatients(data || []))
  }, [user, isPro, supabase])

  useEffect(() => {
    if (!selectedPatientId) { setPatientMeds([]); return }
    supabase.from('patient_meds').select('id, name, dose, frequency').eq('patient_id', selectedPatientId).eq('active', true)
      .then(({ data }) => setPatientMeds(data || []))
  }, [selectedPatientId, supabase])

  useEffect(() => {
    if (!user || !showHistory) return
    supabase.from('clinical_notes').select('id, created_at, note_type, content')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setSavedNotes(data || []))
  }, [user, supabase, showHistory])

  const selectedPatient = patients.find(p => p.id === selectedPatientId)

  const generate = async () => {
    if (!context.trim()) { setError('Descreve o motivo/contexto da nota clínica.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/clinical-note', {
        method: 'POST', headers,
        body: JSON.stringify({
          noteType,
          patient: selectedPatient,
          medications: patientMeds,
          context,
          findings,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro. Tenta novamente.'); return }
      setResult(data)
      // Auto-save to DB
      if (user && selectedPatientId) {
        await supabase.from('clinical_notes').insert({
          user_id: user.id,
          patient_id: selectedPatientId || null,
          note_type: noteType,
          content: formatForSave(data),
        })
      }
    } catch { setError('Erro de rede. Tenta novamente.') }
    setLoading(false)
  }

  function formatForSave(note: SOAPNote): string {
    return `S: ${note.subjective}\nO: ${note.objective}\nA: ${note.assessment}\nP: ${note.plan}`
  }

  function formatForCopy(note: SOAPNote): string {
    const date = new Date().toLocaleDateString('pt-PT')
    const patName = selectedPatient?.name || ''
    return [
      `NOTA CLÍNICA — ${NOTE_TYPES[noteType]} — ${date}${patName ? ` — ${patName}` : ''}`,
      '',
      `S (Subjectivo): ${note.subjective}`,
      '',
      `O (Objectivo): ${note.objective}`,
      '',
      `A (Avaliação): ${note.assessment}`,
      '',
      `P (Plano):\n${note.plan}`,
      '',
      `Monitorização: ${note.monitoring}`,
      '',
      `Seguimento: ${note.follow_up}`,
      note.pcne_code ? `\nCódigo PCNE: ${note.pcne_code}` : '',
    ].filter(l => l !== undefined).join('\n')
  }

  const copy = () => {
    if (!result) return
    navigator.clipboard.writeText(formatForCopy(result))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const NOTE_TYPES: Record<string, string> = {
    soap: 'SOAP',
    evolucao: 'Nota de Evolução',
    alta: 'Nota de Alta',
    interconsulta: 'Interconsulta',
  }

  const inp = {
    border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px',
    fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
    background: 'white',
  }

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 520, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14 }}>Nota Clínica IA</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
            Gera notas SOAP, evoluções e notas de alta em segundos com contexto do doente. Exclusivo Pro e Clinic.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Ver planos →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: '#1d4ed8', borderRadius: 1 }} />
                Clínico · IA
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em' }}>
                Nota Clínica IA
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                SOAP · Evolução · Alta · Interconsulta
              </div>
            </div>
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ padding: '9px 16px', background: showHistory ? '#1d4ed8' : 'rgba(255,255,255,0.08)', color: showHistory ? 'white' : '#94a3b8', border: `1px solid ${showHistory ? '#1d4ed8' : '#334155'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              Histórico
            </button>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>

          {/* Input panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Note type selector */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Tipo de nota</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.entries(NOTE_TYPES) as [string, string][]).map(([k, v]) => (
                  <button key={k} onClick={() => setNoteType(k as any)}
                    style={{ padding: '7px 14px', background: noteType === k ? '#1d4ed8' : 'var(--bg-2)', color: noteType === k ? 'white' : 'var(--ink-3)', border: `1px solid ${noteType === k ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient selector */}
            {patients.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Doente (opcional)</div>
                <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
                  style={{ ...inp, padding: '9px 12px', fontSize: 13 }}>
                  <option value="">Sem doente associado</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>)}
                </select>
                {selectedPatient && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedPatient.age && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 10 }}>{selectedPatient.age}a</span>}
                    {selectedPatient.conditions?.split(/[,;]+/).filter(Boolean).map(c => (
                      <span key={c} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 10 }}>{c.trim()}</span>
                    ))}
                    {patientMeds.slice(0, 4).map(m => (
                      <span key={m.id} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 10 }}>{m.name}</span>
                    ))}
                    {patientMeds.length > 4 && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>+{patientMeds.length - 4}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Context */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Motivo / Contexto *</div>
              <textarea value={context} onChange={e => setContext(e.target.value)} rows={4}
                placeholder={noteType === 'soap' ? 'Ex: Doente com ICC em descompensação, queixa de dispneia de esforço e edemas...' :
                  noteType === 'evolucao' ? 'Ex: Evolução favorável após ajuste de dose de furosemida...' :
                  noteType === 'alta' ? 'Ex: Alta hospitalar após internamento por pneumonia adquirida na comunidade...' :
                  'Ex: Pedido de interconsulta para Nefrologia por IRC G4 em progressão...'}
                style={{ ...inp, resize: 'vertical', minHeight: 100 }} />
            </div>

            {/* Findings */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Achados / Dados objectivos (opcional)</div>
              <textarea value={findings} onChange={e => setFindings(e.target.value)} rows={3}
                placeholder="Ex: TA 148/92, FC 88bpm, SpO2 96%, auscultação com crepitações bibasais, edemas ++..."
                style={{ ...inp, resize: 'vertical' }} />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>
            )}

            <button onClick={generate} disabled={loading || !context.trim()}
              style={{ padding: '14px', background: loading || !context.trim() ? 'var(--ink-5)' : '#1d4ed8', color: 'white', border: 'none', borderRadius: 10, cursor: loading || !context.trim() ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'background 0.15s' }}>
              {loading ? 'A gerar nota...' : `Gerar ${NOTE_TYPES[noteType]} →`}
            </button>
          </div>

          {/* Result panel */}
          {result && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 80 }}>
              <div style={{ background: '#0f172a', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                  {NOTE_TYPES[noteType].toUpperCase()}
                  {selectedPatient && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {selectedPatient.name}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copy}
                    style={{ padding: '6px 14px', background: copied ? '#059669' : 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                  <button onClick={() => window.print()}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                    Imprimir
                  </button>
                </div>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'S — Subjectivo', value: result.subjective, color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'O — Objectivo', value: result.objective, color: '#0d9488', bg: '#f0fdfa' },
                  { label: 'A — Avaliação', value: result.assessment, color: '#7c3aed', bg: '#faf5ff' },
                  { label: 'P — Plano', value: result.plan, color: '#059669', bg: '#f0fdf4' },
                ].map(s => (
                  <div key={s.label} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: 14 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{s.value}</div>
                  </div>
                ))}
                {result.monitoring && (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Monitorização</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.monitoring}</div>
                  </div>
                )}
                {result.follow_up && (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Seguimento</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.follow_up}</div>
                  </div>
                )}
                {result.pcne_code && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.06em' }}>PCNE</span>
                    <span style={{ fontSize: 13, color: '#1d4ed8' }}>{result.pcne_code}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button onClick={() => { setResult(null); setContext(''); setFindings('') }}
                    style={{ flex: 1, padding: '10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                    Nova nota
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History panel */}
        {showHistory && (
          <div style={{ marginTop: 24, background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Notas anteriores</div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18 }}>×</button>
            </div>
            {savedNotes.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem notas guardadas ainda.</div>
            ) : (
              savedNotes.map((n, i) => (
                <div key={n.id} style={{ padding: '14px 18px', borderBottom: i < savedNotes.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 3 }}>
                      {NOTE_TYPES[n.note_type] || n.note_type}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(n.created_at).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {n.content}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
