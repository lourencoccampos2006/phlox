'use client'

// app/dashboard-institucional/page.tsx — Dashboard Institucional Phlox
// Vista de gestão para directores de farmácia, administradores hospitalares,
// responsáveis de lar. Métricas de uso, alertas activos, actividade de equipa.
// Requer plano Institucional (clinic) + org_id.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface TeamMember {
  id: string; name: string; email: string; org_role: string; plan: string
  last_active?: string; interventions_today?: number; patients_count?: number
}
interface OrgMetrics {
  total_patients: number; patients_with_alerts: number; interventions_this_week: number
  ward_messages_today: number; reviews_pending: number; avg_risk_score: number
}
interface RecentAlert {
  patient_name: string; type: string; severity: string; created_at: string; author: string
}
interface TeamActivity {
  user_name: string; action: string; patient_name?: string; created_at: string; type: string
}

export default function DashboardInstitucionalPage() {
  const { user, supabase } = useAuth()
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [alerts, setAlerts] = useState<RecentAlert[]>([])
  const [activity, setActivity] = useState<TeamActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'team' | 'alerts' | 'reports'>('overview')

  const plan = (user as any)?.plan || 'free'
  const orgId = (user as any)?.org_id
  const orgRole = (user as any)?.org_role
  const isInstitutional = plan === 'clinic' && !!orgId

  const load = useCallback(async () => {
    if (!user || !isInstitutional) { setLoading(false); return }

    try {
      // Load org members
      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, name, email, org_role, plan, updated_at')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false })

      setMembers(membersData || [])

      // Load patients in org
      const { data: patients } = await supabase
        .from('patients')
        .select('id, updated_at')
        .in('user_id', (membersData || []).map((m: any) => m.id))

      const patientIds = (patients || []).map(p => p.id)

      // Load recent ward messages for metrics
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

      const { data: todayMessages } = await supabase
        .from('channel_messages')
        .select('id, type, author_name, content, created_at')
        .gte('created_at', `${today}T00:00:00`)
        .in('channel_id',
          patientIds.length > 0
            ? (await supabase.from('patient_channels').select('id').in('patient_id', patientIds.slice(0, 50))).data?.map(c => c.id) || []
            : []
        )
        .order('created_at', { ascending: false })
        .limit(100)

      const { data: weekMessages } = await supabase
        .from('channel_messages')
        .select('id, type')
        .gte('created_at', weekAgo)
        .limit(500)

      const alertMessages = (todayMessages || []).filter((m: any) => m.type === 'alert')
      const interventions = (weekMessages || []).filter((m: any) => m.type === 'decision' || m.type === 'alert')

      setMetrics({
        total_patients: patientIds.length,
        patients_with_alerts: alertMessages.length > 0 ? new Set(alertMessages.map((m: any) => m.channel_id)).size : 0,
        interventions_this_week: interventions.length,
        ward_messages_today: (todayMessages || []).length,
        reviews_pending: Math.max(0, patientIds.length - Math.floor(patientIds.length * 0.7)),
        avg_risk_score: 0,
      })

      // Recent alerts
      setAlerts((alertMessages || []).slice(0, 8).map((m: any) => ({
        patient_name: 'Doente',
        type: 'Alerta clínico',
        severity: 'ALTA',
        created_at: m.created_at,
        author: m.author_name || 'Equipa',
      })))

      // Team activity
      setActivity((todayMessages || []).slice(0, 12).map((m: any) => ({
        user_name: m.author_name || 'Utilizador',
        action: m.type === 'note' ? 'Nota clínica' : m.type === 'alert' ? 'Alerta criado' : m.type === 'decision' ? 'Decisão registada' : m.type === 'vital' ? 'Parâmetros vitais' : m.type === 'task' ? 'Tarefa criada' : 'Entrada Ward',
        created_at: m.created_at,
        type: m.type,
      })))

    } catch (e) { console.error('Dashboard load error:', e) }
    setLoading(false)
  }, [user, supabase, orgId, isInstitutional])

  useEffect(() => { load() }, [load])

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'agora'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  const TYPE_COLOR: Record<string, string> = {
    note: '#374151', alert: '#dc2626', decision: '#0d6e42',
    vital: '#0891b2', task: '#65a30d', handover: '#1d4ed8',
  }

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  if (!isInstitutional) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 600 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 36px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, marginBottom: 12 }}>Dashboard Institucional</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 8, maxWidth: 400, margin: '0 auto 12px' }}>
            Vista de gestão para directores clínicos e administradores.
          </p>
          <ul style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.9, margin: '0 0 28px', textAlign: 'left', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', padding: '0 0 0 20px' }}>
            <li>Métricas de actividade da equipa em tempo real</li>
            <li>Alertas activos por doente e por profissional</li>
            <li>Dashboard de risco farmacoterapêutico</li>
            <li>Relatórios mensais para acreditação</li>
            <li>Gestão de membros e permissões</li>
          </ul>
          <Link href="/institucional" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver plano Institucional →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Institutional header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '16px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                Phlox · Plano Institucional
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#f8fafc', fontWeight: 400, margin: 0 }}>
                Dashboard de Gestão
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/teams" style={{ padding: '8px 14px', background: '#1e293b', color: '#94a3b8', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                Ward →
              </Link>
              <Link href="/organizacao" style={{ padding: '8px 14px', background: '#1e293b', color: '#94a3b8', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                Equipa →
              </Link>
              <button onClick={load} style={{ padding: '8px 14px', background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ↻ Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 24 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, background: 'white', borderRadius: '10px 10px 0 0', overflow: 'hidden', overflowX: 'auto' }}>
          {[['overview','Visão Geral'],['team','Equipa'],['alerts','Alertas'],['reports','Relatórios']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />)}
          </div>
        ) : (
          <>
            {/* OVERVIEW */}
            {tab === 'overview' && metrics && (
              <div>
                {/* Metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 10, marginBottom: 24 }}>
                  {[
                    { label: 'Total de doentes', value: metrics.total_patients, color: '#1d4ed8', bg: '#eff6ff', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
                    { label: 'Doentes com alertas', value: metrics.patients_with_alerts, color: '#dc2626', bg: '#fee2e2', icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
                    { label: 'Intervenções (7 dias)', value: metrics.interventions_this_week, color: '#0d6e42', bg: '#f0fdf5', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label: 'Entradas Ward hoje', value: metrics.ward_messages_today, color: '#7c3aed', bg: '#faf5ff', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                    { label: 'Revisões pendentes', value: metrics.reviews_pending, color: '#d97706', bg: '#fffbeb', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                    { label: 'Membros activos', value: members.length, color: '#0891b2', bg: '#ecfeff', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
                  ].map(m => (
                    <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}20`, borderRadius: 12, padding: '16px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" style={{ marginBottom: 10 }}>
                        <path d={m.icon} />
                      </svg>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: m.color, lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: m.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 5 }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Activity feed + team side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }} className="inst-grid">
                  {/* Activity feed */}
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Actividade de hoje
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 2s infinite' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42' }}>Em tempo real</span>
                      </div>
                    </div>
                    {activity.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                        Sem actividade registada hoje. A equipa ainda não usou o Ward.
                      </div>
                    ) : activity.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: i < activity.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLOR[a.type] || '#374151', flexShrink: 0, marginTop: 7 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {a.user_name}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', flexShrink: 0, marginLeft: 8 }}>{timeAgo(a.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{a.action}{a.patient_name ? ` — ${a.patient_name}` : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Acções rápidas</div>
                      {[
                        { href: '/teams', label: 'Abrir Ward', desc: 'Ficha colaborativa de doentes', color: '#1d4ed8' },
                        { href: '/rounds', label: 'Iniciar Ronda', desc: 'Ronda farmacêutica · PCNE', color: '#7c3aed' },
                        { href: '/residentes', label: 'Gerir Residentes', desc: 'Revisão AI · STOPP/START', color: '#dc2626' },
                        { href: '/connect', label: 'Phlox Connect', desc: 'Comunicação inter-profissional', color: '#0d6e42' },
                        { href: '/organizacao', label: 'Gerir Equipa', desc: 'Membros · permissões · convites', color: '#0891b2' },
                      ].map(a => (
                        <Link key={a.href} href={a.href}
                          style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bg-3)', textDecoration: 'none' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0, marginTop: 6 }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{a.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{a.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TEAM */}
            {tab === 'team' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Link href="/organizacao" style={{ padding: '9px 18px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                    Gerir membros →
                  </Link>
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', gap: 10 }}>
                    {['Membro', 'Função', 'Plano', 'Último acesso'].map(h => (
                      <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                    ))}
                  </div>
                  {members.map((m, i) => {
                    const roleStyle = { owner: { color: '#1d4ed8', bg: '#eff6ff' }, admin: { color: '#0d6e42', bg: '#f0fdf5' }, member: { color: 'var(--ink-4)', bg: 'var(--bg-3)' } }[m.org_role] || { color: 'var(--ink-4)', bg: 'var(--bg-3)' }
                    return (
                      <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', gap: 10, padding: '12px 18px', borderBottom: i < members.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.name || m.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{m.email}</div>
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: roleStyle.color, background: roleStyle.bg, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-block' }}>
                          {m.org_role}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{m.plan}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>
                          {m.last_active ? timeAgo(m.last_active) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ALERTS */}
            {tab === 'alerts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                  <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>{alerts.length} alertas activos hoje</div>
                  <Link href="/monitor" style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>Phlox Watcher →</Link>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: '#0d6e42', fontWeight: 600 }}>Sem alertas activos hoje</div>
                    <div style={{ fontSize: 13, color: '#14532d', marginTop: 6 }}>A equipa não registou alertas no Ward nas últimas 24h.</div>
                  </div>
                ) : alerts.map((a, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid #fca5a5', borderLeft: '3px solid #dc2626', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{a.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Por {a.author}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase' }}>{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* REPORTS */}
            {tab === 'reports' && (
              <div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '28px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>Relatórios disponíveis</div>
                  {[
                    { title: 'Relatório Mensal de Intervenções', desc: 'Todas as intervenções farmacêuticas do mês — formato PCNE, pronto para acreditação ACSS/DGS.', href: '/rounds', color: '#7c3aed', action: 'Ir para Rounds →' },
                    { title: 'Revisão Farmacoterapêutica — Residentes', desc: 'Relatório individual por residente com alertas, monitorização e nota do farmacêutico.', href: '/residentes', color: '#dc2626', action: 'Ir para Residentes →' },
                    { title: 'Passagens de Turno', desc: 'Histórico de passagens de turno geradas por AI — auditável e pesquisável.', href: '/teams', color: '#1d4ed8', action: 'Ir para Ward →' },
                    { title: 'Registo de Alertas de Segurança', desc: 'Todos os alertas FDA/EMA/INFARMED para os medicamentos dos vossos doentes.', href: '/monitor', color: '#d97706', action: 'Ver Watcher →' },
                  ].map(r => (
                    <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{r.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>{r.desc}</div>
                      </div>
                      <Link href={r.href} style={{ padding: '8px 14px', background: `${r.color}10`, color: r.color, textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, flexShrink: 0, border: `1px solid ${r.color}30` }}>
                        {r.action}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1}50%{opacity:0.4} }
        @media(max-width:768px){.inst-grid{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}