'use client'

// /plano-recuperacao — Plano de Recuperação (Pro, ligado ao Objetivo de Saúde
// "recover"). Marcos realistas para O EVENTO CONCRETO desta pessoa (cirurgia,
// internamento…), contextualizados à medicação e condições reais. Mesmo
// padrão do /plano-peso (auto-carrega medicação, stateless, gera a pedido).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { goalMeta } from '@/lib/healthGoals'

const ACCENT = '#7c3aed'

interface RecoveryPlan {
  summary: string
  phase_now: string
  milestones: { period: string; focus: string; dos: string[]; donts: string[] }[]
  medication_considerations: { medication: string; consideration: string }[]
  warning_signs: string[]
  when_to_call_112: string
  disclaimer: string
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

export default function PlanoRecuperacaoPage() {
  const { user, supabase } = useAuth() as any
  const [goal, setGoal] = useState<string | null | undefined>(undefined)
  const [event, setEvent] = useState('')
  const [daysSince, setDaysSince] = useState('')
  const [meds, setMeds] = useState('')
  const [conditions, setConditions] = useState('')
  const [age, setAge] = useState('')
  const [plan, setPlan] = useState<RecoveryPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: prof }, { data: personalMeds }] = await Promise.all([
      supabase.from('profiles').select('health_goal, health_goal_detail').eq('id', user.id).maybeSingle(),
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id),
    ])
    setGoal(prof?.health_goal ?? null)
    if (prof?.health_goal_detail) setEvent(prof.health_goal_detail)
    if (personalMeds?.length) setMeds(personalMeds.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`).join('\n'))
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!event.trim()) { setError('Indica o evento (ex: "Cirurgia à anca", "Internamento por pneumonia").'); return }
    setLoading(true); setError(''); setPlan(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/recovery-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ event, medications: meds, conditions, age: age ? parseInt(age) : null, days_since: daysSince ? parseInt(daysSince) : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar plano')
      setPlan(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  // Gate de plano feito por PLAN_ROUTES + <PlanGate> no ClientLayout — aqui só
  // falta o gate de OBJETIVO, específico desta ferramenta.
  if (goal !== undefined && goal !== 'recover') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>🏥</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 10 }}>Plano de Recuperação</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 8 }}>Esta ferramenta é para quem tem "Recuperar de um evento" como Objetivo de Saúde.</p>
        {goal && <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>O teu objetivo atual é <strong>{goalMeta(goal)?.label}</strong>.</p>}
        <Link href="/settings" style={{ background: ACCENT, color: 'white', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Mudar o meu objetivo →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #5b21b6)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Objetivo · Recuperar de um evento</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Plano de Recuperação</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Marcos realistas para o teu evento concreto — a tua medicação real muda o que é normal e o que é sinal de alarme.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>O que aconteceu?</label>
            <input value={event} onChange={e => setEvent(e.target.value)} placeholder="Ex: Cirurgia à anca, internamento por pneumonia, AVC ligeiro"
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Medicação atual</label>
              <textarea value={meds} onChange={e => setMeds(e.target.value)} rows={4} placeholder="Um medicamento por linha"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Idade</label>
                <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 68" inputMode="numeric"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Há quantos dias?</label>
                <input value={daysSince} onChange={e => setDaysSince(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 5" inputMode="numeric"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Condições / diagnósticos</label>
            <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: Diabetes, fibrilhação auricular"
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{ padding: '13px 24px', background: loading ? '#9ca3af' : ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'A preparar o teu plano…' : plan ? '↺ Gerar plano novo' : '✨ Gerar o meu plano'}
          </button>
        </div>

        {plan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, background: '#faf5ff', borderColor: '#e9d5ff' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{plan.phase_now}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4c1d95' }}>{plan.summary}</div>
            </div>

            {plan.medication_considerations?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>💊 O que a tua medicação muda na recuperação</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.medication_considerations.map((m, i) => (
                    <div key={i} style={{ padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{m.medication}</span>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{m.consideration}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.milestones?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🗓 Marcos da recuperação</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.milestones.map((m, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 3 }}>{m.period}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>{m.focus}</div>
                      {m.dos?.length > 0 && <div style={{ fontSize: 12, color: '#15803d', marginBottom: 2 }}>✓ {m.dos.join(' · ')}</div>}
                      {m.donts?.length > 0 && <div style={{ fontSize: 12, color: '#b45309' }}>✗ {m.donts.join(' · ')}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.warning_signs?.length > 0 && (
              <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>🚨 Contacta o médico se:</div>
                {plan.warning_signs.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: '#7f1d1d', marginBottom: 4 }}>• {r}</div>)}
                {plan.when_to_call_112 && <div style={{ fontSize: 12.5, color: '#7f1d1d', fontWeight: 700, marginTop: 6 }}>🚑 Ligar 112 se: {plan.when_to_call_112}</div>}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', fontStyle: 'italic' }}>{plan.disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  )
}
