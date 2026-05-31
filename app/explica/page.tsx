'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'

interface Result {
  concept: string; simple: string; exam: string; clinical: string
  analogy: string; key_points: string[]; common_mistake: string
}
interface HistoryItem { concept: string; at: string }
const LS_KEY = 'phlox-explica-history'

export default function ExplicaPage() {
  const { user } = useAuth() as any
  const area = areaOf(user?.student_area)
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [level, setLevel] = useState<'simple' | 'exam' | 'clinical'>('simple')
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => { try { const r = localStorage.getItem(LS_KEY); if (r) setHistory(JSON.parse(r)) } catch { /* noop */ } }, [])

  function persistHistory(concept: string) {
    const next: HistoryItem[] = [{ concept, at: new Date().toISOString() }, ...history.filter(h => h.concept !== concept)].slice(0, 8)
    setHistory(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  async function run(c?: string) {
    const cp = (c ?? concept).trim(); if (!cp) return
    if (c) setConcept(c)
    setLoading(true); setError(''); setResult(null); setLevel('simple')
    try {
      const res = await fetch('/api/explica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept: cp, area: area.label }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data); persistHistory(cp)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  const examples = area.subjects.slice(0, 4)
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const LEVELS = [{ k: 'simple', l: 'Simples' }, { k: 'exam', l: 'Nível exame' }, { k: 'clinical', l: 'Na prática' }] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · {area.label}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Explica-me</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Qualquer conceito em 3 níveis — do simples ao nível de exame — com uma analogia que não esqueces.</p>
        </div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={concept} onChange={e => setConcept(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Ex: potencial de ação, ciclo de Krebs, farmacocinética…"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <button onClick={() => run()} disabled={loading || !concept.trim()} style={{ padding: '0 20px', background: concept.trim() && !loading ? '#7c3aed' : 'var(--bg-3)', color: concept.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: concept.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? '…' : 'Explicar'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {examples.map(ex => <button key={ex} onClick={() => run(ex)} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 11px', cursor: 'pointer' }}>{ex}</button>)}
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {history.length > 0 && !result && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>Já explicaste</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {history.map(h => (
                <button key={h.concept} onClick={() => run(h.concept)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#581c87', background: 'white', border: '1px solid #e9d5ff', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                  ↻ {h.concept}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-2)', borderRadius: 10, padding: 3 }}>
              {LEVELS.map(l => (
                <button key={l.k} onClick={() => setLevel(l.k)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: level === l.k ? 'white' : 'transparent', color: level === l.k ? '#7c3aed' : 'var(--ink-4)', fontSize: 13, fontWeight: level === l.k ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: level === l.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{l.l}</button>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7 }}>{level === 'simple' ? result.simple : level === 'exam' ? result.exam : (result.clinical || 'Sem aplicação clínica direta.')}</div>
            </div>

            {result.analogy && <div style={{ ...card, background: '#faf5ff', borderColor: '#e9d5ff' }}><div style={{ fontSize: 14, color: '#6b21a8', lineHeight: 1.6 }}>🧠 {result.analogy}</div></div>}

            {result.key_points?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>A reter</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{result.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            )}
            {result.common_mistake && <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}><div style={{ fontSize: 13.5, color: '#92400e', lineHeight: 1.6 }}>⚠️ Erro comum: {result.common_mistake}</div></div>}
          </div>
        )}
      </div>
    </div>
  )
}
