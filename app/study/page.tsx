'use client'

import { useState } from 'react'
import Header from '@/components/Header'

const DRUG_CLASSES = [
  // Cardiovascular
  { name: 'Beta-bloqueadores',           tag: 'Cardiovascular', color: '#9f1239', bg: '#fff1f2' },
  { name: 'IECA / ARA-II',              tag: 'Cardiovascular', color: '#9f1239', bg: '#fff1f2' },
  { name: 'Estatinas',                   tag: 'Cardiovascular', color: '#9f1239', bg: '#fff1f2' },
  { name: 'Anticoagulantes',             tag: 'Cardiovascular', color: '#9f1239', bg: '#fff1f2' },
  { name: 'Antiarrítmicos',              tag: 'Cardiovascular', color: '#9f1239', bg: '#fff1f2' },
  // SNC
  { name: 'Benzodiazepinas',             tag: 'SNC', color: '#7e22ce', bg: '#fdf4ff' },
  { name: 'ISRS / IRSN',                tag: 'SNC', color: '#7e22ce', bg: '#fdf4ff' },
  { name: 'Antipsicóticos',              tag: 'SNC', color: '#7e22ce', bg: '#fdf4ff' },
  { name: 'Antiepilépticos',             tag: 'SNC', color: '#7e22ce', bg: '#fdf4ff' },
  { name: 'Anestésicos gerais',          tag: 'SNC', color: '#7e22ce', bg: '#fdf4ff' },
  // Anti-infecciosos
  { name: 'Antibióticos Beta-lactâmicos',tag: 'Anti-infecciosos', color: '#065f46', bg: '#ecfdf5' },
  { name: 'Fluoroquinolonas',            tag: 'Anti-infecciosos', color: '#065f46', bg: '#ecfdf5' },
  { name: 'Macrólidos',                  tag: 'Anti-infecciosos', color: '#065f46', bg: '#ecfdf5' },
  { name: 'Antifúngicos',                tag: 'Anti-infecciosos', color: '#065f46', bg: '#ecfdf5' },
  { name: 'Antivirais',                  tag: 'Anti-infecciosos', color: '#065f46', bg: '#ecfdf5' },
  // Metabolismo
  { name: 'Anti-inflamatórios AINE',     tag: 'Metabolismo', color: '#92400e', bg: '#fffbeb' },
  { name: 'Opióides',                    tag: 'Metabolismo', color: '#92400e', bg: '#fffbeb' },
  { name: 'Antidiabéticos orais',        tag: 'Metabolismo', color: '#92400e', bg: '#fffbeb' },
  { name: 'Inibidores da Bomba de Protões', tag: 'Metabolismo', color: '#92400e', bg: '#fffbeb' },
  { name: 'Corticosteróides',            tag: 'Metabolismo', color: '#92400e', bg: '#fffbeb' },
  // Outros
  { name: 'Diuréticos',                  tag: 'Renal', color: '#1e40af', bg: '#eff6ff' },
  { name: 'Broncodilatadores',           tag: 'Respiratório', color: '#0369a1', bg: '#f0f9ff' },
  { name: 'Imunossupressores',           tag: 'Imunologia', color: '#be185d', bg: '#fdf2f8' },
  { name: 'Hormonas tiróideias',         tag: 'Endócrino', color: '#b45309', bg: '#fefce8' },
]

type Mode = 'home' | 'flashcards' | 'quiz'
type FlashCard = { front: string; back: string }
type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string }

