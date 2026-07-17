'use client'

// HealthGoalPicker — Objetivo de Saúde (Pro Ronda 3). A espinha de
// personalização: o motivo real da pessoa estar no Phlox reconfigura o que
// lhe mostramos (planos por objetivo, funcionalidades de cuidador avançadas).
// Componente autónomo (fetch/save próprios) para não mexer no form grande de
// /settings. Só aparece para planos Pro/Institucional.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { HEALTH_GOALS, type HealthGoal } from '@/lib/healthGoals'

export default function HealthGoalPicker() {
  const { user, supabase, refreshUser } = useAuth() as any
  const [goal, setGoal] = useState<HealthGoal | null>(null)
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('health_goal, health_goal_detail').eq('id', user.id).single()
      .then(({ data }: any) => {
        if (data) { setGoal(data.health_goal || null); setDetail(data.health_goal_detail || '') }
        setLoading(false)
      })
  }, [user, supabase])

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  if (!isPro) return null

  async function save(g: HealthGoal, d: string) {
    if (!user) return
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({ health_goal: g, health_goal_detail: d || null }).eq('id', user.id)
    await refreshUser?.()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className="skeleton" style={{ height: 140, borderRadius: 10 }} />

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Objetivo de saúde</div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>
        O motivo real de estares aqui — o Phlox adapta planos e funcionalidades a isto, não só ao modo.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: detail !== undefined && goal ? 12 : 0 }}>
        {HEALTH_GOALS.map(g => (
          <button key={g.id} onClick={() => { setGoal(g.id); save(g.id, detail) }}
            style={{ padding: '11px 14px', border: `1.5px solid ${goal === g.id ? g.color : 'var(--border)'}`, borderRadius: 8, background: goal === g.id ? g.color + '14' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>{g.icon}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: goal === g.id ? g.color : 'var(--ink)', marginBottom: 1 }}>{g.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-4)', lineHeight: 1.3 }}>{g.desc}</div>
          </button>
        ))}
      </div>
      {goal === 'manage_chronic' && (
        <input value={detail} onChange={e => setDetail(e.target.value)} onBlur={() => save(goal, detail)}
          placeholder="Qual doença crónica? Ex: Diabetes tipo 2, DPOC, Insuficiência cardíaca…"
          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
      )}
      {goal === 'recover' && (
        <input value={detail} onChange={e => setDetail(e.target.value)} onBlur={() => save(goal, detail)}
          placeholder="Que evento? Ex: Cirurgia à anca, internamento por pneumonia…"
          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
      )}
      {saving && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8 }}>A guardar…</div>}
      {saved && <div style={{ fontSize: 11, color: '#0d6e42', marginTop: 8, fontWeight: 700 }}>✓ Guardado</div>}
      {goal === 'lose_weight' && !saving && (
        <Link href="/plano-peso" style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#0d9488', textDecoration: 'none' }}>Abrir o teu plano de perda de peso →</Link>
      )}
      {goal === 'manage_chronic' && !saving && (
        <Link href="/minha-condicao" style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>Abrir o painel da tua condição →</Link>
      )}
      {goal === 'recover' && !saving && (
        <Link href="/plano-recuperacao" style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>Abrir o teu plano de recuperação →</Link>
      )}
      {goal === 'wellness' && !saving && (
        <Link href="/relatorio" style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#0d6e42', textDecoration: 'none' }}>Abrir o teu check-in geral →</Link>
      )}
    </div>
  )
}
