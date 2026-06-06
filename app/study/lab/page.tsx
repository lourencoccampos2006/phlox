'use client'

// /study/lab — Interpretação de valores laboratoriais.
// Cola valores → vê referência + significado + correlação clínica via IA.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { usePhloxContext } from '@/lib/copilotContext'

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
  const [analysis, setAnalysis] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('')

  usePhloxContext(
    analysis ? 'Análises laboratoriais interpretadas' : (labText ? 'Análises a interpretar' : ''),
    analysis ? { valores: labText.slice(0, 800), interpretacao: typeof analysis === 'string' ? analysis.slice(0, 800) : JSON.stringify(analysis).slice(0, 800) }
      : (labText ? { valores: labText.slice(0, 800) } : null)
  )

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
    setBusy(true); setAnalysis(null); setErr(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/labs', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({ text: labText }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setAnalysis(j)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
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
        {err && <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{err}</div>}
        {analysis && (
          <div style={{ marginTop: 12 }}>
            {/* Resumo geral */}
            {(analysis.summary || analysis.patient_summary) && (
              <div style={{
                padding: 14, borderRadius: 10, marginBottom: 12,
                background: analysis.overall_status === 'CRÍTICO' || analysis.overall_status === 'GRAVE' ? '#fee2e2'
                          : analysis.overall_status === 'ATENÇÃO' || analysis.overall_status === 'ALERTA' ? '#fef3c7'
                          : '#dcfce7',
              }}>
                {analysis.overall_status && (
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 6,
                    color: analysis.overall_status === 'CRÍTICO' || analysis.overall_status === 'GRAVE' ? '#991b1b'
                         : analysis.overall_status === 'ATENÇÃO' || analysis.overall_status === 'ALERTA' ? '#92400e'
                         : '#065f46',
                  }}>{analysis.overall_status}</div>
                )}
                <p style={{ margin: 0, fontSize: 14, color: '#111827', lineHeight: 1.5 }}>{analysis.patient_summary || analysis.summary}</p>
                {analysis.reassurance && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151', fontStyle: 'italic' }}>{analysis.reassurance}</p>}
              </div>
            )}

            {/* Achados-chave */}
            {analysis.key_findings && analysis.key_findings.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Achados principais</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  {analysis.key_findings.map((k: string, i: number) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}

            {/* Valores individuais */}
            {analysis.values && analysis.values.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valores analisados ({analysis.values.length})</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                  {analysis.values.map((v: any, i: number) => (
                    <div key={i} style={{
                      padding: 10, borderRadius: 8, border: '1px solid #e5e7eb',
                      background: v.status === 'CRÍTICO' ? '#fef2f2'
                                : v.status === 'BAIXO' || v.status === 'ALTO' ? '#fffbeb'
                                : '#f9fafb',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</span>
                        <span style={{
                          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: v.status === 'CRÍTICO' ? '#fee2e2' : v.status === 'BAIXO' || v.status === 'ALTO' ? '#fef3c7' : '#dcfce7',
                          color: v.status === 'CRÍTICO' ? '#991b1b' : v.status === 'BAIXO' || v.status === 'ALTO' ? '#92400e' : '#065f46',
                        }}>{v.value}</span>
                      </div>
                      {v.reference && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Ref: {v.reference}</div>}
                      {v.interpretation && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{v.interpretation}</p>}
                      {v.follow_up && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1e40af', fontWeight: 600 }}>↪ {v.follow_up}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perguntas ao médico */}
            {analysis.questions_for_doctor && analysis.questions_for_doctor.length > 0 && (
              <div style={{ marginBottom: 12, padding: 12, background: '#eff6ff', borderRadius: 8 }}>
                <h3 style={{ fontSize: 12, color: '#1e40af', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>💬 Perguntas a fazer ao médico</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                  {analysis.questions_for_doctor.map((q: string, i: number) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}

            {/* Sugestões de estilo de vida */}
            {analysis.lifestyle_suggestions && analysis.lifestyle_suggestions.length > 0 && (
              <div style={{ marginBottom: 12, padding: 12, background: '#f0fdf5', borderRadius: 8 }}>
                <h3 style={{ fontSize: 12, color: '#065f46', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🌿 Sugestões de estilo de vida</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                  {analysis.lifestyle_suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {analysis.when_to_repeat && (
              <div style={{ padding: 10, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                <b>⏰ Repetir análise:</b> {analysis.when_to_repeat}
              </div>
            )}

            {/* Fallback se o JSON tiver outra forma */}
            {!analysis.values && !analysis.summary && !analysis.patient_summary && (
              <pre style={{ padding: 10, background: '#f9fafb', borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap' }}>{JSON.stringify(analysis, null, 2)}</pre>
            )}
          </div>
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
