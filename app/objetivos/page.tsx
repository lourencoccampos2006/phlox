'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Goal {
  id: string
  metric: string
  target: number
  unit: string
  current?: number
  direction: 'below' | 'above' | 'range'
  range_min?: number
  range_max?: number
  label: string
  icon: string
  color: string
}

interface VitalLatest {
  bp_sys?: number
  bp_dia?: number
  hr?: number
  weight?: number
  glucose?: number
  spo2?: number
}

const PRESET_GOALS: Omit<Goal, 'id' | 'current'>[] = [
  { metric: 'bp_sys', target: 130, unit: 'mmHg', direction: 'below', label: 'Tensão Sistólica', icon: '❤️', color: '#dc2626' },
  { metric: 'bp_dia', target: 85, unit: 'mmHg', direction: 'below', label: 'Tensão Diastólica', icon: '💗', color: '#ef4444' },
  { metric: 'glucose', target: 100, unit: 'mg/dL', direction: 'below', label: 'Glicemia em Jejum', icon: '🩸', color: '#b45309' },
  { metric: 'weight', target: 75, unit: 'kg', direction: 'below', label: 'Peso Corporal', icon: '⚖️', color: '#7c3aed' },
  { metric: 'hr', target: 80, unit: 'bpm', direction: 'below', label: 'Freq. Cardíaca em Repouso', icon: '💓', color: '#0d6e42' },
  { metric: 'spo2', target: 95, unit: '%', direction: 'above', label: 'Saturação O₂', icon: '🫁', color: '#1d4ed8' },
]

function getStatus(goal: Goal): 'achieved' | 'close' | 'off' | 'unknown' {
  if (goal.current == null) return 'unknown'
  const diff = goal.direction === 'above'
    ? goal.current - goal.target
    : goal.target - goal.current
  if (diff >= 0) return 'achieved'
  if (diff >= -10) return 'close'
  return 'off'
}

