'use client'

// /study/procedimentos — Procedimentos clínicos passo-a-passo.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface Step { order: number; title: string; body: string; image_url?: string }
interface Procedure {
  id: string; title: string; category: string|null; description: string|null
  indications: string[]|null; contraindications: string[]|null
  materials: string[]|null; steps: Step[]|null
  warnings: string[]|null; difficulty: string; duration_min: number|null
}

export default function ProcedimentosPage() {
  const { supabase } = useAuth() as any
  const [list, setList] = useState<Procedure[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Procedure | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('procedure_guides').select('*').order('title')
      setList(data || [])
    })()
  }, [supabase])

  const filtered = list.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()))

  if (selected) {
    const steps = selected.steps || []
    return (
      <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => { setSelected(null); setDone(new Set()) }} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>

        <h1 style={{ margin: 0, fontSize: 22 }}>{selected.title}</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>{selected.description}</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ padding: '3px 10px', background: '#f3f4f6', borderRadius: 999, fontSize: 11 }}>{selected.category}</span>
          {selected.duration_min && <span style={{ padding: '3px 10px', background: '#f3f4f6', borderRadius: 999, fontSize: 11 }}>⏱ {selected.duration_min} min</span>}
          <span style={{ padding: '3px 10px', background: selected.difficulty === 'easy' ? '#dcfce7' : selected.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: selected.difficulty === 'easy' ? '#065f46' : selected.difficulty === 'medium' ? '#92400e' : '#991b1b', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            {selected.difficulty}
          </span>
        </div>

        {selected.indications && selected.indications.length > 0 && (
          <Section title="✓ Indicações" color="#065f46" bg="#f0fdf5" items={selected.indications} />
        )}
        {selected.contraindications && selected.contraindications.length > 0 && (
          <Section title="✗ Contra-indicações" color="#991b1b" bg="#fef2f2" items={selected.contraindications} />
        )}
        {selected.materials && selected.materials.length > 0 && (
          <Section title="📦 Material" color="#1e40af" bg="#eff6ff" items={selected.materials} />
        )}

        <h3 style={{ marginTop: 18, fontSize: 16, color: '#111827' }}>Passos ({steps.length})</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {steps.map((s, i) => {
            const isDone = done.has(i)
            return (
              <button key={i} onClick={() => setDone(d => {
                const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n
              })} style={{
                textAlign: 'left', display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, padding: 12,
                background: isDone ? '#f0fdf5' : 'white', border: `1px solid ${isDone ? ACCENT : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isDone ? ACCENT : '#f3f4f6', color: isDone ? 'white' : '#374151',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                }}>{isDone ? '✓' : s.order}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 3, lineHeight: 1.5 }}>{s.body}</div>
                </div>
              </button>
            )
          })}
        </div>

        {selected.warnings && selected.warnings.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Section title="⚠ Avisos" color="#9a3412" bg="#fffbeb" items={selected.warnings} />
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Progresso: <b style={{ color: ACCENT }}>{done.size}</b> / {steps.length} passos
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Procedimentos clínicos</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Guias passo-a-passo com checklist.
      </p>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar…" style={{ ...input, marginBottom: 16 }} />

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum procedimento. Aplica sprint70 SQL.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => { setSelected(p); setDone(new Set()) }} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>{p.title}</div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{p.description}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, color: '#374151' }}>{p.category}</span>
                {p.duration_min && <span style={{ fontSize: 10, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, color: '#374151' }}>{p.duration_min} min</span>}
                <span style={{ fontSize: 10, padding: '2px 6px', background: p.difficulty === 'easy' ? '#dcfce7' : p.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: p.difficulty === 'easy' ? '#065f46' : p.difficulty === 'medium' ? '#92400e' : '#991b1b', borderRadius: 4, fontWeight: 700 }}>{p.difficulty}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function Section({ title, color, bg, items }: { title: string; color: string; bg: string; items: string[] }) {
  return (
    <div style={{ background: bg, padding: 10, borderRadius: 8, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
