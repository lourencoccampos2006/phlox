'use client'

// ─── PHLOX ARENA — Sistema de Ligas Clínicas ─────────────────────────────────
// Bronze → Diamante. Casos gerados por AI. XP real. Leaderboard global.
// Liga icons: SVGs únicos criados para o Phlox — sem emojis, sem letras

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Challenge {
  id: string; title: string; domain: string; difficulty: 'facil'|'medio'|'dificil'|'especialista'
  case_data: CaseData
}
interface CaseData {
  title?: string; presentation: string; question: string
  options: { label: string; is_correct: boolean; explanation: string }[]
  learning_point: string; reference?: string
}
interface LeaderboardEntry {
  user_id: string; display_name: string; total_xp: number
  total_attempts: number; correct_answers: number; league: string
}
interface MyStats {
  total_xp: number; total_attempts: number; correct: number
  streak: number; league: string; rank: number
  by_domain: Record<string, { correct: number; total: number }>
}

// ─── League SVG Icons ─────────────────────────────────────────────────────────
// Criados especificamente para o Phlox — medalhas sem texto, distintas por forma/preenchimento

const LeagueIcon = ({ id, size = 32, color }: { id: string; size?: number; color: string }) => {
  const icons: Record<string, React.ReactNode> = {
    bronze: (
      // Escudo com 3 riscos — iniciante
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 6.5 5.2 11.8 12 13 6.8-1.2 12-6.5 12-13V8L16 3z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
        <line x1="10" y1="13" x2="22" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="10" y1="16.5" x2="22" y2="16.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="10" y1="20" x2="22" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    silver: (
      // Escudo com estrela de 5 pontas
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 6.5 5.2 11.8 12 13 6.8-1.2 12-6.5 12-13V8L16 3z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
        <polygon points="16,9 17.5,14 22.5,14 18.5,17 20,22 16,19 12,22 13.5,17 9.5,14 14.5,14" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="1"/>
      </svg>
    ),
    gold: (
      // Escudo com coroa
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 6.5 5.2 11.8 12 13 6.8-1.2 12-6.5 12-13V8L16 3z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
        <path d="M10 20h12M10 20l1.5-5 4.5 3 4.5-3 1.5 5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="10" cy="15" r="1.2" fill={color}/>
        <circle cx="16" cy="12.5" r="1.2" fill={color}/>
        <circle cx="22" cy="15" r="1.2" fill={color}/>
      </svg>
    ),
    platinum: (
      // Escudo com hexágono (DNA/ciência)
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 6.5 5.2 11.8 12 13 6.8-1.2 12-6.5 12-13V8L16 3z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
        <polygon points="16,9 20,11.5 20,16.5 16,19 12,16.5 12,11.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.4"/>
        <circle cx="16" cy="14" r="2" fill={color}/>
      </svg>
    ),
    diamond: (
      // Escudo com diamante geométrico
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 6.5 5.2 11.8 12 13 6.8-1.2 12-6.5 12-13V8L16 3z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
        <polygon points="16,8 22,14 16,22 10,14" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.4"/>
        <line x1="10" y1="14" x2="22" y2="14" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
        <line x1="13" y1="9.5" x2="19" y2="18.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
        <line x1="19" y1="9.5" x2="13" y2="18.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      </svg>
    ),
  }
  return <>{icons[id] || icons.bronze}</>
}

// Domain icons — minimal SVG paths
const DOMAIN_ICONS: Record<string, string> = {
  all:              'M3 12h18M12 3v18',
  farmacologia:     'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  medicina_interna: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  emergencia:       'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  cirurgia:         'M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14M14 14.5v1M14 19.5v1M14 16.5c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z',
  pediatria:        'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  enfermagem:       'M12 3v18M3 12h18',
  nutricao:         'M12 3a9 9 0 100 18A9 9 0 0012 3zM3.6 9h16.8M3.6 15h16.8',
}

