'use client'

// /study/documentos — RAG pessoal (Pro).
// Carrega os teus PDFs/slides/sebentas → a IA responde COM BASE no teu material,
// citando o documento. "O que diz a minha sebenta sobre X?"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { extractFromFile } from '@/lib/docExtract'

const ACCENT = '#0d6e42'

interface Doc { id: string; title: string; kind: string; chunk_count: number; char_count: number; created_at: string }
interface Source { n: number; title: string; snippet: string }

export default function DocumentosPage() {
  const { supabase } = useAuth() as any
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [err, setErr] = useState('')
  const [docOutput, setDocOutput] = useState<{ title: string; summary?: string; cards?: { front: string; back: string }[] } | null>(null)
  const [docBusy, setDocBusy] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function summarizeDoc(id: string, title: string) {
    setDocBusy(id + ':sum'); setDocOutput(null); setAnswer(''); setErr('')
    const headers = await auth()
    const r = await fetch('/api/study/documents', { method: 'POST', headers, body: JSON.stringify({ action: 'summarize', document_id: id }) })
    const j = await r.json().catch(() => ({}))
    setDocBusy('')
    if (j.summary) setDocOutput({ title, summary: j.summary }); else setErr(j.error || 'Erro')
  }
  async function flashcardsDoc(id: string, title: string) {
    setDocBusy(id + ':fc'); setDocOutput(null); setAnswer(''); setErr('')
    const headers = await auth()
    const r = await fetch('/api/study/documents', { method: 'POST', headers, body: JSON.stringify({ action: 'flashcards', document_id: id }) })
    const j = await r.json().catch(() => ({}))
    setDocBusy('')
    if (j.flashcards?.length) setDocOutput({ title, cards: j.flashcards }); else setErr(j.error || 'Erro')
  }

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const headers = await auth()
    const r = await fetch('/api/study/documents', { headers })
    const j = await r.json().catch(() => ({}))
    setDocs(j.documents || []); setLoading(false)
  }, [auth])
  useEffect(() => { load() }, [load])

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      setUploading(`A ler ${file.name}…`)
      try {
        const ex = await extractFromFile(file)
        if (!ex.text || ex.text.trim().length < 20) { setErr(`${file.name}: sem texto extraível.`); continue }
        setUploading(`A indexar ${file.name}…`)
        const headers = await auth()
        const r = await fetch('/api/study/documents', { method: 'POST', headers, body: JSON.stringify({ action: 'ingest', title: file.name.replace(/\.[^.]+$/, ''), kind: ex.kind, text: ex.text }) })
        const j = await r.json().catch(() => ({}))
        if (j.error) setErr(j.error)
      } catch (e: any) { setErr(`${file.name}: ${e.message || 'falha'}`) }
    }
    setUploading(''); await load()
  }

  async function ask(q?: string) {
    const target = (q ?? question).trim()
    if (!target || busy) return
    if (q) setQuestion(q)
    setBusy(true); setErr(''); setAnswer(''); setSources([])
    try {
      const headers = await auth()
      const r = await fetch('/api/study/documents', { method: 'POST', headers, body: JSON.stringify({ action: 'ask', question: target }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setAnswer(j.answer || ''); setSources(j.sources || [])
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function removeDoc(id: string) {
    if (!confirm('Apagar este documento?')) return
    const headers = await auth()
    await fetch(`/api/study/documents?id=${id}`, { method: 'DELETE', headers })
    await load()
  }

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  return (
    <main style={{ padding: '18px clamp(14px,4vw,32px)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99', marginBottom: 4 }}>Os meus documentos</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Pergunta ao teu próprio material.</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>Carrega as tuas sebentas, slides e PDFs. A IA responde com base neles e cita a fonte.</p>
      </div>

      {/* Upload */}
      <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed #c4b5fd', borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', background: '#faf5ff', marginBottom: 16 }}>
        <div style={{ fontSize: 26, marginBottom: 4 }}>📚</div>
        <div style={{ fontWeight: 700, color: '#6d28d9' }}>Carregar PDF, Word, slides ou texto</div>
        <div style={{ fontSize: 12, color: '#8b8f99', marginTop: 2 }}>{uploading || 'O texto é extraído no teu browser e indexado de forma privada.'}</div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.txt,.md" multiple onChange={onFiles} style={{ display: 'none' }} />
      </div>

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {/* Lista de documentos — com ações Resumir / Flashcards (do antigo /biblioteca) */}
      {docs.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          {docs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: '8px 10px 8px 14px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 120 }}>{d.title}</span>
              <span style={{ fontSize: 11, color: '#8b8f99' }}>{d.chunk_count} trechos</span>
              <button onClick={() => summarizeDoc(d.id, d.title)} disabled={!!docBusy} style={docAct}>{docBusy === d.id + ':sum' ? '…' : '📄 Resumir'}</button>
              <button onClick={() => flashcardsDoc(d.id, d.title)} disabled={!!docBusy} style={docAct}>{docBusy === d.id + ':fc' ? '…' : '🃏 Flashcards'}</button>
              <button onClick={() => removeDoc(d.id)} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Resultado de resumo / flashcards */}
      {docOutput && (
        <article style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>{docOutput.summary ? `Resumo · ${docOutput.title}` : `Flashcards · ${docOutput.title}`}</b>
            <button onClick={() => setDocOutput(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>×</button>
          </div>
          {docOutput.summary && <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{docOutput.summary.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^## /gm, '')}</div>}
          {docOutput.cards && (
            <div style={{ display: 'grid', gap: 8 }}>
              {docOutput.cards.map((c, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.front}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{c.back}</div>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {/* Perguntar */}
      {docs.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', padding: 20 }}>Carrega pelo menos um documento para começar a perguntar.</p>
      ) : (
        <>
          <form onSubmit={e => { e.preventDefault(); ask() }} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex: O que diz a minha sebenta sobre insuficiência cardíaca?"
              style={{ flex: 1, padding: '11px 13px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            <button type="submit" disabled={busy || !question.trim()} style={{ padding: '11px 20px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: busy || !question.trim() ? 0.5 : 1 }}>{busy ? '…' : 'Perguntar'}</button>
          </form>

          {answer && (
            <article style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 18, marginTop: 10 }}>
              <div style={{ fontSize: 14.5, color: '#16181d', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</div>
              {sources.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e7e8ea' }}>
                  <div style={{ fontSize: 11, color: '#8b8f99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Dos teus documentos</div>
                  {sources.map(s => (
                    <div key={s.n} style={{ fontSize: 12.5, color: '#374151', marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${ACCENT}` }}>
                      <b>[{s.n}] {s.title}</b><br /><span style={{ color: '#6b7280' }}>{s.snippet}…</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}
        </>
      )}
    </main>
  )
}

const docAct: React.CSSProperties = { padding: '5px 10px', background: 'white', border: '1px solid #e7e8ea', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }
