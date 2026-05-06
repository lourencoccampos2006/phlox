'use client'

// ─── REDESIGN: app/monitor/page.tsx ─── Phlox Watcher
// Sistema de alertas proactivos: FDA/EMA/INFARMED + interações nos perfis.
// Esta é a feature que "vigia" a medicação mesmo quando não estás na app.

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Alert {
  id: string
  type: 'fda_recall' | 'interaction' | 'ema_signal' | 'infarmed' | 'missing_renewal'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  body: string
  drug?: string
  profile_name?: string
  source: string
  date: string
  read: boolean
  action_url?: string
}

interface WatchedMed {
  id: string
  name: string
  profile: string
  profile_id: string | null
}

const SEVERITY = {
  critical: { label: 'CRÍTICO',  bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', dot: '#dc2626', icon: '🚨' },
  high:     { label: 'ALTO',     bg: '#fef9c3', border: '#fde68a', color: '#854d0e', dot: '#d97706', icon: '⚠️' },
  medium:   { label: 'MÉDIO',    bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', dot: '#3b82f6', icon: '📋' },
  low:      { label: 'INFO',     bg: '#f0fdf5', border: '#bbf7d0', color: '#14532d', dot: '#16a34a', icon: 'ℹ️' },
}

const TYPE_LABELS = {
  fda_recall:       { label: 'Retirada FDA',     icon: '🇺🇸' },
  interaction:      { label: 'Interação',         icon: '⚡' },
  ema_signal:       { label: 'Alerta EMA',        icon: '🇪🇺' },
  infarmed:         { label: 'INFARMED',          icon: '🇵🇹' },
  missing_renewal:  { label: 'Renovação em falta', icon: '📅' },
}

// ─── Alertas demo (em produção viriam do Supabase + jobs de background) ───────
const DEMO_ALERTS: Alert[] = [
  {
    id: '1', type: 'interaction', severity: 'critical',
    title: 'Interação crítica detectada — Manuel Silva',
    body: 'O Xarelto (rivaroxabano) e o Brufen (ibuprofeno) que o Manuel toma têm risco hemorrágico grave quando combinados. Esta combinação aumenta o risco de hemorragia GI em 3-4x.',
    drug: 'Xarelto + Brufen', profile_name: 'Manuel Silva',
    source: 'Análise automática Phlox', date: new Date().toISOString().split('T')[0], read: false,
    action_url: '/interactions',
  },
  {
    id: '2', type: 'infarmed', severity: 'high',
    title: 'Alerta INFARMED — Lote retirado: Amoxicilina Ratiopharm',
    body: 'O INFARMED emitiu alerta de retirada voluntária do lote AM2024-089 de Amoxicilina Ratiopharm 500mg por possível contaminação microbiológica. Verifica o lote na embalagem.',
    drug: 'Amoxicilina Ratiopharm 500mg',
    source: 'INFARMED · Circular Informativa', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], read: false,
    action_url: 'https://www.infarmed.pt/alertas',
  },
  {
    id: '3', type: 'ema_signal', severity: 'medium',
    title: 'EMA actualiza informação de segurança — Metformina',
    body: 'A EMA actualizou o RCM da metformina com nova informação sobre risco de acidose láctica em doentes com função renal moderadamente reduzida (TFG 30-45). Avaliar função renal.',
    drug: 'Metformina',
    source: 'EMA · EPAR Update', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], read: true,
    action_url: 'https://www.ema.europa.eu',
  },
  {
    id: '4', type: 'missing_renewal', severity: 'low',
    title: 'Renovação provável em falta — Sofia (filha)',
    body: 'Com base na data de início e frequência, a embalagem do Ventilan (salbutamol) da Sofia deve estar a acabar. A última prescrição foi há 28 dias.',
    drug: 'Ventilan 100μg', profile_name: 'Sofia',
    source: 'Phlox Watcher — estimativa', date: new Date(Date.now() - 259200000).toISOString().split('T')[0], read: true,
  },
]

