'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_users: number
  users_free: number
  users_student: number
  users_pro: number
  total_searches: number
  searches_today: number
  searches_week: number
  top_drugs: { name: string; count: number }[]
  top_interactions: { query: string; count: number; severity: string }[]
  countries: { code: string; count: number }[]
  conversions_this_month: number
  mrr_estimate: number
}

interface RecentUser {
  id: string
  email: string
  name: string
  plan: string
  created_at: string
  searches_count?: number
}

// Admin emails — only these can access
const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']

const PLAN_COLOR: Record<string, string> = {
  free: 'var(--ink-4)', student: '#7c3aed', pro: '#1e40af', clinic: '#065f46',
}

export default function AdminPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<RecentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'users' | 'searches'>('overview')

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

  useEffect(() => {
    if (!user) return
    if (!isAdmin) { router.push('/'); return }
    loadData()
  }, [user, isAdmin])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, searchesRes, analyticsRes] = await Promise.allSettled([
        supabase.from('profiles').select('id, email, name, plan, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('search_history').select('query, type, result_severity, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('analytics_events').select('event_type, drug_names, result_severity, country_code, created_at').order('created_at', { ascending: false }).limit(1000),
      ])

      const usersData = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : []
      const searchesData = searchesRes.status === 'fulfilled' ? (searchesRes.value.data || []) : []
      const analyticsData = analyticsRes.status === 'fulfilled' ? (analyticsRes.value.data || []) : []

      // Compute stats
      const today = new Date(); today.setHours(0,0,0,0)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const planCounts = usersData.reduce((acc: any, u: any) => {
        acc[u.plan || 'free'] = (acc[u.plan || 'free'] || 0) + 1; return acc
      }, {})

      const newThisMonth = usersData.filter((u: any) => new Date(u.created_at) > monthAgo)
      const conversions = newThisMonth.filter((u: any) => u.plan !== 'free').length

      // Top drugs from analytics
      const drugCounts: Record<string, number> = {}
      analyticsData.forEach((e: any) => {
        (e.drug_names || []).forEach((d: string) => { drugCounts[d] = (drugCounts[d] || 0) + 1 })
      })
      const topDrugs = Object.entries(drugCounts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name, count]) => ({ name, count }))

      // Countries
      const countryCounts: Record<string, number> = {}
      analyticsData.forEach((e: any) => { if (e.country_code) countryCounts[e.country_code] = (countryCounts[e.country_code] || 0) + 1 })
      const countries = Object.entries(countryCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([code, count]) => ({ code, count }))

      setStats({
        total_users: usersData.length,
        users_free: planCounts.free || 0,
        users_student: planCounts.student || 0,
        users_pro: (planCounts.pro || 0) + (planCounts.clinic || 0),
        total_searches: searchesData.length,
        searches_today: searchesData.filter((s: any) => new Date(s.created_at) > today).length,
        searches_week: searchesData.filter((s: any) => new Date(s.created_at) > weekAgo).length,
        top_drugs: topDrugs,
        top_interactions: [],
        countries,
        conversions_this_month: conversions,
        mrr_estimate: (planCounts.student || 0) * 3.99 + ((planCounts.pro || 0) + (planCounts.clinic || 0)) * 12.99,
      })
      setUsers(usersData as RecentUser[])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const upgradeUser = async (userId: string, plan: string) => {
    await supabase.from('profiles').update({ plan }).eq('id', userId)
    setUsers(p => p.map(u => u.id === userId ? { ...u, plan } : u))
    if (stats) setStats({ ...stats })
  }

  if (!user || !isAdmin) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>Acesso restrito.</div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '0' }}>
        <div className="page-container" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'white', textDecoration: 'none', letterSpacing: '-0.03em' }}>Phlox</Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>ADMIN</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['overview', 'users', 'searches'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 12px', background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: tab === t ? 'white' : 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                {t === 'overview' ? 'Overview' : t === 'users' ? 'Utilizadores' : 'Pesquisas'}
              </button>
            ))}
            <button onClick={loadData} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>↻ Refresh</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* ── OVERVIEW ──────────────────────────────────────── */}
        {tab === 'overview' && stats && (
          <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'MRR estimado', value: `${stats.mrr_estimate.toFixed(0)}€`, sub: 'receita mensal recorrente', color: 'var(--green)' },
                { label: 'Utilizadores totais', value: stats.total_users, sub: `+${stats.users_student + stats.users_pro} pagantes`, color: 'var(--ink)' },
                { label: 'Pesquisas esta semana', value: stats.searches_week, sub: `${stats.searches_today} hoje`, color: 'var(--ink)' },
                { label: 'Conversões este mês', value: stats.conversions_this_month, sub: 'novos pagantes', color: '#7c3aed' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color, letterSpacing: '-0.02em', marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Plan breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Distribuição de planos</div>
                {[
                  { plan: 'free', n: stats.users_free, color: 'var(--ink-4)' },
                  { plan: 'student', n: stats.users_student, color: '#7c3aed' },
                  { plan: 'pro/clinic', n: stats.users_pro, color: '#1e40af' },
                ].map(({ plan, n, color }) => {
                  const pct = stats.total_users > 0 ? Math.round((n / stats.total_users) * 100) : 0
                  return (
                    <div key={plan} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{plan}</span>
                        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color }}>{n} ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Top drugs */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Medicamentos mais pesquisados</div>
                {stats.top_drugs.slice(0, 8).map(({ name, count }, i) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bg-3)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', minWidth: 16 }}>{i+1}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Countries */}
            {stats.countries.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Tráfego por país</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats.countries.map(({ code, count }) => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20 }}>
                      <span style={{ fontSize: 13 }}>{code}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────── */}
        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Utilizadores ({users.length})</h2>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                {users.filter(u => u.plan !== 'free').length} pagantes · {users.filter(u => u.plan === 'free').length} free
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 140px', padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                {['Utilizador', 'Plano', 'Registado', 'Acção'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {users.map((u, i) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 140px', padding: '12px 16px', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{u.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: PLAN_COLOR[u.plan || 'free'], background: (u.plan || 'free') === 'free' ? 'var(--bg-3)' : (u.plan === 'student' ? '#ede9fe' : '#dbeafe'), padding: '2px 8px', borderRadius: 10, letterSpacing: '0.04em' }}>
                      {(u.plan || 'free').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(u.created_at).toLocaleDateString('pt-PT')}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['free', 'student', 'pro'].filter(p => p !== (u.plan || 'free')).map(p => (
                      <button key={p} onClick={() => upgradeUser(u.id, p)}
                        style={{ padding: '4px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', transition: 'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--green)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                        → {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCHES ──────────────────────────────────────── */}
        {tab === 'searches' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.01em' }}>Pesquisas recentes</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>
              Útil para perceber o que os utilizadores procuram e melhorar a plataforma.
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                {['Pesquisa', 'Tipo', 'Resultado'].map(h => <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>)}
              </div>
              <p style={{ padding: '20px', fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>
                As pesquisas são carregadas da tabela <code>search_history</code> no Supabase. Abre o painel de utilizadores para ver por utilizador.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}