const DomainSVG = ({ id, size = 14 }: { id: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={DOMAIN_ICONS[id] || DOMAIN_ICONS.all} />
  </svg>
)

// ─── League system ────────────────────────────────────────────────────────────
const LEAGUES = [
  { id:'bronze',   label:'Bronze',   color:'#92400e', bg:'#fef3c7', border:'#fde68a', min:0,    desc:'A tua jornada começa aqui' },
  { id:'silver',   label:'Prata',    color:'#4b5563', bg:'#f3f4f6', border:'#d1d5db', min:200,  desc:'Base sólida de conhecimento' },
  { id:'gold',     label:'Ouro',     color:'#b45309', bg:'#fffbeb', border:'#fde68a', min:500,  desc:'Raciocínio clínico consistente' },
  { id:'platinum', label:'Platina',  color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', min:1000, desc:'Diagnóstico diferencial avançado' },
  { id:'diamond',  label:'Diamante', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff', min:2000, desc:'Nível de especialista' },
]
const DIFF = {
  facil:        { label:'Fácil',        color:'#0d6e42', bg:'#d1fae5', xp:10,  time:60  },
  medio:        { label:'Médio',        color:'#d97706', bg:'#fef9c3', xp:20,  time:90  },
  dificil:      { label:'Difícil',      color:'#dc2626', bg:'#fee2e2', xp:35,  time:120 },
  especialista: { label:'Especialista', color:'#7c3aed', bg:'#faf5ff', xp:50,  time:150 },
}
const DOMAINS = [
  { id:'all',                label:'Todas'         },
  { id:'farmacologia',       label:'Farmacologia'  },
  { id:'medicina_interna',   label:'Medicina'      },
  { id:'emergencia',         label:'Emergência'    },
  { id:'cirurgia',           label:'Cirurgia'      },
  { id:'pediatria',          label:'Pediatria'     },
  { id:'enfermagem',         label:'Enfermagem'    },
  { id:'nutricao',           label:'Nutrição'      },
]

function getLeague(xp: number) { return [...LEAGUES].reverse().find(l => xp >= l.min) || LEAGUES[0] }
function getNextLeague(xp: number) { return LEAGUES.find(l => l.min > xp) || null }

// ─── Timer ────────────────────────────────────────────────────────────────────
function TimerBar({ total, remaining }: { total: number; remaining: number }) {
  const pct = (remaining / total) * 100
  const color = pct > 50 ? '#0d6e42' : pct > 25 ? '#d97706' : '#dc2626'
  const m = Math.floor(remaining / 60), s = remaining % 60
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ flex:1, height:8, background:'var(--bg-3)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width 1s linear' }} />
      </div>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:16, fontWeight:700, color, minWidth:44, textAlign:'right' }}>
        {m}:{s.toString().padStart(2,'0')}
      </span>
    </div>
  )
}

