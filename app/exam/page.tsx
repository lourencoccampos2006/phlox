'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const EXAM_CONFIGS = [
  { id: 'fc10', label: '10 perguntas — Aquecimento', questions: 10, time: 600,  difficulty: 'Misto', desc: '10 min' },
  { id: 'fc20', label: '20 perguntas — Treino',      questions: 20, time: 1200, difficulty: 'Misto', desc: '20 min' },
  { id: 'fc40', label: '40 perguntas — Exame real',  questions: 40, time: 2400, difficulty: 'Difícil', desc: '40 min' },
  { id: 'weak', label: 'Pontos fracos',              questions: 15, time: 900,  difficulty: 'Personalizado', desc: '15 min' },
]

const ALL_DOMAINS = [
  { id: 'farmacologia',       label: 'Farmacologia Clínica', icon: '💊', color: '#0d6e42',
    topics: ['Beta-bloqueadores','IECA / ARA-II','Estatinas','Anticoagulantes','Antidiabéticos orais','Antibióticos Beta-lactâmicos','Opióides','Benzodiazepinas','ISRS / IRSN'] },
  { id: 'medicina_interna',   label: 'Medicina Interna',     icon: '🫀', color: '#dc2626',
    topics: ['Insuficiência Cardíaca','Fibrilhação Auricular','DM Tipo 2','Hipertensão','DPOC','Pneumonia'] },
  { id: 'emergencia',         label: 'Emergência',           icon: '🚨', color: '#b45309',
    topics: ['Paragem Cardiorrespiratória','Choque Séptico','AVC Isquémico','Choque Anafilático'] },
  { id: 'cirurgia',           label: 'Cirurgia',             icon: '🔪', color: '#1d4ed8',
    topics: ['Apendicite Aguda','Oclusão Intestinal','Peri-operatório'] },
  { id: 'pediatria',          label: 'Pediatria',            icon: '👶', color: '#7c3aed',
    topics: ['Febre Pediátrica','Asma Pediátrica','Antibioterapia Pediátrica'] },
]
const ALL_CLASSES = ALL_DOMAINS.flatMap(d => d.topics)

