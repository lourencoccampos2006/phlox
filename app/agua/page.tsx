'use client'

// Phlox Água — track diário de hidratação. Simples, com 3 botões grandes
// (200ml / 330ml / 500ml), barra de progresso para 2L diário, gráfico
// semanal de barras. Usa a tabela hydration_logs existente.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

interface Log { id: string; at: string; fluid_ml: number }

const GOAL_KEY = 'phlox-water-goal-ml'

export default function AguaPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState(2000)
  const [editingGoal, setEditingGoal] = useState(false)

  useEffect(() => {
    try { const v = localStorage.getItem(GOAL_KEY); if (v) setGoal(Number(v) || 2000) } catch { /* noop */ }
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await supabase.from('hydration_logs')
      .select('id,at,fluid_ml').eq('user_id', user.id).eq('kind', 'fluid')
      .gte('at', since).order('at', { ascending: false }).limit(100)
    setLogs(data || [])
    setLoading(false)
  }, [user, supabase])
  useEffect(() => { load() }, [load])

  async function add(ml: number) {
    if (!user) return
    const { data, error } = await supabase.from('hydration_logs').insert({ user_id: user.id, kind: 'fluid', fluid_ml: ml, at: new Date().toISOString() }).select().single()
    if (error) toast.error('Não consegui guardar', error.message)
    else if (data) {
      setLogs(p => [data, ...p])
      const todayKey = new Date().toISOString().slice(0, 10)
      const todayTotal = [data, ...logs].filter(l => l.at.slice(0, 10) === todayKey).reduce((s, l) => s + (l.fluid_ml || 0), 0)
      if (todayTotal >= goal) toast.success('Meta atingida! 💧', `${todayTotal} ml hoje. Boa.`)
    }
  }

  async function del(id: string) {
    await supabase.from('hydration_logs').delete().eq('id', id)
    setLogs(p => p.filter(l => l.id !== id))
  }

  function saveGoal() {
    try { localStorage.setItem(GOAL_KEY, String(goal)) } catch { /* noop */ }
    setEditingGoal(false); toast.success('Meta guardada')
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => l.at.slice(0, 10) === today)
  const todayMl = todayLogs.reduce((s, l) => s + (l.fluid_ml || 0), 0)
  const pct = Math.min(100, Math.round((todayMl / goal) * 100))

  // Últimos 7 dias para gráfico
  const days: { key: string; label: string; ml: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    const ml = logs.filter(l => l.at.slice(0, 10) === key).reduce((s, l) => s + (l.fluid_ml || 0), 0)
    days.push({ key, label: d.toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3), ml })
  }
  const maxDayMl = Math.max(goal, ...days.map(d => d.ml))
  const avg = Math.round(days.reduce((s, d) => s + d.ml, 0) / 7)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f9ff 0%, #fafbfc 60%)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 640 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,40px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Hidratação</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Bebe ao longo do dia. Toca para registar — fica no teu histórico.</p>
        </div>

        {/* Hero — barra de progresso grande */}
        <div style={{ background: 'white', borderRadius: 18, padding: '24px 24px 20px', marginBottom: 14, border: '1px solid #e5e7eb', boxShadow: '0 6px 24px -12px rgba(8,12,24,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: '#0c4a6e', lineHeight: 1 }}>{todayMl} <span style={{ fontSize: 18, color: '#64748b' }}>ml</span></div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Hoje · meta {goal} ml</div>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: pct >= 100 ? '#15803d' : '#0284c7' }}>{pct}%</div>
          </div>
          {/* Barra */}
          <div style={{ height: 18, background: '#e0f2fe', borderRadius: 9, overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#0284c7,#0ea5e9,#38bdf8)', borderRadius: 9, transition: 'width 0.5s ease' }} />
          </div>

          {/* Botões grandes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 18 }}>
            {[
              { ml: 200, label: '200 ml', sub: 'copo' },
              { ml: 330, label: '330 ml', sub: 'lata' },
              { ml: 500, label: '500 ml', sub: 'garrafa' },
              { ml: 750, label: '750 ml', sub: 'garrafão' },
            ].map(b => (
              <button key={b.ml} onClick={() => add(b.ml)} style={{
                padding: '14px 6px', background: 'white', border: '1.5px solid #bae6fd', borderRadius: 12,
                cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s',
              }} className="water-btn">
                <div style={{ fontSize: 22, marginBottom: 4 }}>💧</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0c4a6e' }}>{b.label}</div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>{b.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Gráfico semanal */}
        <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', marginBottom: 14, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120' }}>Últimos 7 dias</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Média: <strong style={{ color: '#0b1120' }}>{avg} ml/dia</strong></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'flex-end', height: 120 }}>
            {days.map(d => {
              const h = Math.max(6, Math.round((d.ml / maxDayMl) * 100))
              const reach = d.ml >= goal
              const isToday = d.key === today
              return (
                <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: reach ? '#15803d' : '#475569' }}>{d.ml > 0 ? d.ml : ''}</span>
                  <div style={{ width: '100%', maxWidth: 30, height: `${h}%`, background: reach ? 'linear-gradient(180deg,#22c55e,#16a34a)' : isToday ? 'linear-gradient(180deg,#38bdf8,#0284c7)' : 'linear-gradient(180deg,#bae6fd,#7dd3fc)', borderRadius: 6, transition: 'height 0.4s' }} />
                  <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Meta editável */}
        <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', marginBottom: 14, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#374151' }}>Meta diária pessoal</div>
          {editingGoal ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" min={500} max={5000} step={250} value={goal} onChange={e => setGoal(Number(e.target.value))} style={{ width: 100, border: '1.5px solid #cbd5e1', borderRadius: 7, padding: '7px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <button onClick={saveGoal} style={{ padding: '7px 14px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar</button>
            </div>
          ) : (
            <button onClick={() => setEditingGoal(true)} style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {goal} ml — Mudar
            </button>
          )}
        </div>

        {/* Histórico de hoje */}
        {todayLogs.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>Hoje</div>
            {todayLogs.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#1a202c' }}>💧 {l.fluid_ml} ml</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date(l.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => del(l.id)} aria-label="Remover" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center' }}>
          {loading ? '' : <>Adicionado ao teu <Link href="/dashboard" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>histórico de saúde</Link>.</>}
        </div>
      </div>

      <style>{`.water-btn:hover{ border-color:#0284c7; transform: translateY(-1px); background:#f0f9ff }`}</style>
    </div>
  )
}
