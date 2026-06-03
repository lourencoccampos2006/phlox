'use client'

// /traduzir — Tradução clínica EN/ES/FR/UK/AR ↔ PT-PT com cache
// Usado em contexto de doentes migrantes, instruções de alta, etc.

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const LANGS: { code: string; label: string; flag: string }[] = [
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'en', label: 'Inglês', flag: '🇬🇧' },
  { code: 'es', label: 'Espanhol', flag: '🇪🇸' },
  { code: 'fr', label: 'Francês', flag: '🇫🇷' },
  { code: 'uk', label: 'Ucraniano', flag: '🇺🇦' },
  { code: 'de', label: 'Alemão', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ro', label: 'Romeno', flag: '🇷🇴' },
  { code: 'ar', label: 'Árabe', flag: '🇸🇦' },
]

const PRESETS = [
  'Toma este medicamento 2 vezes por dia, ao pequeno-almoço e ao jantar, com comida.',
  'Se sentir dor torácica, falta de ar súbita ou tonturas, dirige-te imediatamente à urgência.',
  'Não comas nem bebas nada nas 8 horas antes da cirurgia.',
  'Bebe pelo menos 1,5 litros de água por dia.',
  'A próxima consulta é dentro de 2 semanas. Vais receber uma mensagem com a hora.',
  'Tens alergia a algum medicamento?',
  'Mostra-me onde dói exactamente.',
  'Tomaste a medicação hoje? A que horas?',
]

const ACCENT = '#0d6e42'

export default function TranslatePage() {
  const { user, supabase } = useAuth() as any
  const [source, setSource] = useState('pt')
  const [target, setTarget] = useState('uk')
  const [text, setText] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  const translate = useCallback(async () => {
    if (!text.trim() || busy) return
    setBusy(true); setErr(null); setOut(''); setCached(false)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ text: text.trim(), source_lang: source, target_lang: target }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setOut(j.translated || '')
      setCached(!!j.cached)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }, [text, source, target, supabase, busy])

  function swap() {
    const a = source, b = target; setSource(b); setTarget(a)
    if (out) { setText(out); setOut('') }
  }

  function copy() {
    if (out) navigator.clipboard.writeText(out)
  }

  if (!user) return <main style={{ padding: 24 }}><h1>Tradução</h1><p>Sessão expirada.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Tradução clínica</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
          PT-PT ↔ EN, ES, FR, UK, DE, IT, RO, AR. Mantém doses e terminologia clínica. Cache automática.
        </p>
      </div>

      {/* Seletor de línguas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select value={source} onChange={e => setSource(e.target.value)} style={{ ...input, fontSize: 15 }}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
        </select>
        <button onClick={swap} title="Trocar línguas" style={{
          padding: 10, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16,
        }}>⇄</button>
        <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...input, fontSize: 15 }}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
        </select>
      </div>

      {/* Áreas de texto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Texto a traduzir…"
          style={{ ...input, minHeight: 200, resize: 'vertical', fontSize: 14 }}
        />
        <div style={{ ...input, minHeight: 200, padding: 12, background: '#f9fafb', whiteSpace: 'pre-wrap', overflow: 'auto', position: 'relative' }}>
          {busy ? (
            <p style={{ color: '#6b7280' }}>A traduzir…</p>
          ) : out ? (
            <>
              <span style={{ color: '#111827' }}>{out}</span>
              <button onClick={copy} style={{
                position: 'absolute', top: 8, right: 8, padding: '4px 8px',
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 11,
              }}>Copiar</button>
              {cached && <span style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10, color: '#10b981' }}>cache</span>}
            </>
          ) : (
            <p style={{ color: '#9ca3af' }}>Tradução aparece aqui.</p>
          )}
        </div>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginTop: 12 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button disabled={busy || !text.trim()} onClick={translate} style={{
          padding: '10px 24px', border: 'none', borderRadius: 10, cursor: 'pointer',
          background: ACCENT, color: 'white', fontWeight: 700, fontSize: 15,
          opacity: (busy || !text.trim()) ? 0.5 : 1,
        }}>
          {busy ? 'A traduzir…' : 'Traduzir'}
        </button>
      </div>

      {/* Presets */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Frases comuns</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
          {PRESETS.map(p => (
            <button key={p} onClick={() => setText(p)} style={{
              textAlign: 'left', padding: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, color: '#374151',
            }}>{p}</button>
          ))}
        </div>
      </div>
    </main>
  )
}

const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}
