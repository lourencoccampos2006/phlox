'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ReferralSection from '@/components/ReferralSection'

type Tab = 'overview' | 'meds' | 'history' | 'account'

interface Med { id: string; name: string; dose?: string; frequency?: string; created_at: string }
interface HistItem { id: string; type: string; query: string; result_severity?: string; created_at: string }

const SEV_COLOR: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  GRAVE:        { dot: '#dc2626', label: 'Grave',        bg: '#fef2f2', text: '#7f1d1d' },
  MODERADA:     { dot: '#f59e0b', label: 'Moderada',     bg: '#fffbeb', text: '#78350f' },
  LIGEIRA:      { dot: '#3b82f6', label: 'Ligeira',      bg: '#eff6ff', text: '#1e3a5f' },
  SEM_INTERACAO:{ dot: '#22c55e', label: 'Sem interação', bg: '#f0fdf4', text: '#14532d' },
}

const PLAN_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:    { label: 'Gratuito', color: 'var(--ink-3)',  bg: 'var(--bg-3)', border: 'var(--border)' },
  student: { label: 'Student',  color: '#7c3aed', bg: '#faf5ff',  border: '#e9d5ff' },
  pro:     { label: 'Pro',      color: '#1d4ed8', bg: '#eff6ff',  border: '#bfdbfe' },
  clinic:  { label: 'Clinic',   color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
}

const QUICK_TOOLS = [
  { href: '/labs',       label: 'Análises Clínicas',    plan: null },
  { href: '/interactions',label: 'Verificador de Interações', plan: null },
  { href: '/ai',         label: 'Phlox AI',             plan: 'student' },
  { href: '/nursing',    label: 'IV · SC · IM',         plan: null },
  { href: '/strategy',   label: 'Estratégias',          plan: 'pro' },
  { href: '/med-review', label: 'Revisão de Medicação', plan: 'pro' },
]

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '20px 22px', background: 'white',
      border: '1px solid var(--border)', borderRadius: 10,
      textAlign: 'left', cursor: 'pointer', width: '100%',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }} className="stat-card">
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--green)', marginBottom: 4, lineHeight: 1, fontStyle: 'italic', fontWeight: 400 }}>
        {n}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
