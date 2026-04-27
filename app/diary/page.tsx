'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface DiaryEntry {
  id: string
  date: string
  wellbeing: number
  symptoms: string[]
  notes: string
  medications: string[]
  created_at: string
}

interface DiaryAnalysis {
  summary: string
  patterns: { observation: string; significance: string; action: string }[]
  adverse_effects_possible: string[]
  bring_to_doctor: string[]
  positive_trends: string[]
}

const SYMPTOM_OPTIONS = [
  'Fadiga', 'Tonturas', 'Náuseas', 'Dor de cabeça', 'Dores musculares',
  'Palpitações', 'Falta de ar', 'Insónia', 'Sonolência', 'Apetite reduzido',
  'Dores abdominais', 'Obstipação', 'Diarreia', 'Tosse', 'Comichão',
  'Edema', 'Suores', 'Ansiedade', 'Humor deprimido', 'Confusão',
]

const WELLBEING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Muito mau', color: '#dc2626' },
  2: { label: 'Mau', color: '#ef4444' },
  3: { label: 'Razoável', color: '#f59e0b' },
  4: { label: 'Bom', color: '#22c55e' },
  5: { label: 'Muito bom', color: '#16a34a' },
}

export default function DiaryPage() {
  const { user, supabase } = useAuth()
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [view, setView] = useState<'today' | 'history' | 'analysis'>('today')
  const [wellbeing, setWellbeing] = useState(3)
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analysis, setAnalysis] = useState<DiaryAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [meds, setMeds] = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]
  const todayEntry = entries.find(e => e.date === today)

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: entriesData }, { data: medsData }] = await Promise.all([
      supabase.from('diary_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(60),
      supabase.from('personal_meds').select('name').eq('user_id', user.id),
    ])
    setEntries(entriesData || [])
    setMeds((medsData || []).map((m: any) => m.name))
    // Pre-fill if today already has entry
    const te = (entriesData || []).find((e: any) => e.date === today)
    if (te) {
      setWellbeing(te.wellbeing)
      setSelectedSymptoms(te.symptoms || [])
      setNotes(te.notes || '')
    }
  }, [user, supabase, today])

  useEffect(() => { load() }, [load])

  const saveEntry = async () => {
    if (!user) return
    setSaving(true)
    const entry = {
      user_id: user.id,
      date: today,
      wellbeing,
      symptoms: selectedSymptoms,
      notes: notes.trim(),
      medications: meds,
    }
    if (todayEntry) {
      await supabase.from('diary_entries').update(entry).eq('id', todayEntry.id)
    } else {
      await supabase.from('diary_entries').insert(entry)
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  const getAnalysis = async () => {
    if (entries.length < 3) return
    setAnalysisLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/diary/analysis', {
        method: 'POST', headers,
        body: JSON.stringify({ entries: entries.slice(0, 30), medications: meds })
      })
      const data = await res.json()
      if (res.ok) setAnalysis(data)
    } catch {}
    setAnalysisLoading(false)
  }

  const wb = WELLBEING_LABELS[wellbeing]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container" style={{ paddingTop: 32, paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Diário de saúde</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>Diário de Sintomas</h1>
          </div>
          <div style={{ display: 'flex', gap: 1, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[['today', 'Hoje'], ['history', 'Histórico'], ['analysis', 'Análise']].map(([id, label]) => (
              <button key={id} onClick={() => { setView(id as any); if (id === 'analysis') getAnalysis() }}
                style={{ padding: '8px 16px', background: view === id ? 'white' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: view === id ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* TODAY */}
        {view === 'today' && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>

              {/* Wellbeing */}
              <div style={{ padding: '22px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Como te sentes hoje?</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setWellbeing(n)}
                      style={{ flex: 1, padding: '14px 0', border: `2px solid ${wellbeing === n ? WELLBEING_LABELS[n].color : 'var(--border)'}`, borderRadius: 8, background: wellbeing === n ? WELLBEING_LABELS[n].color + '15' : 'white', cursor: 'pointer', fontSize: 18, fontWeight: 800, color: wellbeing === n ? WELLBEING_LABELS[n].color : 'var(--ink-5)', transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: wb.color, fontWeight: 700, letterSpacing: '-0.01em' }}>{wb.label}</div>
              </div>

              {/* Symptoms */}
              <div style={{ padding: '22px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Sintomas hoje {selectedSymptoms.length > 0 && <span style={{ color: 'var(--green)' }}>({selectedSymptoms.length} seleccionados)</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {SYMPTOM_OPTIONS.map(s => (
                    <button key={s} onClick={() => toggleSymptom(s)}
                      style={{ padding: '6px 13px', border: `1.5px solid ${selectedSymptoms.includes(s) ? 'var(--green)' : 'var(--border)'}`, borderRadius: 20, background: selectedSymptoms.includes(s) ? 'var(--green-light)' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: selectedSymptoms.includes(s) ? 700 : 400, color: selectedSymptoms.includes(s) ? 'var(--green)' : 'var(--ink-3)', transition: 'all 0.15s', fontFamily: 'var(--font-sans)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ padding: '22px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Notas (opcional)</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Tomaste o medicamento? Algo diferente hoje? Dormiste bem?"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none', lineHeight: 1.6 }} />
              </div>

              {/* Meds snapshot */}
              {meds.length > 0 && (
                <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Medicação actual (registada)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {meds.map(m => <span key={m} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: 12 }}>{m}</span>)}
                  </div>
                </div>
              )}

              {/* Save */}
              <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={saveEntry} disabled={saving}
                  style={{ flex: 1, padding: '12px', background: saving ? 'var(--bg-3)' : 'var(--ink)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
                  {saving ? 'A guardar...' : todayEntry ? 'Actualizar registo' : 'Guardar registo de hoje'}
                </button>
                {saved && <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>✓ Guardado</span>}
              </div>
            </div>

            {entries.length < 3 && (
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', fontSize: 13, color: 'var(--green-2)', lineHeight: 1.6 }}>
                Regista pelo menos 3 dias para desbloquear a análise farmacológica — padrões entre sintomas e medicação.
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <div style={{ maxWidth: 680 }}>
            {entries.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                Nenhum registo ainda. Começa por preencher o registo de hoje.
              </div>
            ) : (
              <div>
                {/* Mini chart */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Bem-estar — últimos {Math.min(entries.length, 14)} dias</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                    {entries.slice(0, 14).reverse().map(e => (
                      <div key={e.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', background: WELLBEING_LABELS[e.wellbeing]?.color || 'var(--border)', borderRadius: '3px 3px 0 0', height: `${e.wellbeing * 12}px`, transition: 'height 0.3s', minHeight: 4 }} />
                        <div style={{ fontSize: 8, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(e.date).getDate()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Entry list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {entries.map(entry => {
                    const wb = WELLBEING_LABELS[entry.wellbeing]
                    return (
                      <div key={entry.id} style={{ background: 'white', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: wb?.color + '15', border: `2px solid ${wb?.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: wb?.color, flexShrink: 0 }}>
                          {entry.wellbeing}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                              {new Date(entry.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </div>
                            <div style={{ fontSize: 11, color: wb?.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wb?.label}</div>
                          </div>
                          {entry.symptoms?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: entry.notes ? 6 : 0 }}>
                              {entry.symptoms.map(s => <span key={s} style={{ fontSize: 10, color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 8, fontFamily: 'var(--font-mono)' }}>{s}</span>)}
                            </div>
                          )}
                          {entry.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, fontStyle: 'italic' }}>{entry.notes}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ANALYSIS */}
        {view === 'analysis' && (
          <div style={{ maxWidth: 680 }}>
            {entries.length < 3 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>Análise farmacológica</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7 }}>Precisas de pelo menos 3 dias de registos para gerar a análise.</p>
              </div>
            ) : analysisLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 120, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            ) : analysis ? (
              <div className="fade-in">
                {/* Summary */}
                <div style={{ background: 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Análise farmacológica — {entries.length} dias</div>
                  <p style={{ fontSize: 15, color: 'white', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{analysis.summary}</p>
                </div>

                {/* Patterns */}
                {analysis.patterns.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Padrões identificados</div>
                    {analysis.patterns.map((p, i) => (
                      <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '14px 16px', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>{p.observation}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 6 }}>{p.significance}</div>
                        <div style={{ fontSize: 12, color: 'var(--green-2)', fontWeight: 600 }}>→ {p.action}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Possible adverse effects */}
                {analysis.adverse_effects_possible.length > 0 && (
                  <div style={{ border: '1px solid #fecaca', borderTop: 'none', background: 'var(--red-light)', padding: '16px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Possíveis efeitos adversos a considerar</div>
                    {analysis.adverse_effects_possible.map((e, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 4, lineHeight: 1.5 }}>· {e}</div>
                    ))}
                  </div>
                )}

                {/* Bring to doctor */}
                {analysis.bring_to_doctor.length > 0 && (
                  <div style={{ border: '1px solid #fde68a', borderTop: 'none', background: 'var(--amber-light)', padding: '16px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Levar à próxima consulta</div>
                    {analysis.bring_to_doctor.map((b, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>→ {b}</div>
                    ))}
                  </div>
                )}

                {/* Positive trends */}
                {analysis.positive_trends.length > 0 && (
                  <div style={{ border: '1px solid var(--green-mid)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'var(--green-light)', padding: '16px 22px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Tendências positivas</div>
                    {analysis.positive_trends.map((t, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--green-2)', marginBottom: 4 }}>✓ {t}</div>
                    ))}
                  </div>
                )}

                {/* Prepare consulta CTA */}
                <div style={{ marginTop: 12 }}>
                  <Link href="/consult-prep" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>Preparar a próxima consulta</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Usa esta análise para gerar as perguntas certas para o médico</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>

                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button onClick={getAnalysis} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--green)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Actualizar análise →
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={getAnalysis}
                style={{ width: '100%', padding: '20px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Gerar análise farmacológica ({entries.length} dias de dados)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}