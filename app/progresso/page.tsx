'use client'

// ─── NOVO: app/progresso/page.tsx ───
// Área de progresso do estudante — XP, streak, performance por classe, pontos fracos.

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface StudyStats {
  xp_total: number
  streak_days: number
  flashcards_reviewed: number
  quizzes_completed: number
  cases_solved: number
  shifts_completed: number
  weak_topics: { topic: string; score: number; last_seen: string }[]
  class_performance: { class: string; correct: number; total: number }[]
  activity: { date: string; count: number }[]
}

const CLASS_COLORS: Record<string, string> = {
  'Antibióticos': '#0d6e42',
  'Antihipertensores': '#1d4ed8',
  'Anticoagulantes': '#dc2626',
  'Antidiabéticos': '#b45309',
  'Analgésicos': '#7c3aed',
  'Cardiovascular': '#0891b2',
  'Sistema Nervoso Central': '#6d28d9',
  'Respiratório': '#0f766e',
  'Gastrointestinal': '#c2410c',
  'Endocrinologia': '#b45309',
}

const BADGES = [
  { id: 'first_flash', label: 'Primeiro Flashcard', icon: '⚡', xp: 10, desc: 'Reviste o primeiro flashcard' },
  { id: 'streak_7', label: 'Semana Perfeita', icon: '🔥', xp: 50, desc: '7 dias seguidos de estudo' },
  { id: 'cases_10', label: 'Clínico Jr.', icon: '🩺', xp: 100, desc: 'Resolveste 10 casos clínicos' },
  { id: 'shifts_5', label: 'Residente', icon: '🏥', xp: 75, desc: 'Completaste 5 turnos virtuais' },
  { id: 'quizzes_50', label: 'Scholar', icon: '📚', xp: 200, desc: '50 quizzes completados' },
  { id: 'perfect_case', label: 'Caso Perfeito', icon: '⭐', xp: 150, desc: 'Caso clínico sem erros' },
]

