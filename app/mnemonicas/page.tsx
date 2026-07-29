'use client'

// ─── PHLOX MNEMÓNICAS VISUAIS ─────────────────────────────────────────────────
// Pesquisa competitiva 2026-07-27/28: o Picmonic reporta +331% de retenção com
// mnemónicas visuais (ícone/personagem + associação visual por conceito). Em
// vez de vídeo (caro), o Phlox gera a mesma técnica por IA: uma imagem mental
// vívida e exagerada, com um ícone âncora — mais barato, no mesmo espírito
// "gerado por IA" do resto do produto. O estudante constrói um baralho pessoal
// ao longo do tempo, persistido na conta (sprint118).

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { areaOf } from '@/lib/studyAreas'
import { logStudy } from '@/lib/studyProgress'
import { getCachedDeck, fetchDeck, saveMnemonicToDeck, removeMnemonicFromDeck, type DeckMnemonic } from '@/lib/mnemonicsDeck'

const ACCENT = '#7c3aed'

interface VisualMnemonic {
  concept: string
  technique: 'sigla' | 'historia' | 'palavra-chave'
  mnemonic: string
  scene: string
  icon: string
  breakdown: { letter: string; stands_for: string; icon?: string }[]
  tip: string
  alt: string
}

const TECHNIQUE_LABEL: Record<string, string> = {
  sigla: 'Sigla',
  historia: 'História visual',
  'palavra-chave': 'Palavra-chave',
}

const SUGGESTIONS = [
  'Nervos cranianos', 'Beta-bloqueadores', 'Critérios de Light',
  'Ciclo de Krebs', 'Sinais de choque', 'Hormonas da hipófise anterior',
  'Causas de hipercaliémia', 'Fases da cicatrização',
]

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }

