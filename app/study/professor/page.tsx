'use client'

// /study/professor — Modo Professor. TU ensinas o Phlox; ele faz de aluno
// curioso e aponta as tuas lacunas. No fim, avalia a tua explicação.
// Protégé effect: ensinar é a forma nº1 de aprender.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = 'var(--green)'
interface Msg { role: 'student' | 'ai'; content: string }

const SUGESTOES = ['Insuficiência cardíaca', 'Mecanismo dos IECA', 'Ciclo de Krebs', 'Antibióticos beta-lactâmicos', 'Interpretação de gasometria', 'Farmacocinética básica']

export default function ProfessorPage() {
  const { supabase } = useAuth() as any
  const [topic, setTopic] = useState('')
  const [started, setStarted] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [evalResult, setEvalResult] = useState<any>(null)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [msgs, busy])

  // Voz
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR(); r.lang = 'pt-PT'; r.continuous = true; r.interimResults = true
    r.onresult = (e: any) => { let f = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) f += e.results[i][0].transcript + ' '; if (f) setInput(p => p + f) }
    r.onend = () => setRecording(false)
    recRef.current = r
  }, [])
  function toggleRec() { if (!recRef.current) { alert('Voz requer Chrome/Edge.'); return } if (recording) { recRef.current.stop(); setRecording(false) } else { recRef.current.start(); setRecording(true) } }

  async function send(text: string) {
    if (!text.trim() || busy) return
    const newMsgs = [...msgs, { role: 'student' as const, content: text }]
    setMsgs(newMsgs); setInput(''); setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/study/professor', { method: 'POST', headers, body: JSON.stringify({ action: 'ask', topic, message: text, transcript: newMsgs }) })
    const j = await r.json().catch(() => ({}))
    setMsgs(m => [...m, { role: 'ai', content: j.reply || j.error || 'Hmm, não percebi. Podes explicar de outra forma?' }])
    setBusy(false)
  }

  function start() {
    if (!topic.trim()) return
    setStarted(true); setEvalResult(null)
    setMsgs([{ role: 'ai', content: `Boa! Sou o teu aluno. Explica-me **${topic}** como se eu nunca tivesse ouvido falar. Eu vou fazer perguntas. 🙂` }])
  }

  async function evaluate() {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/study/professor', { method: 'POST', headers, body: JSON.stringify({ action: 'evaluate', topic, transcript: msgs }) })
    const j = await r.json().catch(() => ({}))
    setEvalResult(j.evaluation || { error: j.error }); setBusy(false)
  }

  if (!started) {
    return (
      <main style={{ padding: '40px clamp(16px,4vw,32px)', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-5)' }}>Modo Professor</div>
        <h1 style={{ fontSize: 'clamp(24px,5vw,34px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500, margin: '6px 0 10px' }}>Ensina. É como se aprende a sério.</h1>
        <p style={{ color: 'var(--ink-4)', fontSize: 15, lineHeight: 1.6, marginBottom: 22 }}>Escolhe um tema e explica-o ao Phlox. Ele faz de aluno curioso, faz perguntas difíceis e aponta as tuas lacunas. No fim, avalia a tua explicação.</p>
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && start()} placeholder="Que tema vais ensinar?" style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }} />
        <button onClick={start} disabled={!topic.trim()} style={{ padding: '12px 26px', background: ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, cursor: 'pointer', opacity: topic.trim() ? 1 : 0.5 }}>Começar a ensinar</button>
        <div style={{ marginTop: 20, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SUGESTOES.map(s => <button key={s} onClick={() => setTopic(s)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 999, background: 'white', fontSize: 12.5, color: 'var(--ink-3)', cursor: 'pointer' }}>{s}</button>)}
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '14px clamp(12px,3vw,24px)', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div><span style={{ fontSize: 11, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: 1 }}>A ensinar</span><div style={{ fontWeight: 700, fontSize: 16 }}>{topic}</div></div>
        <button onClick={evaluate} disabled={busy || msgs.filter(m => m.role === 'student').length === 0} style={{ padding: '8px 16px', background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Avaliar explicação</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'student' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-5)', marginBottom: 2, textAlign: m.role === 'student' ? 'right' : 'left' }}>{m.role === 'student' ? 'Tu (professor)' : '🎓 Aluno'}</div>
            <div style={{ padding: '10px 13px', borderRadius: 'var(--r-xl)', fontSize: 14, lineHeight: 1.55, background: m.role === 'student' ? ACCENT : 'var(--bg-3)', color: m.role === 'student' ? 'white' : 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{m.content.replace(/\*\*(.+?)\*\*/g, '$1')}</div>
          </div>
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', color: 'var(--ink-5)', fontSize: 13 }}>…</div>}

        {evalResult && !evalResult.error && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-serif,serif)', fontSize: 30, fontWeight: 700, color: evalResult.score >= 70 ? ACCENT : evalResult.score >= 45 ? 'var(--amber)' : 'var(--red)' }}>{evalResult.score}<span style={{ fontSize: 14, color: 'var(--ink-5)' }}>/100</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{evalResult.verdict === 'domina' ? '✓ Dominas o tema' : evalResult.verdict === 'quase' ? '~ Quase lá' : '⚠ Ainda frágil'}</span>
            </div>
            <EvalBlock title="Explicaste bem" items={evalResult.correct} color="var(--green)" />
            <EvalBlock title="Lacunas / imprecisões" items={evalResult.gaps} color="var(--amber)" />
            <EvalBlock title="Não mencionaste" items={evalResult.missed} color="var(--red)" />
            {evalResult.next && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-3)', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: 10 }}>📚 <b>A seguir:</b> {evalResult.next}</div>}
          </div>
        )}
        {evalResult?.error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{evalResult.error}</div>}
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input) }} style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--bg-3)' }}>
        <button type="button" onClick={toggleRec} style={{ padding: '0 12px', border: `1px solid ${recording ? 'var(--red)' : 'var(--roxo-meio)'}`, borderRadius: 'var(--r-md)', background: 'white', color: recording ? 'var(--red)' : 'var(--roxo)', cursor: 'pointer', fontSize: 16 }}>{recording ? '⏺' : '🎤'}</button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Explica… (ou usa a voz)" style={{ flex: 1, padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 14, boxSizing: 'border-box' }} />
        <button type="submit" disabled={busy || !input.trim()} style={{ padding: '0 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, cursor: 'pointer' }}>↑</button>
      </form>
    </main>
  )
}

function EvalBlock({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items?.length) return null
  return <div style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{title}</div>
    {items.map((x, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>· {x}</div>)}
  </div>
}
