'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface ConsultPrep {
  questions_for_doctor: { question: string; why: string; priority: 'alta' | 'normal' }[]
  symptoms_summary: string
  medication_concerns: string[]
  labs_to_request: string[]
  reminders: string[]
}

export default function ConsultPrepPage() {
  const { user, supabase } = useAuth()
  const [consultDate, setConsultDate] = useState('')
  const [doctor, setDoctor] = useState('')
  const [topic, setTopic] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [result, setResult] = useState<ConsultPrep | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meds, setMeds] = useState<string[]>([])
  const [recentSymptoms, setRecentSymptoms] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ data: medsData }, { data: diaryData }] = await Promise.all([
        supabase.from('personal_meds').select('name').eq('user_id', user.id),
        supabase.from('diary_entries').select('symptoms').eq('user_id', user.id).order('date', { ascending: false }).limit(7),
      ])
      setMeds((medsData || []).map((m: any) => m.name))
      const allSymptoms = (diaryData || []).flatMap((d: any) => d.symptoms || [])
      const freq = allSymptoms.reduce((acc: Record<string, number>, s: string) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {})
      const sorted = (Object.entries(freq) as [string, number][]).sort((a, b) => b[1] - a[1])
      setRecentSymptoms(sorted.slice(0, 5).map(([s]) => s))
    }
    load()
  }, [user, supabase])

  const prepare = async () => {
    if (!topic.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/consult-prep', {
        method: 'POST', headers,
        body: JSON.stringify({ topic, doctor, medications: meds, recent_symptoms: recentSymptoms, extra_context: extraContext })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const printPrep = () => window.print()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Preparação de consulta</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 6 }}>Preparar a Consulta</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>As perguntas certas para fazer ao médico, com base na tua medicação e sintomas recentes.</p>
            </div>

            {/* Context from profile */}
            {(meds.length > 0 || recentSymptoms.length > 0) && (
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Contexto do teu perfil</div>
                {meds.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}><strong>Medicação:</strong> {meds.join(', ')}</div>}
                {recentSymptoms.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}><strong>Sintomas recentes:</strong> {recentSymptoms.join(', ')}</div>}
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Assunto principal da consulta *
              </label>
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && prepare()}
                placeholder="Ex: renovar medicação, dor persistente, resultado das análises..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '12px' }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Data</label>
                <input type="date" value={consultDate} onChange={e => setConsultDate(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '12px' }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Médico</label>
                <input value={doctor} onChange={e => setDoctor(e.target.value)}
                  placeholder="Ex: Dr. Família"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Contexto adicional (opcional)
              </label>
              <textarea value={extraContext} onChange={e => setExtraContext(e.target.value)} rows={3}
                placeholder="Ex: tenho sentido mais tonturas desde que mudei o bisoprolol, as análises vieram com o colesterol alto..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
            </div>

            <button onClick={prepare} disabled={!topic.trim() || loading}
              style={{ width: '100%', background: topic.trim() && !loading ? 'var(--ink)' : 'var(--bg-3)', color: topic.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 700, cursor: topic.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {loading ? 'A preparar...' : 'Preparar consulta →'}
            </button>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>O que recebes</div>
              {['Perguntas prioritárias para o médico', 'Resumo dos sintomas recentes', 'Análises a pedir', 'Preocupações com a medicação actual'].map(item => (
                <div key={item} style={{ fontSize: 12, color: 'var(--ink-3)', padding: '3px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--green)' }}>✓</span>{item}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[60, 100, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}</div>}
            {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{error}</p></div>}
            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>Para a tua próxima consulta</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  O médico tem 15 minutos. Usa-os bem. Diz-nos o assunto da consulta e geramos as perguntas certas, por ordem de prioridade.
                </p>
              </div>
            )}
            {result && !loading && (
              <div className="fade-in">
                {/* Header */}
                <div style={{ background: 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                      {consultDate ? new Date(consultDate).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Preparação de consulta'}
                      {doctor ? ` · ${doctor}` : ''}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>{topic}</div>
                  </div>
                  <button onClick={printPrep}
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Imprimir
                  </button>
                </div>

                {/* Questions */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Perguntas para o médico</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.questions_for_doctor.map((q, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '13px 16px', background: q.priority === 'alta' ? 'var(--green-light)' : 'var(--bg-2)', border: `1px solid ${q.priority === 'alta' ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 8 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)', minWidth: 20, paddingTop: 1 }}>{i + 1}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>{q.question}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{q.why}</div>
                        </div>
                        {q.priority === 'alta' && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', border: '1px solid var(--green-mid)', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', height: 'fit-content', flexShrink: 0, marginLeft: 'auto' }}>PRIORITÁRIA</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Side by side: labs + concerns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none' }}>
                  {result.labs_to_request.length > 0 && (
                    <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Análises a pedir</div>
                      {result.labs_to_request.map((l, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, display: 'flex', gap: 6 }}><span style={{ color: 'var(--green)' }}>→</span>{l}</div>)}
                    </div>
                  )}
                  {result.medication_concerns.length > 0 && (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Medicação a discutir</div>
                      {result.medication_concerns.map((c, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, display: 'flex', gap: 6 }}><span style={{ color: 'var(--amber)' }}>·</span>{c}</div>)}
                    </div>
                  )}
                </div>

                {/* Symptoms summary */}
                {result.symptoms_summary && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '14px 22px', background: 'var(--bg-2)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Resumo de sintomas recentes</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{result.symptoms_summary}</p>
                  </div>
                )}

                {result.reminders.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px 22px', background: 'white' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Não esqueças de levar</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.reminders.map((r, i) => (
                        <span key={i} style={{ fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 20, color: 'var(--ink-2)' }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Informação educacional — segue sempre o conselho do teu médico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}