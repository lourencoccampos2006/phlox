'use client'

// /study/ecg — Biblioteca de ECGs + treino de interpretação com IA.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface ECG {
  id: string; title: string; description: string|null; image_url: string|null
  rhythm: string; rate_bpm: number; axis: string; pr_ms: number; qrs_ms: number; qtc_ms: number
  findings: string[]; diagnosis: string; context: string; difficulty: string; category: string
}

const CATEGORIES = [
  { v: '', label: 'Todas' },
  { v: 'sca', label: 'Síndromes coronários' },
  { v: 'arritmias', label: 'Arritmias' },
  { v: 'condução', label: 'Distúrbios da condução' },
  { v: 'eletrólitos', label: 'Eletrólitos' },
  { v: 'normal', label: 'Normais / variantes' },
  { v: 'outros', label: 'Outros' },
]

export default function ECGPage() {
  const { supabase } = useAuth() as any
  const [ecgs, setEcgs] = useState<ECG[]>([])
  const [selected, setSelected] = useState<ECG | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [category, setCategory] = useState('')
  const [interp, setInterp] = useState('')
  const [feedback, setFeedback] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: sd } = await supabase.auth.getSession()
    const url = new URL('/api/study/ecg', window.location.origin)
    if (category) url.searchParams.set('category', category)
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
    const j = await r.json()
    setEcgs(j.ecgs || [])
    setLoading(false)
  }, [supabase, category])

  useEffect(() => { load() }, [load])

  async function evaluate() {
    if (!selected || !interp.trim()) return
    setBusy(true); setFeedback(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/ecg-interpret', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({ ecg_id: selected.id, interpretation: interp }) })
      const j = await r.json()
      if (r.ok) setFeedback(j)
    } finally { setBusy(false) }
  }

  function pickEcg(e: ECG) {
    setSelected(e); setRevealed(false); setInterp(''); setFeedback(null)
  }

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  if (selected) {
    return (
      <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar à lista</button>

        <h1 style={{ margin: 0, fontSize: 22 }}>{selected.title}</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>{selected.context}</p>

        {selected.image_url ? (
          <img src={selected.image_url} alt="ECG" style={{ width: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }} />
        ) : (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            <p style={{ margin: '0 0 6px' }}>Imagem do ECG indisponível.</p>
            <p style={{ margin: 0, fontSize: 12 }}>Treina interpretação com base nos dados estruturados em baixo.</p>
          </div>
        )}

        {!revealed && (
          <>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados do ECG</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, fontSize: 13 }}>
                <div><b>Ritmo:</b> {selected.rhythm}</div>
                <div><b>Frequência:</b> {selected.rate_bpm} bpm</div>
                <div><b>Eixo:</b> {selected.axis}</div>
                <div><b>PR:</b> {selected.pr_ms || '—'} ms</div>
                <div><b>QRS:</b> {selected.qrs_ms} ms</div>
                <div><b>QTc:</b> {selected.qtc_ms} ms</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>A tua interpretação</label>
              <textarea value={interp} onChange={e => setInterp(e.target.value)} rows={5}
                placeholder="Descreve achados, diagnóstico provável e o que farias de seguida."
                style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={evaluate} disabled={busy || !interp.trim()} style={btn('primary')}>{busy ? 'A avaliar…' : 'Submeter para avaliação IA'}</button>
              <button onClick={() => setRevealed(true)} style={btn('ghost')}>Revelar diagnóstico</button>
            </div>

            {feedback && (
              <div style={{ marginTop: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Avaliação</span>
                  <span style={{ padding: '4px 12px', borderRadius: 999, background: feedback.score >= 70 ? '#dcfce7' : feedback.score >= 40 ? '#fef3c7' : '#fee2e2', color: feedback.score >= 70 ? '#065f46' : feedback.score >= 40 ? '#92400e' : '#991b1b', fontWeight: 700, fontSize: 13 }}>
                    {feedback.score}/100
                  </span>
                </div>
                <p style={{ fontSize: 14, color: '#374151', margin: '0 0 10px', lineHeight: 1.5 }}>{feedback.feedback}</p>
                {feedback.correct?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#065f46', fontWeight: 700, marginBottom: 4 }}>✓ ACERTASTE</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                      {feedback.correct.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {feedback.missed?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, marginBottom: 4 }}>✗ FALHASTE</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                      {feedback.missed.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {revealed && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, color: ACCENT }}>Diagnóstico: {selected.diagnosis}</h2>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{selected.description}</p>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>ACHADOS</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                {selected.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        )}
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca de ECGs</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Treina interpretação de ECGs. A IA avalia a tua resposta livre.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATEGORIES.map(c => (
          <button key={c.v} onClick={() => setCategory(c.v)} style={{
            padding: '5px 12px', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: category === c.v ? ACCENT : '#f3f4f6',
            color: category === c.v ? 'white' : '#374151',
          }}>{c.label}</button>
        ))}
      </div>

      {ecgs.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Nenhum ECG disponível ainda. Aplica o sprint70 SQL.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {ecgs.map(e => (
            <button key={e.id} onClick={() => pickEcg(e)} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{e.title}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, background: e.difficulty === 'easy' ? '#dcfce7' : e.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: e.difficulty === 'easy' ? '#065f46' : e.difficulty === 'medium' ? '#92400e' : '#991b1b', fontSize: 10, fontWeight: 700 }}>
                  {e.difficulty}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{e.context}</p>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