const STATUS_STYLE = {
  achieved: { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', label: 'Atingido', icon: '✅' },
  close:    { color: '#92400e', bg: '#fef9c3', border: '#fde68a', label: 'Perto',    icon: '🎯' },
  off:      { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', label: 'A trabalhar', icon: '📈' },
  unknown:  { color: '#374151', bg: '#f3f4f6', border: '#d1d5db', label: 'Sem dados', icon: '—' },
}

export default function ObjetivosPage() {
  const { user, supabase } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [vitals, setVitals] = useState<VitalLatest>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newGoal, setNewGoal] = useState<typeof PRESET_GOALS[0] | null>(null)
  const [customTarget, setCustomTarget] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const savedGoals = localStorage.getItem(`phlox-goals-${user.id}`)
    if (savedGoals) {
      try { setGoals(JSON.parse(savedGoals)) } catch {}
    }

    // Get latest vitals
    supabase.from('vitals').select('*').eq('user_id', user.id)
      .order('recorded_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const latest: VitalLatest = {}
          for (const v of data) {
            if (!latest.bp_sys && v.bp_sys) latest.bp_sys = v.bp_sys
            if (!latest.bp_dia && v.bp_dia) latest.bp_dia = v.bp_dia
            if (!latest.hr && v.hr) latest.hr = v.hr
            if (!latest.weight && v.weight) latest.weight = v.weight
            if (!latest.glucose && v.glucose) latest.glucose = v.glucose
            if (!latest.spo2 && v.spo2) latest.spo2 = v.spo2
          }
          setVitals(latest)
        }
        setLoading(false)
      })
  }, [user, supabase])

  const saveGoals = (newGoals: Goal[]) => {
    setGoals(newGoals)
    if (user) localStorage.setItem(`phlox-goals-${user.id}`, JSON.stringify(newGoals))
  }

  const addGoal = () => {
    if (!newGoal || !customTarget) return
    const target = parseFloat(customTarget)
    if (isNaN(target)) return
    const goal: Goal = {
      ...newGoal,
      id: `${newGoal.metric}-${Date.now()}`,
      target,
      current: vitals[newGoal.metric as keyof VitalLatest] as number | undefined,
    }
    saveGoals([...goals, goal])
    setAdding(false)
    setNewGoal(null)
    setCustomTarget('')
  }

  const removeGoal = (id: string) => saveGoals(goals.filter(g => g.id !== id))

  // Attach current vitals to goals
  const goalsWithCurrent = goals.map(g => ({
    ...g,
    current: vitals[g.metric as keyof VitalLatest] as number | undefined ?? g.current,
  }))

  const achieved = goalsWithCurrent.filter(g => getStatus(g) === 'achieved').length
  const total = goalsWithCurrent.filter(g => getStatus(g) !== 'unknown').length

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40 }}>🎯</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Objetivos de Saúde</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para definir e acompanhar os teus objetivos de saúde.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Objetivos</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>Os meus objetivos de saúde</div>
            </div>
            {total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: achieved === total && total > 0 ? '#059669' : 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{achieved}/{total}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>atingidos</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* No vitals warning */}
            {Object.keys(vitals).length === 0 && goals.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>⚠️</span>
                <span>Não tens sinais vitais registados. <a href="/vitals" style={{ color: '#b45309', fontWeight: 700, textDecoration: 'none' }}>Registar agora →</a></span>
              </div>
            )}

            {/* Goals list */}
            {goalsWithCurrent.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Define o teu primeiro objetivo</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
                  Associa automaticamente aos teus sinais vitais e acompanha o teu progresso ao longo do tempo.
                </div>
                <button onClick={() => setAdding(true)} style={{ padding: '11px 24px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  🎯 Adicionar objetivo
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {goalsWithCurrent.map(goal => {
                    const status = getStatus(goal)
                    const style = STATUS_STYLE[status]
                    const progress = goal.current != null
                      ? Math.min(100, Math.max(0, goal.direction === 'above'
                          ? (goal.current / goal.target) * 100
                          : ((goal.target - Math.max(0, goal.current - goal.target)) / goal.target) * 100))
                      : 0

                    return (
                      <div key={goal.id} style={{ border: `1.5px solid ${style.border}`, borderRadius: 12, padding: '14px 16px', background: style.bg }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>{goal.icon}</span>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{goal.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                                Objetivo: {goal.direction === 'below' ? '<' : '>'} {goal.target} {goal.unit}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 20, fontWeight: 700, color: style.color, fontFamily: 'var(--font-mono)' }}>
                                {goal.current != null ? `${goal.current} ${goal.unit}` : '—'}
                              </div>
                              <div style={{ fontSize: 10, color: style.color, fontWeight: 600 }}>{style.icon} {style.label}</div>
                            </div>
                            <button onClick={() => removeGoal(goal.id)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }} title="Remover objetivo">×</button>
                          </div>
                        </div>
                        {goal.current != null && (
                          <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: style.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button onClick={() => setAdding(true)} style={{ padding: '10px', background: 'white', border: '2px dashed var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-4)' }}>
                  + Adicionar objetivo
                </button>
              </>
            )}

            {/* Add goal panel */}
            {adding && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>🎯 Escolher objetivo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {PRESET_GOALS.filter(p => !goals.some(g => g.metric === p.metric)).map(preset => (
                    <button key={preset.metric} onClick={() => { setNewGoal(preset); setCustomTarget(String(preset.target)) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `2px solid ${newGoal?.metric === preset.metric ? preset.color : 'var(--border)'}`, borderRadius: 10, background: newGoal?.metric === preset.metric ? `${preset.color}10` : 'white', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 22 }}>{preset.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{preset.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                          Padrão: {preset.direction === 'below' ? '<' : '>'} {preset.target} {preset.unit}
                          {vitals[preset.metric as keyof VitalLatest] != null && (
                            <span style={{ marginLeft: 8, color: '#1d4ed8', fontWeight: 600 }}>
                              Atual: {vitals[preset.metric as keyof VitalLatest]} {preset.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {newGoal && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                      {newGoal.label} — Definir alvo
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{newGoal.direction === 'below' ? 'Menos de' : 'Mais de'}</span>
                      <input type="number" value={customTarget} onChange={e => setCustomTarget(e.target.value)}
                        style={{ width: 90, border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-mono)', outline: 'none', fontWeight: 700 }} />
                      <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{newGoal.unit}</span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addGoal} disabled={!newGoal || !customTarget} style={{ flex: 1, padding: '11px', background: newGoal ? 'var(--green)' : 'var(--bg-3)', color: newGoal ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: newGoal ? 'pointer' : 'default' }}>
                    Adicionar
                  </button>
                  <button onClick={() => { setAdding(false); setNewGoal(null); setCustomTarget('') }} style={{ padding: '11px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: 'var(--ink-4)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Link to vitals */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Os objetivos atualizam automaticamente com os teus registos de sinais vitais.</div>
              <a href="/vitals" style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Registar sinais →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