function ProgressBar({ value, max, color = 'var(--green)' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function ActivityHeatmap({ activity }: { activity: { date: string; count: number }[] }) {
  const actMap = new Map(activity.map(a => [a.date, a.count]))
  const today = new Date()
  const days: { date: string; count: number }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({ date: key, count: actMap.get(key) || 0 })
  }

  const maxCount = Math.max(...days.map(d => d.count), 1)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
        {days.map(({ date, count }) => {
          const intensity = count === 0 ? 0 : Math.ceil((count / maxCount) * 4)
          const colors = ['var(--bg-3)', '#d1fae5', '#86efac', '#22c55e', '#15803d']
          return (
            <div key={date} title={`${date}: ${count} actividades`}
              style={{ aspectRatio: '1', borderRadius: 2, background: colors[intensity], cursor: 'default', transition: 'transform 0.1s' }}
              className="heat-cell" />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
        <span>12 semanas atrás</span>
        <span>Hoje</span>
      </div>
    </div>
  )
}

export default function ProgressoPage() {
  const { user, supabase } = useAuth()
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  useEffect(() => {
    if (!user) return
    // ─── Carregar dados reais do Supabase ───────────────────────────────────
    Promise.all([
      supabase.from('study_sessions').select('*').eq('user_id', user.id),
      supabase.from('quiz_results').select('*').eq('user_id', user.id),
    ]).then(([{ data: sessions }, { data: quizzes }]) => {
      const sess = sessions || []
      const quiz = quizzes || []

      // Calcular streak
      const dates = [...new Set(sess.map((s: any) => s.date?.split('T')[0]))].sort().reverse()
      let streak = 0
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
        if (dates[i] === d.toISOString().split('T')[0]) streak++
        else break
      }

      // Performance por classe dos quizzes
      const classMap: Record<string, { correct: number; total: number }> = {}
      quiz.forEach((q: any) => {
        if (!q.drug_class) return
        if (!classMap[q.drug_class]) classMap[q.drug_class] = { correct: 0, total: 0 }
        classMap[q.drug_class].total++
        if (q.correct) classMap[q.drug_class].correct++
      })

      // Actividade por dia
      const actMap: Record<string, number> = {}
      sess.forEach((s: any) => {
        const d = s.date?.split('T')[0]; if (d) actMap[d] = (actMap[d] || 0) + 1
      })

      setStats({
        xp_total: sess.reduce((a: number, s: any) => a + (s.xp_earned || 10), 0),
        streak_days: streak,
        flashcards_reviewed: sess.filter((s: any) => s.type === 'flashcard').length,
        quizzes_completed: quiz.length,
        cases_solved: sess.filter((s: any) => s.type === 'case').length,
        shifts_completed: sess.filter((s: any) => s.type === 'shift').length,
        weak_topics: Object.entries(classMap)
          .filter(([, v]) => v.total > 0 && (v.correct / v.total) < 0.65)
          .sort((a, b) => (a[1].correct/a[1].total) - (b[1].correct/b[1].total))
          .slice(0, 3)
          .map(([topic, v]) => ({ topic, score: Math.round((v.correct/v.total)*100), last_seen: '—' })),
        class_performance: Object.entries(classMap)
          .filter(([, v]) => v.total >= 3)
          .map(([cls, v]) => ({ class: cls, correct: v.correct, total: v.total })),
        activity: Array.from({ length: 84 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (83 - i))
          const key = d.toISOString().split('T')[0]
          return { date: key, count: actMap[key] || 0 }
        }),
      })
    }).catch(() => {
      // Se as tabelas não existem ainda, mostra estado vazio
      setStats({ xp_total:0, streak_days:0, flashcards_reviewed:0, quizzes_completed:0, cases_solved:0, shifts_completed:0, weak_topics:[], class_performance:[], activity:[] })
    }).finally(() => setLoading(false))
  }, [user, supabase])

  const xpLevel = stats ? Math.floor(stats.xp_total / 500) + 1 : 1
  const xpInLevel = stats ? stats.xp_total % 500 : 0

  if (!isStudent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Header />
        <div className="page-container page-body">
          <div style={{ maxWidth: 480, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Área de Progresso</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
              Acompanha o teu progresso de estudo — XP, streak, performance por classe e pontos fracos. Disponível no plano Student.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Ver plano Student →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#7c3aed', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: '#7c3aed', borderRadius: 1 }} />
            Progresso de Estudo
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
              {user?.name?.split(' ')[0]}, aqui está o teu progresso
            </h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/study" style={{ padding: '9px 16px', background: '#7c3aed', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                Estudar agora →
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />)}
          </div>
        ) : stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stats rápidas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
              {[
                { label: 'XP Total', value: stats.xp_total.toLocaleString(), icon: '⚡', color: '#7c3aed', bg: '#faf5ff' },
                { label: 'Streak', value: `${stats.streak_days} dias`, icon: '🔥', color: '#b45309', bg: '#fffbeb' },
                { label: 'Flashcards', value: stats.flashcards_reviewed, icon: '🃏', color: '#0d6e42', bg: '#f0fdf5' },
                { label: 'Casos resolvidos', value: stats.cases_solved, icon: '🩺', color: '#1d4ed8', bg: '#eff6ff' },
                { label: 'Quizzes', value: stats.quizzes_completed, icon: '✏️', color: '#0891b2', bg: '#ecfeff' },
                { label: 'Turnos virtuais', value: stats.shifts_completed, icon: '🏥', color: '#6d28d9', bg: '#f5f3ff' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}25`, borderRadius: 10, padding: '16px 14px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.color, fontWeight: 400, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Nível + XP */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700 }}>
                    {xpLevel}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Nível {xpLevel}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{xpInLevel} / 500 XP para nível {xpLevel + 1}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#7c3aed', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{stats.xp_total} XP total</div>
              </div>
              <ProgressBar value={xpInLevel} max={500} color="#7c3aed" />
            </div>

            {/* Actividade */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                Actividade — últimas 12 semanas
              </div>
              <ActivityHeatmap activity={stats.activity} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
              {/* Performance por classe */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Performance por classe
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {stats.class_performance.sort((a, b) => (a.correct / a.total) - (b.correct / b.total)).map(cls => {
                    const pct = Math.round((cls.correct / cls.total) * 100)
                    const color = CLASS_COLORS[cls.class] || '#7c3aed'
                    return (
                      <div key={cls.class}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{cls.class}</span>
                          <span style={{ fontSize: 12, color: pct < 60 ? '#dc2626' : pct < 80 ? '#d97706' : '#0d6e42', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{pct}%</span>
                        </div>
                        <ProgressBar value={cls.correct} max={cls.total} color={pct < 60 ? '#dc2626' : pct < 80 ? '#d97706' : color} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Pontos fracos */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Pontos fracos — rever agora
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.weak_topics.map((topic, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, flex: 1, marginRight: 8 }}>{topic.topic}</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>{topic.score}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <ProgressBar value={topic.score} max={100} color="#dc2626" />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>Visto há {topic.last_seen}</div>
                    </div>
                  ))}
                </div>
                <Link href="/study" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: '10px', background: '#dc2626', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                  Rever pontos fracos →
                </Link>
              </div>
            </div>

            {/* Badges */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                Conquistas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {BADGES.map((badge, i) => {
                  // Simplified unlock logic based on stats
                  const unlocked = (
                    (badge.id === 'first_flash' && stats.flashcards_reviewed > 0) ||
                    (badge.id === 'streak_7' && stats.streak_days >= 7) ||
                    (badge.id === 'cases_10' && stats.cases_solved >= 10) ||
                    (badge.id === 'shifts_5' && stats.shifts_completed >= 5) ||
                    (badge.id === 'quizzes_50' && stats.quizzes_completed >= 50)
                  )
                  return (
                    <div key={badge.id} style={{ padding: '14px', background: unlocked ? '#faf5ff' : 'var(--bg-2)', border: `1px solid ${unlocked ? '#e9d5ff' : 'var(--border)'}`, borderRadius: 8, textAlign: 'center', opacity: unlocked ? 1 : 0.5 }}>
                      <div style={{ fontSize: 24, marginBottom: 6, filter: unlocked ? 'none' : 'grayscale(1)' }}>{badge.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: unlocked ? '#7c3aed' : 'var(--ink-4)', marginBottom: 3, lineHeight: 1.3 }}>{badge.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>+{badge.xp} XP</div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>
      <style>{`.heat-cell:hover { transform: scale(1.3); }`}</style>
    </div>
  )
}