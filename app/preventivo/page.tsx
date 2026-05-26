'use client'

// "Estou em dia com a minha saúde?" — vacinas e rastreios recomendados por idade/sexo (DGS).

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Item { name: string; why: string; frequency: string; priority: 'alta' | 'media' | 'informativa' }
interface Result { profile: string; screenings: Item[]; vaccines: Item[]; lifestyle: string[]; note: string }

const PRIO: Record<string, { color: string; bg: string; label: string }> = {
  alta: { color: '#dc2626', bg: '#fef2f2', label: 'Recomendado' },
  media: { color: '#d97706', bg: '#fffbeb', label: 'A considerar' },
  informativa: { color: '#2563eb', bg: '#eff6ff', label: 'Informativo' },
}

export default function PreventivoPage() {
  const { user } = useAuth() as any
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [conditions, setConditions] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { if (user?.age) setAge(String(user.age)); if (user?.sex) setSex(user.sex) }, [user])

  async function run() {
    if (!age) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/preventivo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ age, sex, conditions: conditions.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const renderItem = (it: Item, i: number) => {
    const p = PRIO[it.priority] || PRIO.informativa
    return (
      <div key={i} style={{ borderLeft: `3px solid ${p.color}`, background: 'var(--bg-2)', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{it.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: p.color, background: p.bg, padding: '2px 7px', borderRadius: 5 }}>{p.label}</span>
        </div>
        {it.why && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>{it.why}</div>}
        {it.frequency && <div style={{ fontSize: 12, color: '#0f766e', marginTop: 4, fontWeight: 600 }}>🗓️ {it.frequency}</div>}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Estou em dia com a minha saúde?</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Vê os rastreios e vacinas recomendados para a tua idade — para não deixares passar nenhum.</p>
        </div>
      </div>

      <div className="page-container page-body">
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Idade</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex: 52" min={0} max={120}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Sexo</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['F', 'Feminino'], ['M', 'Masculino']].map(([v, l]) => (
                  <button key={v} onClick={() => setSex(v)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${sex === v ? '#2563eb' : 'var(--border)'}`, background: sex === v ? '#eff6ff' : 'white', color: sex === v ? '#2563eb' : 'var(--ink-3)', fontSize: 13, fontWeight: sex === v ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Doenças crónicas (opcional)</label>
          <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: diabetes, asma…"
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={run} disabled={loading || !age}
            style={{ width: '100%', padding: 13, background: age && !loading ? '#2563eb' : 'var(--bg-3)', color: age && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: age && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            {loading ? 'A preparar…' : 'Ver o meu plano'}
          </button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.profile && <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>{result.profile}</div>}
            {result.screenings?.length > 0 && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}><span style={{ fontSize: 15 }}>🔬</span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rastreios</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{result.screenings.map(renderItem)}</div>
              </div>
            )}
            {result.vaccines?.length > 0 && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}><span style={{ fontSize: 15 }}>💉</span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vacinas</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{result.vaccines.map(renderItem)}</div>
              </div>
            )}
            {result.lifestyle?.length > 0 && (
              <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Hábitos saudáveis</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.lifestyle.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {result.note && <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5 }}>{result.note}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
