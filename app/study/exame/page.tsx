'use client'

// /study/exame — Gerador de exame a partir do material do estudante (RAG).
// Prevê perguntas prováveis (escolha + desenvolvimento) e corrige as respostas
// de escrever. Liga-se a /study/documentos (sebentas, slides, testes do professor).

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'

interface Q {
  type: 'escrita' | 'escolha'
  question: string
  options?: string[]
  correct_index?: number
  model_answer?: string
  key_points?: string[]
  why_likely?: string
}
interface Grade { score: number; covered: string[]; missing: string[]; errors: string[]; feedback: string }

export default function ExamePage() {
  const { supabase } = useAuth() as any
  const [topic, setTopic] = useState('')
  const [style, setStyle] = useState('misto')
  const [count, setCount] = useState(6)
  const [busy, setBusy] = useState(false)
  const [questions, setQuestions] = useState<Q[]>([])
  const [answers, setAnswers] = useState<Record<number, string | number>>({})
  const [grades, setGrades] = useState<Record<number, Grade>>({})
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [err, setErr] = useState('')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  async function generate() {
    setBusy(true); setErr(''); setQuestions([]); setAnswers({}); setGrades({}); setRevealed({})
    try {
      const headers = await auth()
      const r = await fetch('/api/study/exam-generator', { method: 'POST', headers, body: JSON.stringify({ action: 'generate', topic, style, count }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setQuestions(j.questions || [])
      if (!j.questions?.length) setErr('Não consegui gerar perguntas. Carrega material em /study/documentos ou indica um tópico mais específico.')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function grade(i: number) {
    const q = questions[i]; const ans = answers[i]
    if (q.type !== 'escrita' || typeof ans !== 'string' || !ans.trim()) return
    const headers = await auth()
    const r = await fetch('/api/study/exam-generator', { method: 'POST', headers, body: JSON.stringify({ action: 'grade', question: q.question, model_answer: q.model_answer, key_points: q.key_points, answer: ans }) })
    const j = await r.json()
    if (j.result) setGrades(g => ({ ...g, [i]: j.result }))
  }

  return (
    <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99' }}>Gerador de exame</div>
      <h1 style={{ margin: '4px 0 4px', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>O que é provável sair no teu exame.</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>A partir do <Link href="/study/documentos" style={{ color: ACCENT, fontWeight: 600 }}>teu material</Link> (sebentas, slides, testes do professor), prevejo perguntas — incluindo de desenvolvimento — e corrijo as tuas respostas.</p>

      {questions.length === 0 && (
        <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 16 }}>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Cadeira / tópico (ex: Farmacologia — sistema cardiovascular)" style={inp} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="misto">Misto (escolha + escrita)</option>
              <option value="escrita">Só desenvolvimento</option>
              <option value="escolha">Só escolha múltipla</option>
            </select>
            <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ ...inp, width: 'auto' }}>
              {[4, 6, 8, 10].map(n => <option key={n} value={n}>{n} perguntas</option>)}
            </select>
            <button onClick={generate} disabled={busy} style={{ padding: '10px 20px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'A gerar…' : 'Gerar exame'}</button>
          </div>
        </div>
      )}

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 12, borderRadius: 8, marginTop: 14, fontSize: 13 }}>{err}</div>}

      {questions.length > 0 && (
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          {questions.map((q, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{i + 1}. {q.question}</span>
                <span style={{ fontSize: 10, color: q.type === 'escrita' ? '#6d28d9' : '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{q.type === 'escrita' ? '✍ desenvolvimento' : 'escolha'}</span>
              </div>

              {q.type === 'escolha' && q.options ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {q.options.map((opt, oi) => {
                    const sel = answers[i] === oi
                    const showCorrect = revealed[i] && oi === q.correct_index
                    const showWrong = revealed[i] && sel && oi !== q.correct_index
                    return (
                      <button key={oi} onClick={() => !revealed[i] && setAnswers(a => ({ ...a, [i]: oi }))} style={{
                        textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: revealed[i] ? 'default' : 'pointer', fontSize: 13.5,
                        border: `1px solid ${showCorrect ? ACCENT : showWrong ? '#dc2626' : sel ? '#1d4ed8' : '#e7e8ea'}`,
                        background: showCorrect ? '#f0fdf5' : showWrong ? '#fef2f2' : sel ? '#eff6ff' : 'white',
                      }}>{String.fromCharCode(65 + oi)}. {opt}</button>
                    )
                  })}
                  {!revealed[i] && <button onClick={() => setRevealed(r => ({ ...r, [i]: true }))} style={btnGhost}>Ver resposta</button>}
                </div>
              ) : (
                <div>
                  <textarea value={(answers[i] as string) || ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} rows={4} placeholder="Escreve a tua resposta…" style={{ ...inp, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => grade(i)} disabled={!((answers[i] as string) || '').trim()} style={{ ...btnGhost, color: '#6d28d9', borderColor: '#c4b5fd' }}>Corrigir a minha resposta</button>
                    <button onClick={() => setRevealed(r => ({ ...r, [i]: true }))} style={btnGhost}>Ver resposta-modelo</button>
                  </div>
                  {grades[i] && (
                    <div style={{ marginTop: 10, background: '#f6f7f8', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontWeight: 700, color: grades[i].score >= 60 ? ACCENT : '#d97706' }}>{grades[i].score}/100</div>
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{grades[i].feedback}</div>
                      {grades[i].missing?.length > 0 && <div style={{ fontSize: 12.5, color: '#991b1b', marginTop: 4 }}>Faltou: {grades[i].missing.join('; ')}</div>}
                    </div>
                  )}
                  {revealed[i] && q.model_answer && <div style={{ marginTop: 10, fontSize: 13, color: '#374151', borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12 }}><b>Resposta-modelo:</b> {q.model_answer}</div>}
                </div>
              )}
              {revealed[i] && q.why_likely && <div style={{ fontSize: 11.5, color: '#8b8f99', marginTop: 8 }}>💡 {q.why_likely}</div>}
            </div>
          ))}
          <button onClick={() => { setQuestions([]); setErr('') }} style={{ ...btnGhost, alignSelf: 'flex-start' }}>← Gerar outro exame</button>
        </div>
      )}
    </main>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const btnGhost: React.CSSProperties = { padding: '7px 12px', background: 'white', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }
