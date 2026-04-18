'use client'

import { useState } from 'react'
import Header from '@/components/Header'

const DRUG_CLASSES = [
  'Beta-bloqueadores', 'IECA', 'Estatinas', 'Benzodiazepinas',
  'ISRS', 'Opióides', 'Anticoagulantes', 'Antibióticos Beta-lactâmicos',
  'Anti-inflamatórios AINE', 'Inibidores da Bomba de Protões',
  'Antidiabéticos orais', 'Corticosteróides',
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
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>Sessão concluída</div>
        <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 24 }}>{known.size} de {cards.length} cartões marcados como conhecidos</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setIndex(0); setFlipped(false); setKnown(new Set()) }}
            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>Voltar</button>
        </div>
      </div>
    )
  }

  const card = cards[index]
  const progress = Math.round((index / cards.length) * 100)

  const next = (isKnown: boolean) => {
    if (isKnown) setKnown(prev => new Set([...prev, index]))
    setFlipped(false)
    setTimeout(() => setIndex(prev => Math.min(prev + 1, cards.length - 1)), 100)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>{drugClass} · {index + 1} / {cards.length}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green-2)' }}>{known.size} conhecidos</div>
      </div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      <div onClick={() => setFlipped(!flipped)}
        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '40px 24px', minHeight: 240, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginBottom: 20, position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
          {flipped ? 'RESPOSTA' : 'PERGUNTA — clica para revelar'}
        </div>
        {!flipped
          ? <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1.5, maxWidth: 500, margin: 0 }}>{card.front}</p>
          : <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8, maxWidth: 560, margin: 0 }}>{card.back}</p>
        }
      </div>

      {flipped && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => next(false)}
            style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '12px 8px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)' }}>
            Não sei — repetir depois
          </button>
          <button onClick={() => next(true)}
            style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 4, padding: '12px 8px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'white' }}>
            Sei — próximo →
          </button>
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
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 8 }}>Quiz concluído</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: pct >= 70 ? 'var(--green)' : pct >= 50 ? '#dd6b20' : '#c53030', margin: '16px 0' }}>{pct}%</div>
        <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 24 }}>{score} respostas correctas em {questions.length} perguntas</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setIndex(0); setSelected(null); setScore(0); setShowExplanation(false) }}
            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>Voltar</button>
        </div>
      </div>
    )
  }

  const q = questions[index]

  const answer = (optionIdx: number) => {
    if (selected !== null) return
    setSelected(optionIdx)
    setShowExplanation(true)
    if (optionIdx === q.correct) setScore(prev => prev + 1)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>{drugClass} · {index + 1} / {questions.length}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green-2)' }}>{score} correctas</div>
      </div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(index / questions.length) * 100}%`, background: 'var(--green)', borderRadius: 2 }} />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '24px 20px 20px', marginBottom: 16 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 20px' }}>{q.question}</p>
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
                style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '12px 14px', fontSize: 14, color, cursor: selected === null ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'var(--font-sans)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 18, flexShrink: 0, marginTop: 1 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {showExplanation && (
        <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderLeft: '4px solid #276749', borderRadius: 4, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#276749', letterSpacing: '0.1em', marginBottom: 8 }}>EXPLICAÇÃO</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{q.explanation}</p>
        </div>
      )}

      {selected !== null && (
        <button onClick={() => { setSelected(null); setShowExplanation(false); setIndex(prev => prev + 1) }}
          style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {index < questions.length - 1 ? 'Próxima pergunta →' : 'Ver resultados'}
        </button>
      )}
    </div>
  )
}

export default function StudyPage() {
  const [mode, setMode] = useState<Mode>('home')
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flashcards, setFlashcards] = useState<FlashCard[]>([])
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])

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

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">

        {mode !== 'home' && (
          <button onClick={() => { setMode('home'); setError('') }}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 24, padding: 0 }}>
            ← Voltar
          </button>
        )}

        {error && (
          <div style={{ background: 'white', border: '1px solid #feb2b2', borderLeft: '4px solid #c53030', borderRadius: 4, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#742a2a' }}>{error}</div>
        )}

        {loading && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', letterSpacing: '0.15em', marginBottom: 12 }}>A GERAR CONTEÚDO</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)' }}>A criar conteúdo pedagógico para {selectedClass}...</p>
          </div>
        )}

        {!loading && mode === 'home' && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta 04</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Plataforma de Estudo</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>Flashcards e quizzes gerados por IA para estudantes de farmácia, medicina e enfermagem.</p>
            </div>

            <div className="card-grid-3">
              {DRUG_CLASSES.map(dc => (
                <div key={dc} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.4, flex: 1 }}>{dc}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startFlashcards(dc)}
                      style={{ flex: 1, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 3, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      Flashcards
                    </button>
                    <button onClick={() => startQuiz(dc)}
                      style={{ flex: 1, background: 'var(--bg-2)', color: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active modes — constrained width */}
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
    </div>
  )
}