function DashContent() {
  const { user, supabase, signOut } = useAuth()
  const sp = useSearchParams()
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'overview')

  const [meds, setMeds] = useState<Med[]>([])
  const [hist, setHist] = useState<HistItem[]>([])
  const [medsLoading, setMedsLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '' })
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const plan = (user?.plan || 'free') as string
  const planMeta = PLAN_META[plan] || PLAN_META.free
  const isPro = plan === 'pro' || plan === 'clinic'
  const isStudent = plan === 'student' || isPro

  const loadMeds = useCallback(async () => {
    if (!user) return
    setMedsLoading(true)
    const { data } = await supabase.from('personal_meds').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMeds(data || [])
    setMedsLoading(false)
  }, [user, supabase])

  const loadHist = useCallback(async () => {
    if (!user) return
    setHistLoading(true)
    const { data } = await supabase.from('search_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
    setHist(data || [])
    setHistLoading(false)
  }, [user, supabase])

  useEffect(() => { loadMeds(); loadHist() }, [loadMeds, loadHist])

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return
    setAdding(true); setAddErr('')
    try {
      const { data, error } = await supabase.from('personal_meds')
        .insert({ user_id: user.id, name: newMed.name.trim(), dose: newMed.dose.trim() || null, frequency: newMed.frequency.trim() || null })
        .select().single()
      if (error) throw error
      setMeds(p => [data, ...p])
      setNewMed({ name: '', dose: '', frequency: '' })
    } catch (e: any) { setAddErr(e.message) }
    finally { setAdding(false) }
  }

  const removeMed = async (id: string) => {
    setRemoving(id)
    await supabase.from('personal_meds').delete().eq('id', id).eq('user_id', user!.id)
    setMeds(p => p.filter(m => m.id !== id))
    setRemoving(null)
  }

  if (!user) return null

  const severeInteractions = hist.filter(h => h.result_severity === 'GRAVE').length

  // Tab style
  const tabStyle = (t: Tab) => ({
    padding: '11px 18px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.06em',
    textTransform: 'uppercase' as const, marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>

          {/* User identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || 'Utilizador'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: planMeta.color, background: planMeta.bg, border: `1px solid ${planMeta.border}`, padding: '2px 10px', borderRadius: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {planMeta.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  {user.email}
                </span>
              </div>
            </div>
            {!isPro && (
              <Link href="/pricing" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--green)', padding: '6px 12px', borderRadius: 5 }}>
                Upgrade →
              </Link>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            {([
              ['overview', 'Visão geral'],
              ['meds',     'Medicamentos'],
              ['history',  'Histórico'],
              ['account',  'Conta'],
            ] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-container page-body">

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            {/* Stats */}
            <div className="card-grid-3" style={{ gap: 10, marginBottom: 24 }}>
              <StatCard n={meds.length} label="Medicamentos no perfil" onClick={() => setTab('meds')} />
              <StatCard n={hist.length} label="Pesquisas realizadas" onClick={() => setTab('history')} />
              <StatCard n={severeInteractions} label="Interações graves detetadas" onClick={() => setTab('history')} />
            </div>

            {/* Quick tools */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Acesso rápido
              </div>
              <div className="card-grid-3" style={{ gap: 8 }}>
                {QUICK_TOOLS.map(({ href, label, plan: toolPlan }) => {
                  const locked = toolPlan === 'student' && !isStudent || toolPlan === 'pro' && !isPro
                  return (
                    <Link key={href} href={locked ? '/pricing' : href} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 16px', background: 'white',
                      border: '1px solid var(--border)', borderRadius: 8,
                      textDecoration: 'none', gap: 8,
                    }} className="quick-tool">
                      <span style={{ fontSize: 13, fontWeight: 600, color: locked ? 'var(--ink-4)' : 'var(--ink)', letterSpacing: '-0.01em' }}>
                        {label}
                      </span>
                      {locked
                        ? <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{toolPlan}</span>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      }
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Upsell */}
            {!isPro && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)', borderRadius: '0 8px 8px 0', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                    {isStudent ? 'Upgrade para Pro' : 'Upgrade para Student'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {isStudent
                      ? 'Protocolo terapêutico, simulador de estratégias, revisão de medicação e relatório PDF.'
                      : 'Interpretação de análises, Phlox AI, casos clínicos e modo exame completo.'}
                  </div>
                </div>
                <Link href="/pricing" style={{ background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {isStudent ? '12,99€/mês' : '3,99€/mês'} →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── MEDS ──────────────────────────────────────────────────────── */}
        {tab === 'meds' && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
                Os meus medicamentos
              </h2>
              {meds.length >= 2 && (
                <Link href="/mymeds" style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--green)', padding: '6px 12px', borderRadius: 5 }}>
                  Verificar interações →
                </Link>
              )}
            </div>

            {/* Add form */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                Adicionar medicamento
              </div>
              <div className="add-med-form">
                <input
                  value={newMed.name}
                  onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addMed()}
                  placeholder="Nome do medicamento *"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', letterSpacing: '-0.01em', transition: 'border-color 0.15s' }}
                />
                <input
                  value={newMed.dose}
                  onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                  placeholder="Dose (ex: 10mg)"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
                <input
                  value={newMed.frequency}
                  onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
                  placeholder="Frequência"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
                <button
                  onClick={addMed}
                  disabled={!newMed.name.trim() || adding}
                  style={{ background: newMed.name.trim() && !adding ? 'var(--ink)' : 'var(--bg-3)', color: newMed.name.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: newMed.name.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'background 0.15s' }}
                >
                  {adding ? '...' : 'Adicionar'}
                </button>
              </div>
              {addErr && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>{addErr}</div>}
            </div>

            {/* Med list */}
            {medsLoading
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 62, borderRadius: 8 }} />)}</div>
              : meds.length === 0
                ? (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Nenhum medicamento</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Adiciona os teus medicamentos para verificar interações automaticamente.</div>
                  </div>
                )
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meds.map(med => (
                      <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: med.dose || med.frequency ? 3 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}</div>
                          {(med.dose || med.frequency) && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                              {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                          <Link href={`/drugs/${med.name.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Info
                          </Link>
                          <button
                            onClick={() => removeMed(med.id)}
                            disabled={removing === med.id}
                            style={{ background: 'none', border: 'none', cursor: removing === med.id ? 'not-allowed' : 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s', lineHeight: 1 }}
                            className="remove-btn"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {meds.length >= 2 && (
                      <Link href="/mymeds" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Verificar interações entre {meds.length} medicamentos →
                      </Link>
                    )}
                  </div>
                )
            }
          </div>
        )}

        {/* ── HISTORY ───────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
                Histórico de pesquisas
              </h2>
              {hist.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{hist.length} registos</span>
              )}
            </div>

            {histLoading
              ? <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />
              : hist.length === 0
                ? (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nenhuma pesquisa ainda</div>
                  </div>
                )
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {hist.map(item => {
                      const sev = item.result_severity ? SEV_COLOR[item.result_severity] : null
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 16px', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {sev && <div style={{ width: 7, height: 7, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                                {item.query}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {new Date(item.created_at).toLocaleDateString('pt-PT')} · {item.type}
                              </div>
                            </div>
                          </div>
                          {sev && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: sev.text, background: sev.bg, padding: '3px 8px', borderRadius: 3, flexShrink: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              {sev.label}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>
        )}

        {/* ── ACCOUNT ───────────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 24 }}>
              Conta e plano
            </h2>

            {/* Plan card */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '20px', background: planMeta.bg, borderBottom: `2px solid ${planMeta.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: planMeta.color, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                    Plano actual
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
                    {planMeta.label}
                  </div>
                </div>
                {!isPro && (
                  <Link href="/pricing" style={{ background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '10px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Fazer upgrade →
                  </Link>
                )}
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.6 }}>
                  Para gerir ou cancelar a subscrição, contacta{' '}
                  <a href="mailto:hello@phlox-clinical.com" style={{ color: 'var(--green)' }}>hello@phlox-clinical.com</a>
                </div>
              </div>
            </div>

            {/* Account info */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              {[
                { label: 'Nome', value: user.name || '—' },
                { label: 'Email', value: user.email },
                { label: 'Login', value: 'Google OAuth' },
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '13px 16px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                  </div>
                  <div style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Referral */}
            <ReferralSection />

            {/* Sign out */}
            <button
              onClick={signOut}
              style={{ width: '100%', marginTop: 14, padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'color 0.15s, border-color 0.15s' }}
              className="signout-btn"
            >
              Terminar sessão
            </button>
          </div>
        )}
      </div>

      <style>{`
        .stat-card:hover { border-color: var(--green) !important; box-shadow: 0 2px 12px rgba(13,110,66,0.08) !important; }
        .quick-tool:hover { border-color: var(--border-2) !important; background: var(--bg-2) !important; }
        .remove-btn:hover { color: var(--red) !important; }
        .signout-btn:hover { color: var(--red) !important; border-color: var(--red) !important; }
      `}</style>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-2)' }}><Header /></div>}>
      <DashContent />
    </Suspense>
  )
}