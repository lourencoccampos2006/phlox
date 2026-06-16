'use client'

// /biblioteca — Biblioteca de estudo do utilizador.
// Carrega PDFs, .docx, .pptx ou cola texto e o Phlox extrai (no browser) +
// gera resumo, mapa conceptual, perguntas e flashcards. Tudo guardado em
// Supabase para reabrir mais tarde.

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { extractFromFile } from '@/lib/docExtract'
import ReportQuizError from '@/components/ReportQuizError'
import Link from 'next/link'

type DocSummary = {
  id: string
  title: string
  kind: 'pdf' | 'docx' | 'pptx' | 'text' | 'image_ocr' | 'url'
  subject: string | null
  summary: string | null
  page_count: number | null
  chars: number | null
  pinned: boolean
  tags: string[] | null
  created_at: string
  last_opened_at: string | null
}

type DocFull = DocSummary & {
  text_content: string
  outline: any
  key_concepts: any
  generated_quiz: any
  generated_flashcards: any
}

const KIND_META: Record<string, { icon: string; label: string; color: string }> = {
  pdf: { icon: '📄', label: 'PDF', color: '#dc2626' },
  docx: { icon: '📝', label: 'Word', color: '#1d4ed8' },
  pptx: { icon: '📊', label: 'Slides', color: '#d97706' },
  text: { icon: '✎', label: 'Texto', color: '#475569' },
  image_ocr: { icon: '🖼', label: 'Imagem', color: '#7c3aed' },
  url: { icon: '🔗', label: 'URL', color: '#0891b2' },
}

export default function BibliotecaPage() {
  const { user, supabase } = useAuth()
  const [items, setItems] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<DocFull | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  async function refresh() {
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study-doc/list', {
        headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
      })
      const d = await r.json()
      setItems(d.items || [])
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function openDoc(id: string) {
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/study-doc/list?id=${id}`, {
      headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
    })
    const d = await r.json()
    if (d.document) setOpen(d.document)
  }

  async function deleteDoc(id: string) {
    if (!confirm('Eliminar este documento e tudo o que dele foi gerado?')) return
    const { data: sd } = await supabase.auth.getSession()
    await fetch(`/api/study-doc/list?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
    })
    setItems(p => p.filter(x => x.id !== id))
    if (open?.id === id) setOpen(null)
  }

  async function togglePin(it: DocSummary) {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/study-doc/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
      body: JSON.stringify({ id: it.id, pinned: !it.pinned }),
    })
    setItems(p => p.map(x => x.id === it.id ? { ...x, pinned: !x.pinned } : x))
  }

  const filtered = items.filter(it => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return it.title.toLowerCase().includes(t) || (it.subject || '').toLowerCase().includes(t) || (it.summary || '').toLowerCase().includes(t)
  })

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12 }}>Biblioteca de estudo</div>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          Carrega PDFs, slides ou Word e o Phlox gera resumo, perguntas e flashcards. Disponível no plano Plus.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver plano Plus →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · Plus</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Biblioteca</h1>
            <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>
              Sobe o material da aula. Sai com resumo, conceitos-chave, perguntas e flashcards prontos a usar.
            </p>
          </div>
          <button onClick={() => setUploadOpen(true)}
            style={{ padding: '11px 18px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            + Novo documento
          </button>
        </div>

        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={`Pesquisar em ${items.length} documento${items.length === 1 ? '' : 's'}…`}
          style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 16, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />

        {loading ? (
          <div style={{ background: 'white', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#94a3b8' }}>A carregar…</div>
        ) : filtered.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} hasAny={items.length > 0} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {filtered.map(it => <DocCard key={it.id} item={it} onOpen={() => openDoc(it.id)} onPin={() => togglePin(it)} onDelete={() => deleteDoc(it.id)} />)}
          </div>
        )}

        {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); refresh() }} />}
        {open && <DocViewer doc={open} onClose={() => setOpen(null)} />}
      </div>
    </div>
  )
}

