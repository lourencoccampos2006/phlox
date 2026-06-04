'use client'

// /study/notas — App de notas clínicas avançada.
// Markdown rendering, templates por especialidade, IA assist (resumir, expandir,
// simplificar), conversão para flashcards, knowledge graph, sugestão automática
// de ligações, ditado por voz.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface Note {
  id: string; title: string; body: string|null; domain: string|null
  tags: string[]|null; linked_ids: string[]|null; pinned: boolean
  updated_at: string
}

// ─── Templates clínicos prontos a usar ──────────────────────────────────
const TEMPLATES: { id: string; icon: string; title: string; domain: string; body: string }[] = [
  { id: 'soap', icon: '📝', title: 'Nota SOAP', domain: 'clinico', body: `## S — Subjectivo
(queixas, história relatada)

## O — Objectivo
(exame físico, vitais, exames)

## A — Avaliação
(diagnóstico/raciocínio)

## P — Plano
(terapêutica e seguimento)
` },
  { id: 'caso', icon: '🩺', title: 'Caso clínico', domain: 'clinico', body: `## Identificação
Sexo, idade, profissão.

## História da doença actual
(HDA)

## Antecedentes
- Pessoais:
- Familiares:
- Hábitos:

## Exame físico
Vitais: TA · FC · FR · SpO2 · T

## Exames complementares

## Diagnóstico diferencial

## Conduta

## Discussão / Pearls

## Referências
- [[Guideline relevante]]
` },
  { id: 'farmaco', icon: '💊', title: 'Cartão de fármaco', domain: 'farmacologia', body: `## Princípio activo

## Classe terapêutica

## Mecanismo de acção

## Indicações principais

## Doses (adulto)

## Efeitos adversos comuns

## Contra-indicações

## Interacções importantes

## Pearls
` },
  { id: 'patologia', icon: '🦠', title: 'Cartão de patologia', domain: 'medicina_interna', body: `## Definição

## Epidemiologia

## Fisiopatologia

## Manifestações clínicas

## Diagnóstico
### Critérios diagnósticos
### Exames complementares

## Diagnóstico diferencial

## Tratamento
### Primeira linha
### Refractária

## Complicações

## Prognóstico

## Ligações
- [[Tema relacionado]]
` },
  { id: 'ecg', icon: '💓', title: 'Cartão de ECG', domain: 'cardiologia', body: `## Tipo de ritmo

## Frequência

## PR · QRS · QTc

## Achados-chave

## Diagnóstico

## Conduta

## DDx

## Pearls
` },
  { id: 'procedimento', icon: '✅', title: 'Procedimento', domain: 'clinico', body: `## Indicações

## Contra-indicações

## Material necessário

## Passos
1.
2.
3.

## Complicações

## Pearls
` },
  { id: 'review', icon: '🔁', title: 'Review semanal', domain: 'estudo', body: `## O que aprendi esta semana

## Tópicos a aprofundar

## Erros / lacunas identificados

## Plano para próxima semana

## Notas relacionadas
- [[Tema]]
` },
]

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
  const [view, setView] = useState<'editor' | 'preview' | 'graph'>('editor')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)

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

  // Voz: reconhecimento de fala
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const r = new SR()
      r.lang = 'pt-PT'; r.continuous = true; r.interimResults = true
      r.onresult = (e: any) => {
        let final = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        }
        if (final) setBody(b => b + final)
      }
      r.onend = () => setRecording(false)
      setRecognition(r)
    }
  }, [])

  function toggleRecord() {
    if (!recognition) { alert('Reconhecimento de voz requer Chrome/Edge.'); return }
    if (recording) { recognition.stop(); setRecording(false) } else { recognition.start(); setRecording(true) }
  }

  function open(n: Note) {
    setActive(n); setTitle(n.title); setBody(n.body || ''); setTags((n.tags || []).join(', ')); setDomain(n.domain || '')
  }

  async function newNote(template?: typeof TEMPLATES[0]) {
    if (busy) return
    setBusy(true)
    const headers = await auth()
    const payload: any = { title: template ? template.title : 'Sem título' }
    if (template) { payload.body = template.body; payload.domain = template.domain }
    const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify(payload) })
    const j = await r.json()
    if (j.note) { open(j.note); await load() }
    setBusy(false); setShowTemplates(false)
  }

  async function save() {
    if (!title.trim() || busy) return
    setBusy(true)
    const headers = await auth()
    const linkedTitles = Array.from(body.matchAll(/\[\[([^\]]+)\]\]/g)).map(m => m[1].toLowerCase().trim())
    const linked = notes.filter(n => linkedTitles.includes(n.title.toLowerCase().trim())).map(n => n.id)
    const payload: any = {
      title: title.trim(),
      body: body || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      domain: domain || null,
      linked_ids: linked,
    }
    if (active) {
      const r = await fetch('/api/study/notes', { method: 'PATCH', headers, body: JSON.stringify({ id: active.id, ...payload }) })
      const j = await r.json(); if (j.note) open(j.note)
    } else {
      const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify(payload) })
      const j = await r.json(); if (j.note) open(j.note)
    }
    await load(); setBusy(false)
  }

  async function remove() {
    if (!active || !confirm('Eliminar?')) return
    const headers = await auth()
    await fetch(`/api/study/notes?id=${active.id}`, { method: 'DELETE', headers })
    setActive(null); setTitle(''); setBody(''); setTags(''); setDomain('')
    load()
  }

  async function aiAction(action: string) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/study/notes-ai', {
      method: 'POST', headers,
      body: JSON.stringify({ action, text: body, title, note_id: active?.id }),
    })
    const j = await r.json(); setBusy(false)
    return j
  }

  async function aiTransform(action: 'summarize' | 'expand' | 'simplify' | 'generate_from_topic') {
    const r = await aiAction(action)
    if (r.result) {
      if (action === 'generate_from_topic') setBody(r.result)
      else setBody(r.result)
    } else if (r.error) alert(r.error)
  }

  async function aiToFlashcards() {
    const r = await aiAction('to_flashcards')
    if (r.flashcards?.length) {
      const fc = r.flashcards.map((f: any) => `### ${f.front}\n${f.back}`).join('\n\n---\n\n')
      setBody(b => b + `\n\n## 📇 Flashcards gerados\n\n${fc}`)
    } else if (r.error) alert(r.error)
  }

  async function aiSuggestLinks() {
    const r = await aiAction('suggest_links')
    if (r.suggestions?.length) {
      const list = r.suggestions.map((s: any) => `- [[${s.title}]] — ${s.reason}`).join('\n')
      setBody(b => b + `\n\n## 🔗 Ligações sugeridas pela IA\n\n${list}`)
    } else if (r.error) alert(r.error)
    else alert('Nenhuma ligação sugerida.')
  }

  const backlinks = useMemo(() => active ? notes.filter(n => (n.linked_ids || []).includes(active.id)) : [], [active, notes])
  const forwardLinks = useMemo(() => active ? notes.filter(n => (active.linked_ids || []).includes(n.id)) : [], [active, notes])

  if (view === 'graph') {
    return (
      <main style={{ padding: '12px clamp(8px, 2vw, 24px)', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🕸 Grafo de conhecimento</h1>
          <button onClick={() => setView('editor')} style={btn('ghost')}>← Voltar ao editor</button>
        </div>
        <NotesGraph notes={notes} onOpen={(n: Note) => { open(n); setView('editor') }} />
      </main>
    )
  }

  return (
    <main style={{ padding: '12px clamp(8px, 2vw, 24px)', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 12, alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, position: 'sticky', top: 70 }}>
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            <button onClick={() => newNote()} style={{ ...btn('primary'), width: '100%' }}>+ Nova nota</button>
            <button onClick={() => setShowTemplates(s => !s)} style={{ ...btn('ghost'), width: '100%', fontSize: 12 }}>📋 A partir de template</button>
            <button onClick={() => setView('graph')} style={{ ...btn('ghost'), width: '100%', fontSize: 12 }}>🕸 Ver grafo</button>
          </div>

          {showTemplates && (
            <div style={{ marginBottom: 10, padding: 8, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, marginBottom: 6 }}>TEMPLATES</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => newNote(t)} style={{
                    padding: 7, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
                    cursor: 'pointer', textAlign: 'left', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span>{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar…" style={{ ...input, marginBottom: 10 }} />

          {loading ? <p style={{ fontSize: 13, color: '#9ca3af' }}>A carregar…</p>
            : notes.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>Sem notas ainda.</p>
            : (
              <div style={{ display: 'grid', gap: 4, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
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
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título da nota"
            style={{ width: '100%', fontSize: 22, fontWeight: 700, border: 'none', outline: 'none', marginBottom: 12, background: 'transparent' }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="Domínio" style={{ ...input, flex: '1 1 160px' }} />
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags, separadas, por, vírgula" style={{ ...input, flex: '1 1 200px' }} />
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10, padding: 6, background: '#f9fafb', borderRadius: 8 }}>
            <button onClick={() => setView(view === 'editor' ? 'preview' : 'editor')} style={tbtn(view === 'preview')}>
              👁 {view === 'preview' ? 'Editar' : 'Pré-visualizar'}
            </button>
            <button onClick={toggleRecord} style={tbtn(recording)} title="Ditar por voz">
              🎙 {recording ? 'Parar' : 'Ditar'}
            </button>
            <span style={{ borderLeft: '1px solid #e5e7eb', margin: '0 4px' }} />
            <button onClick={() => setShowAi(s => !s)} style={tbtn(showAi)} title="Assistente IA">🤖 IA</button>
          </div>

          {showAi && (
            <div style={{ marginBottom: 10, padding: 10, background: '#ede9fe', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', marginBottom: 6, textTransform: 'uppercase' }}>Assistente IA</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {!body.trim() && title.trim() && (
                  <button onClick={() => aiTransform('generate_from_topic')} disabled={busy} style={aibtn}>✨ Gerar nota a partir do título</button>
                )}
                {body.trim() && (
                  <>
                    <button onClick={() => aiTransform('summarize')} disabled={busy} style={aibtn}>📑 Resumir</button>
                    <button onClick={() => aiTransform('expand')} disabled={busy} style={aibtn}>📚 Expandir</button>
                    <button onClick={() => aiTransform('simplify')} disabled={busy} style={aibtn}>👶 Simplificar</button>
                    <button onClick={aiToFlashcards} disabled={busy} style={aibtn}>📇 → Flashcards</button>
                    <button onClick={aiSuggestLinks} disabled={busy} style={aibtn}>🔗 Sugerir ligações</button>
                  </>
                )}
              </div>
              {busy && <p style={{ fontSize: 11, color: '#6d28d9', margin: '6px 0 0' }}>A IA está a trabalhar…</p>}
            </div>
          )}

          {/* Editor / Preview */}
          {view === 'editor' ? (
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Escreve em markdown. Usa **negrito**, ## títulos, - listas. [[Outra nota]] cria uma ligação."
              rows={22}
              style={{ width: '100%', fontSize: 14, padding: 14, border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}
            />
          ) : (
            <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 400, fontSize: 14, lineHeight: 1.7 }}>
              <MarkdownRender text={body} onLink={n => { const note = notes.find(x => x.title.toLowerCase() === n.toLowerCase()); if (note) open(note) }} />
            </div>
          )}

          {/* Ligações */}
          {(backlinks.length > 0 || forwardLinks.length > 0) && (
            <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              {forwardLinks.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>→ Liga a ({forwardLinks.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {forwardLinks.map(n => (
                      <button key={n.id} onClick={() => open(n)} style={chip('#eff6ff', '#1e40af', '#bfdbfe')}>{n.title}</button>
                    ))}
                  </div>
                </div>
              )}
              {backlinks.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>← Referenciada por ({backlinks.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {backlinks.map(n => (
                      <button key={n.id} onClick={() => open(n)} style={chip('#f0fdf5', '#065f46', '#bbf7d0')}>{n.title}</button>
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

// ─── Markdown renderer com suporte a [[wiki-links]] ─────────────────────
function MarkdownRender({ text, onLink }: { text: string; onLink?: (title: string) => void }) {
  if (!text) return <p style={{ color: '#9ca3af', fontSize: 13 }}>(Sem conteúdo)</p>

  // Processa markdown leve
  let html = text
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:12.5px">$1</code>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0" />')
    .replace(/^\s*- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul style="margin:6px 0;padding-left:22px">$1</ul>')
    .replace(/\[\[([^\]]+)\]\]/g, (_m, t) => `<a href="#" data-link="${t}" style="background:#eff6ff;color:#1e40af;padding:1px 8px;border-radius:6px;text-decoration:none;border:1px solid #bfdbfe;font-weight:600;font-size:12.5px">${t}</a>`)
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')

  html = `<p style="margin:8px 0">${html}</p>`

  return (
    <div
      className="md-content"
      onClick={e => {
        const t = (e.target as HTMLElement)
        if (t.dataset?.link && onLink) { e.preventDefault(); onLink(t.dataset.link) }
      }}
      style={{ color: '#111827' }}
    >
      <style>{`
        .md-h1 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; }
        .md-h2 { font-size: 18px; font-weight: 700; margin: 14px 0 6px; color: ${ACCENT}; }
        .md-h3 { font-size: 15px; font-weight: 700; margin: 12px 0 4px; color: #374151; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function NotesGraph({ notes, onOpen }: { notes: Note[]; onOpen: (n: Note) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const { positions, edges } = useMemo(() => {
    const W = 900, H = 600
    const cx = W / 2, cy = H / 2
    const adj: Record<string, Set<string>> = {}
    for (const n of notes) {
      adj[n.id] = new Set(n.linked_ids || [])
      for (const o of notes) if ((o.linked_ids || []).includes(n.id)) adj[n.id].add(o.id)
    }
    const sorted = [...notes].sort((a, b) => (adj[b.id]?.size || 0) - (adj[a.id]?.size || 0))
    const positions: Record<string, { x: number; y: number; degree: number }> = {}
    sorted.forEach((n) => {
      const degree = adj[n.id]?.size || 0
      const ring = degree >= 4 ? 0 : degree >= 2 ? 1 : degree >= 1 ? 2 : 3
      const radius = [80, 180, 280, 360][ring] || 360
      const ringNodes = sorted.filter(m => {
        const d = adj[m.id]?.size || 0
        const r = d >= 4 ? 0 : d >= 2 ? 1 : d >= 1 ? 2 : 3
        return r === ring
      })
      const idx = ringNodes.indexOf(n)
      const angle = (idx / Math.max(1, ringNodes.length)) * 2 * Math.PI - Math.PI / 2
      positions[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), degree }
    })
    const edgeSet = new Set<string>()
    const edges: { from: string; to: string }[] = []
    for (const n of notes) {
      for (const link of (n.linked_ids || [])) {
        const key = [n.id, link].sort().join('|')
        if (edgeSet.has(key) || !positions[link]) continue
        edgeSet.add(key)
        edges.push({ from: n.id, to: link })
      }
    }
    return { positions, edges }
  }, [notes])

  if (notes.length === 0) return <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 14, padding: 40, textAlign: 'center', color: '#6b7280' }}>Sem notas. Cria notas e usa [[título]] para criar ligações.</div>

  const W = 900, H = 600
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
        <b>{notes.length}</b> notas · <b>{edges.length}</b> ligações
      </div>
      <div style={{ overflow: 'auto', background: '#fafafa', borderRadius: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 600, display: 'block' }}>
          {edges.map((e, i) => {
            const p1 = positions[e.from], p2 = positions[e.to]; if (!p1 || !p2) return null
            const h = hover === e.from || hover === e.to
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={h ? ACCENT : '#cbd5e1'} strokeWidth={h ? 2 : 1} opacity={hover && !h ? 0.25 : 0.65} />
          })}
          {notes.map(n => {
            const p = positions[n.id]; if (!p) return null
            const r = 8 + Math.min(14, p.degree * 3); const h = hover === n.id
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen(n)}>
                <circle cx={p.x} cy={p.y} r={r} fill={p.degree >= 4 ? '#dc2626' : p.degree >= 2 ? '#7c3aed' : p.degree >= 1 ? ACCENT : '#94a3b8'} opacity={hover && !h ? 0.4 : 1} stroke="white" strokeWidth={2} />
                <text x={p.x} y={p.y + r + 12} fontSize={11} fontWeight={h ? 700 : 500} fill="#111827" textAnchor="middle" opacity={hover && !h ? 0.4 : 1}>
                  {n.title.length > 22 ? n.title.substring(0, 22) + '…' : n.title}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

const input: React.CSSProperties = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const aibtn: React.CSSProperties = { padding: '5px 10px', background: 'white', border: '1px solid #c4b5fd', color: '#6d28d9', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }

function tbtn(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: active ? ACCENT : 'transparent', color: active ? 'white' : '#374151',
  }
}
function chip(bg: string, color: string, border: string): React.CSSProperties {
  return { padding: '3px 10px', background: bg, color, border: `1px solid ${border}`, borderRadius: 999, fontSize: 12, cursor: 'pointer' }
}
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 13 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
