'use client'

// /saude-agora — A ferramenta única "preciso de ajuda agora".
// 2026-06-01: reescrita. Fundi /triagem + /socorros num ÚNICO fluxo:
// utilizador descreve o que se passa → endpoint decide level + dá passos
// e indicação do destino. Sempre com botão grande "🆘 LIGAR 112" visível.
//
// Conceito melhorado:
//   - Mesma página serve "devo ir ao médico" E "o que faço numa emergência"
//   - A AI decide qual mecanismo aplicar
//   - Em qualquer nível, mostra-se sempre o número 112 destacado
//   - Atalhos rápidos para casos comuns (engasgamento, queimadura, etc.)
//   - O resultado é guardado em /guardados

import { useState, useEffect } from 'react'
import SaveButton from '@/components/SaveButton'
import { consumeReopen } from '@/lib/saves'

type Level = '112' | 'urgencias' | 'centro_saude' | 'farmacia' | 'casa' | 'primeiros_socorros'

interface Result {
  level: Level
  headline: string                      // "Liga já 112" / "Vai ao centro de saúde" etc.
  why: string                           // explicação curta
  red_flags_now: string[]               // se aparecer um destes, escala
  what_to_do_now: string[]              // passos imediatos
  do_not: string[]                      // o que NÃO fazer
  watch_for: string[]                   // sinais que justificam escalar
  timeframe: string                     // "agora", "nas próximas horas", "podes esperar 1-2 dias"
  reassurance?: string
}

const LEVEL_META: Record<Level, { label: string; color: string; bg: string; border: string; emoji: string; subtitle: string }> = {
  '112':              { label: 'EMERGÊNCIA — LIGAR 112', color: '#fff',    bg: '#dc2626', border: '#dc2626', emoji: '🚨', subtitle: 'Risco de vida imediato' },
  primeiros_socorros: { label: 'Atua já — passos abaixo', color: '#fff',    bg: '#ef4444', border: '#ef4444', emoji: '⚡', subtitle: 'Faz isto enquanto chega ajuda' },
  urgencias:          { label: 'Ir às Urgências',          color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', emoji: '🏥', subtitle: 'Hospital · agora' },
  centro_saude:       { label: 'Centro de Saúde / SNS 24', color: '#b45309', bg: '#fffbeb', border: '#fde68a', emoji: '🩺', subtitle: 'Médico nas próximas horas' },
  farmacia:           { label: 'Vai à Farmácia',           color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', emoji: '💊', subtitle: 'Aconselhamento + sem receita' },
  casa:               { label: 'Cuidar em casa',           color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🏠', subtitle: 'Vigia os sinais de alerta' },
}

const QUICK = [
  'Alguém se engasgou',
  'Queimadura',
  'Corte com hemorragia',
  'Desmaio',
  'Convulsão',
  'Reação alérgica grave',
  'Dor no peito',
  'Tontura súbita / fraqueza num lado',
  'Febre alta há 3 dias',
  'Vómitos persistentes',
]

export default function SaudeAgoraPage() {
  const [complaint, setComplaint] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

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
      const res = await fetch('/api/saude-agora', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaint: c }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Não foi possível. Em caso de dúvida e situação grave, liga já 112.')
    } finally { setLoading(false) }
  }

  const meta = result ? LEVEL_META[result.level] : null
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      {/* Hero com botão 112 sempre visível */}
      <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', padding: '20px 18px 18px' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Precisa de ajuda agora</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>O que aconteceu?</h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Descrevemos a situação e dizemos-te <strong>onde ir</strong>, <strong>o que fazer já</strong> e o que NÃO fazer. Mantém a calma.</p>
            </div>
            {/* Botão 112 — destaque máximo em mobile */}
            <a href="tel:112"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'white', color: '#dc2626', borderRadius: 12, fontSize: 16, fontWeight: 900, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
              📞 Ligar 112
            </a>
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Input livre */}
        <div style={{ ...card, marginBottom: 14 }}>
          <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }}
            placeholder="Ex: dor no peito desde manhã, queimei a mão a cozinhar, criança caiu da cama…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.55 }} />
          <button onClick={() => run()} disabled={loading || !complaint.trim()}
            style={{ width: '100%', padding: 13, marginTop: 10, background: complaint.trim() && !loading ? '#0b1120' : 'var(--bg-3)', color: complaint.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: complaint.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            {loading ? 'A analisar…' : 'Analisar agora →'}
          </button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {/* Atalhos rápidos */}
        {!result && !loading && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Comuns</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => run(q)}
                  style={{ padding: '8px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && meta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Headline com cor do nível */}
            <div style={{ background: meta.bg, border: `2px solid ${meta.border}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: meta.label.includes('112') || meta.label.includes('Atua') ? 'rgba(255,255,255,0.25)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{meta.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(18px,2.5vw,22px)', color: meta.color, fontWeight: 700, lineHeight: 1.2 }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: meta.color, opacity: 0.85, marginTop: 2, fontFamily: 'var(--font-mono)' }}>{meta.subtitle}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: meta.color, lineHeight: 1.6, margin: 0 }}>{result.why}</p>
              {result.timeframe && <div style={{ fontSize: 12, color: meta.color, marginTop: 8, opacity: 0.85, fontWeight: 700 }}>⏱ {result.timeframe}</div>}
            </div>

            {/* Passos a fazer JÁ */}
            {result.what_to_do_now?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>✓ Faz isto agora</div>
                <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65 }}>
                  {result.what_to_do_now.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
                </ol>
              </div>
            )}

            {/* Não fazer */}
            {result.do_not?.length > 0 && (
              <div style={{ ...card, background: '#fff7f7', borderColor: '#fca5a5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>🚫 NÃO faças</div>
                <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, color: '#7f1d1d', lineHeight: 1.6 }}>
                  {result.do_not.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                </ul>
              </div>
            )}

            {/* Red flags — escalar se aparecer */}
            {result.red_flags_now?.length > 0 && (
              <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>🚨 Liga 112 se aparecer</div>
                <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: '#991b1b', lineHeight: 1.6 }}>
                  {result.red_flags_now.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                </ul>
              </div>
            )}

            {/* Vigia */}
            {result.watch_for?.length > 0 && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>👁 Vigia nas próximas horas</div>
                <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, color: '#78350f', lineHeight: 1.6 }}>
                  {result.watch_for.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {result.reassurance && (
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, fontStyle: 'italic', textAlign: 'center', padding: '4px 8px' }}>{result.reassurance}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <a href="tel:112" style={{ flex: '1 1 160px', textAlign: 'center', padding: 13, background: '#dc2626', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800 }}>📞 Ligar 112</a>
              <a href="tel:808242424" style={{ flex: '1 1 160px', textAlign: 'center', padding: 13, background: 'white', color: '#1d4ed8', textDecoration: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, border: '1.5px solid #bfdbfe' }}>📞 SNS 24 · 808 24 24 24</a>
              <SaveButton kind="triage" title={`${meta.label.toUpperCase()}: ${complaint.slice(0, 60)}`}
                preview={result.headline || result.why} href="/saude-agora"
                data={{ ...result, input: complaint }} color={meta.bg !== '#fff' && meta.bg.startsWith('#f') ? '#dc2626' : meta.bg} size="sm" />
              <button onClick={() => { setResult(null); setComplaint('') }}
                style={{ flex: '1 1 100%', padding: 11, background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Nova consulta
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.55, padding: '6px 12px' }}>
              ⓘ Esta orientação é prudente mas não substitui a avaliação médica. Em caso de dúvida ou agravamento, liga já o 112 ou o SNS 24.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
