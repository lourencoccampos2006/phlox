'use client'

// Ficha de Fármaco com Mnemónica — era /ficha, fundido diretamente em /tutor.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { logStudy, setLastTool } from '@/lib/studyProgress'

interface DrugCard {
  drug_name: string
  dci: string
  class: string
  mechanism: { simple: string; analogy: string }
  indications: string[]
  adverse_effects: { effect: string; severity: 'grave' | 'moderado' | 'ligeiro'; frequency: string }[]
  mnemonic: { word: string; letters: { letter: string; meaning: string }[] }
  key_interactions: { drug: string; effect: string; mechanism: string }[]
  pharmacokinetics: { absorption: string; half_life: string; elimination: string; notes: string }
  monitoring: string[]
  clinical_pearl: string
  quiz: { question: string; options: string[]; correct: number; explanation: string }[]
}

const EXAMPLES = ['Metformina', 'Varfarina', 'Amiodarona', 'Metoprolol', 'Atorvastatina', 'Sertralina', 'Furosemida', 'Omeprazol']

const SEV_STYLE = {
  grave: { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
  moderado: { color: 'var(--badge-amber-fg)', bg: 'var(--amber-light)', border: 'var(--badge-amber-border)' },
  ligeiro: { color: 'var(--green-3)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
}

export default function FichaFarmaco({ initialDrug }: { initialDrug?: string } = {}) {
  const { user, supabase } = useAuth()
  const [query, setQuery] = useState(initialDrug || '')
  const [card, setCard] = useState<DrugCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedCards, setSavedCards] = useState<string[]>([])
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [tab, setTab] = useState<'mechanism' | 'adverse' | 'interactions' | 'pk' | 'quiz'>('mechanism')

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`phlox-saved-cards-${user.id}`)
      if (stored) setSavedCards(JSON.parse(stored))
    }
  }, [user])

  useEffect(() => { if (initialDrug) generate(initialDrug) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (drug?: string) => {
    const term = (drug || query).trim()
    if (!term) return
    setLoading(true); setError(''); setCard(null); setQuizAnswers([]); setQuizSubmitted(false)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/ficha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ drug: term }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCard(data)
      setTab('mechanism')
      setQuery(term)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const saveCard = () => {
    if (!card || !user) return
    const updated = savedCards.includes(card.dci) ? savedCards.filter(c => c !== card.dci) : [...savedCards, card.dci]
    setSavedCards(updated)
    localStorage.setItem(`phlox-saved-cards-${user.id}`, JSON.stringify(updated))
  }

  const isSaved = card ? savedCards.includes(card.dci) : false

  const tabStyle = (t: string) => ({
    padding: '8px 14px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--roxo)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? 'var(--roxo)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  return (
    <div>
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: 16, maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="Nome do fármaco (ex: Metformina, Varfarina...)"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'transparent', padding: '12px 0' }} />
          <button onClick={() => generate()} disabled={!query.trim() || loading}
            style={{ background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: query.trim() ? 1 : 0.5 }}>
            {loading ? 'A gerar...' : 'Gerar ficha →'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {EXAMPLES.map(e => (
          <button key={e} onClick={() => { setQuery(e); generate(e) }}
            style={{ padding: '5px 12px', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-xl)', background: 'var(--roxo-claro)', cursor: 'pointer', fontSize: 12, color: 'var(--roxo)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            {e}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'var(--red-light)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--ink-3)' }}>
            <div style={{ width: 20, height: 20, border: '2.5px solid var(--roxo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>A construir a tua ficha de estudo...</span>
          </div>
        </div>
      )}

      {card && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--roxo)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{card.class}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'white', fontWeight: 400, marginBottom: 2 }}>{card.drug_name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>DCI: {card.dci}</div>
            </div>
            <button onClick={saveCard}
              style={{ background: isSaved ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 'var(--r-md)', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
              {isSaved ? '★ Guardado' : '☆ Guardar'}
            </button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            {[
              ['mechanism', 'Mecanismo'],
              ['adverse', `Efeitos (${card.adverse_effects.length})`],
              ['interactions', `Interações (${card.key_interactions.length})`],
              ['pk', 'Farmacocinética'],
              ['quiz', 'Quiz'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {tab === 'mechanism' && (
              <div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }} className="mech-grid">
                  <div style={{ padding: '18px', background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-lg)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--roxo)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Mecanismo</div>
                    <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{card.mechanism.simple}</p>
                  </div>
                  <div style={{ padding: '18px', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-lg)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>💡 Analogia</div>
                    <p style={{ fontSize: 14, color: 'var(--amber)', lineHeight: 1.7, fontStyle: 'italic' }}>{card.mechanism.analogy}</p>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Indicações aprovadas</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {card.indications.map((ind, i) => (
                      <span key={i} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-xl)', color: 'var(--green-2)', fontWeight: 500 }}>{ind}</span>
                    ))}
                  </div>
                </div>

                {card.monitoring.length > 0 && (
                  <div style={{ marginTop: 14, padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>🔬 Monitorização necessária</div>
                    {card.monitoring.map((m, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                        <span style={{ flexShrink: 0 }}>·</span>{m}
                      </div>
                    ))}
                  </div>
                )}

                {card.clinical_pearl && (
                  <div style={{ marginTop: 12, padding: '14px 16px', background: 'var(--ink)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>💎</span>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Pearl clínico</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>{card.clinical_pearl}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'adverse' && (
              <div>
                <div style={{ marginBottom: 20, padding: '18px', background: 'var(--roxo-claro)', border: '2px solid var(--roxo-borda)', borderRadius: 'var(--r-lg)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--roxo)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>🧠 Mnemónica — {card.mnemonic.word}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {card.mnemonic.letters.map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--roxo)', fontFamily: 'var(--font-serif)', width: 28, flexShrink: 0 }}>{l.letter}</span>
                        <span style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{l.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {card.adverse_effects.map((ae, i) => {
                    const s = SEV_STYLE[ae.severity]
                    return (
                      <div key={i} style={{ padding: '12px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{ae.effect}</span>
                          <span style={{ fontSize: 11, color: s.color, opacity: 0.7, marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{ae.frequency}</span>
                        </div>
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, background: 'white', border: `1px solid ${s.border}`, padding: '2px 6px', borderRadius: 'var(--r-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                          {ae.severity}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {tab === 'interactions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {card.key_interactions.map((inter, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                      {card.dci} + <span style={{ color: 'var(--red)' }}>{inter.drug}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 6, fontStyle: 'italic' }}>"{inter.effect}"</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Mecanismo: {inter.mechanism}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'pk' && card.pharmacokinetics && (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {[
                  ['Absorção', card.pharmacokinetics.absorption, '💊'],
                  ['Semivida', card.pharmacokinetics.half_life, '⏱'],
                  ['Eliminação', card.pharmacokinetics.elimination, '🔄'],
                  ['Notas', card.pharmacokinetics.notes, '📝'],
                ].map(([label, value, icon]) => value && (
                  <div key={label as string} style={{ padding: '16px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 16, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'quiz' && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>3 perguntas sobre {card.drug_name}. Selecciona a tua resposta e vê a explicação no final.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {card.quiz.map((q, qi) => {
                    const answered = quizAnswers[qi] !== undefined && quizAnswers[qi] !== null
                    const selected = quizAnswers[qi]
                    const isCorrect = selected === q.correct
                    return (
                      <div key={qi} style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.5 }}>{qi + 1}. {q.question}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {q.options.map((opt, oi) => {
                            let bg = 'white'; let border = 'var(--border)'; let color = 'var(--ink)'
                            if (quizSubmitted) {
                              if (oi === q.correct) { bg = 'var(--badge-green-bg)'; border = 'var(--green-mid)'; color = 'var(--green)' }
                              else if (oi === selected && !isCorrect) { bg = 'var(--badge-red-bg)'; border = 'var(--badge-red-border)'; color = 'var(--red)' }
                            } else if (oi === selected) { bg = 'var(--roxo-claro)'; border = 'var(--roxo-meio)'; color = 'var(--roxo-escuro)' }
                            return (
                              <button key={oi} onClick={() => {
                                if (quizSubmitted) return
                                const a = [...quizAnswers]
                                a[qi] = oi
                                setQuizAnswers(a)
                              }}
                                style={{ padding: '10px 14px', background: bg, border: `1.5px solid ${border}`, borderRadius: 'var(--r-md)', cursor: quizSubmitted ? 'default' : 'pointer', fontSize: 13, color, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        {quizSubmitted && (
                          <div style={{ marginTop: 10, padding: '10px 12px', background: isCorrect ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)', borderRadius: 'var(--r-md)', fontSize: 12, color: isCorrect ? 'var(--green)' : 'var(--red)', lineHeight: 1.6 }}>
                            {isCorrect ? '✓ Correcto! ' : '✗ Incorrecta. '}{q.explanation}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!quizSubmitted && quizAnswers.filter(a => a !== null && a !== undefined).length === card.quiz.length && (
                  <button onClick={() => {
                    setQuizSubmitted(true)
                    card.quiz.forEach((q, i) => logStudy({ kind: 'flashcard', area: card.class, correct: quizAnswers[i] === q.correct }))
                    setLastTool('/tutor', 'Ficha de Fármaco')
                  }}
                    style={{ marginTop: 16, width: '100%', padding: '13px', background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Ver resultados
                  </button>
                )}
                {quizSubmitted && (
                  <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', textAlign: 'center', fontSize: 14, color: 'var(--ink)' }}>
                    Resultado: <strong>{quizAnswers.filter((a, i) => a === card.quiz[i]?.correct).length}/{card.quiz.length}</strong> correctas
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`.mech-grid{grid-template-columns:1fr 1fr} @media(max-width:640px){.mech-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