// ─── Active challenge ─────────────────────────────────────────────────────────
function ActiveChallenge({ ch, onComplete, onAbandon }: {
  ch: Challenge; onComplete: (xp: number, correct: boolean, time: number) => void; onAbandon: () => void
}) {
  const totalTime = DIFF[ch.difficulty].time
  const [remaining, setRemaining] = useState(totalTime)
  const [selected, setSelected] = useState<number|null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const d = DIFF[ch.difficulty]

  if (!ch.case_data?.options?.length || !ch.case_data?.presentation) {
    return (
      <div style={{ padding:24, background:'white', border:'1px solid var(--border)', borderRadius:10, textAlign:'center' }}>
        <div style={{ fontSize:14, color:'var(--ink-4)', marginBottom:12 }}>Erro ao carregar o caso. Tenta gerar um novo.</div>
        <button onClick={onAbandon} style={{ padding:'8px 16px', background:'var(--ink)', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)' }}>Voltar</button>
      </div>
    )
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining(r => { if (r <= 1) { handleSubmit(selected); return 0 } return r - 1 })
      setTimeSpent(t => t + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [selected])

  const handleSubmit = (idx: number | null) => {
    if (submitted) return
    if (timerRef.current) clearInterval(timerRef.current)
    const chosen = idx !== null ? idx : selected
    setSelected(chosen); setSubmitted(true)
    const correct = chosen !== null && ch.case_data.options[chosen]?.is_correct
    const baseXp = d.xp
    const bonus = correct ? Math.round((remaining / totalTime) * (baseXp * 0.5)) : 0
    setTimeout(() => onComplete(correct ? baseXp + bonus : 0, !!correct, timeSpent), 2800)
  }

  return (
    <div>
      <button onClick={onAbandon} style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', padding:0, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Abandonar
      </button>
      <div style={{ background:'white', border:`2px solid ${d.color}40`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ background:d.bg, borderBottom:`1px solid ${d.color}30`, padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:d.color, textTransform:'uppercase', letterSpacing:'0.1em' }}>{d.label}</span>
            <span style={{ fontSize:9, color:d.color, opacity:0.7, fontFamily:'var(--font-mono)' }}>+{d.xp} XP base</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:4 }}>
              <DomainSVG id={ch.domain} size={11} />
              {DOMAINS.find(x => x.id === ch.domain)?.label || ch.domain}
            </span>
          </div>
          {!submitted && <TimerBar total={totalTime} remaining={remaining} />}
        </div>
        <div style={{ padding:'20px 18px' }}>
          <p style={{ fontSize:15, color:'var(--ink)', lineHeight:1.8, marginBottom:16, fontFamily:'var(--font-serif)' }}>{ch.case_data.presentation}</p>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'12px 14px', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1d4ed8', lineHeight:1.5 }}>{ch.case_data.question}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ch.case_data.options.map((opt, i) => {
              let bg='var(--bg-2)', border='var(--border)', color='var(--ink-2)'
              if (submitted) {
                if (opt.is_correct) { bg='#d1fae5'; border='#6ee7b7'; color='#065f46' }
                else if (i === selected) { bg='#fee2e2'; border='#fca5a5'; color='#991b1b' }
                else { bg='white'; color='var(--ink-5)'; border='var(--border)' }
              } else if (i === selected) { bg='#ede9fe'; border='#c4b5fd'; color='#5b21b6' }
              return (
                <button key={i} onClick={() => { if (!submitted) { setSelected(i); handleSubmit(i) } }}
                  style={{ padding:'12px 14px', background:bg, border:`1.5px solid ${border}`, borderRadius:8, cursor:submitted?'default':'pointer', textAlign:'left', fontSize:14, color, lineHeight:1.5, transition:'all 0.1s', fontFamily:'var(--font-sans)' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.5, marginRight:6 }}>{String.fromCharCode(65+i)}.</span>
                  {opt.label}
                </button>
              )
            })}
          </div>
          {submitted && selected !== null && (
            <div style={{ marginTop:14 }}>
              <div style={{ padding:'12px 14px', background:ch.case_data.options[selected]?.is_correct?'#d1fae5':'#fee2e2', border:`1px solid ${ch.case_data.options[selected]?.is_correct?'#6ee7b7':'#fca5a5'}`, borderRadius:8, marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:ch.case_data.options[selected]?.is_correct?'#065f46':'#991b1b', marginBottom:5 }}>
                  {ch.case_data.options[selected]?.is_correct ? `Correcto! +${d.xp + Math.round((remaining/totalTime)*(d.xp*0.5))} XP` : 'Incorrecta'}
                </div>
                <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.6 }}>{ch.case_data.options[selected]?.explanation}</div>
              </div>
              {ch.case_data.learning_point && (
                <div style={{ padding:'10px 12px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8 }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Pearl clínico</div>
                  <div style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.6 }}>{ch.case_data.learning_point}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function XPToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ position:'fixed', top:80, right:20, zIndex:1000, background:'var(--ink)', color:'white', padding:'12px 20px', borderRadius:10, fontFamily:'var(--font-serif)', fontSize:22, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', animation:'slideIn 0.3s ease' }}>
      +{xp} XP
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ArenaPage() {
  const { user, supabase } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myStats, setMyStats] = useState<MyStats|null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [active, setActive] = useState<Challenge|null>(null)
  const [tab, setTab] = useState<'play'|'league'|'stats'>('play')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filterDomain, setFilterDomain] = useState('all')
  const [filterDiff, setFilterDiff] = useState('all')
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set())
  const [xpToast, setXpToast] = useState<number|null>(null)

  const plan = (user?.plan || 'free') as string
  const canPlay = plan !== 'free'

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const { data: ch } = await supabase.from('arena_challenges').select('*').eq('active', true).order('created_at', { ascending:false }).limit(40)
      const parsed = (ch || []).map((c: any) => ({
        ...c,
        case_data: typeof c.case_data === 'string' ? (() => { try { return JSON.parse(c.case_data) } catch { return c.case_data } })() : c.case_data
      }))
      setChallenges(parsed)

      const { data: myAttempts } = await supabase.from('arena_attempts').select('challenge_id, score, time_seconds, domain, completed_at').eq('user_id', user.id)
      const ma = myAttempts || []
      setAttemptedIds(new Set(ma.map((a: any) => a.challenge_id)))
      const totalXp = ma.reduce((sum: number, a: any) => sum + (a.score || 0), 0)
      const correct = ma.filter((a: any) => (a.score || 0) > 0).length
      const byDomain: Record<string, {correct: number; total: number}> = {}
      ma.forEach((a: any) => {
        const d = a.domain || 'outro'
        if (!byDomain[d]) byDomain[d] = { correct:0, total:0 }
        byDomain[d].total++
        if ((a.score||0) > 0) byDomain[d].correct++
      })

      const { data: lb } = await supabase.from('arena_leaderboard').select('*').order('total_xp', { ascending:false }).limit(50)
      const lbData = (lb || []).map((row: any) => ({
        user_id: row.user_id,
        display_name: row.display_name || `Estudante ${row.user_id?.slice(0,4)}`,
        total_xp: row.total_xp || 0,
        total_attempts: row.total_attempts || 0,
        correct_answers: row.correct_answers || 0,
        league: getLeague(row.total_xp || 0).id,
      }))
      setLeaderboard(lbData)
      const myRank = lbData.findIndex((e: LeaderboardEntry) => e.user_id === user.id) + 1
      setMyStats({ total_xp: totalXp, total_attempts: ma.length, correct, streak: 0, league: getLeague(totalXp).id, rank: myRank || 0, by_domain: byDomain })
    } catch (e) { console.error('Arena load error:', e) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { loadData() }, [loadData])

  const generateChallenge = async () => {
    if (!user) return
    setGenerating(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const domain = filterDomain === 'all' ? DOMAINS[Math.floor(Math.random() * (DOMAINS.length - 1)) + 1].id : filterDomain
      const diff = filterDiff === 'all' ? ['facil','medio','dificil'][Math.floor(Math.random()*3)] : filterDiff
      const res = await fetch('/api/arena/challenge', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ domain, difficulty: diff }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const caseData = data.case_data ? (typeof data.case_data === 'string' ? JSON.parse(data.case_data) : data.case_data) : data
      const newCh: Challenge = { id: data.id || crypto.randomUUID(), title: caseData.title || data.title || 'Caso clínico', domain, difficulty: diff as any, case_data: caseData }
      setChallenges(prev => [newCh, ...prev])
      setActive(newCh)
    } catch (e: any) { alert(e.message || 'Erro ao gerar caso') }
    setGenerating(false)
  }

  const handleComplete = async (xp: number, correct: boolean, time: number) => {
    if (!active || !user) return
    try {
      const { error } = await supabase.from('arena_attempts').insert({
        challenge_id: active.id, user_id: user.id, score: xp, time_seconds: time, domain: active.domain, completed_at: new Date().toISOString(),
      })
      if (error?.code === '23505') {
        await supabase.from('arena_attempts').update({ score: Math.max(xp, 0) }).eq('challenge_id', active.id).eq('user_id', user.id)
      }
      if (xp > 0) setXpToast(xp)
      setAttemptedIds(prev => new Set([...prev, active.id]))
      setTimeout(() => loadData(), 500)
    } catch (e) { console.error('Save attempt error:', e) }
    setActive(null)
  }

  const myLeague = myStats ? getLeague(myStats.total_xp) : LEAGUES[0]
  const nextLeague = myStats ? getNextLeague(myStats.total_xp) : LEAGUES[1]
  const progress = myStats && nextLeague ? Math.round(((myStats.total_xp - myLeague.min) / (nextLeague.min - myLeague.min)) * 100) : 100
  const filtered = challenges.filter(c => {
    if (filterDomain !== 'all' && c.domain !== filterDomain) return false
    if (filterDiff !== 'all' && c.difficulty !== filterDiff) return false
    return true
  })

  const tabStyle = (t: string) => ({
    padding:'9px 16px', background:'none', border:'none',
    borderBottom:`2px solid ${tab===t?'#7c3aed':'transparent'}`,
    cursor:'pointer', fontSize:11, fontWeight:700,
    color:tab===t?'#a78bfa':'#475569',
    fontFamily:'var(--font-sans)', letterSpacing:'0.04em',
    textTransform:'uppercase' as const, marginBottom:-1,
  })

  if (!canPlay) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:480, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'56px 32px', textAlign:'center' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
            <LeagueIcon id="diamond" size={56} color="#7c3aed" />
          </div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'var(--ink)', marginBottom:12 }}>Phlox Arena</div>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.7, marginBottom:28 }}>Bronze → Diamante. Casos de 8 domínios. XP real. Leaderboard global. Disponível no plano Student.</p>
          <Link href="/pricing" style={{ display:'inline-block', background:'#7c3aed', color:'white', textDecoration:'none', padding:'13px 32px', borderRadius:8, fontSize:14, fontWeight:700 }}>Ver plano Student →</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      {xpToast !== null && <XPToast xp={xpToast} onDone={() => setXpToast(null)} />}

      {/* Header */}
      <div style={{ background:'#0f172a', borderBottom:'1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop:20, paddingBottom:0 }}>
          {myStats && (
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16, flexWrap:'wrap' }}>
              <LeagueIcon id={myLeague.id} size={44} color={myLeague.color} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'#f8fafc', marginBottom:2 }}>
                  {user?.name?.split(' ')[0] || 'Estudante'}
                  <span style={{ fontSize:12, color:myLeague.color, marginLeft:10, fontFamily:'var(--font-mono)', fontWeight:700 }}>{myLeague.label}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1, maxWidth:200, height:6, background:'#1e293b', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${progress}%`, background:myLeague.color, borderRadius:3, transition:'width 0.8s ease' }} />
                  </div>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#475569' }}>{myStats.total_xp} XP</span>
                  {myStats.rank > 0 && <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#475569' }}>#{myStats.rank} global</span>}
                </div>
              </div>
              <button onClick={generateChallenge} disabled={generating}
                style={{ padding:'10px 20px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, cursor:generating?'wait':'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:8, opacity:generating?0.7:1 }}>
                {generating ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />A gerar...</> : 'Jogar agora'}
              </button>
            </div>
          )}
          <div style={{ display:'flex', borderTop:'1px solid #1e293b', overflowX:'auto' }}>
            {[['play','Casos'],['league','Liga'],['stats','As minhas stats']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {active && <ActiveChallenge ch={active} onComplete={handleComplete} onAbandon={() => setActive(null)} />}

        {!active && tab === 'play' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              {DOMAINS.map(d => (
                <button key={d.id} onClick={() => setFilterDomain(d.id)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', border:`1.5px solid ${filterDomain===d.id?'#7c3aed':'var(--border)'}`, borderRadius:20, background:filterDomain===d.id?'#faf5ff':'white', color:filterDomain===d.id?'#7c3aed':'var(--ink-3)', cursor:'pointer', fontSize:11, fontWeight:filterDomain===d.id?700:400, fontFamily:'var(--font-sans)' }}>
                  <DomainSVG id={d.id} size={12} />
                  {d.label}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:4, marginBottom:14 }}>
              {['all','facil','medio','dificil','especialista'].map(d => (
                <button key={d} onClick={() => setFilterDiff(d)}
                  style={{ padding:'4px 10px', border:`1.5px solid ${filterDiff===d?'var(--ink)':'var(--border)'}`, borderRadius:20, background:filterDiff===d?'var(--ink)':'white', color:filterDiff===d?'white':'var(--ink-3)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                  {d==='all'?'Todas':DIFF[d as keyof typeof DIFF]?.label||d}
                </button>
              ))}
            </div>
            <button onClick={generateChallenge} disabled={generating}
              style={{ width:'100%', padding:'13px', background:generating?'var(--bg-3)':'#7c3aed', color:generating?'var(--ink-4)':'white', border:'none', borderRadius:10, cursor:generating?'wait':'pointer', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {generating ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#7c3aed', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />A gerar...</> : `Gerar novo caso${filterDomain!=='all'?' de '+DOMAINS.find(d=>d.id===filterDomain)?.label:''}`}
            </button>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:76, borderRadius:8 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--ink-4)', fontSize:14 }}>Clica em "Gerar novo caso" para começar.</div>
            ) : filtered.map(ch => {
              const d = DIFF[ch.difficulty]
              const dom = DOMAINS.find(x => x.id === ch.domain)
              const done = attemptedIds.has(ch.id)
              return (
                <div key={ch.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'white', border:'1px solid var(--border)', borderRadius:9, marginBottom:6, opacity:done?0.55:1, cursor:done?'default':'pointer', transition:'all 0.15s' }}
                  onClick={() => !done && setActive(ch)}>
                  <div style={{ width:32, height:32, borderRadius:6, background:'var(--bg-2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-4)', flexShrink:0 }}>
                    <DomainSVG id={ch.domain} size={16} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{ch.title}</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:d.color, background:d.bg, padding:'1px 6px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{d.label}</span>
                      <span style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>+{d.xp} XP</span>
                    </div>
                  </div>
                  {done ? <span style={{ fontSize:11, color:'#0d6e42', fontFamily:'var(--font-mono)', fontWeight:700, flexShrink:0 }}>Feito</span>
                        : <span style={{ fontSize:13, fontWeight:700, color:'#7c3aed', flexShrink:0 }}>Jogar →</span>}
                </div>
              )
            })}
          </div>
        )}

        {!active && tab === 'league' && (
          <div>
            {myStats && (
              <div style={{ background:myLeague.bg, border:`2px solid ${myLeague.border}`, borderRadius:12, padding:'18px 20px', marginBottom:14, display:'flex', alignItems:'center', gap:16 }}>
                <LeagueIcon id={myLeague.id} size={52} color={myLeague.color} />
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:myLeague.color, marginBottom:2 }}>
                    {myLeague.label}
                    <span style={{ fontSize:13, fontFamily:'var(--font-sans)', color:myLeague.color, opacity:0.7, marginLeft:8 }}>{myStats.total_xp} XP</span>
                  </div>
                  <div style={{ fontSize:12, color:myLeague.color, opacity:0.7, marginBottom:8 }}>{myLeague.desc}</div>
                  {nextLeague && (
                    <>
                      <div style={{ height:6, background:`${myLeague.color}20`, borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                        <div style={{ height:'100%', width:`${progress}%`, background:myLeague.color, borderRadius:3 }} />
                      </div>
                      <div style={{ fontSize:10, color:myLeague.color, opacity:0.6, fontFamily:'var(--font-mono)' }}>
                        {nextLeague.min - myStats.total_xp} XP para {nextLeague.label}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px,1fr))', gap:8, marginBottom:14 }}>
              {LEAGUES.map(l => (
                <div key={l.id} style={{ background:l.bg, border:`1px solid ${l.border}`, borderRadius:10, padding:'14px 10px', textAlign:'center', opacity:myStats&&myStats.total_xp>=l.min?1:0.3, transition:'opacity 0.2s' }}>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>
                    <LeagueIcon id={l.id} size={36} color={l.color} />
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:l.color }}>{l.label}</div>
                  <div style={{ fontSize:10, color:l.color, opacity:0.6, fontFamily:'var(--font-mono)', marginTop:2 }}>{l.min}+ XP</div>
                </div>
              ))}
            </div>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-2)' }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Ranking Global · Top {leaderboard.length}</div>
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--ink-4)', fontSize:13 }}>Ainda sem dados. Joga casos para aparecer no ranking!</div>
              ) : leaderboard.map((p, i) => {
                const l = getLeague(p.total_xp)
                const isMe = p.user_id === user?.id
                return (
                  <div key={p.user_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom:i<leaderboard.length-1?'1px solid var(--bg-3)':'none', background:isMe?'#faf5ff':'white' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:i<3?['#ffd70020','#c0c0c020','#cd7f3220'][i]:'var(--bg-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink-3)', flexShrink:0 }}>
                      {i+1}
                    </div>
                    <LeagueIcon id={l.id} size={24} color={l.color} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:isMe?700:500, color:isMe?'#7c3aed':'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.display_name}{isMe?' (tu)':''}</div>
                      <div style={{ fontSize:10, color:l.color, fontFamily:'var(--font-mono)' }}>{l.label} · {p.correct_answers}/{p.total_attempts} correctas</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--ink)' }}>{p.total_xp}</div>
                      <div style={{ fontSize:9, color:'var(--ink-4)', fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>XP</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!active && tab === 'stats' && myStats && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:10 }}>
              {[
                { label:'XP Total', value:myStats.total_xp, color:'#7c3aed' },
                { label:'Correctas', value:`${myStats.correct}/${myStats.total_attempts}`, color:'#0d6e42' },
                { label:'Taxa', value:myStats.total_attempts>0?`${Math.round((myStats.correct/myStats.total_attempts)*100)}%`:'—', color:'#1d4ed8' },
                { label:'Rank global', value:myStats.rank>0?`#${myStats.rank}`:'—', color:'#d97706' },
              ].map(s => (
                <div key={s.label} style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'14px' }}>
                  <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:s.color, opacity:0.7, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {Object.keys(myStats.by_domain).length > 0 && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:18 }}>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>Performance por domínio</div>
                {Object.entries(myStats.by_domain).sort(([,a],[,b]) => (a.correct/Math.max(1,a.total)) - (b.correct/Math.max(1,b.total))).map(([domain, data]) => {
                  const rate = data.total > 0 ? Math.round((data.correct/data.total)*100) : 0
                  const dom = DOMAINS.find(d => d.id === domain)
                  const color = rate>=80?'#0d6e42':rate>=60?'#d97706':'#dc2626'
                  return (
                    <div key={domain} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, alignItems:'center' }}>
                        <span style={{ fontSize:12, color:'var(--ink)', display:'flex', alignItems:'center', gap:5 }}><DomainSVG id={domain} size={12} />{dom?.label||domain}</span>
                        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color }}>{rate}%</span>
                      </div>
                      <div style={{ height:5, background:'var(--bg-3)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${rate}%`, background:color, borderRadius:3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:18 }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>Progressão de liga</div>
              <div style={{ display:'flex', gap:0, borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                {LEAGUES.map((l, i) => {
                  const unlocked = myStats.total_xp >= l.min
                  return (
                    <div key={l.id} style={{ flex:1, background:unlocked?l.bg:'var(--bg-3)', padding:'12px 4px', textAlign:'center', borderRight:i<LEAGUES.length-1?'1px solid rgba(255,255,255,0.3)':'none', opacity:unlocked?1:0.35 }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:4 }}>
                        <LeagueIcon id={l.id} size={28} color={l.color} />
                      </div>
                      <div style={{ fontSize:8, fontFamily:'var(--font-mono)', fontWeight:700, color:unlocked?l.color:'var(--ink-5)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}