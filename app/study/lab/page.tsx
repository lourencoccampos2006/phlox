'use client'

// /study/lab — Interpretação de valores laboratoriais.
// Cola valores → vê referência + significado + correlação clínica via IA.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface LabRef {
  id: string; parameter: string; unit: string
  ref_low: number|null; ref_high: number|null; sex: string|null; age_group: string|null
  category: string|null; clinical_note: string|null
  abnormal_low_meaning: string|null; abnormal_high_meaning: string|null
}

export default function LabPage() {
  const { supabase } = useAuth() as any
  const [refs, setRefs] = useState<LabRef[]>([])
  const [search, setSearch] = useState('')
  const [labText, setLabText] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lab_value_library').select('*').order('parameter')
      setRefs(data || [])
    })()
  }, [supabase])

  const filtered = refs.filter(r => {
    if (category && r.category !== category) return false
    if (search && !r.parameter.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const categories = Array.from(new Set(refs.map(r => r.category).filter(Boolean))) as string[]

  async function analyse() {
    if (!labText.trim() || busy) return
    setBusy(true); setAnalysis('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/labs', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({ text: labText }) })
      const j = await r.json()
      setAnalysis(JSON.stringify(j, null, 2))
    } catch (e: any) { setAnalysis('Erro: ' + e.message) } finally { setBusy(false) }
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Laboratório</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Valores de referência + interpretação automática de análises.
      </p>

      {/* Interpretação livre */}
      <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Cola análises → interpreta</h2>
        <textarea value={labText} onChange={e => setLabText(e.target.value)} rows={5}
          placeholder="Cola texto bruto das análises (ex: Hb 8.2 g/dL, Plaquetas 120 ×10⁹/L, Cr 2.1 mg/dL...)"
          style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
        />
        <button onClick={analyse} disabled={busy || !labText.trim()} style={{ ...btn('primary'), marginTop: 8 }}>
          {busy ? 'A interpretar…' : 'Interpretar'}
        </button>
        {analysis && (
          <pre style={{ marginTop: 12, padding: 10, background: '#f9fafb', borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>{analysis}</pre>
        )}
      </section>

      {/* Biblioteca */}
      <section>
        <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Valores de referência</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar parâmetro…" style={{ ...input, flex: '1 1 200px' }} />
          <select value={category} onChange={e => setCategory(e.target.value)} style={input}>
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>Nenhum parâmetro. Aplica o sprint70 SQL.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {filtered.map(r => (
              <details key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.parameter}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{r.category}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                    {r.ref_low}–{r.ref_high} {r.unit}
                    {r.sex && r.sex !== 'any' && ` · ${r.sex === 'M' ? '♂' : '♀'}`}
                  </div>
                </summary>
                <div style={{ marginTop: 10, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  {r.clinical_note && <p style={{ margin: '0 0 6px' }}>{r.clinical_note}</p>}
                  {r.abnormal_low_meaning && <p style={{ margin: '6px 0' }}><b>↓ Baixo:</b> {r.abnormal_low_meaning}</p>}
                  {r.abnormal_high_meaning && <p style={{ margin: '6px 0' }}><b>↑ Alto:</b> {r.abnormal_high_meaning}</p>}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

const input: React.CSSProperties = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
