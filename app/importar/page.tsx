'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ParsedMed {
  name: string
  dose: string
  frequency: string
  indication: string
  confidence: 'high' | 'medium' | 'low'
}

interface ParseResult {
  patient_name: string | null
  meds: ParsedMed[]
  raw_count: number
  notes: string
}

export default function ImportPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [patients, setPatients] = useState<Array<{id:string; name:string}>>([])
  const [newPatientName, setNewPatientName] = useState('')
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useState(() => {
    if (!user || !isPro) return
    supabase.from('patients').select('id, name').eq('user_id', user.id)
      .order('name').then(({ data }) => setPatients(data || []))
  })

  const parse = async () => {
    if (!text.trim()) return
    setParsing(true); setError(''); setParsed(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/import-meds', {
        method: 'POST', headers,
        body: JSON.stringify({ text: text.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsed(data)
      if (data.patient_name && mode === 'new') setNewPatientName(data.patient_name)
    } catch (e: any) { setError(e.message || 'Erro ao interpretar. Tenta novamente.') }
    finally { setParsing(false) }
  }

  const removeMed = (i: number) => {
    if (!parsed) return
    setParsed({ ...parsed, meds: parsed.meds.filter((_, j) => j !== i) })
  }

  const importMeds = async () => {
    if (!parsed || parsed.meds.length === 0 || !user) return
    if (mode === 'existing' && !selectedPatient) { setError('Selecciona um doente.'); return }
    if (mode === 'new' && !newPatientName.trim()) { setError('Introduz o nome do doente.'); return }

    setImporting(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      let patientId = selectedPatient

      // Create new patient if needed
      if (mode === 'new') {
        const { data: pat, error: patErr } = await supabase.from('patients').insert({
          user_id: user.id,
          name: newPatientName.trim(),
        }).select().single()
        if (patErr) throw new Error(patErr.message)
        patientId = pat.id
      }

      // Insert all meds
      const medsToInsert = parsed.meds.map(m => ({
        patient_id: patientId,
        user_id: user.id,
        name: m.name,
        dose: m.dose || null,
        frequency: m.frequency || null,
        indication: m.indication || null,
      }))

      const { error: medsErr } = await supabase.from('patient_meds').insert(medsToInsert)
      if (medsErr) throw new Error(medsErr.message)

      setDone(true)
      setTimeout(() => router.push(`/patients/${patientId}`), 1500)
    } catch (e: any) { setError(e.message) }
    finally { setImporting(false) }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 6 }}>
            {parsed?.meds.length} medicamentos importados
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>A redirecionar para o perfil do doente...</div>
        </div>
      </div>
    )
  }

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 14 }}>Importar lista de medicamentos</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
            Cola qualquer lista de medicamentos — do Sifarma, SClinico, ou escrita à mão. A IA interpreta automaticamente e adiciona ao perfil do doente.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            Activar Plano Pro →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Importação</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 8 }}>Importar lista de medicamentos</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Cola qualquer lista — do Sifarma, SClinico, PDF copiado, ou escrita à mão. Interpretamos automaticamente.
            </p>
          </div>

          {!parsed ? (
            <div>
              {/* Example formats */}
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Exemplos de formatos aceites</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Sifarma / lista simples', example: 'Metformina 850mg 1+0+1\nXarelto 20mg 0+1+0' },
                    { label: 'SClinico / formato clínico', example: 'Enalapril 10mg oral 1x/dia\nAtorvastatin 40mg noite' },
                    { label: 'Escrita livre', example: 'toma brufen 400 de 8 em 8 horas\nomeprazol 20 antes do pequeno almoço' },
                  ].map(({ label, example }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                      <pre style={{ fontSize: 11, color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', borderRadius: 5, padding: '8px', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', margin: 0 }}>{example}</pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Text input */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Lista de medicamentos</div>
                  <button onClick={() => setText('')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>Limpar</button>
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={10}
                  placeholder="Cola aqui a lista de medicamentos...&#10;&#10;Metformina 850mg 1+0+1&#10;Ramipril 5mg 1+0+0&#10;Atorvastatina 40mg 0+0+1&#10;Aspirina 100mg 1+0+0"
                  style={{ width: '100%', border: 'none', padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none', lineHeight: 1.7, background: 'var(--bg-2)' }}
                />
              </div>

              {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 10 }}>{error}</div>}

              <button onClick={parse} disabled={!text.trim() || parsing}
                style={{ width: '100%', padding: '13px', background: text.trim() && !parsing ? 'var(--ink)' : 'var(--bg-3)', color: text.trim() && !parsing ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: text.trim() && !parsing ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {parsing ? 'A interpretar...' : 'Interpretar lista →'}
              </button>
            </div>
          ) : (
            <div>
              {/* Parsed results */}
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-2)' }}>
                  {parsed.meds.length} medicamentos identificados
                  {parsed.patient_name && <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 8 }}>· Doente: {parsed.patient_name}</span>}
                </div>
                <button onClick={() => setParsed(null)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  Recomeçar
                </button>
              </div>

              {parsed.notes && (
                <div style={{ background: 'var(--amber-light)', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  {parsed.notes}
                </div>
              )}

              {/* Meds list */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 0, background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
                  {['Medicamento', 'Dose', 'Frequência', 'Indicação', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {parsed.meds.map((med, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 0, padding: '11px 16px', borderBottom: i < parsed.meds.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      {med.name}
                      {med.confidence === 'low' && <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>verificar</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{med.dose || '—'}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{med.frequency || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{med.indication || '—'}</div>
                    <button onClick={() => removeMed(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16, padding: '2px 6px' }}>×</button>
                  </div>
                ))}
              </div>

              {/* Patient assignment */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Adicionar ao perfil de:</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[['existing', 'Doente existente'], ['new', 'Criar novo doente']].map(([m, label]) => (
                    <button key={m} onClick={() => setMode(m as any)}
                      style={{ padding: '8px 16px', border: `1.5px solid ${mode === m ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 7, background: mode === m ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: mode === m ? 700 : 400, color: mode === m ? '#1d4ed8' : 'var(--ink-3)' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {mode === 'existing' ? (
                  <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
                    <option value="">Seleccionar doente...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                  <input value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                    placeholder="Nome do novo doente"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                )}
              </div>

              {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 10 }}>{error}</div>}

              <button onClick={importMeds} disabled={importing || parsed.meds.length === 0}
                style={{ width: '100%', padding: '13px', background: !importing && parsed.meds.length > 0 ? '#1d4ed8' : 'var(--bg-3)', color: !importing && parsed.meds.length > 0 ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: !importing && parsed.meds.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {importing ? 'A importar...' : `Importar ${parsed.meds.length} medicamentos →`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}