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

interface OrgRow {
  id: string; name: string; kind: string; created_at: string
  member_count: number; owner_email: string | null; owner_name: string | null
}

interface Revenue {
  configured: boolean; mrr_total: number; subscriber_count: number
  by_plan: Record<string, { subscribers: number; mrr: number }>
  error?: string
}

interface CostRow { id: string; label: string; amount_monthly: number; note: string | null }
interface Costs {
  twilio: { configured: boolean; spend_month: number; currency: string }
  fixed_costs: CostRow[]; fixed_total: number; total_estimated: number
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
  const [tab, setTab] = useState<'overview' | 'users' | 'instituicoes' | 'financeiro' | 'searches' | 'ia'>('overview')
  const [aiUsage, setAiUsage] = useState<{ month: string; free_tier: { key: string; count: number }[]; pro_tier: { key: string; count: number }[]; total_calls: number } | null>(null)
  const [aiUsageLoading, setAiUsageLoading] = useState(false)

  const [orgs, setOrgs] = useState<OrgRow[] | null>(null)
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [accessEmail, setAccessEmail] = useState('')
  const [accessMsg, setAccessMsg] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgKind, setNewOrgKind] = useState<'nursing_home' | 'day_care'>('nursing_home')

  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [costs, setCosts] = useState<Costs | null>(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [costLabel, setCostLabel] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costNote, setCostNote] = useState('')
  const [costBusy, setCostBusy] = useState(false)

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

  const loadAiUsage = async () => {
    if (!isAdmin) return
    setAiUsageLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/ai-usage', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
      const j = await res.json()
      if (res.ok) setAiUsage(j)
    } catch (e) { console.error(e) }
    setAiUsageLoading(false)
  }

  useEffect(() => { if (tab === 'ia' && !aiUsage) loadAiUsage() }, [tab])

  const authHeader = async () => {
    const { data: sd } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${sd?.session?.access_token || ''}` }
  }

  const loadOrgs = async () => {
    setOrgsLoading(true)
    try {
      const res = await fetch('/api/admin/organizations', { headers: await authHeader() })
      const j = await res.json()
      if (res.ok) setOrgs(j.organizations)
    } catch (e) { console.error(e) }
    setOrgsLoading(false)
  }
  useEffect(() => { if (tab === 'instituicoes' && !orgs) loadOrgs() }, [tab])

  const approveAccess = async () => {
    if (!accessEmail.trim() || accessBusy) return
    setAccessBusy(true); setAccessMsg('')
    try {
      const res = await fetch('/api/admin/institution-approve', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ email: accessEmail.trim() }) })
      const j = await res.json()
      setAccessMsg(res.ok ? `✓ Acesso aprovado para ${j.profile.email}. Já pode entrar em /comecar-instituicao.` : (j.error || 'Erro.'))
    } catch (e: any) { setAccessMsg(e.message || 'Erro.') }
    setAccessBusy(false)
  }

  const createInstitution = async () => {
    if (!accessEmail.trim() || !newOrgName.trim() || accessBusy) return
    setAccessBusy(true); setAccessMsg('')
    try {
      const res = await fetch('/api/admin/institution-create', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ email: accessEmail.trim(), name: newOrgName.trim(), kind: newOrgKind }) })
      const j = await res.json()
      if (res.ok) { setAccessMsg(`✓ Instituição "${newOrgName.trim()}" criada e ligada a ${accessEmail.trim()}.`); setNewOrgName(''); loadOrgs() }
      else setAccessMsg(j.error || 'Erro.')
    } catch (e: any) { setAccessMsg(e.message || 'Erro.') }
    setAccessBusy(false)
  }

  const loadFinance = async () => {
    setFinanceLoading(true)
    try {
      const headers = await authHeader()
      const [revRes, costRes] = await Promise.all([
        fetch('/api/admin/revenue', { headers }), fetch('/api/admin/costs', { headers }),
      ])
      const [revJ, costJ] = await Promise.all([revRes.json(), costRes.json()])
      if (revRes.ok) setRevenue(revJ)
      if (costRes.ok) setCosts(costJ)
    } catch (e) { console.error(e) }
    setFinanceLoading(false)
  }
  useEffect(() => { if (tab === 'financeiro' && !revenue) loadFinance() }, [tab])

  const saveCost = async () => {
    if (!costLabel.trim() || !costAmount || costBusy) return
    setCostBusy(true)
    try {
      const res = await fetch('/api/admin/costs', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action: 'upsert', label: costLabel.trim(), amount_monthly: parseFloat(costAmount), note: costNote.trim() || null }) })
      if (res.ok) { setCostLabel(''); setCostAmount(''); setCostNote(''); loadFinance() }
    } catch (e) { console.error(e) }
    setCostBusy(false)
  }

  const deleteCost = async (id: string) => {
    try {
      await fetch('/api/admin/costs', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action: 'delete', id }) })
      loadFinance()
    } catch (e) { console.error(e) }
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
            {(['overview', 'users', 'instituicoes', 'financeiro', 'searches', 'ia'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 12px', background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: tab === t ? 'white' : 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                {t === 'overview' ? 'Overview' : t === 'users' ? 'Utilizadores' : t === 'instituicoes' ? 'Instituições' : t === 'financeiro' ? 'Financeiro' : t === 'searches' ? 'Pesquisas' : 'IA'}
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

        {/* ── INSTITUIÇÕES ──────────────────────────────────── */}
        {tab === 'instituicoes' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Dar acesso a uma instituição</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18, maxWidth: 560 }}>
              A pessoa precisa de ter conta grátis primeiro. Aprovas o acesso (para ela criar a instituição em /comecar-instituicao), ou crias já a instituição por ela.
            </p>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24, maxWidth: 480 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email da pessoa</label>
              <input value={accessEmail} onChange={e => setAccessEmail(e.target.value)} placeholder="dono@lar-exemplo.pt"
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 14 }} />

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={approveAccess} disabled={accessBusy || !accessEmail.trim()}
                  style={{ flex: 1, padding: '10px', background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', cursor: accessBusy ? 'wait' : 'pointer' }}>
                  Só aprovar acesso
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ou criar já a instituição</label>
                <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Nome da instituição"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {([['nursing_home', 'Lar / ERPI'], ['day_care', 'Centro de Dia']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setNewOrgKind(id)}
                      style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${newOrgKind === id ? 'var(--green)' : 'var(--border)'}`, background: newOrgKind === id ? '#f0fdf5' : 'white', color: newOrgKind === id ? 'var(--green)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={createInstitution} disabled={accessBusy || !accessEmail.trim() || !newOrgName.trim()}
                  style={{ width: '100%', padding: '11px', background: 'var(--green)', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, color: 'white', cursor: accessBusy ? 'wait' : 'pointer' }}>
                  {accessBusy ? 'A processar…' : 'Criar instituição e dar acesso'}
                </button>
              </div>
              {accessMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: accessMsg.startsWith('✓') ? '#15803d' : '#dc2626' }}>{accessMsg}</div>}
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.01em' }}>Instituições existentes {orgs ? `(${orgs.length})` : ''}</h2>
            {orgsLoading && <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>A carregar…</div>}
            {orgs && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 150px', padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Instituição', 'Tipo', 'Equipa', 'Dono'].map(h => <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>)}
                </div>
                {orgs.length === 0 && <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Ainda sem instituições.</div>}
                {orgs.map((o, i) => (
                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 150px', padding: '12px 16px', borderBottom: i < orgs.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{o.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{o.kind === 'nursing_home' ? 'Lar / ERPI' : o.kind === 'day_care' ? 'Centro de Dia' : o.kind}</div>
                    <div style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{o.member_count}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.owner_email || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FINANCEIRO ────────────────────────────────────── */}
        {tab === 'financeiro' && (
          <div>
            {financeLoading && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>A carregar…</div>}

            {revenue && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Receita — real, do Stripe</div>
                {!revenue.configured ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>STRIPE_SECRET_KEY não está configurada — sem dados de receita real.</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>MRR real</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--green)', letterSpacing: '-0.02em' }}>{revenue.mrr_total.toFixed(2)}€</div>
                      </div>
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Subscrições ativas</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{revenue.subscriber_count}</div>
                      </div>
                    </div>
                    {Object.keys(revenue.by_plan).length > 0 && (
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px' }}>
                        {Object.entries(revenue.by_plan).map(([plan, v]) => (
                          <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bg-3)' }}>
                            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{plan} · {v.subscribers} assinante{v.subscribers !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{v.mrr.toFixed(2)}€/mês</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {costs && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Custos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Twilio — real, este mês</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                      {costs.twilio.configured ? `${costs.twilio.spend_month.toFixed(2)}${costs.twilio.currency === 'usd' ? '$' : costs.twilio.currency}` : '—'}
                    </div>
                    {!costs.twilio.configured && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>Não configurado</div>}
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Custos fixos — introduzidos à mão</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{costs.fixed_total.toFixed(2)}€</div>
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  {costs.fixed_costs.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Sem custos fixos registados (hosting, Supabase, domínio…).</div>}
                  {costs.fixed_costs.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < costs.fixed_costs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{c.label}</div>
                        {c.note && <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{c.note}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{Number(c.amount_monthly).toFixed(2)}€/mês</span>
                        <button onClick={() => deleteCost(c.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 12 }}>Remover</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={costLabel} onChange={e => setCostLabel(e.target.value)} placeholder="Ex: Vercel, Supabase Pro, domínio…"
                    style={{ flex: '1 1 200px', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                  <input value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="€/mês" type="number" step="0.01"
                    style={{ width: 100, padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                  <input value={costNote} onChange={e => setCostNote(e.target.value)} placeholder="Nota (opcional)"
                    style={{ flex: '1 1 160px', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                  <button onClick={saveCost} disabled={costBusy || !costLabel.trim() || !costAmount} style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: costBusy ? 'wait' : 'pointer' }}>
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {revenue && costs && revenue.configured && (
              <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '20px 24px', color: 'white' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Margem estimada / mês</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, letterSpacing: '-0.02em' }}>
                  {(revenue.mrr_total - costs.total_estimated).toFixed(2)}€
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {revenue.mrr_total.toFixed(2)}€ receita − {costs.total_estimated.toFixed(2)}€ custos (Twilio real + fixos à mão — IA não incluída, ver separador IA para volume de chamadas)
                </div>
              </div>
            )}
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

        {/* ── IA (visibilidade de custo, sugestão 7 da auditoria) ───────────── */}
        {tab === 'ia' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Uso de IA este mês{aiUsage ? ` · ${aiUsage.month}` : ''}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18 }}>
              Não bloqueia ninguém — é só visibilidade de quanto está a ser usado, antes de doer.
            </div>
            {aiUsageLoading && <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>A carregar…</div>}
            {aiUsage && (
              <>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 20, maxWidth: 260 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Total de chamadas de IA</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{aiUsage.total_calls}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas gratuitas/Plus (com limite diário)</div>
                    {aiUsage.free_tier.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem uso registado.</div> : aiUsage.free_tier.map(({ key, count }, i) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bg-3)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', minWidth: 16 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{key}</span>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Rotas Pro com orçamento próprio</div>
                    {aiUsage.pro_tier.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem uso registado.</div> : aiUsage.pro_tier.map(({ key, count }, i) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bg-3)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', minWidth: 16 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{key}</span>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}