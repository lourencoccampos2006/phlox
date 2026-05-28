'use client'

// Nota SOAP — estrutura as notas de uma consulta em Subjetivo/Objetivo/Avaliação/Plano.

import { useState } from 'react'

interface Result {
  subjective: string; objective: string; assessment: string
  plan: string[]; icpc2: string[]; missing: string[]
}

export default function SoapPage() {
  const [consult, setConsult] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function run() {
    if (!consult.trim()) return
    setLoading(true); setError(''); setResult(null); setCopied(false)
    try {
      const res = await fetch('/api/soap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consult: consult.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  function copyText() {
    if (!result) return
    const txt = `S: ${result.subjective}\n\nO: ${result.objective}\n\nA: ${result.assessment}\n\nP:\n${result.plan.map(p => `- ${p}`).join('\n')}`
    navigator.clipboard?.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const SOAP = [
    { k: 'subjective', letter: 'S', label: 'Subjetivo', color: '#2563eb' },
    { k: 'objective', letter: 'O', label: 'Objetivo', color: '#0891b2' },
    { k: 'assessment', letter: 'A', label: 'Avaliação', color: '#d97706' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Clínica · Consulta</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Nota Clínica SOAP</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Escreve livremente o que aconteceu na consulta — estruturamos em S/O/A/P pronto para o processo.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <textarea value={consult} onChange={e => setConsult(e.target.value)} rows={5} placeholder="Ex: Sr. de 58a, vem por tosse seca há 1 semana, sem febre. Auscultação limpa, SpO2 98%. Suspeito de tosse pós-viral. Vou pedir RX se persistir, aconselhar hidratação…"
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.55, marginBottom: 12 }} />
          <button onClick={run} disabled={loading || !consult.trim()} style={{ width: '100%', padding: 13, background: consult.trim() && !loading ? '#dc2626' : 'var(--bg-3)', color: consult.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: consult.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? 'A estruturar…' : 'Estruturar nota'}</button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={copyText} style={{ fontSize: 12.5, fontWeight: 700, color: copied ? '#16a34a' : '#374151', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', cursor: 'pointer' }}>{copied ? '✓ Copiado' : 'Copiar nota'}</button>
            </div>
            {SOAP.map(s => (
              <div key={s.k} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: s.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{s.letter}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{(result as any)[s.k] || '—'}</div>
              </div>
            ))}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>P</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Plano</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{(result.plan || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            {result.icpc2?.length > 0 && (
              <div style={{ ...card, background: 'var(--bg-2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Codificação ICPC-2 (sugestão)</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{result.icpc2.join(' · ')}</div>
              </div>
            )}
            {result.missing?.length > 0 && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>A documentar (em falta)</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e', lineHeight: 1.55 }}>{result.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>Apoio à documentação — rever antes de incluir no processo clínico.</div>
          </div>
        )}
      </div>
    </div>
  )
}
