'use client'

// Phlox AI Copilot — assistente clínico ancorado no Decision Engine.
// O motor determinístico corre primeiro; a IA explica e organiza, mas só usa
// regras documentadas. Cada recomendação cita o id da regra (R1, R7…).
// Requer plano Pro.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { runRules, riskScore, SEVERITY_META, type ClinicalCase, type Finding } from '@/lib/decisionEngine'

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

function splitLines(s: string): string[] { return s.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean) }

const QUICK_QUESTIONS = [
  'Analisa o caso e prioriza ações para hoje.',
  'Que medicação devo desprescrever primeiro?',
  'Plano de monitorização para a próxima semana.',
  'Como abordar este caso na próxima consulta?',
]

export default function CopilotPage() {
  const { supabase } = useAuth() as any
  const [age, setAge] = useState(''); const [sex, setSex] = useState<'M' | 'F' | ''>('')
  const [egfr, setEgfr] = useState(''); const [qtc, setQtc] = useState('')
  const [conds, setConds] = useState(''); const [meds, setMeds] = useState('')
  const [question, setQuestion] = useState('')
  const [thinking, setThinking] = useState(false)
  const [answer, setAnswer] = useState<{ text: string; findings: Finding[]; score: number; provider: string; model: string } | null>(null)
  const [err, setErr] = useState('')

  const cse: ClinicalCase = useMemo(() => ({
    age: age ? Number(age) : undefined,
    sex: sex || undefined,
    egfr: egfr ? Number(egfr) : undefined,
    qtc_ms: qtc ? Number(qtc) : undefined,
    conditions: splitLines(conds),
    meds: splitLines(meds),
  }), [age, sex, egfr, qtc, conds, meds])

  const previewFindings = useMemo(() => runRules(cse), [cse])
  const previewScore = useMemo(() => riskScore(previewFindings), [previewFindings])

  async function ask(q?: string) {
    const finalQ = (q || question).trim()
    if (!finalQ) { setErr('Escreve uma pergunta ou escolhe um atalho.'); return }
    if ((cse.meds?.length ?? 0) === 0 && (cse.conditions?.length ?? 0) === 0 && !cse.age) { setErr('Preenche pelo menos idade ou medicação.'); return }
    setThinking(true); setErr(''); setAnswer(null)
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ case: cse, question: finalQ }) })
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'Erro')
      else setAnswer({ text: j.answer, findings: j.decision_engine.findings, score: j.decision_engine.risk_score, provider: j.provider, model: j.model })
    } catch (e: any) { setErr(String(e?.message || e)) }
    setThinking(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1080 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Copilot (Pro)</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>AI Copilot clínico</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>Não inventa. Ancorado no <Link href="/motor-clinico" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Decision Engine</Link>. Cada recomendação cita a regra (R1, R7…) — auditável.</p>
        </div>

        <div className="copilot-grid" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Caso */}
          <div style={{ ...card }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><span style={lbl}>Idade</span><input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="anos" style={inp} /></div>
              <div>
                <span style={lbl}>Sexo</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['M', 'F'] as const).map(s => <button key={s} onClick={() => setSex(sex === s ? '' : s)} style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13, fontWeight: 700, border: `1.5px solid ${sex === s ? '#0d6e42' : 'var(--border)'}`, background: sex === s ? '#eef6f1' : 'white', color: sex === s ? '#0d6e42' : 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{s}</button>)}
                </div>
              </div>
              <div><span style={lbl}>TFG</span><input type="number" value={egfr} onChange={e => setEgfr(e.target.value)} placeholder="mL/min" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><span style={lbl}>QTc (ms)</span><input type="number" value={qtc} onChange={e => setQtc(e.target.value)} placeholder="opcional" style={inp} /></div>
            <div style={{ marginBottom: 12 }}>
              <span style={lbl}>Condições</span>
              <textarea value={conds} onChange={e => setConds(e.target.value)} rows={3} placeholder="Insuficiência cardíaca, asma…" style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div>
              <span style={lbl}>Medicação</span>
              <textarea value={meds} onChange={e => setMeds(e.target.value)} rows={6} placeholder={'Furosemida 40 mg\nVarfarina 5 mg\nIbuprofeno 400 mg'} style={{ ...inp, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5 }} />
            </div>

            {previewFindings.length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 9, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                <strong>Decision Engine:</strong> {previewFindings.length} achado(s) · score {previewScore}.
                {' '}{previewFindings.slice(0, 3).map(f => f.id).join(' · ')}{previewFindings.length > 3 ? '…' : ''}
              </div>
            )}
          </div>

          {/* Pergunta + resposta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card}>
              <span style={lbl}>Pergunta ao Copilot</span>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Ex: analisa este caso e propõe plano." style={{ ...inp, resize: 'vertical' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => { setQuestion(q); ask(q) }} disabled={thinking} style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'white', color: '#374151', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{q}</button>
                ))}
              </div>
              <button onClick={() => ask()} disabled={thinking} style={{ width: '100%', marginTop: 12, padding: 12, background: thinking ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: thinking ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {thinking ? 'A pensar…' : 'Perguntar ao Copilot'}
              </button>
              {err && <div style={{ marginTop: 10, padding: '9px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}
            </div>

            {answer && (
              <>
                {/* Resposta da IA */}
                <div style={{ ...card, borderColor: '#bbf7d0', background: '#f8fdfb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resposta do Copilot</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{answer.provider} · {answer.model} · score {answer.score}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{answer.text}</div>
                </div>

                {/* Citações: achados do Engine */}
                {answer.findings.length > 0 && (
                  <div style={{ ...card }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Citações — regras do Decision Engine</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {answer.findings.map(f => (
                        <div key={f.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderLeft: `3px solid ${SEVERITY_META[f.severity].color}`, background: SEVERITY_META[f.severity].bg, borderRadius: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: SEVERITY_META[f.severity].color, minWidth: 26 }}>{f.id}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{f.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{f.detail}{f.reference ? ` · ${f.reference}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 860px){ .copilot-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