async function generateFlashcards(drugClass: string): Promise<FlashCard[]> {
  const res = await fetch('/api/study/flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugClass }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data.flashcards
}

async function generateQuiz(drugClass: string): Promise<QuizQuestion[]> {
  const res = await fetch('/api/study/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugClass }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data.questions
}

function FlashcardsMode({ drugClass, cards, onBack }: { drugClass: string; cards: FlashCard[]; onBack: () => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())

  if (index >= cards.length) {
    const pct = Math.round((known.size / cards.length) * 100)
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 8 }}>Sessão concluída</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: pct >= 80 ? 'var(--green)' : pct >= 50 ? '#d69e2e' : '#c53030', marginBottom: 8 }}>{pct}%</div>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 28 }}>{known.size} de {cards.length} cartões conhecidos</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setIndex(0); setFlipped(false); setKnown(new Set()) }}
            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>Escolher outra classe</button>
        </div>
      </div>
    )
  }

  const card = cards[index]
  const progress = Math.round((index / cards.length) * 100)

  const next = (isKnown: boolean) => {
    if (isKnown) setKnown(prev => new Set([...prev, index]))
    setFlipped(false)
    setTimeout(() => setIndex(prev => prev + 1), 100)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{drugClass} · {index + 1}/{cards.length}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)' }}>{known.size} conhecidos</div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      <div onClick={() => setFlipped(!flipped)}
        style={{ background: 'white', border: `2px solid ${flipped ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, padding: '40px 24px', minHeight: 220, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginBottom: 20, position: 'relative', transition: 'border-color 0.2s' }}>
        <div style={{ position: 'absolute', top: 14, right: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: flipped ? 'var(--green-2)' : 'var(--ink-4)', letterSpacing: '0.1em' }}>
          {flipped ? 'RESPOSTA ✓' : 'PERGUNTA — toca para revelar'}
        </div>
        {!flipped
          ? <p style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', lineHeight: 1.5, maxWidth: 500, margin: 0 }}>{card.front}</p>
          : <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, maxWidth: 520, margin: 0 }}>{card.back}</p>
        }
      </div>

      {flipped ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => next(false)}
            style={{ flex: 1, background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '12px 8px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#742a2a' }}>
            ✗ Não sei
          </button>
          <button onClick={() => next(true)}
            style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 4, padding: '12px 8px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'white' }}>
            ✓ Sei
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: 0 }}>Toca no cartão para ver a resposta</p>
        </div>
      )}
    </div>
  )
}

function QuizMode({ drugClass, questions, onBack }: { drugClass: string; questions: QuizQuestion[]; onBack: () => void }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📖'}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 8 }}>Quiz concluído</div>
        <div style={{ fontSize: 52, fontWeight: 700, color: pct >= 70 ? 'var(--green)' : pct >= 50 ? '#d69e2e' : '#c53030', margin: '8px 0 16px' }}>{pct}%</div>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 28 }}>{score} correctas em {questions.length} perguntas</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setIndex(0); setSelected(null); setScore(0); setShowExplanation(false) }}
            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>Escolher outra classe</button>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const answer = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    setShowExplanation(true)
    if (i === q.correct) setScore(p => p + 1)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{drugClass} · {index + 1}/{questions.length}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)' }}>{score} correctas</div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(index / questions.length) * 100}%`, background: 'var(--green)', borderRadius: 2 }} />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '22px 20px 18px', marginBottom: 14 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 20px' }}>{q.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            let bg = 'var(--bg-2)', border = 'var(--border)', color = 'var(--ink-2)'
            if (selected !== null) {
              if (i === q.correct) { bg = '#f0fff4'; border = '#9ae6b4'; color = '#276749' }
              else if (i === selected && selected !== q.correct) { bg = '#fff5f5'; border = '#feb2b2'; color = '#742a2a' }
              else { bg = 'white'; color = 'var(--ink-4)' }
            }
            return (
              <button key={i} onClick={() => answer(i)}
                style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '11px 14px', fontSize: 14, color, cursor: selected === null ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'var(--font-sans)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 18, flexShrink: 0, marginTop: 1 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {showExplanation && (
        <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderLeft: '4px solid #276749', borderRadius: 4, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#276749', letterSpacing: '0.1em', marginBottom: 6 }}>EXPLICAÇÃO</div>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{q.explanation}</p>
        </div>
      )}

      {selected !== null && (
        <button onClick={() => { setSelected(null); setShowExplanation(false); setIndex(p => p + 1) }}
          style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {index < questions.length - 1 ? 'Próxima →' : 'Ver resultado'}
        </button>
      )}
    </div>
  )
}

// Group by tag for display
const TAGS = [...new Set(DRUG_CLASSES.map(c => c.tag))]

export default function StudyPage() {
  const [mode, setMode] = useState<Mode>('home')
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flashcards, setFlashcards] = useState<FlashCard[]>([])
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [filter, setFilter] = useState<string | null>(null)

  const startFlashcards = async (dc: string) => {
    setLoading(true); setError(''); setSelectedClass(dc)
    try { setFlashcards(await generateFlashcards(dc)); setMode('flashcards') }
    catch { setError('Erro ao gerar flashcards. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const startQuiz = async (dc: string) => {
    setLoading(true); setError(''); setSelectedClass(dc)
    try { setQuiz(await generateQuiz(dc)); setMode('quiz') }
    catch { setError('Erro ao gerar quiz. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const filtered = filter ? DRUG_CLASSES.filter(c => c.tag === filter) : DRUG_CLASSES

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {mode !== 'home' && (
          <button onClick={() => { setMode('home'); setError('') }}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 24, padding: 0 }}>
            ← Voltar às classes
          </button>
        )}

        {error && (
          <div style={{ background: 'white', border: '1px solid #feb2b2', borderLeft: '4px solid #c53030', borderRadius: 4, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#742a2a' }}>{error}</div>
        )}

        {loading && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '48px', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTop: '3px solid var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', letterSpacing: '0.15em', marginBottom: 8 }}>A GERAR CONTEÚDO</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 0 }}>A criar conteúdo pedagógico para {selectedClass}...</p>
          </div>
        )}

        {!loading && mode === 'home' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta 07</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Plataforma de Estudo</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {DRUG_CLASSES.length} classes farmacológicas · Flashcards e quizzes gerados por IA
              </p>

              {/* Tag filter */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => setFilter(null)}
                  style={{ background: !filter ? 'var(--green)' : 'white', color: !filter ? 'white' : 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: !filter ? 600 : 400 }}>
                  Todas
                </button>
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => setFilter(filter === tag ? null : tag)}
                    style={{ background: filter === tag ? 'var(--green)' : 'white', color: filter === tag ? 'white' : 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: filter === tag ? 600 : 400 }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-grid-3">
              {filtered.map(dc => (
                <div key={dc.name} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.4, flex: 1 }}>{dc.name}</div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: dc.bg, color: dc.color, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>{dc.tag}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button onClick={() => startFlashcards(dc.name)}
                      style={{ flex: 1, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 3, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      Flashcards
                    </button>
                    <button onClick={() => startQuiz(dc.name)}
                      style={{ flex: 1, background: 'var(--bg-2)', color: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && (mode === 'flashcards' || mode === 'quiz') && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {mode === 'flashcards' && flashcards.length > 0 && (
              <FlashcardsMode drugClass={selectedClass} cards={flashcards} onBack={() => setMode('home')} />
            )}
            {mode === 'quiz' && quiz.length > 0 && (
              <QuizMode drugClass={selectedClass} questions={quiz} onBack={() => setMode('home')} />
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}