function UpgradeGate() {
  return (
    <div style={{ background: 'white', border: '2px solid #7c3aed', borderRadius: 8, padding: '48px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Modo Exame</h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 12, maxWidth: 380, margin: '0 auto 12px' }}>
        Simulação real de exame de Farmacologia Clínica. Timer, banco de questões cumulativo, análise de pontos fracos por classe.
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
        Funcionalidade exclusiva do plano Student.
      </p>
      <Link href="/pricing" style={{ background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
        Student — 3,99€/mês →
      </Link>
    </div>
  )
}

type ExamState = 'config' | 'running' | 'done'
type Question = { question: string; options: string[]; correct: number; explanation: string; class: string }

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ExamPage() {
  const { user } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const [examState, setExamState] = useState<ExamState>('config')
  const [selectedDomainId, setSelectedDomainId] = useState<string|null>(null)
  const [config, setConfig] = useState(EXAM_CONFIGS[1])
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)

  // Timer
  useEffect(() => {
    if (examState !== 'running' || timeLeft <= 0) return
    const t = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { setExamState('done'); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [examState, timeLeft])

  const startExam = async () => {
    const classes = selectedClasses.length > 0 ? selectedClasses : ALL_CLASSES.slice(0, 6)
    setLoading(true); setError('')
    try {
      // Generate questions from multiple classes in parallel
      const classesToUse = classes.slice(0, Math.min(classes.length, config.questions))
      const qPerClass = Math.ceil(config.questions / classesToUse.length)

      const responses = await Promise.allSettled(
        classesToUse.map(cls =>
          fetch('/api/study/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drugClass: cls }),
          }).then(r => r.json()).then(d => (d.questions || []).slice(0, qPerClass).map((q: any) => ({ ...q, class: cls })))
        )
      )

      let allQ: Question[] = []
      for (const r of responses) {
        if (r.status === 'fulfilled') allQ = [...allQ, ...r.value]
      }

      // Shuffle and take required count
      allQ = allQ.sort(() => Math.random() - 0.5).slice(0, config.questions)

      if (allQ.length === 0) throw new Error('Não foi possível gerar perguntas.')

      setQuestions(allQ)
      setAnswers(new Array(allQ.length).fill(-1))
      setCurrent(0)
      setTimeLeft(config.time)
      setShowExplanation(false)
      setExamState('running')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const answer = (idx: number) => {
    if (answers[current] !== -1) return
    const newAnswers = [...answers]
    newAnswers[current] = idx
    setAnswers(newAnswers)
    setShowExplanation(true)
  }

  const next = () => {
    setShowExplanation(false)
    if (current >= questions.length - 1) {
      setExamState('done')
    } else {
      setCurrent(p => p + 1)
    }
  }

  // Results analysis
  const score = answers.filter((a, i) => a === questions[i]?.correct).length
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  const classResults = questions.reduce((acc, q, i) => {
    if (!acc[q.class]) acc[q.class] = { correct: 0, total: 0 }
    acc[q.class].total++
    if (answers[i] === q.correct) acc[q.class].correct++
    return acc
  }, {} as Record<string, { correct: number; total: number }>)

  const weakClasses = Object.entries(classResults)
    .filter(([, v]) => v.total > 0 && (v.correct / v.total) < 0.6)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))

  if (!isStudent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div className="page-container page-body">
          <UpgradeGate />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* CONFIG */}
        {examState === 'config' && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 20, padding: '3px 10px', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', fontWeight: 700 }}>STUDENT</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Modo Exame</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>Simulação real com timer. Escolhe as classes e o nível de dificuldade.</p>
            </div>

            {/* Exam type */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Tipo de exame</div>
              <div className="card-grid-2" style={{ gap: 8 }}>
                {EXAM_CONFIGS.map(cfg => (
                  <button key={cfg.id} onClick={() => setConfig(cfg)}
                    style={{ background: config.id === cfg.id ? 'var(--green-light)' : 'white', border: `2px solid ${config.id === cfg.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 6, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: config.id === cfg.id ? 'var(--green)' : 'var(--ink)', marginBottom: 4 }}>{cfg.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{cfg.desc} · {cfg.difficulty}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Class filter */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Classes farmacológicas</div>
                <button onClick={() => setSelectedClasses(selectedClasses.length === ALL_CLASSES.length ? [] : [...ALL_CLASSES])}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--green-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  {selectedClasses.length === ALL_CLASSES.length ? 'Limpar' : 'Seleccionar todas'}
                </button>
              </div>
              <div className="card-grid-3" style={{ gap: 6 }}>
                {ALL_CLASSES.map(cls => (
                  <button key={cls} onClick={() => setSelectedClasses(p => p.includes(cls) ? p.filter(c => c !== cls) : [...p, cls])}
                    style={{ background: selectedClasses.includes(cls) ? 'var(--green)' : 'white', border: `1px solid ${selectedClasses.includes(cls) ? 'var(--green)' : 'var(--border)'}`, borderRadius: 4, padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: selectedClasses.includes(cls) ? 'white' : 'var(--ink-2)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                    {cls}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                {selectedClasses.length === 0 ? 'Nenhuma seleccionada — usará mix aleatório' : `${selectedClasses.length} classes seleccionadas`}
              </p>
            </div>

            {error && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#742a2a' }}>{error}</div>}

            <button onClick={startExam} disabled={loading}
              style={{ width: '100%', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 6, padding: '14px', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              {loading ? 'A preparar exame...' : `Iniciar exame — ${config.questions} perguntas (${config.desc})`}
            </button>
          </div>
        )}

        {/* RUNNING */}
        {examState === 'running' && questions.length > 0 && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {/* Header bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
                {current + 1} / {questions.length}
              </div>
              <div style={{ display: 'flex', gap: 8, flex: 1, margin: '0 16px', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((current) / questions.length) * 100}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: timeLeft < 120 ? '#c53030' : 'var(--ink)', minWidth: 48, textAlign: 'right' }}>
                ⏱ {formatTime(timeLeft)}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '24px 20px', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{questions[current].class}</div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 20px' }}>
                {questions[current].question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questions[current].options.map((opt, i) => {
                  const answered = answers[current] !== -1
                  const isCorrect = i === questions[current].correct
                  const isSelected = answers[current] === i
                  let bg = 'var(--bg-2)', border = 'var(--border)', color = 'var(--ink-2)'
                  if (answered) {
                    if (isCorrect) { bg = '#f0fff4'; border = '#9ae6b4'; color = '#276749' }
                    else if (isSelected) { bg = '#fff5f5'; border = '#feb2b2'; color = '#742a2a' }
                    else { bg = 'white'; color = 'var(--ink-4)' }
                  }
                  return (
                    <button key={i} onClick={() => answer(i)}
                      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '12px 14px', fontSize: 14, color, cursor: !answered ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'var(--font-sans)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{questions[current].explanation}</p>
              </div>
            )}

            {answers[current] !== -1 && (
              <button onClick={next}
                style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {current < questions.length - 1 ? 'Próxima →' : 'Ver resultados'}
              </button>
            )}
          </div>
        )}

        {/* DONE */}
        {examState === 'done' && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: pct >= 70 ? 'var(--green)' : pct >= 50 ? '#dd6b20' : '#c53030', padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 8 }}>RESULTADO FINAL</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 56, color: 'white', fontWeight: 700, lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
                  {score} correctas em {questions.length} perguntas
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {pct >= 75 ? '✓ Preparado para o exame' : pct >= 55 ? '⚠ A melhorar' : '✗ Continua a estudar'}
                </div>
              </div>

              {/* Results by class */}
              <div style={{ padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Resultado por classe</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {Object.entries(classResults).map(([cls, { correct, total }]) => {
                    const p = Math.round((correct / total) * 100)
                    const col = p >= 70 ? '#276749' : p >= 50 ? '#dd6b20' : '#c53030'
                    return (
                      <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p}%`, background: col, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: col, minWidth: 36, textAlign: 'right' }}>{p}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {weakClasses.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.1em', marginBottom: 6 }}>PONTOS FRACOS — ESTUDAR</div>
                    {weakClasses.slice(0, 3).map(([cls]) => (
                      <div key={cls} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>→ {cls}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => { setExamState('config'); setQuestions([]); setAnswers([]) }}
                    style={{ flex: 1, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 140 }}>
                    Novo exame
                  </button>
                  {weakClasses.length > 0 && (
                    <button onClick={() => { setSelectedClasses(weakClasses.slice(0,3).map(([c]) => c)); setConfig(EXAM_CONFIGS[0]); setExamState('config'); setQuestions([]) }}
                      style={{ flex: 1, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 140 }}>
                      Treinar pontos fracos
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}