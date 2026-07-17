'use client'

// /plano-peso — Plano de Perda de Peso (Pro, ligado ao Objetivo de Saúde
// "lose_weight"). Dieta + exercício contextualizados à medicação e condições
// REAIS da pessoa — não um template genérico. Auto-carrega a medicação e a
// tendência de peso já registadas; o resto (idade/condições) é preenchido
// aqui, tal como no /relatorio?tab=plano (mesma convenção, não persistido
// noutro sítio — profiles não guarda idade/condições da própria pessoa).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { goalMeta } from '@/lib/healthGoals'

const ACCENT = '#0d9488'

interface WeightPlan {
  summary: string
  weekly_calorie_target: number
  macro_split: { protein_g: number; carbs_g: number; fat_g: number }
  meal_plan: { meal: string; suggestion: string; note?: string }[]
  exercise_plan: { day: string; activity: string; intensity: string; caution?: string }[]
  medication_considerations: { medication: string; consideration: string }[]
  weekly_milestones: string[]
  red_flags: string[]
  disclaimer: string
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

export default function PlanoPesoPage() {
  const { user, supabase } = useAuth() as any
  const [goal, setGoal] = useState<string | null | undefined>(undefined)
  const [meds, setMeds] = useState('')
  const [conditions, setConditions] = useState('')
  const [age, setAge] = useState('')
  const [targetNote, setTargetNote] = useState('')
  const [weightTrend, setWeightTrend] = useState('')
  const [plan, setPlan] = useState<WeightPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: prof }, { data: personalMeds }, { data: vitals }] = await Promise.all([
      supabase.from('profiles').select('health_goal').eq('id', user.id).maybeSingle(),
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id),
      supabase.from('vitals').select('recorded_at, weight').eq('user_id', user.id).is('profile_id', null).not('weight', 'is', null).order('recorded_at', { ascending: false }).limit(10),
    ])
    setGoal(prof?.health_goal ?? null)
    if (personalMeds?.length) setMeds(personalMeds.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`).join('\n'))
    const ws = (vitals || []) as { recorded_at: string; weight: number }[]
    if (ws.length >= 2) {
      const recent = ws[0].weight, oldest = ws[ws.length - 1].weight
      const delta = recent - oldest
      setWeightTrend(`${ws.length} registos recentes, de ${oldest}kg para ${recent}kg (${delta <= 0 ? '' : '+'}${delta.toFixed(1)}kg)`)
    } else if (ws.length === 1) {
      setWeightTrend(`Último peso registado: ${ws[0].weight}kg`)
    }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!meds.trim() && !conditions.trim()) { setError('Adiciona pelo menos a tua medicação ou condições — o plano tem de ser sobre ti.'); return }
    setLoading(true); setError(''); setPlan(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/weight-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ medications: meds, conditions, age: age ? parseInt(age) : null, current_weight: null, target_note: targetNote, weight_trend: weightTrend }),
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
  // falta o gate de OBJETIVO, que é específico desta ferramenta.
  if (goal !== undefined && goal !== 'lose_weight') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>⚖️</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 10 }}>Plano de Perda de Peso</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 8 }}>Esta ferramenta é para quem tem "Perder peso" como Objetivo de Saúde.</p>
        {goal && <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>O teu objetivo atual é <strong>{goalMeta(goal)?.label}</strong>.</p>}
        <Link href="/settings" style={{ background: ACCENT, color: 'white', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Mudar o meu objetivo →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #0f766e)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Objetivo · Perder peso</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Plano de Perda de Peso</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Dieta e exercício pensados para ti — a tua medicação e condições reais mudam o que é seguro e eficaz.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Medicação atual</label>
              <textarea value={meds} onChange={e => setMeds(e.target.value)} rows={4} placeholder="Um medicamento por linha"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Idade</label>
                <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 45" inputMode="numeric"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Condições / diagnósticos</label>
                <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: HTA, DM2, artrose no joelho"
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Alguma nota sobre o teu objetivo? (opcional)</label>
            <input value={targetNote} onChange={e => setTargetNote(e.target.value)} placeholder="Ex: quero perder 8kg até ao verão, tenho o joelho fraco"
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {weightTrend && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12 }}>📈 {weightTrend} <Link href="/vitals" style={{ color: ACCENT, fontWeight: 600 }}>ver histórico →</Link></div>}
          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{ padding: '13px 24px', background: loading ? '#9ca3af' : ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'A construir o teu plano…' : plan ? '↺ Gerar plano novo' : '✨ Gerar o meu plano'}
          </button>
        </div>

        {plan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, background: '#f0fdfa', borderColor: '#99f6e4' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f766e', marginBottom: 6 }}>{plan.summary}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#134e4a' }}>
                <span>🎯 {plan.weekly_calorie_target} kcal/dia</span>
                {plan.macro_split && <>
                  <span>🍗 {plan.macro_split.protein_g}g proteína</span>
                  <span>🍞 {plan.macro_split.carbs_g}g hidratos</span>
                  <span>🥑 {plan.macro_split.fat_g}g gordura</span>
                </>}
              </div>
            </div>

            {plan.medication_considerations?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>💊 O que a tua medicação muda no plano</div>
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

            {plan.meal_plan?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🍽 Plano alimentar</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {plan.meal_plan.map((m, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.meal}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>{m.suggestion}</div>
                      {m.note && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, fontStyle: 'italic' }}>{m.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.exercise_plan?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🏃 Plano de exercício</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.exercise_plan.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '8px 0', borderBottom: i < plan.exercise_plan.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', width: 70, flexShrink: 0 }}>{e.day}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{e.activity}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 8 }}>({e.intensity})</span>
                        {e.caution && <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>⚠ {e.caution}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.weekly_milestones?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🗓 Marcos semanais</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.weekly_milestones.map((m, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {m}</div>)}
                </div>
              </div>
            )}

            {plan.red_flags?.length > 0 && (
              <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>🚨 Para de seguir o plano e fala com o médico se:</div>
                {plan.red_flags.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: '#7f1d1d', marginBottom: 4 }}>• {r}</div>)}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', fontStyle: 'italic' }}>{plan.disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  )
}