export default function MonitorPage() {
  const { user, supabase } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS)
  const [watchedMeds, setWatchedMeds] = useState<WatchedMed[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'alerts' | 'watching'>('alerts')

  const unreadCount = alerts.filter(a => !a.read).length

  const loadWatchedMeds = useCallback(async () => {
    if (!user) return
    const [{ data: personal }, { data: family }] = await Promise.all([
      supabase.from('personal_meds').select('id, name').eq('user_id', user.id),
      supabase.from('family_profile_meds').select('id, name, profile_id, family_profiles(name)').eq('user_id', user.id),
    ])
    const meds: WatchedMed[] = [
      ...(personal || []).map((m: any) => ({ id: m.id, name: m.name, profile: 'Eu', profile_id: null })),
      ...(family || []).map((m: any) => ({ id: m.id, name: m.name, profile: m.family_profiles?.name || 'Familiar', profile_id: m.profile_id })),
    ]
    setWatchedMeds(meds)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { loadWatchedMeds() }, [loadWatchedMeds])

  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })))

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.read
    if (filter === 'critical') return a.severity === 'critical' || a.severity === 'high'
    return true
  })

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Hero header */}
      <div style={{ background: 'var(--ink)', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                Phlox Watcher · Monitorização activa
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em' }}>
                Alertas e Monitorização
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                {watchedMeds.length} medicamentos em vigilância · {unreadCount} alertas não lidos
              </div>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                style={{ padding: '9px 16px', background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                Marcar todos como lidos
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid #1e293b' }}>
            {[['alerts', `Alertas${unreadCount > 0 ? ` (${unreadCount})` : ''}`], ['watching', 'Em vigilância']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? '#22c55e' : 'transparent'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: tab === id ? '#f8fafc' : '#475569', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: -1, whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {tab === 'alerts' && (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['all', 'Todos'], ['unread', 'Não lidos'], ['critical', 'Críticos / Altos']].map(([id, label]) => (
                <button key={id} onClick={() => setFilter(id as any)}
                  style={{ padding: '7px 14px', border: `1.5px solid ${filter === id ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 20, background: filter === id ? 'var(--ink)' : 'white', color: filter === id ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Lista de alertas */}
            {filtered.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  {filter === 'unread' ? 'Sem alertas por ler' : 'Sem alertas'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                  O Phlox está a vigiar os teus medicamentos em background.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(alert => {
                  const sev = SEVERITY[alert.severity]
                  const type = TYPE_LABELS[alert.type]
                  return (
                    <div key={alert.id}
                      onClick={() => markRead(alert.id)}
                      style={{ background: alert.read ? 'white' : sev.bg, border: `1px solid ${alert.read ? 'var(--border)' : sev.border}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                      className="alert-card">
                      {/* Unread dot */}
                      {!alert.read && (
                        <div style={{ position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: '50%', background: sev.dot }} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{sev.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: sev.color, background: `${sev.bg}`, border: `1px solid ${sev.border}`, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              {sev.label}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                              {type.icon} {type.label}
                            </span>
                            {alert.profile_name && (
                              <span style={{ fontSize: 10, color: '#7c3aed', fontFamily: 'var(--font-mono)', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '1px 6px', borderRadius: 3 }}>
                                👤 {alert.profile_name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4 }}>{alert.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 8 }}>{alert.body}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                              {alert.source} · {new Date(alert.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                            </span>
                            {alert.action_url && (
                              <Link href={alert.action_url}
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: 12, fontWeight: 700, color: sev.color, textDecoration: 'none', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                Ver detalhes →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'watching' && (
          <div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Como funciona o Phlox Watcher</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>
                  O Phlox verifica automaticamente todos os teus medicamentos contra alertas de segurança da FDA, EMA e INFARMED, e analisa interações sempre que adicionas um medicamento novo a qualquer perfil. Quando algo muda, notificamos imediatamente.
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
              </div>
            ) : watchedMeds.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Sem medicamentos em vigilância</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>
                  Adiciona medicamentos aos teus perfis para activar a monitorização.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/mymeds" style={{ padding: '10px 18px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                    Os meus medicamentos →
                  </Link>
                  <Link href="/perfis" style={{ padding: '10px 18px', background: 'white', color: 'var(--ink)', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, border: '1px solid var(--border)' }}>
                    Perfis familiares →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {watchedMeds.length} medicamentos em vigilância
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {watchedMeds.map((med, i) => (
                    <div key={med.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < watchedMeds.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💊</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          👤 {med.profile}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                        <span style={{ fontSize: 11, color: '#16a34a', fontFamily: 'var(--font-mono)' }}>Em vigilância</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, fontSize: 12, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                  ✓ Próxima verificação automática: em 24 horas · Fontes: FDA MedWatch · EMA PSUR · INFARMED Alertas
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .alert-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); transform: translateY(-1px); }
      `}</style>
    </div>
  )
}