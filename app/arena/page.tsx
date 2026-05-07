'use client'

// ─── PHLOX ARENA — Sistema de Ligas Clínicas ───────────────────────────────
// Não é gamification superficial. É competição de conhecimento clínico real.
// Sistema de ligas (Bronze → Diamante), duelos assíncronos por especialidade,
// XP, streaks, e casos gerados por AI de todas as áreas da saúde.
// O que o League of Legends fez para gaming, o Arena faz para medicina.

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: string; title: string; domain: string; difficulty: 'facil'|'medio'|'dificil'|'especialista'
  case_data: { presentation: string; question: string; options: { label: string; is_correct: boolean; explanation: string }[]; learning_point: string; reference: string }
  attempts_count?: number; correct_rate?: number
}
interface ArenaAttempt {
  challenge_id: string; score: number; time_seconds: number; domain?: string
}
interface LeaguePlayer { user_id: string; display_name: string; total_score: number; rank: number; league: string; wins: number; losses: number }
interface MyProfile {
  total_score: number; total_attempts: number; correct: number; streak: number
  league: string; league_points: number; rank_global: number
  domains: Record<string, { correct: number; total: number }>
  recent: ArenaAttempt[]
}

// ─── League system ────────────────────────────────────────────────────────────

const LEAGUES: { id: string; label: string; icon: string; color: string; bg: string; border: string; min_score: number; description: string }[] = [
  { id:'bronze',    label:'Bronze',    icon:'🥉', color:'#92400e', bg:'#fef3c7', border:'#fde68a', min_score:0,    description:'Iniciando a jornada clínica' },
  { id:'silver',    label:'Prata',     icon:'🥈', color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db', min_score:200,  description:'Base sólida de conhecimento' },
  { id:'gold',      label:'Ouro',      icon:'🥇', color:'#d97706', bg:'#fffbeb', border:'#fde68a', min_score:500,  description:'Raciocínio clínico consistente' },
  { id:'platinum',  label:'Platina',   icon:'💎', color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', min_score:1000, description:'Diagnóstico diferencial avançado' },
  { id:'diamond',   label:'Diamante',  icon:'🔷', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff', min_score:2000, description:'Nível de especialista' },
]

function getLeague(score: number) {
  return [...LEAGUES].reverse().find(l => score >= l.min_score) || LEAGUES[0]
}
function getNextLeague(score: number) {
  return LEAGUES.find(l => l.min_score > score) || null
}

const DIFF = {
  facil:        { label:'Fácil',        color:'#0d6e42', bg:'#d1fae5', xp:10, time:60 },
  medio:        { label:'Médio',        color:'#d97706', bg:'#fef9c3', xp:20, time:90 },
  dificil:      { label:'Difícil',      color:'#dc2626', bg:'#fee2e2', xp:35, time:120 },
  especialista: { label:'Especialista', color:'#7c3aed', bg:'#faf5ff', xp:50, time:150 },
}

const ALL_DOMAINS = [
  { id:'all',                label:'Todas',          icon:'🏥' },
  { id:'farmacologia',       label:'Farmacologia',   icon:'💊' },
  { id:'medicina_interna',   label:'Med. Interna',   icon:'🫀' },
  { id:'emergencia',         label:'Emergência',     icon:'🚨' },
  { id:'cirurgia',           label:'Cirurgia',       icon:'🔪' },
  { id:'pediatria',          label:'Pediatria',      icon:'👶' },
  { id:'gineco_obstetricia', label:'Gineco-Obs',     icon:'🤰' },
  { id:'enfermagem',         label:'Enfermagem',     icon:'💉' },
  { id:'nutricao',           label:'Nutrição',       icon:'🥗' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeagueCard({ league, score, nextLeague }: { league: ReturnType<typeof getLeague>; score: number; nextLeague: ReturnType<typeof getNextLeague> }) {
  const progress = nextLeague ? Math.round(((score - league.min_score) / (nextLeague.min_score - league.min_score)) * 100) : 100
  return (
    <div style={{ background: league.bg, border: `2px solid ${league.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 40, flexShrink: 0 }}>{league.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: league.color, fontWeight: 400 }}>{league.label}</div>
          <div style={{ fontSize: 12, color: league.color, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{score} XP</div>
        </div>
        <div style={{ fontSize: 12, color: league.color, opacity: 0.7, marginBottom: 8 }}>{league.description}</div>
        {nextLeague && (
          <>
            <div style={{ height: 6, background: `${league.color}20`, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: league.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: league.color, opacity: 0.6, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {nextLeague.min_score - score} XP para {nextLeague.icon} {nextLeague.label}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TimerBar({ totalSeconds, remaining }: { totalSeconds: number; remaining: number }) {
  const pct = (remaining / totalSeconds) * 100
  const color = pct > 50 ? '#0d6e42' : pct > 25 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 1s linear' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color, minWidth: 36 }}>
        {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
      </span>
    </div>
  )
}

function DomainBar({ domain, correct, total }: { domain: string; correct: number; total: number }) {
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0
  const d = ALL_DOMAINS.find(d => d.id === domain)
  const color = rate >= 80 ? '#0d6e42' : rate >= 60 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{d?.icon || '🏥'} {d?.label || domain}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{rate}% ({correct}/{total})</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ─── Challenge card (list view) ───────────────────────────────────────────────

function ChallengeCard({ ch, attempted, onStart }: { ch: Challenge; attempted: boolean; onStart: () => void }) {
  const d = DIFF[ch.difficulty]
  const dom = ALL_DOMAINS.find(x => x.id === ch.domain)
  return (
    <div style={{ background: 'white', border: `1px solid ${attempted ? 'var(--border)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: attempted ? 0.6 : 1, transition: 'all 0.15s' }}
      className="challenge-card">
      <div style={{ textAlign: 'center', flexShrink: 0, width: 48 }}>
        <div style={{ fontSize: 22 }}>{dom?.icon || '🏥'}</div>
        <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{dom?.label || ch.domain}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, lineHeight: 1.3 }}>{ch.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: d.color, background: d.bg, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {d.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>⏱ {d.time}s · +{d.xp} XP</span>
          {ch.attempts_count && ch.attempts_count > 0 && (
            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{ch.attempts_count} tentativas</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {attempted ? (
          <span style={{ fontSize: 11, color: '#0d6e42', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>✓ Feito</span>
        ) : (
          <button onClick={onStart}
            style={{ padding: '9px 18px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
            Jogar →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Active challenge ─────────────────────────────────────────────────────────

function ActiveChallenge({ ch, onComplete }: { ch: Challenge; onComplete: (score: number, time: number) => void }) {
  const totalTime = DIFF[ch.difficulty].time
  const [remaining, setRemaining] = useState(totalTime)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { handleSubmit(null); return 0 }
        return r - 1
      })
      setTimeSpent(t => t + 1)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleSubmit = (idx: number | null) => {
    if (submitted) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const chosen = idx !== null ? idx : selected
    setSelected(chosen)
    setSubmitted(true)
    const correct = chosen !== null && ch.case_data.options[chosen]?.is_correct
    const baseXp = DIFF[ch.difficulty].xp
    const timeBonus = Math.round((remaining / totalTime) * (baseXp * 0.5))
    const finalScore = correct ? baseXp + timeBonus : 0
    setTimeout(() => onComplete(finalScore, timeSpent), 2500)
  }

  const d = DIFF[ch.difficulty]

  return (
    <div style={{ background: 'white', border: `2px solid ${d.color}40`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: d.bg, borderBottom: `1px solid ${d.color}30`, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: d.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{DIFF[ch.difficulty].label}</span>
          <span style={{ fontSize: 10, color: d.color, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>+{d.xp} XP base</span>
        </div>
        {!submitted && <TimerBar totalSeconds={totalTime} remaining={remaining} />}
      </div>

      <div style={{ padding: '20px 18px' }}>
        {/* Case */}
        <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.8, marginBottom: 16, fontFamily: 'var(--font-serif)', fontWeight: 400 }}>{ch.case_data.presentation}</p>

        {/* Question */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8', lineHeight: 1.5 }}>{ch.case_data.question}</div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ch.case_data.options.map((opt, i) => {
            let bg = 'var(--bg-2)', border = 'var(--border-2)', color = 'var(--ink-2)'
            if (submitted) {
              if (opt.is_correct) { bg = '#d1fae5'; border = '#6ee7b7'; color = '#065f46' }
              else if (i === selected && !opt.is_correct) { bg = '#fee2e2'; border = '#fca5a5'; color = '#991b1b' }
              else { bg = 'white'; color = 'var(--ink-5)'; border = 'var(--border)' }
            } else if (i === selected) { bg = '#ede9fe'; border = '#c4b5fd'; color = '#5b21b6' }
            return (
              <button key={i} onClick={() => { if (!submitted) { setSelected(i); handleSubmit(i) } }}
                style={{ padding: '12px 14px', background: bg, border: `1.5px solid ${border}`, borderRadius: 8, cursor: submitted ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, color, fontFamily: 'var(--font-sans)', lineHeight: 1.5, transition: 'all 0.15s' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6, marginRight: 6 }}>{String.fromCharCode(65 + i)}.</span>
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {submitted && selected !== null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '14px 16px', background: ch.case_data.options[selected]?.is_correct ? '#d1fae5' : '#fee2e2', border: `1px solid ${ch.case_data.options[selected]?.is_correct ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ch.case_data.options[selected]?.is_correct ? '#065f46' : '#991b1b', marginBottom: 5 }}>
                {ch.case_data.options[selected]?.is_correct ? `✓ Correcto! +${DIFF[ch.difficulty].xp + Math.round((remaining / totalTime) * (DIFF[ch.difficulty].xp * 0.5))} XP` : '✗ Incorrecta'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{ch.case_data.options[selected]?.explanation}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>💎 Pearl clínico</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{ch.case_data.learning_point}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const { user, supabase } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaguePlayer[]>([])
  const [active, setActive] = useState<Challenge | null>(null)
  const [tab, setTab] = useState<'play'|'league'|'stats'>('play')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filterDomain, setFilterDomain] = useState('all')
  const [filterDiff, setFilterDiff] = useState('all')
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set())

  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [{ data: ch }, { data: lb }, { data: myAttempts }] = await Promise.all([
        supabase.from('arena_challenges').select('*').eq('active', true).order('created_at', { ascending: false }).limit(30),
        supabase.from('arena_attempts').select('user_id, score, time_seconds').order('score', { ascending: false }).limit(200),
        supabase.from('arena_attempts').select('challenge_id, score, time_seconds, arena_challenges(domain)').eq('user_id', user.id),
      ])

      const parsed = (ch || []).map((c: any) => ({ ...c, case_data: typeof c.case_data === 'string' ? JSON.parse(c.case_data) : c.case_data }))
      setChallenges(parsed)
      setAttemptedIds(new Set((myAttempts || []).map((a: any) => a.challenge_id)))

      // Leaderboard with league
      const userMap: Record<string, { score: number; count: number }> = {}
      ;(lb || []).forEach((a: any) => {
        if (!userMap[a.user_id]) userMap[a.user_id] = { score: 0, count: 0 }
        userMap[a.user_id].score += a.score
        userMap[a.user_id].count++
      })
      const sorted = Object.entries(userMap).sort((a, b) => b[1].score - a[1].score)
        .map(([uid, data], i) => ({
          user_id: uid,
          display_name: uid === user.id ? (user.name?.split(' ')[0] || 'Eu') : `Estudante ${uid.slice(0, 4)}`,
          total_score: data.score,
          rank: i + 1,
          league: getLeague(data.score).id,
          wins: data.count,
          losses: 0,
        }))
      setLeaderboard(sorted.slice(0, 50))

      // My profile
      const ma = myAttempts || []
      const totalScore = ma.reduce((a: number, x: any) => a + (x.score || 0), 0)
      const correct = ma.filter((x: any) => x.score > 0).length
      const domainMap: Record<string, { correct: number; total: number }> = {}
      ma.forEach((x: any) => {
        const d = (x.arena_challenges as any)?.domain || 'outro'
        if (!domainMap[d]) domainMap[d] = { correct: 0, total: 0 }
        domainMap[d].total++
        if (x.score > 0) domainMap[d].correct++
      })
      const myRank = sorted.findIndex(e => e.user_id === user.id) + 1
      const league = getLeague(totalScore)
      setMyProfile({
        total_score: totalScore, total_attempts: ma.length,
        correct, streak: 0,
        league: league.id, league_points: totalScore - league.min_score,
        rank_global: myRank || 0, domains: domainMap, recent: ma.slice(0, 5),
      })
    } catch {}
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { loadData() }, [loadData])

  const generateChallenge = async () => {
    if (!user) return
    setGenerating(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const domain = filterDomain === 'all' ? ALL_DOMAINS[Math.floor(Math.random() * (ALL_DOMAINS.length - 1)) + 1].id : filterDomain
      const diff = filterDiff === 'all' ? ['facil','medio','dificil'][Math.floor(Math.random() * 3)] : filterDiff
      const res = await fetch('/api/arena/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ domain, difficulty: diff }),
      })
      const data = await res.json()
      if (data.id) {
        const newCh: Challenge = { ...data, case_data: typeof data.case_data === 'string' ? JSON.parse(data.case_data) : data.case_data }
        setChallenges(prev => [newCh, ...prev])
        setActive(newCh)
      }
    } catch {}
    setGenerating(false)
  }

  const handleComplete = async (score: number, time: number) => {
    if (!active || !user) return
    try {
      await supabase.from('arena_attempts').upsert({
        challenge_id: active.id, user_id: user.id,
        score, time_seconds: time, completed_at: new Date().toISOString(),
      }, { onConflict: 'challenge_id,user_id' })
      setAttemptedIds(prev => new Set([...prev, active.id]))
      await loadData()
    } catch {}
    setActive(null)
  }

  const myLeague = myProfile ? getLeague(myProfile.total_score) : LEAGUES[0]
  const nextLeague = myProfile ? getNextLeague(myProfile.total_score) : LEAGUES[1]

  const filtered = challenges.filter(c => {
    if (filterDomain !== 'all' && c.domain !== filterDomain) return false
    if (filterDiff !== 'all' && c.difficulty !== filterDiff) return false
    return true
  })

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#7c3aed' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? '#7c3aed' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
  })

  if (!isStudent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏆</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Phlox Arena</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
            Sistema de ligas clínicas. Bronze → Diamante. Casos de todas as áreas da saúde. Competes com estudantes do mundo inteiro.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver plano Student →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Arena header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
          {myProfile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 28 }}>{myLeague.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#f8fafc', fontWeight: 400 }}>
                  {user?.name?.split(' ')[0] || 'Estudante'}
                  <span style={{ fontSize: 13, color: myLeague.color, marginLeft: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{myLeague.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-mono)' }}>
                  {myProfile.total_score} XP · #{myProfile.rank_global > 0 ? myProfile.rank_global : '—'} global · {myProfile.correct}/{myProfile.total_attempts} correctas
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={generateChallenge} disabled={generating}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, cursor: generating ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: generating ? 0.7 : 1 }}>
                  {generating ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A gerar...</> : '⚡ Jogar agora'}
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', borderTop: '1px solid #1e293b', overflowX: 'auto' }}>
            {[['play','Casos'], ['league','Liga'], ['stats','As minhas stats']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)}
                style={{ ...tabStyle(id), color: tab === id ? '#a78bfa' : '#475569', borderBottomColor: tab === id ? '#7c3aed' : 'transparent' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Active challenge overlay */}
        {active && (
          <div>
            <button onClick={() => setActive(null)}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Abandonar
            </button>
            <ActiveChallenge ch={active} onComplete={handleComplete} />
          </div>
        )}

        {!active && tab === 'play' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ALL_DOMAINS.map(d => (
                  <button key={d.id} onClick={() => setFilterDomain(d.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: `1.5px solid ${filterDomain === d.id ? '#7c3aed' : 'var(--border)'}`, borderRadius: 20, background: filterDomain === d.id ? '#faf5ff' : 'white', color: filterDomain === d.id ? '#7c3aed' : 'var(--ink-3)', cursor: 'pointer', fontSize: 11, fontWeight: filterDomain === d.id ? 700 : 400, fontFamily: 'var(--font-sans)' }}>
                    <span>{d.icon}</span>{d.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all', 'facil', 'medio', 'dificil', 'especialista'].map(d => (
                  <button key={d} onClick={() => setFilterDiff(d)}
                    style={{ padding: '5px 10px', border: `1.5px solid ${filterDiff === d ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 20, background: filterDiff === d ? 'var(--ink)' : 'white', color: filterDiff === d ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    {d === 'all' ? 'Todas' : DIFF[d as keyof typeof DIFF]?.label || d}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate new */}
            <button onClick={generateChallenge} disabled={generating}
              style={{ width: '100%', padding: '14px', background: generating ? 'var(--bg-3)' : '#7c3aed', color: generating ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, cursor: generating ? 'wait' : 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {generating ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A gerar caso...</> : `⚡ Gerar novo caso${filterDomain !== 'all' ? ` de ${ALL_DOMAINS.find(d => d.id === filterDomain)?.label}` : ''}`}
            </button>

            {/* Challenge list */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 14 }}>Nenhum caso disponível. Clica em "Gerar novo caso".</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(ch => (
                  <ChallengeCard key={ch.id} ch={ch} attempted={attemptedIds.has(ch.id)} onStart={() => setActive(ch)} />
                ))}
              </div>
            )}
          </div>
        )}

        {!active && tab === 'league' && (
          <div>
            {myProfile && (
              <div style={{ marginBottom: 16 }}>
                <LeagueCard league={myLeague} score={myProfile.total_score} nextLeague={nextLeague} />
              </div>
            )}

            {/* League tiers legend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
              {LEAGUES.map(l => (
                <div key={l.id} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 8, padding: '10px 12px', opacity: myProfile && myProfile.total_score >= l.min_score ? 1 : 0.4 }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{l.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: l.color }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: l.color, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{l.min_score}+ XP</div>
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Top 50 — Ranking global
              </div>
              {leaderboard.slice(0, 20).map((p, i) => {
                const l = getLeague(p.total_score)
                const isMe = p.user_id === user?.id
                return (
                  <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < 19 ? '1px solid var(--bg-3)' : 'none', background: isMe ? '#faf5ff' : 'white' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < 3 ? ['#ffd70030','#c0c0c030','#cd7f3230'][i] : 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `#${p.rank}`}
                    </div>
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{l.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? '#7c3aed' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.display_name} {isMe && '(tu)'}
                      </div>
                      <div style={{ fontSize: 10, color: l.color, fontFamily: 'var(--font-mono)' }}>{l.label}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{p.total_score}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>XP</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!active && tab === 'stats' && myProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Overview stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 10 }}>
              {[
                { label: 'XP Total', value: myProfile.total_score, color: '#7c3aed', bg: '#faf5ff', icon: '⚡' },
                { label: 'Correctas', value: `${myProfile.correct}/${myProfile.total_attempts}`, color: '#0d6e42', bg: '#f0fdf5', icon: '✓' },
                { label: 'Taxa', value: myProfile.total_attempts > 0 ? `${Math.round((myProfile.correct/myProfile.total_attempts)*100)}%` : '—', color: '#1d4ed8', bg: '#eff6ff', icon: '📊' },
                { label: 'Rank global', value: myProfile.rank_global > 0 ? `#${myProfile.rank_global}` : '—', color: '#d97706', bg: '#fffbeb', icon: '🏆' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Performance by domain */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Performance por área</div>
              {Object.keys(myProfile.domains).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '20px 0' }}>Ainda sem tentativas suficientes para análise.</div>
              ) : Object.entries(myProfile.domains).sort((a,b) => (a[1].correct/Math.max(1,a[1].total)) - (b[1].correct/Math.max(1,b[1].total))).map(([domain, data]) => (
                <DomainBar key={domain} domain={domain} correct={data.correct} total={data.total} />
              ))}
            </div>

            {/* League progress */}
            <LeagueCard league={myLeague} score={myProfile.total_score} nextLeague={nextLeague} />
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .challenge-card:hover{border-color:var(--border-2)!important;box-shadow:0 4px 12px rgba(0,0,0,0.04)}`}</style>
    </div>
  )
}