export default function MnemonicasPage() {
  const { user, supabase } = useAuth() as any
  const area = areaOf(user?.student_area)
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const [concept, setConcept] = useState('')
  const [result, setResult] = useState<VisualMnemonic | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prevVersions, setPrevVersions] = useState<string[]>([])

  const [deck, setDeck] = useState<DeckMnemonic[]>([])
  const [deckLoaded, setDeckLoaded] = useState(false)
  const [showDeck, setShowDeck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const consumedDeepLink = useRef(false)

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  // Baralho: pintura instantânea a partir da cache local, depois refresca da conta.
  useEffect(() => {
    if (!user || !isStudent) return
    setDeck(getCachedDeck())
    ;(async () => {
      const headers = await authHeaders()
      const { items } = await fetchDeck(headers)
      setDeck(items)
      setDeckLoaded(true)
    })()
  }, [user, isStudent, authHeaders])

  const generate = useCallback(async (c: string, avoid: string[] = []) => {
    const cp = c.trim()
    if (!cp) return
    setLoading(true); setError(''); setCopied(false)
    try {
      const res = await fetch('/api/mnemonicas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: cp, area: area.label, avoid }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao gerar')
      setResult(d); setConcept(cp)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [area.label])

  // Deep-link a partir de /tutor (Explicar & Mnemónica): ?concept=...
  useEffect(() => {
    if (consumedDeepLink.current) return
    consumedDeepLink.current = true
    try {
      const c = new URLSearchParams(window.location.search).get('concept')
      if (c) generate(c)
    } catch {}
  }, [generate])

  function regenerate() {
    if (!result) return
    const avoid = [...prevVersions, result.mnemonic]
    setPrevVersions(avoid)
    generate(concept, avoid)
  }

  const isSaved = result ? deck.some(d => d.concept === result.concept && d.mnemonic === result.mnemonic) : false

  async function saveToDeck() {
    if (!result || saving) return
    setSaving(true)
    try {
      const headers = await authHeaders()
      const item = await saveMnemonicToDeck(headers, {
        concept: result.concept, area: area.label, technique: result.technique,
        mnemonic: result.mnemonic, scene: result.scene, icon: result.icon,
        breakdown: result.breakdown, tip: result.tip, alt: result.alt,
      })
      if (item) {
        setDeck(prev => [item, ...prev])
        logStudy({ kind: 'mnemonic', area: area.label })
      } else {
        setError('Não foi possível guardar agora. Tenta de novo.')
      }
    } finally { setSaving(false) }
  }

  async function deleteFromDeck(id: string) {
    const headers = await authHeaders()
    const ok = await removeMnemonicFromDeck(headers, id)
    if (ok) setDeck(prev => prev.filter(d => d.id !== id))
  }

  function openFromDeck(d: DeckMnemonic) {
    setResult({
      concept: d.concept, technique: (d.technique as any) || 'historia', mnemonic: d.mnemonic,
      scene: d.scene || '', icon: d.icon || '🧠', breakdown: d.breakdown || [], tip: d.tip || '', alt: d.alt || '',
    })
    setConcept(d.concept); setPrevVersions([]); setShowDeck(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function copyMnemonic() {
    if (!result) return
    const text = [
      result.mnemonic, '', result.scene, '',
      ...result.breakdown.map(b => `${b.icon ? b.icon + ' ' : ''}${b.letter} — ${b.stands_for}`),
      result.tip ? `\nDica: ${result.tip}` : '',
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  if (!isStudent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Mnemónicas visuais</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Uma imagem mental memorável para cada conceito — gerada por IA, com um ícone âncora e a técnica de memorização certa para o que estás a estudar. Constrói o teu baralho pessoal. Exclusivo Plus.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: ACCENT, color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver plano Plus →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: ACCENT, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: ACCENT, borderRadius: 1 }} />Mnemónicas visuais · Plus
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 10 }}>
            Uma imagem mental para cada conceito
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 560 }}>
            Escreve um fármaco, um mecanismo ou uma lista de critérios. A IA escolhe a técnica certa — sigla, história visual ou palavra-chave — e devolve uma associação memorável, não só um resumo.
          </p>
          {deck.length > 0 && (
            <button onClick={() => setShowDeck(s => !s)} style={{ marginTop: 12, padding: '6px 12px', background: 'white', border: `1.5px solid #e9d5ff`, borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
              {showDeck ? 'Fechar baralho' : `🗂 O meu baralho · ${deck.length}`}
            </button>
          )}
        </div>

        {showDeck && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Mnemónicas guardadas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deck.map(d => (
                <div key={d.id} style={{ padding: '11px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{d.icon || '🧠'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{d.concept}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#581c87', lineHeight: 1.4 }}>{d.mnemonic}</div>
                  </div>
                  <button onClick={() => openFromDeck(d)} style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: 'white', border: '1px solid #e9d5ff', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', flexShrink: 0 }}>Abrir</button>
                  <button onClick={() => deleteFromDeck(d.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-5)', flexShrink: 0 }}>×</button>
                </div>
              ))}
              {deckLoaded && deck.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Ainda sem mnemónicas guardadas.</div>}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ ...card, marginBottom: 16 }}>
          <input value={concept} onChange={e => setConcept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && generate(concept)}
            placeholder="Ex: heparina · nervos cranianos · ciclo de Krebs…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <button onClick={() => generate(concept)} disabled={!concept.trim() || loading}
            style={{ width: '100%', marginTop: 10, padding: '12px 16px', background: concept.trim() && !loading ? ACCENT : 'var(--bg-3)', color: concept.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: concept.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
            {loading ? 'A criar a imagem mental…' : '✨ Gerar mnemónica visual'}
          </button>
          {error && <div style={{ marginTop: 10, padding: '9px 11px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12.5, color: '#991b1b' }}>{error}</div>}
          {!result && !loading && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>Experimenta</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => generate(s)} style={{ fontSize: 12, color: '#581c87', background: 'white', border: '1px solid #e9d5ff', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${ACCENT}30`, borderTop: `3px solid ${ACCENT}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>A escolher a técnica certa para "{concept}"…</div>
          </div>
        )}

        {!loading && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Card principal */}
            <div style={{ ...card, background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)', borderColor: '#e9d5ff', textAlign: 'center', padding: '28px 22px' }}>
              <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>{result.icon}</div>
              <div style={{ display: 'inline-block', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ACCENT, background: 'white', border: '1px solid #e9d5ff', borderRadius: 20, padding: '3px 11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                {TECHNIQUE_LABEL[result.technique] || 'Mnemónica'}
              </div>
              <div style={{ fontSize: 11, color: '#7c3aed', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{result.concept}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: '#581c87', lineHeight: 1.35 }}>{result.mnemonic}</div>
            </div>

            {/* A imagem mental */}
            {result.scene && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#b45309', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>A imagem mental</div>
                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.75, fontStyle: 'italic' }}>{result.scene}</div>
              </div>
            )}

            {/* Breakdown */}
            {result.breakdown?.length > 0 && (
              <div style={card}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.breakdown.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      {b.icon && <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{b.icon}</span>}
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: ACCENT }}>{b.letter}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}> — {b.stands_for}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.tip && (
              <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#15803d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Dica</div>
                <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>{result.tip}</div>
              </div>
            )}
            {result.alt && (
              <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Alternativa: <span style={{ color: 'var(--ink-2)' }}>{result.alt}</span></div>
            )}

            {/* Ações */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={regenerate} disabled={loading} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                ↻ Gerar outra versão
              </button>
              <button onClick={copyMnemonic} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? 'Copiado ✓' : 'Copiar'}
              </button>
              <button onClick={saveToDeck} disabled={saving || isSaved} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #e9d5ff', background: isSaved ? '#faf5ff' : ACCENT, color: isSaved ? ACCENT : 'white', fontSize: 12.5, fontWeight: 700, cursor: isSaved ? 'default' : 'pointer' }}>
                {isSaved ? '★ No baralho' : saving ? 'A guardar…' : '☆ Guardar no baralho'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
