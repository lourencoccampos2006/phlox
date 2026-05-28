'use client'

// Comunidade estudante — mural de dúvidas, recursos e dicas por área de estudo.
// Cooperação entre pares: publicar, responder, dar upvote.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'

interface Post {
  id: string; author_name?: string; area?: string; kind: 'question' | 'resource' | 'tip'
  subject?: string; title: string; body?: string; link?: string; upvotes: number; answer_count: number; created_at: string
}
interface Answer { id: string; author_name?: string; body: string; upvotes: number; created_at: string }

const KIND = {
  question: { label: 'Dúvida', emoji: '❓', color: '#2563eb', bg: '#eff6ff' },
  resource: { label: 'Recurso', emoji: '📎', color: '#16a34a', bg: '#f0fdf4' },
  tip: { label: 'Dica', emoji: '💡', color: '#d97706', bg: '#fffbeb' },
} as const

export default function ComunidadePage() {
  const { user, supabase } = useAuth() as any
  const area = areaOf(user?.student_area)
  const areaId = user?.student_area || 'other'
  const authorName = (user?.name || 'Estudante').split(' ')[0]

  const [scope, setScope] = useState<'area' | 'all'>('area')
  const [posts, setPosts] = useState<Post[]>([])
  const [voted, setVoted] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [open, setOpen] = useState<Post | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answerText, setAnswerText] = useState('')
  const [form, setForm] = useState({ kind: 'question' as Post['kind'], subject: '', title: '', body: '', link: '' })
  const [busy, setBusy] = useState(false)

  const auth = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const t = await auth()
    const res = await fetch(`/api/comunidade${scope === 'area' ? `?area=${encodeURIComponent(areaId)}` : ''}`, { headers: { Authorization: `Bearer ${t}` } })
    const d = await res.json()
    if (!res.ok) { setErr(d.error || 'Erro'); setLoading(false); return }
    setPosts(d.posts || []); setVoted(d.voted || []); setLoading(false)
  }, [user, scope, areaId, auth])

  useEffect(() => { load() }, [load])

  async function openPost(p: Post) {
    setOpen(p); setAnswers([])
    const t = await auth()
    const res = await fetch(`/api/comunidade?post=${p.id}`, { headers: { Authorization: `Bearer ${t}` } })
    const d = await res.json(); if (res.ok) setAnswers(d.answers || [])
  }
  async function vote(id: string, kind: 'post' | 'answer') {
    if (voted.includes(id)) return
    setVoted(v => [...v, id])
    if (kind === 'post') setPosts(p => p.map(x => x.id === id ? { ...x, upvotes: x.upvotes + 1 } : x))
    else setAnswers(a => a.map(x => x.id === id ? { ...x, upvotes: x.upvotes + 1 } : x))
    const t = await auth()
    await fetch('/api/comunidade', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ vote: id, voteKind: kind }) })
  }
  async function createPost() {
    if (!form.title.trim()) return
    setBusy(true)
    const t = await auth()
    const res = await fetch('/api/comunidade', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ ...form, area: areaId, author_name: authorName }) })
    const d = await res.json()
    if (res.ok && d.post) { setPosts(p => [d.post, ...p]); setShowNew(false); setForm({ kind: 'question', subject: '', title: '', body: '', link: '' }) }
    else setErr(d.error || 'Erro')
    setBusy(false)
  }
  async function sendAnswer() {
    if (!open || !answerText.trim()) return
    setBusy(true)
    const t = await auth()
    const res = await fetch('/api/comunidade', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ post_id: open.id, answer: answerText.trim(), author_name: authorName }) })
    const d = await res.json()
    if (res.ok && d.answer) { setAnswers(a => [...a, d.answer]); setAnswerText(''); setPosts(p => p.map(x => x.id === open.id ? { ...x, answer_count: x.answer_count + 1 } : x)) }
    setBusy(false)
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · Comunidade</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Comunidade</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Tira dúvidas, partilha recursos e ajuda colegas de {area.label}.</p>
          </div>
          <button onClick={() => setShowNew(true)} style={{ padding: '10px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Publicar</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([['area', area.label], ['all', 'Todas as áreas']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${scope === k ? '#7c3aed' : 'var(--border)'}`, background: scope === k ? '#faf5ff' : 'white', color: scope === k ? '#7c3aed' : 'var(--ink-4)', fontSize: 13, fontWeight: scope === k ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{l}</button>
          ))}
        </div>

        {err && <div style={{ ...card, marginBottom: 14, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13 }}>{err}</div>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}</div>
        ) : posts.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Ainda sem publicações. Sê o primeiro a partilhar uma dúvida ou recurso!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map(p => {
              const k = KIND[p.kind]
              return (
                <div key={p.id} style={{ ...card, padding: '14px 16px', display: 'flex', gap: 12 }}>
                  <button onClick={() => vote(p.id, 'post')} disabled={voted.includes(p.id)} title="Upvote"
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: voted.includes(p.id) ? '#faf5ff' : 'white', border: `1.5px solid ${voted.includes(p.id) ? '#7c3aed' : 'var(--border)'}`, borderRadius: 9, padding: '6px 9px', cursor: voted.includes(p.id) ? 'default' : 'pointer', color: voted.includes(p.id) ? '#7c3aed' : 'var(--ink-4)' }}>
                    <span style={{ fontSize: 13 }}>▲</span><span style={{ fontSize: 13, fontWeight: 700 }}>{p.upvotes}</span>
                  </button>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openPost(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: k.color, background: k.bg, padding: '2px 8px', borderRadius: 5 }}>{k.emoji} {k.label}</span>
                      {p.subject && <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{p.subject}</span>}
                      {scope === 'all' && p.area && <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>· {areaOf(p.area).label}</span>}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{p.title}</div>
                    {p.body && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{p.body}</div>}
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#16a34a', textDecoration: 'none' }}>🔗 abrir recurso</a>}
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 5 }}>{p.author_name || 'Estudante'} · {p.answer_count} resposta{p.answer_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Novo post */}
      {showNew && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false) }} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Publicar</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(Object.keys(KIND) as Post['kind'][]).map(k => (
                <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${form.kind === k ? KIND[k].color : 'var(--border)'}`, background: form.kind === k ? KIND[k].bg : 'white', color: form.kind === k ? KIND[k].color : 'var(--ink-4)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{KIND[k].emoji} {KIND[k].label}</button>
              ))}
            </div>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Matéria (ex: Farmacologia)" list="subjects" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <datalist id="subjects">{area.subjects.map(s => <option key={s} value={s} />)}</datalist>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título / pergunta" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Detalhe (opcional)" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
            {form.kind === 'resource' && <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="Link do recurso (https://…)" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />}
            <button onClick={createPost} disabled={busy || !form.title.trim()} style={{ width: '100%', padding: 12, background: form.title.trim() ? '#7c3aed' : 'var(--bg-3)', color: form.title.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: form.title.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{busy ? '…' : 'Publicar'}</button>
          </div>
        </div>
      )}

      {/* Detalhe + respostas */}
      {open && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setOpen(null) }} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: KIND[open.kind].color, background: KIND[open.kind].bg, padding: '2px 8px', borderRadius: 5 }}>{KIND[open.kind].emoji} {KIND[open.kind].label}{open.subject ? ` · ${open.subject}` : ''}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0' }}>{open.title}</h2>
              </div>
              <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            {open.body && <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 8 }}>{open.body}</div>}
            {open.link && <a href={open.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#16a34a', textDecoration: 'none' }}>🔗 {open.link}</a>}
            <div style={{ fontSize: 12, color: 'var(--ink-5)', margin: '8px 0 16px' }}>{open.author_name || 'Estudante'}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Respostas ({answers.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {answers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-5)' }}>Sem respostas. Ajuda este colega!</div> : answers.map(a => (
                <div key={a.id} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10 }}>
                  <button onClick={() => vote(a.id, 'answer')} disabled={voted.includes(a.id)} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', border: `1px solid ${voted.includes(a.id) ? '#7c3aed' : 'var(--border)'}`, borderRadius: 7, padding: '3px 7px', cursor: voted.includes(a.id) ? 'default' : 'pointer', color: voted.includes(a.id) ? '#7c3aed' : 'var(--ink-4)', fontSize: 11, fontWeight: 700 }}>▲ {a.upvotes}</button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{a.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 3 }}>{a.author_name || 'Estudante'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={answerText} onChange={e => setAnswerText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAnswer()} placeholder="Escreve uma resposta…" style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={sendAnswer} disabled={busy || !answerText.trim()} style={{ padding: '0 16px', background: answerText.trim() ? '#7c3aed' : 'var(--bg-3)', color: answerText.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: answerText.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>Responder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
