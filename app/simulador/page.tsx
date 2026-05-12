'use client'

// app/simulador/page.tsx — Phlox Simulador Clínico
// Substitui: /shift (Turno Virtual) + /cases (Casos Clínicos) + /decisao (Phlox Decisão)
// Três modos de simulação, uma ferramenta coerente.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

type SimMode = 'case' | 'shift' | 'decision'

const MODES: { id: SimMode; title: string; sub: string; desc: string; color: string; badge?: string }[] = [
  {
    id: 'case',
    title: 'Caso Clínico',
    sub: 'Questão única · resposta guiada',
    desc: 'Um caso gerado por AI com 4 opções, timer e feedback detalhado. Usa XP da Arena. Ideal para estudo rápido em qualquer área.',
    color: '#7c3aed',
  },
  {
    id: 'shift',
    title: 'Turno Virtual',
    sub: 'Múltiplos doentes · score global',
    desc: 'Um turno completo com 3-5 doentes numa especialidade. Tomas decisões sobre cada doente e no final recebes um score global por turno.',
    color: '#1d4ed8',
  },
  {
    id: 'decision',
    title: 'Caso Evolutivo',
    sub: 'O doente evolui com as tuas decisões',
    desc: 'O caso clínico mais exigente. O doente piora ou melhora conforme decides. Consequências fisiológicas simuladas. Feedback de especialista no final.',
    color: '#0d6e42',
    badge: 'Exclusivo',
  },
]

const DOMAINS = [
  { id: 'all',              label: 'Todas as áreas'     },
  { id: 'farmacologia',     label: 'Farmacologia'        },
  { id: 'medicina_interna', label: 'Medicina Interna'    },
  { id: 'emergencia',       label: 'Urgência'            },
  { id: 'cirurgia',         label: 'Cirurgia'            },
  { id: 'pediatria',        label: 'Pediatria'           },
  { id: 'enfermagem',       label: 'Enfermagem'          },
  { id: 'nutricao',         label: 'Nutrição Clínica'    },
  { id: 'psiquiatria',      label: 'Psiquiatria'         },
]

const DIFFICULTIES = [
  { id: 'all',         label: 'Todas'        },
  { id: 'facil',       label: 'Fácil'        },
  { id: 'medio',       label: 'Médio'        },
  { id: 'dificil',     label: 'Difícil'      },
  { id: 'especialista',label: 'Especialista' },
]

export default function SimuladorPage() {
  const { user, supabase } = useAuth()
  const [mode, setMode] = useState<SimMode>('case')
  const [domain, setDomain] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const plan = (user as any)?.plan || 'free'
  const canPlay = plan !== 'free'

  const selectedMode = MODES.find(m => m.id === mode)!

  const start = async () => {
    if (!canPlay) return
    setGenerating(true)
    setError('')

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const selectedDomain = domain === 'all'
        ? DOMAINS[Math.floor(Math.random() * (DOMAINS.length - 1)) + 1].id
        : domain
      const selectedDiff = difficulty === 'all'
        ? ['facil', 'medio', 'dificil'][Math.floor(Math.random() * 3)]
        : difficulty

      if (mode === 'case') {
        // Redirige para arena com caso gerado
        const res = await fetch('/api/arena/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ domain: selectedDomain, difficulty: selectedDiff }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        // Store in session storage for arena to pick up
        sessionStorage.setItem('phlox_arena_autostart', JSON.stringify(data))
        window.location.href = '/arena'
        return
      }

      if (mode === 'shift') {
        sessionStorage.setItem('phlox_shift_config', JSON.stringify({ domain: selectedDomain, difficulty: selectedDiff }))
        window.location.href = '/shift'
        return
      }

      if (mode === 'decision') {
        sessionStorage.setItem('phlox_decisao_config', JSON.stringify({ domain: selectedDomain, difficulty: selectedDiff }))
        window.location.href = '/decisao'
        return
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao iniciar. Tenta novamente.')
      setGenerating(false)
    }
  }

  if (!canPlay) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 480 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12 }}>Simulador Clínico</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>Casos clínicos · Turno virtual · Casos evolutivos. Disponível no plano Student.</p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Ver plano Student →</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Simulação · Student</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10 }}>Simulador Clínico</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.65 }}>Escolhe o modo, a área e o nível. O resto é contigo.</p>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', background: mode === m.id ? `${m.color}06` : 'white', border: `1.5px solid ${mode === m.id ? m.color : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: mode === m.id ? m.color : 'var(--ink)', letterSpacing: '-0.01em' }}>{m.title}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: mode === m.id ? m.color : 'var(--ink-5)', opacity: 0.8 }}>{m.sub}</span>
                  {m.badge && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}30`, padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.badge}</span>}
                </div>
                <div style={{ fontSize: 13, color: mode === m.id ? m.color : 'var(--ink-4)', lineHeight: 1.5, opacity: mode === m.id ? 0.9 : 1 }}>{m.desc}</div>
              </div>
              {mode === m.id && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 5 }}><path d="M20 6L9 17l-5-5"/></svg>
              )}
            </button>
          ))}
        </div>

        {/* Domain + Difficulty */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Área clínica</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {DOMAINS.map(d => (
                <button key={d.id} onClick={() => setDomain(d.id)}
                  style={{ padding: '5px 12px', border: `1.5px solid ${domain === d.id ? selectedMode.color : 'var(--border)'}`, borderRadius: 20, background: domain === d.id ? `${selectedMode.color}10` : 'white', color: domain === d.id ? selectedMode.color : 'var(--ink-4)', fontSize: 12, fontWeight: domain === d.id ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.1s' }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Nível de dificuldade</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {DIFFICULTIES.map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)}
                  style={{ padding: '5px 12px', border: `1.5px solid ${difficulty === d.id ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 20, background: difficulty === d.id ? 'var(--ink)' : 'white', color: difficulty === d.id ? 'white' : 'var(--ink-4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.1s' }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>{error}</div>
        )}

        <button onClick={start} disabled={generating}
          style={{ width: '100%', padding: '16px', background: generating ? 'var(--bg-3)' : selectedMode.color, color: generating ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'opacity 0.15s' }}>
          {generating ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              A preparar caso...
            </>
          ) : (
            <>
              Iniciar {selectedMode.title}
              {domain !== 'all' && ` — ${DOMAINS.find(d => d.id === domain)?.label}`}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </>
          )}
        </button>

        <div style={{ marginTop: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>
          Casos gerados por AI em tempo real · Baseados em guidelines clínicas
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}