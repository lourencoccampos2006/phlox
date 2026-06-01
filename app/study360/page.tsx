'use client'

// /study360 — Hub do plano Student.
//   • SRS: cards para rever hoje (algoritmo SM-2)
//   • Plano de estudo: criar plano por data de exame + tópicos
//   • Pomodoro: timer de sessão com track de minutos/dia
//   • Métricas: cards aprendidos, sequência, tempo total
// Reaproveita study_cards / study_plans / study_sessions (sprint48).

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import { sm2, deckStats } from '@/lib/srsEngine'

type Tab = 'review' | 'plan' | 'pomodoro' | 'stats'

export default function Study360() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('review')
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28 }}>Estudo 360°</h1>
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 24 }}>
          Algoritmo de revisão SM-2 (Anki), plano por data de exame e sessões com tracker. Disponível no plano Student.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver Student →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Student · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Estudo 360°</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Algoritmo de revisão espaçada, plano por exame, Pomodoro e métricas.</p>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 16, overflowX: 'auto' }}>
          {([
            ['review',   '🃏 Rever cards'],
            ['plan',     '🗓 Plano por exame'],
            ['pomodoro', '⏱ Pomodoro'],
            ['stats',    '📈 Estatísticas'],
          ] as [Tab, string][]).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '10px 14px', background: tab === id ? '#faf5ff' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#7c3aed' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#7c3aed' : '#475569', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{l}</button>
          ))}
        </div>

        {tab === 'review' && <ReviewTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'pomodoro' && <PomodoroTab />}
        {tab === 'stats' && <StatsTab />}
      </div>
    </div>
  )
}

