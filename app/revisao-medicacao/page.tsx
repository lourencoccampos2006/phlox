'use client'

// /revisao-medicacao — Revisão da Minha Medicação (Pro). Porte para
// consumidor de uma ferramenta clínica: corre o mesmo Decision Engine do
// /assessments clínico, traduzido para linguagem leiga. Auto-carrega a
// medicação (personal_meds), mesmo padrão do /plano-peso.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { SEVERITY_META } from '@/lib/decisionEngine'

const ACCENT = '#0f766e'
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

interface PlainFinding { rule_id: string; severity: keyof typeof SEVERITY_META; plain_title: string; plain_explanation: string; what_to_do: string }
interface ReviewResult {
  summary: string
  findings_plain: PlainFinding[]
  questions_for_doctor: string[]
  simplification_notes: string[]
  disclaimer: string
}

export default function RevisaoMedicacaoPage() {
  const { user, supabase } = useAuth() as any
  const [meds, setMeds] = useState('')
  const [conditions, setConditions] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const { data: personalMeds } = await supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id)
    if (personalMeds?.length) setMeds(personalMeds.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`).join('\n'))
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!meds.trim()) { setError('Adiciona a tua medicação — a revisão tem de ser sobre o que tomas de verdade.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/mymeds-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ medications: meds, conditions, age: age ? parseInt(age) : null, sex: sex || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar revisão')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #134e4a)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Pro</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Revisão da Minha Medicação</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>O mesmo motor de regras clínicas que os profissionais usam — explicado em linguagem simples, sobre a tua medicação real.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>A tua medicação</label>
            <textarea value={meds} onChange={e => setMeds(e.target.value)} rows={5} placeholder="Um medicamento por linha"
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Idade</label>
              <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 68" inputMode="numeric"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Sexo</label>
              <select value={sex} onChange={e => setSex(e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}>
                <option value="">Não indicar</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Condições / diagnósticos</label>
            <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: HTA, DM2, insuficiência renal"
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{ padding: '13px 24px', background: loading ? '#9ca3af' : ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'A rever a tua medicação…' : result ? '↺ Rever de novo' : '✨ Rever a minha medicação'}
          </button>
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, background: '#f0fdfa', borderColor: '#99f6e4' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f766e' }}>{result.summary}</div>
            </div>

            {result.findings_plain?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🔍 O que o motor de regras encontrou</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.findings_plain.map((f, i) => {
                    const meta = SEVERITY_META[f.severity] || SEVERITY_META.info
                    return (
                      <div key={i} style={{ padding: '10px 12px', background: meta.bg, borderRadius: 8, borderLeft: `4px solid ${meta.color}` }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{f.plain_title}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 4 }}>{f.plain_explanation}</div>
                        <div style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>→ {f.what_to_do}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {result.simplification_notes?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>✂️ Podes simplificar</div>
                {result.simplification_notes.map((s, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>• {s}</div>)}
              </div>
            )}

            {result.questions_for_doctor?.length > 0 && (
              <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', marginBottom: 10 }}>❓ Perguntas para levar à próxima consulta</div>
                {result.questions_for_doctor.map((q, i) => <div key={i} style={{ fontSize: 13, color: '#1e40af', marginBottom: 4 }}>• {q}</div>)}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', fontStyle: 'italic' }}>{result.disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  )
}
