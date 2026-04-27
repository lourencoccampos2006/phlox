'use client'

import { useState, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

interface OTCResult {
  symptom: string
  severity_assessment: string
  when_to_see_doctor: string[]
  red_flags: string[]
  recommended_otc: {
    name: string
    active: string
    dose: string
    when: string
    notes: string
    avoid_if: string[]
  }[]
  alternatives: string[]
  non_pharmacological: string[]
  duration_expected: string
}

const SYMPTOM_EXAMPLES = [
  'Dor de cabeça', 'Febre', 'Tosse seca', 'Tosse com expetoração',
  'Dor de garganta', 'Nariz entupido', 'Azia / refluxo', 'Diarreia',
  'Obstipação', 'Dor muscular', 'Insónia', 'Alergias / rinite',
  'Dor menstrual', 'Herpes labial', 'Candidíase vaginal', 'Pé de atleta',
]

function PhotoCapture({ onCapture, loading = false }: {
  onCapture: (base64: string, mimeType: string) => void
  loading?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    onCapture(base64, file.type || 'image/jpeg')
  }
  return (
    <div>
      <div onClick={() => !loading && ref.current?.click()}
        style={{ border: '2px dashed var(--border-2)', borderRadius: 8, padding: '14px', textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--bg-2)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 2 }}>
          {loading ? 'A analisar...' : '📷 Foto do sintoma / produto'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
          Foto de erupção, embalagem, ferida, etc.
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}


export default function OTCPage() {
  const { user, supabase } = useAuth()
  const [symptom, setSymptom] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<OTCResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)

  const handlePhoto = async (base64: string, mimeType: string) => {
    setPhotoLoading(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/otc', { method: 'POST', headers,
        body: JSON.stringify({ image: base64, mimeType, symptom: 'analisa a imagem e descreve o sintoma visível' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro ao processar foto.') }
    finally { setPhotoLoading(false) }
  }

  const search = async (sym?: string) => {
    const s = (sym ?? symptom).trim()
    if (!s) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/otc', { method: 'POST', headers, body: JSON.stringify({ symptom: s, context: context.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Guia de Automedicação</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>O que comprar na farmácia sem receita, para cada sintoma.</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Sintoma</label>
              <input value={symptom} onChange={e => setSymptom(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Ex: dor de cabeça, febre, tosse..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Contexto (opcional)</label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                placeholder="Ex: grávida, tomo varfarina, tenho úlcera, é para uma criança de 8 anos..."
                rows={3}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <PhotoCapture onCapture={handlePhoto} loading={photoLoading} />
            </div>
            <button onClick={() => search()} disabled={!symptom.trim() || loading}
              style={{ width: '100%', background: symptom.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: symptom.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 600, cursor: symptom.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '-0.01em' }}>
              {loading ? 'A pesquisar...' : 'Ver recomendações →'}
            </button>

            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Sintomas frequentes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {SYMPTOM_EXAMPLES.map(s => (
                  <button key={s} onClick={() => { setSymptom(s); search(s) }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[60, 120, 80, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏥</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '-0.01em' }}>O que comprar na farmácia</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Descreve o sintoma e recebe recomendações específicas de medicamentos OTC, com doses, quando usar e quando ir ao médico.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {/* Red flags first if any */}
                {result.red_flags.length > 0 && (
                  <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#7f1d1d', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>🚨 SINAIS DE ALARME — VAI URGENTEMENTE AO MÉDICO SE:</div>
                    {result.red_flags.map((f, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#742a2a', marginBottom: 4, display: 'flex', gap: 8 }}>
                        <span>·</span>{f}
                      </div>
                    ))}
                  </div>
                )}

                {/* Header */}
                <div style={{ background: 'var(--green)', borderRadius: '10px 10px 0 0', padding: '18px 22px', marginBottom: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', marginBottom: 4 }}>AUTOMEDICAÇÃO</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>{result.symptom}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{result.severity_assessment}</div>
                </div>

                {/* OTC recommendations */}
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>💊 O que comprar</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.recommended_otc.map((med, i) => (
                      <div key={i} style={{ border: `1px solid ${i === 0 ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, padding: '14px 16px', background: i === 0 ? 'var(--green-light)' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{med.active}</span>
                          </div>
                          {i === 0 && <span style={{ fontSize: 10, background: 'var(--green)', color: 'white', padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0 }}>RECOMENDADO</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}><strong>Dose:</strong> {med.dose}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}><strong>Quando:</strong> {med.when}</div>
                        {med.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 4 }}>{med.notes}</div>}
                        {med.avoid_if.length > 0 && (
                          <div style={{ fontSize: 12, color: '#7f1d1d', background: '#fff5f5', padding: '6px 10px', borderRadius: 5, marginTop: 6 }}>
                            ⚠ Evitar se: {med.avoid_if.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Non-pharma + when to see doctor */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none' }}>
                  <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🌿 Sem medicamentos</div>
                    {result.non_pharmacological.map((n, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--green-2)' }}>→</span>{n}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🏥 Vai ao médico se</div>
                    {result.when_to_see_doctor.map((w, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--amber)' }}>·</span>{w}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px 20px', background: 'var(--bg-2)' }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>⏱ Duração esperada: {result.duration_expected}</span>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  ⚕️ Informação educacional. Se os sintomas piorarem ou persistirem, consulta um profissional de saúde.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}