// ─── Review (SRS) ─────────────────────────────────────────────────────────────
function ReviewTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [cards, setCards] = useState<any[]>([])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => { refresh() }, [user?.id])
  async function refresh() {
    if (!user?.id) return
    const { data } = await supabase.from('study_cards')
      .select('*').eq('user_id', user.id).eq('suspended', false)
      .lte('due_at', new Date().toISOString()).order('due_at').limit(50)
    setCards(data || [])
    setI(0); setFlipped(false)
  }

  if (cards.length === 0) return (
    <Empty msg="Nenhum cartão para rever agora 🎉 Adiciona cartões a partir da Biblioteca ou cria manualmente." />
  )

  if (i >= cards.length) return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 28, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: '#0d6e42' }}>✓ Sessão completa</div>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>Acabaste de rever {cards.length} cartões. Volta amanhã.</p>
      <button onClick={refresh} style={{ marginTop: 12, padding: '9px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Recarregar</button>
    </div>
  )

  const c = cards[i]

  async function rate(r: number) {
    const newState = sm2({ ease: c.ease, interval_d: c.interval_d, repetitions: c.repetitions }, r)
    await supabase.from('study_cards').update({
      ease: newState.ease,
      interval_d: newState.interval_d,
      repetitions: newState.repetitions,
      due_at: newState.due_at.toISOString(),
      last_review_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    await supabase.from('study_card_reviews').insert({
      user_id: user!.id, card_id: c.id, rating: r,
      prev_interval: c.interval_d, new_interval: newState.interval_d,
    })
    setI(i + 1); setFlipped(false)
  }

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Card {i + 1} / {cards.length} · {c.deck || 'Sem baralho'}</div>
      <div onClick={() => setFlipped(f => !f)}
        style={{ minHeight: 180, padding: 28, background: flipped ? '#faf5ff' : 'white', border: `1.5px solid ${flipped ? '#e9d5ff' : '#e5e7eb'}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', fontSize: 16, color: '#0b1120', lineHeight: 1.6, marginBottom: 12 }}>
        {flipped ? c.back : c.front}
        {!flipped && c.hint && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' }}>Pista: {c.hint}</div>}
      </div>

      {!flipped ? (
        <button onClick={() => setFlipped(true)} style={{ width: '100%', padding: 12, background: '#0b1120', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Ver resposta</button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { v: 0, label: 'Errei', color: '#dc2626', desc: 'Reiniciar' },
            { v: 3, label: 'Difícil', color: '#d97706', desc: '+ poucos dias' },
            { v: 4, label: 'Bom', color: '#1d4ed8', desc: 'Intervalo normal' },
            { v: 5, label: 'Fácil', color: '#0d6e42', desc: 'Intervalo longo' },
          ].map(b => (
            <button key={b.v} onClick={() => rate(b.v)}
              style={{ padding: '10px 6px', background: b.color, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', textAlign: 'center' }}>
              <div>{b.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2, fontWeight: 500 }}>{b.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Plan ────────────────────────────────────────────────────────────────────
function PlanTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [plans, setPlans] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [subject, setSubject] = useState('')
  const [topicsRaw, setTopicsRaw] = useState('')
  const [daysWeek, setDaysWeek] = useState(5)
  const [minutes, setMinutes] = useState(50)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase.from('study_plans').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      setPlans(data || [])
    })()
  }, [user?.id])

  async function generate() {
    if (!title.trim() || !examDate || !topicsRaw.trim()) { toast.error('Falta título, data ou tópicos'); return }
    setGenerating(true)
    const topics = topicsRaw.split('\n').map(t => t.trim()).filter(Boolean)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ title, exam_date: examDate, subject, topics, days_per_week: daysWeek, minutes_per_session: minutes }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou')
      const { data: created } = await supabase.from('study_plans').insert({
        user_id: user!.id, title, exam_date: examDate, subject,
        topics, days_per_week: daysWeek, minutes_per_session: minutes,
        ai_breakdown: d.plan,
      }).select().single()
      setPlans(p => [created, ...p])
      setCreating(false); setTitle(''); setTopicsRaw(''); setSubject(''); setExamDate('')
      toast.success('Plano criado')
    } catch (e: any) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div>
      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 14, padding: '10px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          + Novo plano de estudo
        </button>
      )}

      {creating && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <Label>Título</Label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Exame final de Farmacologia" style={input()} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div><Label>Data do exame</Label><input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={input()} /></div>
            <div><Label>Área</Label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Farmacologia" style={input()} /></div>
          </div>

          <Label>Tópicos a estudar (um por linha)</Label>
          <textarea value={topicsRaw} onChange={e => setTopicsRaw(e.target.value)} rows={6}
            placeholder="Anticoagulantes&#10;Estatinas&#10;Antibióticos beta-lactâmicos&#10;…"
            style={{ ...input(), fontFamily: 'var(--font-mono)', fontSize: 12.5, resize: 'vertical' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div><Label>Dias por semana</Label><input type="number" min={1} max={7} value={daysWeek} onChange={e => setDaysWeek(Number(e.target.value))} style={input()} /></div>
            <div><Label>Minutos por sessão</Label><input type="number" min={20} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} style={input()} /></div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => setCreating(false)} disabled={generating} style={{ padding: '9px 16px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={generate} disabled={generating} style={{ padding: '9px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: generating ? 'wait' : 'pointer' }}>{generating ? 'A gerar com AI…' : 'Gerar plano com AI →'}</button>
          </div>
        </div>
      )}

      {plans.length === 0 && !creating && <Empty msg="Sem planos. Cria um plano com data do exame e os tópicos — a AI distribui sessões." />}

      {plans.map(p => (
        <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{p.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{p.subject || ''} · Exame {p.exam_date}</div>
            </div>
            {p.exam_date && (() => {
              const days = Math.ceil((new Date(p.exam_date).getTime() - Date.now()) / (86400 * 1000))
              const c = days < 7 ? '#dc2626' : days < 30 ? '#d97706' : '#0d6e42'
              return <div style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: 'var(--font-mono)' }}>{days > 0 ? `${days} d` : 'hoje'}</div>
            })()}
          </div>
          {p.ai_breakdown?.weeks && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.ai_breakdown.weeks.map((w: any, wi: number) => (
                <details key={wi} style={{ background: '#f8fafc', borderRadius: 7, padding: '7px 11px' }}>
                  <summary style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1120', cursor: 'pointer' }}>Semana {wi + 1} · {w.focus}</summary>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#475569' }}>
                    {(w.sessions || []).map((s: any, si: number) => <li key={si} style={{ lineHeight: 1.55 }}>{s}</li>)}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Pomodoro ────────────────────────────────────────────────────────────────
function PomodoroTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [duration, setDuration] = useState<25 | 50>(25)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(25 * 60)
  const [topic, setTopic] = useState('')
  const [started, setStarted] = useState<Date | null>(null)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => { if (running && remaining === 0) finish() }, [remaining, running])

  function start() {
    setRemaining(duration * 60); setRunning(true); setStarted(new Date())
  }
  async function finish() {
    setRunning(false)
    if (!user?.id || !started) return
    const mins = Math.round((Date.now() - started.getTime()) / 60000)
    await supabase.from('study_sessions').insert({
      user_id: user.id, topic: topic || null,
      started_at: started.toISOString(), ended_at: new Date().toISOString(),
      minutes: mins,
    })
    toast.success(`Sessão de ${mins} min guardada`)
    setStarted(null)
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 64, color: '#7c3aed', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="O que vais estudar?"
          disabled={running}
          style={{ ...input(), maxWidth: 360, margin: '14px auto 0', textAlign: 'center' }} />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }}>
          {!running && [25, 50].map(d => (
            <button key={d} onClick={() => { setDuration(d as 25 | 50); setRemaining(d * 60) }}
              style={{ padding: '8px 14px', borderRadius: 7, border: `1.5px solid ${duration === d ? '#7c3aed' : '#e5e7eb'}`, background: duration === d ? '#faf5ff' : 'white', color: duration === d ? '#7c3aed' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{d} min</button>
          ))}
        </div>
        {!running ? (
          <button onClick={start} style={{ marginTop: 16, padding: '11px 28px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>▶ Iniciar sessão</button>
        ) : (
          <button onClick={finish} style={{ marginTop: 16, padding: '11px 28px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>■ Terminar agora</button>
        )}
      </div>
    </div>
  )
}

// ─── Stats ──────────────────────────────────────────────────────────────────
function StatsTab() {
  const { user, supabase } = useAuth()
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const [cards, sess, rev] = await Promise.all([
        supabase.from('study_cards').select('ease,interval_d,repetitions,due_at,last_review_at,created_at').eq('user_id', user.id),
        supabase.from('study_sessions').select('minutes,started_at').eq('user_id', user.id).order('started_at', { ascending: false }).limit(60),
        supabase.from('study_card_reviews').select('rating, reviewed_at').eq('user_id', user.id).order('reviewed_at', { ascending: false }).limit(500),
      ])
      const ds = deckStats((cards.data || []) as any[])
      const totalMins = (sess.data || []).reduce((a: number, b: any) => a + (b.minutes || 0), 0)
      const last7 = (sess.data || []).filter((s: any) => new Date(s.started_at).getTime() > Date.now() - 7 * 86400 * 1000)
      const last7Mins = last7.reduce((a: number, b: any) => a + (b.minutes || 0), 0)
      const correctRate = (rev.data || []).length === 0 ? 0
        : ((rev.data || []).filter((r: any) => r.rating >= 3).length / (rev.data || []).length) * 100
      setStats({ ds, totalMins, last7Mins, correctRate, totalReviews: (rev.data || []).length })
    })()
  }, [user?.id])

  if (!stats) return <Empty msg="A carregar estatísticas…" />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
      <Stat label="Cartões" v={stats.ds.total} />
      <Stat label="Para rever agora" v={stats.ds.due_today} color="#dc2626" />
      <Stat label="Maduros (≥21 d)" v={stats.ds.mature} color="#0d6e42" />
      <Stat label="Jovens" v={stats.ds.young} color="#1d4ed8" />
      <Stat label="Ease médio" v={stats.ds.avg_ease} />
      <Stat label="Tempo total" v={`${Math.round(stats.totalMins / 60)} h`} />
      <Stat label="Últimos 7 d" v={`${stats.last7Mins} min`} color="#7c3aed" />
      <Stat label="Acertos SRS" v={`${Math.round(stats.correctRate)}%`} color="#0d6e42" />
    </div>
  )
}

function Stat({ label, v, color }: { label: string; v: number | string; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0b1120', marginTop: 4 }}>{v}</div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{msg}</div>
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 8 }}>{children}</div> }
function input(): React.CSSProperties { return { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' } }