// ── Doc card ───────────────────────────────────────────────────────────────────
function DocCard({ item, onOpen, onPin, onDelete }: { item: DocSummary; onOpen: () => void; onPin: () => void; onDelete: () => void }) {
  const meta = KIND_META[item.kind] || KIND_META.text
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: meta.color + '14', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>{meta.label}</span>
            {item.page_count && <span style={{ fontSize: 10, color: '#94a3b8' }}>· {item.page_count} {item.kind === 'pptx' ? 'slides' : 'pp'}</span>}
            {item.pinned && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>★ Fixo</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1120', lineHeight: 1.35, wordBreak: 'break-word', marginTop: 3 }}>{item.title}</div>
          {item.subject && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{item.subject}</div>}
        </div>
      </div>
      {item.summary && (
        <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
          {item.summary}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onOpen} style={{ flex: 1, padding: '7px 10px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Abrir</button>
        <button onClick={onPin} title="Fixar" style={{ padding: '7px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: item.pinned ? '#b45309' : '#94a3b8' }}>★</button>
        <button onClick={onDelete} title="Eliminar" style={{ padding: '7px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#94a3b8' }}>×</button>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onUpload, hasAny }: { onUpload: () => void; hasAny: boolean }) {
  return (
    <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 14, padding: '36px 24px', textAlign: 'center' }}>
      {hasAny ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum documento corresponde à pesquisa.</div>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#0b1120', marginBottom: 6 }}>A tua biblioteca está vazia</div>
          <p style={{ fontSize: 13.5, color: '#475569', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.6 }}>
            Sobe um PDF, slides ou Word e em 30 s tens resumo + conceitos + perguntas. Os ficheiros não são guardados — só o texto.
          </p>
          <button onClick={onUpload} style={{ padding: '11px 22px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>Carregar primeiro documento →</button>
        </>
      )}
    </div>
  )
}

// ── Upload modal ───────────────────────────────────────────────────────────────
function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { supabase } = useAuth()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [stage, setStage] = useState<'idle' | 'extracting' | 'processing' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function go() {
    setErr('')
    setStage('extracting')
    setProgress(10)
    try {
      let text = pastedText.trim()
      let kind: 'pdf' | 'docx' | 'pptx' | 'text' = 'text'
      let pageCount: number | undefined
      let fname: string | undefined

      if (file) {
        const ext = await extractFromFile(file)
        text = ext.text
        kind = ext.kind
        pageCount = ext.pageCount
        fname = file.name
      }
      if (!text || text.length < 100) throw new Error('O texto extraído é muito curto (< 100 caracteres). O documento pode ser uma imagem digitalizada.')
      setProgress(45)

      const finalTitle = (title.trim() || file?.name?.replace(/\.[^.]+$/, '') || 'Documento sem nome').slice(0, 200)

      setStage('processing')
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study-doc/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({
          title: finalTitle,
          subject: subject.trim() || null,
          source_filename: fname,
          page_count: pageCount,
          kind, text,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou.')
      setProgress(100)
      setStage('done')
      toast.success('Documento processado e guardado na biblioteca.')
      setTimeout(onDone, 500)
    } catch (e: any) {
      setErr(e.message || 'Erro desconhecido.')
      setStage('error')
    }
  }

  const busy = stage === 'extracting' || stage === 'processing'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,17,32,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 22 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 4 }}>Novo documento</div>
        <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
          Carrega um <strong>PDF</strong>, <strong>.docx</strong>, <strong>.pptx</strong> ou cola texto. A extração faz-se no teu browser. Só o texto e os artefactos gerados são guardados — o ficheiro original nunca sai do dispositivo.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Slides Farmacologia — Anticoagulantes"
            disabled={busy}
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Área (opcional)</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Farmacologia, Cardiologia, …"
            disabled={busy}
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            style={{ width: '100%', padding: '14px', background: file ? '#f0fdf4' : '#f8fafc', border: `1.5px dashed ${file ? '#16a34a' : '#cbd5e1'}`, borderRadius: 10, fontSize: 13, color: '#475569', fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer' }}>
            {file ? `✓ ${file.name} (${Math.round(file.size / 1024)} KB)` : '+ Escolher PDF / Word / PowerPoint'}
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.docx,.pptx,.txt,.md" style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files?.[0] || null); setPastedText('') }} />
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '4px 0 8px', fontFamily: 'var(--font-mono)' }}>OU</div>

        <textarea value={pastedText} onChange={e => { setPastedText(e.target.value); setFile(null) }}
          placeholder="Cola aqui o texto dos apontamentos…"
          disabled={busy}
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', marginBottom: 12 }} />

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '9px 11px', fontSize: 12, color: '#991b1b', marginBottom: 12 }}>{err}</div>}

        {busy && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 5 }}>
              {stage === 'extracting' ? 'A extrair texto…' : 'A gerar resumo, conceitos e perguntas com AI… (pode demorar 15-30s)'}
            </div>
            <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#7c3aed', transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '10px 16px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>Cancelar</button>
          <button onClick={go} disabled={busy || (!file && pastedText.trim().length < 100)}
            style={{ padding: '10px 20px', background: (!busy && (file || pastedText.trim().length >= 100)) ? '#7c3aed' : '#cbd5e1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'A processar…' : 'Processar →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Doc viewer ─────────────────────────────────────────────────────────────────
function DocViewer({ doc, onClose }: { doc: DocFull; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'concepts' | 'quiz' | 'flashcards' | 'text'>('summary')
  const meta = KIND_META[doc.kind] || KIND_META.text

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,17,32,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 880, maxWidth: '100%', height: 'min(88vh, 720px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: meta.color + '14', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{meta.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              {meta.label}{doc.page_count ? ` · ${doc.page_count} ${doc.kind === 'pptx' ? 'slides' : 'pp'}` : ''}{doc.chars ? ` · ${Math.round(doc.chars / 1000)} k chars` : ''}{doc.subject ? ` · ${doc.subject}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', fontSize: 18, color: '#475569' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {[
            { id: 'summary', label: 'Resumo' },
            { id: 'concepts', label: 'Conceitos' },
            { id: 'quiz', label: `Perguntas (${doc.generated_quiz?.length || 0})` },
            { id: 'flashcards', label: `Flashcards (${doc.generated_flashcards?.length || 0})` },
            { id: 'text', label: 'Texto original' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ padding: '11px 14px', background: tab === t.id ? '#f8fafc' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === t.id ? '#7c3aed' : 'transparent'}`, fontSize: 12.5, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? '#7c3aed' : '#475569', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {tab === 'summary' && (
            <>
              {doc.summary && <p style={{ fontSize: 14, color: '#0b1120', lineHeight: 1.75, marginTop: 0 }}>{doc.summary}</p>}
              {Array.isArray(doc.outline) && doc.outline.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Estrutura</div>
                  {doc.outline.map((s: any, i: number) => (
                    <div key={i} style={{ marginBottom: 9 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120' }}>{s.title}</div>
                      {Array.isArray(s.subsections) && (
                        <ul style={{ margin: '3px 0 0 18px', padding: 0 }}>
                          {s.subsections.map((ss: string, j: number) => <li key={j} style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>{ss}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'concepts' && Array.isArray(doc.key_concepts) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {doc.key_concepts.map((k: any, i: number) => {
                const c = k.importance === 'alta' ? '#dc2626' : k.importance === 'baixa' ? '#94a3b8' : '#1d4ed8'
                return (
                  <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120' }}>{k.term}</span>
                      <span style={{ fontSize: 10, color: c, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{k.importance}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 3, lineHeight: 1.55 }}>{k.definition}</div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'quiz' && Array.isArray(doc.generated_quiz) && (
            <DocQuiz quiz={doc.generated_quiz} docId={doc.id} />
          )}

          {tab === 'flashcards' && Array.isArray(doc.generated_flashcards) && (
            <Flashcards cards={doc.generated_flashcards} />
          )}

          {tab === 'text' && (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#0b1120', lineHeight: 1.65, margin: 0 }}>{doc.text_content}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

function DocQuiz({ quiz, docId }: { quiz: any[]; docId: string }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  if (quiz.length === 0) return <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem perguntas geradas.</div>
  const q = quiz[i]

  function answer(idx: number) {
    if (picked !== null) return
    setPicked(idx)
    if (idx === q.correct) setScore(s => s + 1)
  }
  function next() {
    if (i >= quiz.length - 1) { setDone(true); return }
    setI(i + 1); setPicked(null)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: '#0b1120' }}>{score}<span style={{ color: '#94a3b8', fontSize: 20 }}> / {quiz.length}</span></div>
      <div style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>{Math.round(score / quiz.length * 100)}% acertaste</div>
      <button onClick={() => { setI(0); setPicked(null); setScore(0); setDone(false) }}
        style={{ marginTop: 14, padding: '9px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Refazer
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#94a3b8', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
        <span>Pergunta {i + 1} / {quiz.length}</span>
        <ReportQuizError source="exam" sourceKey={`docquiz:${docId}:${i}`} qualityFlags={q.quality_flags} snapshot={q} />
      </div>
      <div style={{ fontSize: 14.5, color: '#0b1120', lineHeight: 1.6, marginBottom: 12, fontFamily: 'var(--font-serif)' }}>{q.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {q.options.map((opt: string, idx: number) => {
          const answered = picked !== null
          const isCorrect = idx === q.correct
          const isPicked = picked === idx
          let bg = 'white', border = '#e5e7eb', color = '#475569'
          if (answered) {
            if (isCorrect) { bg = '#f0fdf4'; border = '#bbf7d0'; color = '#166534' }
            else if (isPicked) { bg = '#fef2f2'; border = '#fca5a5'; color = '#991b1b' }
          }
          return (
            <button key={idx} onClick={() => answer(idx)}
              style={{ padding: '9px 12px', background: bg, border: `1.5px solid ${border}`, borderRadius: 7, cursor: answered ? 'default' : 'pointer', textAlign: 'left', fontSize: 13, color, fontFamily: 'var(--font-sans)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6, marginRight: 6 }}>{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && q.explanation && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '3px solid #1d4ed8', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.55, marginBottom: 10 }}>
          {q.explanation}
        </div>
      )}
      {picked !== null && (
        <button onClick={next} style={{ padding: '9px 16px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {i < quiz.length - 1 ? 'Próxima →' : 'Ver resultado'}
        </button>
      )}
    </div>
  )
}

function Flashcards({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  if (cards.length === 0) return <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem flashcards gerados.</div>
  const c = cards[i]
  return (
    <div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Card {i + 1} / {cards.length}</div>
      <div onClick={() => setFlipped(f => !f)}
        style={{ minHeight: 160, padding: 24, background: flipped ? '#f0fdf4' : 'white', border: `1.5px solid ${flipped ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 15, color: '#0b1120', lineHeight: 1.6, marginBottom: 12 }}>
        {flipped ? c.back : c.front}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => { setI(Math.max(0, i - 1)); setFlipped(false) }} disabled={i === 0}
          style={{ flex: 1, padding: '9px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: i === 0 ? 'not-allowed' : 'pointer', color: i === 0 ? '#cbd5e1' : '#475569' }}>← Anterior</button>
        <button onClick={() => setFlipped(f => !f)} style={{ flex: 1, padding: '9px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {flipped ? 'Ver frente' : 'Ver verso'}
        </button>
        <button onClick={() => { setI(Math.min(cards.length - 1, i + 1)); setFlipped(false) }} disabled={i === cards.length - 1}
          style={{ flex: 1, padding: '9px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: i === cards.length - 1 ? 'not-allowed' : 'pointer', color: i === cards.length - 1 ? '#cbd5e1' : '#475569' }}>Seguinte →</button>
      </div>
    </div>
  )
}
