'use client'

// /study/biblioteca — Biblioteca médica: guidelines, protocolos, resumos.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface LibEntry {
  id: string; title: string; source: string|null; year: number|null
  domain: string|null; summary: string|null; body: string|null
  tags: string[]|null; url: string|null
}

export default function BibliotecaPage() {
  const { supabase } = useAuth() as any
  const [entries, setEntries] = useState<LibEntry[]>([])
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('')
  const [selected, setSelected] = useState<LibEntry | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('medical_library').select('*').order('year', { ascending: false })
      setEntries(data || [])
    })()
  }, [supabase])

  const domains = Array.from(new Set(entries.map(e => e.domain).filter(Boolean))) as string[]

  const filtered = entries.filter(e => {
    if (domain && e.domain !== domain) return false
    if (search) {
      const s = search.toLowerCase()
      return e.title.toLowerCase().includes(s)
          || (e.summary || '').toLowerCase().includes(s)
          || (e.tags || []).some(t => t.toLowerCase().includes(s))
    }
    return true
  })

  if (selected) {
    return (
      <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
        <h1 style={{ margin: 0, fontSize: 24 }}>{selected.title}</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {selected.source && <span><b>Fonte:</b> {selected.source}</span>}
          {selected.year && <span><b>Ano:</b> {selected.year}</span>}
          {selected.domain && <span><b>Domínio:</b> {selected.domain}</span>}
        </div>
        {selected.summary && (
          <div style={{ marginTop: 14, padding: 12, background: '#f0fdf5', borderRadius: 8, fontSize: 14, fontStyle: 'italic', color: '#065f46' }}>
            {selected.summary}
          </div>
        )}
        <article style={{ marginTop: 16, lineHeight: 1.7, fontSize: 14, color: '#374151' }}>
          {selected.body}
        </article>
        {selected.tags && selected.tags.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {selected.tags.map(t => <span key={t} style={{ padding: '3px 10px', background: '#f3f4f6', borderRadius: 999, fontSize: 11, color: '#374151' }}>#{t}</span>)}
          </div>
        )}
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca médica</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Resumos rápidos de guidelines (ESC, ADA, GINA, NICE, DGS). Clica para abrir o texto completo.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar título, conteúdo ou tag…" style={{ ...input, flex: '1 1 200px' }} />
        <select value={domain} onChange={e => setDomain(e.target.value)} style={input}>
          <option value="">Todos os domínios</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhuma entrada. Aplica sprint70 SQL.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(e => (
            <button key={e.id} onClick={() => setSelected(e)} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{e.title}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {e.source} {e.year && `· ${e.year}`}
                </span>
              </div>
              {e.summary && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{e.summary}</p>}
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

const input: React.CSSProperties = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
