'use client'

// ─── NOVO: app/ficha/page.tsx ───
// Ficha de Fármaco com Mnemónica gerada por AI — exclusivo Student+
// O estudante pesquisa um fármaco e recebe uma ficha de estudo completa:
// mecanismo com analogia, mnemónica para efeitos adversos, interações como história,
// quiz de 3 perguntas, e a ficha é guardada no "caderno" do estudante.

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

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
  grave:    { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  moderado: { color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
  ligeiro:  { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0' },
}

export default function FichaPage() {
  const { user, supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [card, setCard] = useState<DrugCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedCards, setSavedCards] = useState<string[]>([])
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [tab, setTab] = useState<'mechanism' | 'adverse' | 'interactions' | 'pk' | 'quiz'>('mechanism')

  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  useEffect(() => {
    if (user) {
      // Carregar fichas guardadas
      const stored = localStorage.getItem(`phlox-saved-cards-${user.id}`)
      if (stored) setSavedCards(JSON.parse(stored))
    }
  }, [user])

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
    borderBottom: `2px solid ${tab === t ? '#7c3aed' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? '#7c3aed' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  if (!isStudent) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:480, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🧠</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--ink)', marginBottom:12 }}>Ficha de Fármaco com Mnemónica</div>
          <p style={{ fontSize:14, color:'var(--ink-4)', lineHeight:1.7, marginBottom:24 }}>
            Mecanismo com analogia, mnemónica para efeitos adversos, interações como história e quiz no final. Exclusivo Student.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'#7c3aed', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius:8, fontSize:14, fontWeight:700 }}>
            Ver plano Student →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#7c3aed', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:2, background:'#7c3aed', borderRadius:1 }} />Ficha de Fármaco · Student
          </div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(20px,3vw,28px)', color:'var(--ink)', fontWeight:400, marginBottom:8 }}>Ficha com Mnemónica</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6, maxWidth:520 }}>Mecanismo com analogia, mnemónica para efeitos adversos, interações como história, e quiz no final. A ficha que o ChatGPT não consegue fazer.</p>
        </div>

        {/* Search */}
        <div style={{ background:'white', border:'1.5px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.04)', marginBottom:16, maxWidth:600 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'4px 4px 4px 16px', gap:8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="Nome do fármaco (ex: Metformina, Varfarina...)"
              style={{ flex:1, border:'none', outline:'none', fontSize:15, fontFamily:'var(--font-sans)', color:'var(--ink)', background:'transparent', padding:'12px 0' }} />
            <button onClick={() => generate()} disabled={!query.trim() || loading}
              style={{ background:'#7c3aed', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', opacity:query.trim()?1:0.5 }}>
              {loading ? 'A gerar...' : 'Gerar ficha →'}
            </button>
          </div>
        </div>

        {/* Examples */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => { setQuery(e); generate(e) }}
              style={{ padding:'5px 12px', border:'1px solid #e9d5ff', borderRadius:20, background:'#faf5ff', cursor:'pointer', fontSize:12, color:'#7c3aed', fontFamily:'var(--font-sans)', fontWeight:500, transition:'all 0.15s' }}
              className="example-chip">
              {e}
            </button>
          ))}
        </div>

        {error && <div style={{ padding:'12px 16px', background:'var(--red-light)', border:'1px solid #fca5a5', borderRadius:8, fontSize:13, color:'var(--red)', marginBottom:16 }}>{error}</div>}

        {loading && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'60px 24px', textAlign:'center' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:12, color:'var(--ink-3)' }}>
              <div style={{ width:20, height:20, border:'2.5px solid #7c3aed', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              <span style={{ fontSize:14, fontFamily:'var(--font-mono)' }}>A construir a tua ficha de estudo...</span>
            </div>
          </div>
        )}

        {card && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            {/* Card header */}
            <div style={{ background:'#7c3aed', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.6)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>{card.class}</div>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'white', fontWeight:400, marginBottom:2 }}>{card.drug_name}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)' }}>DCI: {card.dci}</div>
              </div>
              <button onClick={saveCard}
                style={{ background:isSaved?'rgba(255,255,255,0.2)':'transparent', color:'white', border:'1px solid rgba(255,255,255,0.4)', borderRadius:7, padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'var(--font-sans)', flexShrink:0 }}>
                {isSaved ? '★ Guardado' : '☆ Guardar'}
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
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

            <div style={{ padding:'24px' }}>

              {/* MECANISMO */}
              {tab === 'mechanism' && (
                <div>
                  <div style={{ display:'grid', gap:12, gridTemplateColumns:'1fr 1fr' }} className="mech-grid">
                    <div style={{ padding:'18px', background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:10 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#7c3aed', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Mecanismo</div>
                      <p style={{ fontSize:14, color:'var(--ink)', lineHeight:1.7 }}>{card.mechanism.simple}</p>
                    </div>
                    <div style={{ padding:'18px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#b45309', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>💡 Analogia</div>
                      <p style={{ fontSize:14, color:'#78350f', lineHeight:1.7, fontStyle:'italic' }}>{card.mechanism.analogy}</p>
                    </div>
                  </div>

                  {/* Indicações */}
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Indicações aprovadas</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {card.indications.map((ind, i) => (
                        <span key={i} style={{ fontSize:12, padding:'4px 10px', background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:20, color:'var(--green-2)', fontWeight:500 }}>{ind}</span>
                      ))}
                    </div>
                  </div>

                  {/* Monitoring */}
                  {card.monitoring.length > 0 && (
                    <div style={{ marginTop:14, padding:'14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#1d4ed8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>🔬 Monitorização necessária</div>
                      {card.monitoring.map((m, i) => (
                        <div key={i} style={{ fontSize:13, color:'#1d4ed8', lineHeight:1.6, display:'flex', gap:8 }}>
                          <span style={{ flexShrink:0 }}>·</span>{m}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pearl */}
                  {card.clinical_pearl && (
                    <div style={{ marginTop:12, padding:'14px 16px', background:'var(--ink)', borderRadius:8, display:'flex', gap:12 }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>💎</span>
                      <div>
                        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Pearl clínico</div>
                        <div style={{ fontSize:13, color:'rgba(255,255,255,0.9)', lineHeight:1.7 }}>{card.clinical_pearl}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EFEITOS ADVERSOS + MNEMÓNICA */}
              {tab === 'adverse' && (
                <div>
                  {/* Mnemónica */}
                  <div style={{ marginBottom:20, padding:'18px', background:'#faf5ff', border:'2px solid #e9d5ff', borderRadius:10 }}>
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#7c3aed', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>🧠 Mnemónica — {card.mnemonic.word}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {card.mnemonic.letters.map((l, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                          <span style={{ fontSize:22, fontWeight:800, color:'#7c3aed', fontFamily:'var(--font-serif)', width:28, flexShrink:0 }}>{l.letter}</span>
                          <span style={{ fontSize:14, color:'var(--ink)', lineHeight:1.5 }}>{l.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lista de efeitos */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {card.adverse_effects.map((ae, i) => {
                      const s = SEV_STYLE[ae.severity]
                      return (
                        <div key={i} style={{ padding:'12px 14px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                          <div>
                            <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{ae.effect}</span>
                            <span style={{ fontSize:11, color:s.color, opacity:0.7, marginLeft:8, fontFamily:'var(--font-mono)' }}>{ae.frequency}</span>
                          </div>
                          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase', flexShrink:0 }}>
                            {ae.severity}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* INTERAÇÕES */}
              {tab === 'interactions' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {card.key_interactions.map((inter, i) => (
                    <div key={i} style={{ padding:'14px 16px', background:'white', border:'1px solid var(--border)', borderRadius:8 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:6 }}>
                        {card.dci} + <span style={{ color:'#dc2626' }}>{inter.drug}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.6, marginBottom:6, fontStyle:'italic' }}>"{inter.effect}"</div>
                      <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>Mecanismo: {inter.mechanism}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* FARMACOCINÉTICA */}
              {tab === 'pk' && card.pharmacokinetics && (
                <div style={{ display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {[
                    ['Absorção', card.pharmacokinetics.absorption, '💊'],
                    ['Semivida', card.pharmacokinetics.half_life, '⏱'],
                    ['Eliminação', card.pharmacokinetics.elimination, '🔄'],
                    ['Notas', card.pharmacokinetics.notes, '📝'],
                  ].map(([label, value, icon]) => value && (
                    <div key={label as string} style={{ padding:'16px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:16, marginBottom:6 }}>{icon}</div>
                      <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
                      <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.6 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* QUIZ */}
              {tab === 'quiz' && (
                <div>
                  <div style={{ fontSize:13, color:'var(--ink-3)', marginBottom:16 }}>3 perguntas sobre {card.drug_name}. Selecciona a tua resposta e vê a explicação no final.</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {card.quiz.map((q, qi) => {
                      const answered = quizAnswers[qi] !== undefined && quizAnswers[qi] !== null
                      const selected = quizAnswers[qi]
                      const isCorrect = selected === q.correct
                      return (
                        <div key={qi} style={{ padding:'16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:12, lineHeight:1.5 }}>
                            {qi + 1}. {q.question}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {q.options.map((opt, oi) => {
                              let bg = 'white'; let border = 'var(--border)'; let color = 'var(--ink)'
                              if (quizSubmitted) {
                                if (oi === q.correct) { bg = '#d1fae5'; border = '#6ee7b7'; color = '#065f46' }
                                else if (oi === selected && !isCorrect) { bg = '#fee2e2'; border = '#fca5a5'; color = '#991b1b' }
                              } else if (oi === selected) { bg = '#ede9fe'; border = '#c4b5fd'; color = '#5b21b6' }
                              return (
                                <button key={oi} onClick={() => {
                                  if (quizSubmitted) return
                                  const a = [...quizAnswers]
                                  a[qi] = oi
                                  setQuizAnswers(a)
                                }}
                                  style={{ padding:'10px 14px', background:bg, border:`1.5px solid ${border}`, borderRadius:7, cursor:quizSubmitted?'default':'pointer', fontSize:13, color, fontFamily:'var(--font-sans)', textAlign:'left', transition:'all 0.15s' }}>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                          {quizSubmitted && (
                            <div style={{ marginTop:10, padding:'10px 12px', background:isCorrect?'#d1fae5':'#fee2e2', borderRadius:7, fontSize:12, color:isCorrect?'#065f46':'#991b1b', lineHeight:1.6 }}>
                              {isCorrect ? '✓ Correcto! ' : '✗ Incorrecta. '}{q.explanation}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!quizSubmitted && quizAnswers.filter(a => a !== null && a !== undefined).length === card.quiz.length && (
                    <button onClick={() => setQuizSubmitted(true)}
                      style={{ marginTop:16, width:'100%', padding:'13px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                      Ver resultados
                    </button>
                  )}
                  {quizSubmitted && (
                    <div style={{ marginTop:14, padding:'14px 16px', background:'var(--bg-2)', borderRadius:8, textAlign:'center', fontSize:14, color:'var(--ink)' }}>
                      Resultado: <strong>{quizAnswers.filter((a, i) => a === card.quiz[i]?.correct).length}/{card.quiz.length}</strong> correctas
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .example-chip:hover{background:#ede9fe!important} .mech-grid{grid-template-columns:1fr 1fr} @media(max-width:640px){.mech-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}