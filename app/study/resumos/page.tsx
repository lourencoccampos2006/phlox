'use client'

// /study/resumos — Resumos gerados por IA em vários formatos e níveis.

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

const FORMATS = [
  { id: 'flash',   label: 'Flash',    desc: '5 bullets · ~80 palavras' },
  { id: 'curto',   label: 'Curto',    desc: '200-300 palavras' },
  { id: 'medio',   label: 'Médio',    desc: '500-700 palavras' },
  { id: 'completo', label: 'Completo', desc: '1000-1500 palavras' },
  { id: 'exame',   label: 'Para exame', desc: 'Critérios + pearls' },
  { id: 'pratica', label: 'Prática clínica', desc: 'O que fazer no SU' },
]

const LEVELS = [
  { id: 'estudante',   label: 'Estudante (3º ano)' },
  { id: 'finalista',   label: 'Finalista' },
  { id: 'interno',     label: 'Interno / Pós-grad' },
  { id: 'especialista', label: 'Especialista' },
]

const SUGESTOES = [
  'Insuficiência cardíaca com FE reduzida',
  'Cetoacidose diabética',
  'Pneumonia adquirida na comunidade',
  'STEMI — abordagem',
  'Hipertensão na gravidez',
  'Hipercaliemia grave',
  'AVC isquémico em janela',
  'Anafilaxia',
  'Sepsis-3 e bundle de 1 hora',
  'DPOC exacerbação',
  'Anticoagulantes orais — IECA',
  'Cefaleia em trovão — abordagem',
]

export default function ResumosPage() {
  const { supabase } = useAuth() as any
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState('medio')
  const [level, setLevel] = useState('finalista')
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const [savedMsg, setSavedMsg] = useState('')
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const generate = useCallback(async (t?: string) => {
    const target = (t || topic).trim()
    if (!target || busy) return
    setBusy(true); setErr(null); setSummary(''); setSavedMsg(''); setSavedNoteId(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ topic: target, format, level, domain: domain || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setSummary(j.summary || '')
      if (t) setTopic(t)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }, [topic, format, level, domain, busy, supabase])

  // Guardar o resumo como nota (entra no sistema de memória)
  const saveAsNote = useCallback(async (alsoCards: boolean) => {
    if (!summary || saving) return
    setSaving(true); setSavedMsg(alsoCards ? 'A guardar + gerar flashcards…' : 'A guardar…')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` }
      let noteId = savedNoteId
      if (!noteId) {
        const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify({ title: topic || 'Resumo', body: summary, domain: domain || null, source: 'resumo' }) })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Erro a guardar')
        noteId = j.note?.id; setSavedNoteId(noteId)
      }
      if (alsoCards && noteId) {
        const cr = await fetch('/api/study/cards', { method: 'POST', headers, body: JSON.stringify({ action: 'generate', note_id: noteId, title: topic, text: summary }) })
        const cj = await cr.json()
        setSavedMsg(cj.count != null ? `Guardado · ${cj.count} flashcards na tua revisão` : 'Guardado (flashcards falharam)')
      } else {
        setSavedMsg('Guardado nas tuas notas')
      }
    } catch (e: any) { setSavedMsg(e.message) } finally { setSaving(false) }
  }, [summary, saving, savedNoteId, topic, domain, supabase])

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Resumos IA</h1>
      <p style={{ margin: '4px 0 18px', color: '#6b7280', fontSize: 14 }}>
        Resumos clínicos rigorosos em PT-PT, adaptados ao teu nível e ao formato que precisas.
      </p>

      <form onSubmit={e => { e.preventDefault(); generate() }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Ex: Cetoacidose diabética, ou Estatinas em prevenção primária..."
          style={{ ...input, fontSize: 15, marginBottom: 12 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Formato</label>
            <select value={format} onChange={e => setFormat(e.target.value)} style={input}>
              {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nível</label>
            <select value={level} onChange={e => setLevel(e.target.value)} style={input}>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={busy || !topic.trim()} style={{
          padding: '10px 22px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8,
          fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (busy || !topic.trim()) ? 0.5 : 1,
        }}>{busy ? 'A gerar…' : 'Gerar resumo'}</button>
      </form>

      {/* Sugestões */}
      {!summary && !busy && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Sugestões</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGESTOES.map(s => (
              <button key={s} onClick={() => { setTopic(s); generate(s) }} style={{
                padding: '5px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 999,
                fontSize: 12, color: '#374151', cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginTop: 16, fontSize: 13 }}>{err}</div>}

      {(summary || busy) && (
        <article style={{ marginTop: 22, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 22, lineHeight: 1.65, fontSize: 14, color: '#111827', whiteSpace: 'pre-wrap' }}>
          {busy ? <p style={{ color: '#6b7280' }}>A pensar…</p> : <MarkdownLike text={summary} />}
        </article>
      )}

      {/* Dá propósito ao resumo: entra no sistema de memória */}
      {summary && !busy && (
        <div style={{ marginTop: 12, padding: 14, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#6d28d9' }}>Não percas este resumo</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{savedMsg || 'Guarda-o como nota — vira flashcards que voltam a ti na revisão.'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => saveAsNote(false)} disabled={saving} style={{ padding: '8px 14px', background: 'white', border: '1px solid #c4b5fd', color: '#6d28d9', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Guardar nota</button>
            <button onClick={() => saveAsNote(true)} disabled={saving} style={{ padding: '8px 14px', background: '#6d28d9', border: 'none', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>Guardar + flashcards</button>
          </div>
        </div>
      )}
    </main>
  )
}

function MarkdownLike({ text }: { text: string }) {
  // Renderer simples para o markdown leve dos resumos
  const html = text
    .replace(/^## (.+)$/gm, '<h3 style="font-size:16px; font-weight:700; margin:18px 0 8px; color:#111827">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="margin:8px 0; padding-left:20px">${m}</ul>`)
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
}
