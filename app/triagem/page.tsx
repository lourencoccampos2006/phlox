'use client'

// "Devo ir ao médico ou às urgências?" — orientação de triagem simples e prudente.
// Não diagnostica; diz onde procurar ajuda (casa/farmácia/centro de saúde/urgências/112).

import { useState, useEffect } from 'react'
import SaveButton from '@/components/SaveButton'
import { consumeReopen } from '@/lib/saves'

interface Result {
  level: '112' | 'urgencias' | 'centro_saude' | 'farmacia' | 'casa'
  headline: string; why: string; red_flags_now: string[]
  what_to_do: string[]; timeframe: string; reassurance: string
}

const LEVEL: Record<string, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  '112':         { label: 'Emergência — Ligar 112', color: '#fff', bg: '#dc2626', border: '#dc2626', emoji: '🚨' },
  urgencias:     { label: 'Ir às Urgências', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', emoji: '🏥' },
  centro_saude:  { label: 'Centro de Saúde', color: '#b45309', bg: '#fffbeb', border: '#fde68a', emoji: '🩺' },
  farmacia:      { label: 'Farmácia', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', emoji: '💊' },
  casa:          { label: 'Cuidar em casa', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🏠' },
}

const EXAMPLES = ['Dor de cabeça há 2 dias', 'Febre de 38,5 e tosse', 'Torci o tornozelo', 'Dor no peito ao respirar']

export default function TriagemPage() {
  const [complaint, setComplaint] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  // Reabrir conteúdo vindo de /guardados
  useEffect(() => {
    const d = consumeReopen<Result & { input?: string }>()
    if (d) { setResult(d); if (d.input) setComplaint(d.input) }
  }, [])

  async function run(text?: string) {
    const c = (text ?? complaint).trim()
    if (!c) return
    if (text) setComplaint(text)
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/triagem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint: c }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const lv = result ? (LEVEL[result.level] || LEVEL.centro_saude) : null
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Devo ir ao médico?</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Descreve o que sentes e dizemos-te, com prudência, onde deves procurar ajuda — de casa às urgências.</p>
        </div>
      </div>

      <div className="page-container page-body">
        <div style={{ ...card, marginBottom: 16 }}>
          <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={3} placeholder="Ex: tenho febre há 2 dias, dores no corpo e tosse seca…"
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            {EXAMPLES.map(ex => <button key={ex} onClick={() => run(ex)} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 11px', cursor: 'pointer' }}>{ex}</button>)}
          </div>
          <button onClick={() => run()} disabled={loading || !complaint.trim()}
            style={{ width: '100%', padding: 13, background: complaint.trim() && !loading ? '#e11d48' : 'var(--bg-3)', color: complaint.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: complaint.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            {loading ? 'A avaliar…' : 'Orientar-me'}
          </button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && lv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ borderRadius: 14, padding: '18px 20px', background: lv.bg, border: `1.5px solid ${lv.border}`, color: result.level === '112' ? '#fff' : lv.color }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 26 }}>{lv.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: result.level === '112' ? 0.95 : 1 }}>{lv.label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{result.headline}</div>
              {result.why && <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, opacity: result.level === '112' ? 0.95 : 0.9 }}>{result.why}</div>}
              {result.timeframe && <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 700, opacity: 0.9 }}>Quando: {result.timeframe}</div>}
              {result.level === '112' && <a href="tel:112" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', background: '#fff', color: '#dc2626', borderRadius: 10, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>📞 Ligar 112</a>}
            </div>

            {result.what_to_do?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>O que fazer agora</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{result.what_to_do.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {result.red_flags_now?.length > 0 && (
              <div style={{ ...card, borderColor: '#fca5a5', background: '#fff7f7' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Ligar 112 se aparecer</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#991b1b', lineHeight: 1.6 }}>{result.red_flags_now.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {result.reassurance && <div style={{ ...card, background: 'var(--bg-2)' }}><div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>💙 {result.reassurance}</div></div>}

            {/* Acções rápidas — sempre presentes para o utilizador agir */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              <a href="tel:808242424" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: '#0891b2', color: 'white', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                📞 Ligar SNS24 (808 24 24 24)
              </a>
              {(result.level === 'urgencias' || result.level === 'centro_saude') && (
                <a href="https://www.google.com/maps/search/?api=1&query=hospital+ou+centro+de+saúde+mais+próximo" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'white', color: '#0b1120', border: '1.5px solid var(--border)', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                  🗺 Mais perto de mim
                </a>
              )}
              {result.level === 'farmacia' && (
                <a href="https://www.google.com/maps/search/?api=1&query=farmácia+de+serviço" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'white', color: '#0b1120', border: '1.5px solid var(--border)', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                  🗺 Farmácia de serviço
                </a>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <SaveButton kind="triage" color="#e11d48"
                title={result.headline || complaint.slice(0, 80)}
                preview={result.why || result.timeframe}
                data={{ complaint, result }} href="/triagem" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5 }}>Orientação geral, não substitui avaliação médica.</div>
          </div>
        )}
      </div>
    </div>
  )
}
