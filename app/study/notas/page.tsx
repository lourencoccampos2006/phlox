'use client'

// /study/notas — Sistema de notas com knowledge graph (links entre notas).
// Inspirado em Obsidian/Notion. Usa [[título]] para criar ligação automática.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface Note {
  id: string
  title: string
  body: string|null
  domain: string|null
  tags: string[]|null
  linked_ids: string[]|null
  pinned: boolean
  updated_at: string
}

export default function NotasPage() {
  const { supabase } = useAuth() as any
  const [notes, setNotes] = useState<Note[]>([])
  const [active, setActive] = useState<Note | null>(null)
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    const headers = await auth()
    const url = new URL('/api/study/notes', window.location.origin)
    if (search) url.searchParams.set('q', search)
    const r = await fetch(url.toString(), { headers })
    const j = await r.json()
    setNotes(j.notes || [])
    setLoading(false)
  }, [auth, search])

  useEffect(() => { load() }, [search]) // eslint-disable-line

  function open(n: Note) {
    setActive(n); setTitle(n.title); setBody(n.body || ''); setTags((n.tags || []).join(', ')); setDomain(n.domain || '')
  }

  async function newNote() {
    // Cria imediatamente uma nota "Sem título" e abre-a para edição
    if (busy) return
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify({ title: 'Sem título' }) })
    const j = await r.json()
    if (j.note) {
      open(j.note)
      await load()
    }
    setBusy(false)
  }

  async function save() {
    if (!title.trim() || busy) return
    setBusy(true)
    const headers = await auth()
    const payload: any = {
      title: title.trim(),
      body: body || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      domain: domain || null,
    }
    // Detecta links [[outro título]] e converte em linked_ids
    const linkedTitles = Array.from(body.matchAll(/\[\[([^\]]+)\]\]/g)).map(m => m[1].toLowerCase().trim())
    const linked = notes.filter(n => linkedTitles.includes(n.title.toLowerCase().trim())).map(n => n.id)
    payload.linked_ids = linked

    if (active) {
      const r = await fetch('/api/study/notes', { method: 'PATCH', headers, body: JSON.stringify({ id: active.id, ...payload }) })
      const j = await r.json()
      if (j.note) open(j.note)
    } else {
      const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify(payload) })
      const j = await r.json()
      if (j.note) open(j.note)
    }
    await load()
    setBusy(false)
  }

  async function remove() {
    if (!active) return
    if (!confirm('Eliminar esta nota?')) return
    const headers = await auth()
    await fetch(`/api/study/notes?id=${active.id}`, { method: 'DELETE', headers })
    setActive(null); newNote()
    load()
  }

  // Backlinks (notas que apontam para esta)
  const backlinks = useMemo(() => {
    if (!active) return []
    return notes.filter(n => (n.linked_ids || []).includes(active.id))
  }, [active, notes])

  // Forward links (notas referenciadas)
  const forwardLinks = useMemo(() => {
    if (!active) return []
    return notes.filter(n => (active.linked_ids || []).includes(n.id))
  }, [active, notes])

  return (
    <main style={{ padding: '12px clamp(8px, 2vw, 24px)', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 12, alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, position: 'sticky', top: 70 }}>
          <button onClick={newNote} style={{ ...btn('primary'), width: '100%', marginBottom: 10 }}>+ Nova nota</button>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar…" style={{ ...input, marginBottom: 10 }} />
          {loading ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>A carregar…</p>
          ) : notes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Sem notas ainda.</p>
          ) : (
            <div style={{ display: 'grid', gap: 4, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {notes.map(n => (
                <button key={n.id} onClick={() => open(n)} style={{
                  textAlign: 'left', padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  background: active?.id === n.id ? '#f0fdf5' : 'transparent',
                  border: `1px solid ${active?.id === n.id ? ACCENT : 'transparent'}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.title}</div>
                  {n.domain && <div style={{ fontSize: 10, color: '#6b7280' }}>{n.domain}</div>}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Editor */}
        <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, minHeight: 'calc(100vh - 100px)' }}>
          <input
            value={title} onChange={e => { setTitle(e.target.value) }}
            placeholder="Título da nota"
            style={{ width: '100%', fontSize: 22, fontWeight: 700, border: 'none', outline: 'none', marginBottom: 12, background: 'transparent' }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={domain} onChange={e => { setDomain(e.target.value) }} placeholder="Domínio (ex: cardiologia)" style={{ ...input, flex: '1 1 200px' }} />
            <input value={tags} onChange={e => { setTags(e.target.value) }} placeholder="Etiquetas separadas por vírgula" style={{ ...input, flex: '1 1 200px' }} />
          </div>
          <textarea
            value={body} onChange={e => { setBody(e.target.value) }}
            placeholder="Conteúdo da nota. Usa [[Título de outra nota]] para criar uma ligação automática."
            rows={20}
            style={{ width: '100%', fontSize: 14, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />

          {/* Knowledge graph: backlinks + forward links */}
          {(backlinks.length > 0 || forwardLinks.length > 0) && (
            <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              {forwardLinks.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>→ Ligações de saída ({forwardLinks.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {forwardLinks.map(n => (
                      <button key={n.id} onClick={() => open(n)} style={{ padding: '3px 10px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
                        {n.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {backlinks.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>← Backlinks ({backlinks.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {backlinks.map(n => (
                      <button key={n.id} onClick={() => open(n)} style={{ padding: '3px 10px', background: '#f0fdf5', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
                        {n.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            {active && <button onClick={remove} style={{ ...btn('ghost'), color: '#dc2626' }}>Eliminar</button>}
            <button onClick={save} disabled={!title.trim() || busy} style={{ ...btn('primary'), opacity: (!title.trim() || busy) ? 0.5 : 1 }}>
              {busy ? 'A guardar…' : active ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

const input: React.CSSProperties = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 13 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
