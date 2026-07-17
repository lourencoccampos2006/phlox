'use client'

// /minha-condicao — Painel da Minha Condição (Pro, ligado ao Objetivo de
// Saúde "manage_chronic"). Compositional, sem IA nova: junta medicação,
// vitais recentes, sintomas recentes e o Índice de Risco Contínuo já
// existentes num só ecrã à volta da doença crónica nomeada — em vez de a
// pessoa ter de ir a /mymeds, /vitals, /sintomas e /timeline separadamente.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { goalMeta } from '@/lib/healthGoals'
import RiskIndexCard from '@/components/RiskIndexCard'

const ACCENT = '#1d4ed8'
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

interface Med { name: string; dose?: string; frequency?: string }
interface Vital { recorded_at: string; bp_sys?: number | null; bp_dia?: number | null; hr?: number | null; glucose?: number | null; weight?: number | null }
interface SymptomLog { at: string; feeling?: number | null; symptoms?: string[] | null; pain?: number | null; notes?: string | null }

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

export default function MinhaCondicaoPage() {
  const { user, supabase } = useAuth() as any
  const [goal, setGoal] = useState<string | null | undefined>(undefined)
  const [detail, setDetail] = useState('')
  const [meds, setMeds] = useState<Med[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [symptoms, setSymptoms] = useState<SymptomLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: prof }, { data: personalMeds }, { data: vitalRows }, sd] = await Promise.all([
      supabase.from('profiles').select('health_goal, health_goal_detail').eq('id', user.id).maybeSingle(),
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id),
      supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, glucose, weight').eq('user_id', user.id).is('profile_id', null).order('recorded_at', { ascending: false }).limit(5),
      supabase.auth.getSession(),
    ])
    setGoal(prof?.health_goal ?? null)
    setDetail(prof?.health_goal_detail || '')
    setMeds(personalMeds || [])
    setVitals(vitalRows || [])
    try {
      const res = await fetch('/api/sintomas', { headers: { Authorization: `Bearer ${sd?.data?.session?.access_token || ''}` } })
      if (res.ok) { const j = await res.json(); setSymptoms((j.logs || []).slice(0, 5)) }
    } catch { /* degrada — secção fica vazia */ }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  if (goal !== undefined && goal !== 'manage_chronic') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>🩺</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 10 }}>Painel da Minha Condição</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 8 }}>Esta ferramenta é para quem tem "Gerir uma doença crónica" como Objetivo de Saúde.</p>
        {goal && <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>O teu objetivo atual é <strong>{goalMeta(goal)?.label}</strong>.</p>}
        <Link href="/settings" style={{ background: ACCENT, color: 'white', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Mudar o meu objetivo →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #1e3a8a)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Objetivo · Gerir uma doença crónica</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>{detail || 'A minha condição'}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Medicação, vitais e sintomas — tudo o que importa para acompanhar isto, num só ecrã.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!detail && (
          <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div style={{ fontSize: 13, color: '#1e3a8a' }}>Ainda não indicaste o nome da condição. <Link href="/settings" style={{ color: ACCENT, fontWeight: 700 }}>Adicionar em Definições →</Link></div>
          </div>
        )}

        <RiskIndexCard title="Índice de Risco" />

        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        ) : (
          <>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>💊 Medicação ({meds.length})</div>
                <Link href="/mymeds" style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Gerir →</Link>
              </div>
              {meds.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem medicação registada ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {meds.map((m, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {m.name}{m.dose ? ` — ${m.dose}` : ''}{m.frequency ? ` (${m.frequency})` : ''}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>📈 Sinais vitais recentes</div>
                <Link href="/vitals" style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Registar/ver tudo →</Link>
              </div>
              {vitals.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem registos ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {vitals.map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--ink-4)', minWidth: 70 }}>{timeAgo(v.recorded_at)}</span>
                      {v.bp_sys != null && <span>🩸 {v.bp_sys}/{v.bp_dia ?? '—'}</span>}
                      {v.hr != null && <span>💓 {v.hr} bpm</span>}
                      {v.glucose != null && <span>🩹 {v.glucose} mg/dL</span>}
                      {v.weight != null && <span>⚖️ {v.weight} kg</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>📝 Sintomas recentes</div>
                <Link href="/sintomas" style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Registar/ver tudo →</Link>
              </div>
              {symptoms.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem registos ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {symptoms.map((s, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      <span style={{ color: 'var(--ink-4)' }}>{timeAgo(s.at)}: </span>
                      {s.symptoms?.length ? s.symptoms.join(', ') : 'sem sintomas descritos'}
                      {s.pain != null && ` · dor ${s.pain}/10`}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link href={`/ai?q=${encodeURIComponent(`Tenho ${detail || 'uma doença crónica'} — o que devo saber para a gerir melhor com a minha medicação atual?`)}`}
              style={{ display: 'block', textAlign: 'center', padding: '13px 24px', background: ACCENT, color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              💬 Perguntar ao Phlox sobre a minha condição
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
