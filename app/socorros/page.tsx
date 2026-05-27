'use client'

// Guia rápido de Primeiros Socorros — "o que faço se…". Passos claros e prudentes.

import { useState } from 'react'

interface Result {
  situation: string; call_112_now: boolean; call_112_reason: string
  steps: string[]; do_not: string[]; watch_for: string[]; after: string
}

const QUICK = ['Engasgamento', 'Queimadura', 'Corte com hemorragia', 'Desmaio', 'Convulsão', 'Queda de idoso', 'Reação alérgica', 'Entornou água a ferver']

export default function SocorrosPage() {
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function run(s?: string) {
    const sit = (s ?? situation).trim(); if (!sit) return
    if (s) setSituation(s)
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/socorros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ situation: sit }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', padding: '24px 24px 20px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Primeiros Socorros</h1>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>O que fazer numa emergência, passo a passo. Mantém a calma — e se for grave, liga já 112.</p>
        </div>
      </div>

      <div className="page-container page-body">
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={situation} onChange={e => setSituation(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="O que aconteceu? Ex: alguém se engasgou…"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <button onClick={() => run()} disabled={loading || !situation.trim()} style={{ padding: '0 20px', background: situation.trim() && !loading ? '#dc2626' : 'var(--bg-3)', color: situation.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: situation.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? '…' : 'Ajuda'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {QUICK.map(q => <button key={q} onClick={() => run(q)} style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '5px 11px', cursor: 'pointer' }}>{q}</button>)}
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.call_112_now && (
              <div style={{ borderRadius: 14, padding: '16px 18px', background: '#dc2626', color: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>🚨 Ligar 112 agora</div>
                {result.call_112_reason && <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.95 }}>{result.call_112_reason}</div>}
                <a href="tel:112" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: '#fff', color: '#dc2626', borderRadius: 10, fontWeight: 800, textDecoration: 'none', fontSize: 16 }}>📞 112</a>
              </div>
            )}

            {result.steps?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Passos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55, paddingTop: 2 }}>{s}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.do_not?.length > 0 && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Não fazer</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#92400e', lineHeight: 1.6 }}>{result.do_not.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </div>
            )}

            {result.watch_for?.length > 0 && (
              <div style={{ ...card, borderColor: '#fca5a5', background: '#fff7f7' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ligar 112 se aparecer</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#991b1b', lineHeight: 1.6 }}>{result.watch_for.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            {result.after && <div style={{ ...card, background: 'var(--bg-2)' }}><div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>Depois: {result.after}</div></div>}
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5 }}>Guia de apoio — em emergência liga 112 · dúvidas SNS24 808 24 24 24.</div>
          </div>
        )}
      </div>
    </div>
  )
}
