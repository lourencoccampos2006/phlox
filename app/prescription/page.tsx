'use client'

import { useState, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

interface RxExplained {
  medications: {
    name: string
    active: string
    for_what: string
    how_to_take: string
    duration: string
    important_notes: string[]
    side_effects_watch: string[]
  }[]
  general_advice: string[]
  questions_for_pharmacist: string[]
  questions_for_doctor: string[]
}

export default function PrescriptionPage() {
  const { user, supabase } = useAuth()
  const [text, setText] = useState('')
  const [result, setResult] = useState<RxExplained | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const explain = async () => {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/prescription', { method: 'POST', headers, body: JSON.stringify({ prescription: text.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally { setLoading(false) }
  }

  const handleImage = async (file: File) => {
    setLoading(true); setError('')
    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/prescription', { method: 'POST', headers, body: JSON.stringify({ image: base64, mimeType: file.type }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao processar imagem.')
    } finally { setLoading(false) }
  }

  const EXAMPLE = `Amoxicilina 875mg + Ácido Clavulânico 125mg
1 comprimido de 12/12h durante 7 dias às refeições

Ibuprofeno 400mg
1 comprimido de 8/8h com alimento (SOS dor/febre)

Omeprazol 20mg
1 cápsula em jejum, 30 min antes do pequeno-almoço`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Explicador de Receita</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Cola o texto da receita ou faz upload de uma foto. Explicamos tudo em linguagem simples.</p>
            </div>

            {/* Photo upload */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Foto da receita</div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed var(--border-2)', borderRadius: 6, padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-2)' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>Tirar/seleccionar foto</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>JPG, PNG — receita ou caixa do medicamento</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f) }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>OU</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Texto da receita</label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={'Cola aqui o que está na receita...\n\nEx: Amoxicilina 875mg, 1 comp 12/12h...'}
                rows={6}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
              <button onClick={() => setText(EXAMPLE)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: '6px 0 0' }}>
                Ver exemplo →
              </button>
            </div>

            <button onClick={explain} disabled={!text.trim() || loading}
              style={{ width: '100%', background: text.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: text.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 600, cursor: text.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
              {loading ? 'A explicar...' : 'Explicar receita →'}
            </button>

            <div style={{ marginTop: 16, padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>O que explicamos</div>
              {['Para que serve cada medicamento', 'Como e quando tomar exactamente', 'Efeitos adversos a vigiar', 'Perguntas para o farmacêutico', 'O que NÃO fazer'].map(item => (
                <div key={item} style={{ fontSize: 12, color: 'var(--ink-3)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--green-2)' }}>✓</span>{item}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 120, 80, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '-0.01em' }}>A tua receita, explicada</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  O médico prescreveu, o farmacêutico dispensou — mas ficaste com dúvidas? Cola o texto ou tira foto e explicamos tudo em linguagem simples.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                <div style={{ background: 'var(--green)', borderRadius: '10px 10px 0 0', padding: '16px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', marginBottom: 4 }}>RECEITA EXPLICADA</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', letterSpacing: '-0.01em' }}>{result.medications.length} medicamento{result.medications.length !== 1 ? 's' : ''} identificado{result.medications.length !== 1 ? 's' : ''}</div>
                </div>

                {result.medications.map((med, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px', borderBottom: i < result.medications.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.active}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Para que serve</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{med.for_what}</div>
                      </div>
                      <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Duração</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{med.duration}</div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Como tomar</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{med.how_to_take}</div>
                    </div>
                    {med.important_notes.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ Importante</div>
                        {med.important_notes.map((n, j) => <div key={j} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 3 }}>· {n}</div>)}
                      </div>
                    )}
                  </div>
                ))}

                {/* Questions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', background: 'white' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>💬 Pergunta ao farmacêutico</div>
                    {result.questions_for_pharmacist.map((q, i) => <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 5, lineHeight: 1.5 }}>{i + 1}. {q}</div>)}
                  </div>
                  <div style={{ padding: '16px 20px', background: 'white' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>🏥 Pergunta ao médico</div>
                    {result.questions_for_doctor.map((q, i) => <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 5, lineHeight: 1.5 }}>{i + 1}. {q}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  ⚕️ Esta explicação é educacional. Segue sempre as indicações do teu médico e farmacêutico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}