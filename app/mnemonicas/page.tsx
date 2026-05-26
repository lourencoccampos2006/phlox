'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'

interface Result {
  topic: string; items: string[]; mnemonic: string
  breakdown: { letter: string; stands_for: string }[]; tip: string; alt: string
}

export default function MnemonicasPage() {
  const { user } = useAuth() as any
  const area = areaOf(user?.student_area)
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  const examples = ['Nervos cranianos', 'Critérios de Ranson', 'Ossos do carpo', 'Sinais de inflamação', 'Causas de acidose metabólica']

  async function run(t?: string) {
    const tp = (t ?? topic).trim(); if (!tp) return
    if (t) setTopic(t)
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/mnemonicas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: tp, area: area.label }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · {area.label}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Mnemónicas</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Diz o que precisas de decorar e crio-te uma mnemónica em português, com o significado de cada parte.</p>
        </div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Ex: nervos cranianos, critérios de…"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <button onClick={() => run()} disabled={loading || !topic.trim()} style={{ padding: '0 20px', background: topic.trim() && !loading ? '#7c3aed' : 'var(--bg-3)', color: topic.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: topic.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? '…' : 'Criar'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {examples.map(ex => <button key={ex} onClick={() => run(ex)} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 11px', cursor: 'pointer' }}>{ex}</button>)}
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)', borderColor: '#e9d5ff', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>A tua mnemónica</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#581c87', lineHeight: 1.4 }}>{result.mnemonic}</div>
            </div>

            {result.breakdown?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>O que cada parte significa</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.breakdown.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#7c3aed', flexShrink: 0 }}>{b.letter}</div>
                      <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>{b.stands_for}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.tip && <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}><div style={{ fontSize: 13.5, color: '#15803d', lineHeight: 1.6 }}>💡 {result.tip}</div></div>}
            {result.alt && <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Alternativa: <strong style={{ color: 'var(--ink-2)' }}>{result.alt}</strong></div>}
          </div>
        )}
      </div>
    </div>
  )
}
