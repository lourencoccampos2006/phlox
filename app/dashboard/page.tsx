'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Tab = 'overview' | 'history' | 'meds' | 'account'
interface Med { id: string; name: string; dose?: string; frequency?: string; created_at: string }
interface HistItem { id: string; type: string; query: string; result_severity?: string; created_at: string }

const SEV_COLOR: Record<string, string> = {
  GRAVE: '#ef4444', MODERADA: '#f59e0b', LIGEIRA: '#3b82f6', SEM_INTERACAO: '#22c55e',
}

const QUICK_TOOLS = [
  { href: '/labs',       icon: '🔬', label: 'Análises',     sub: 'Interpretar resultados' },
  { href: '/ai',         icon: '🧠', label: 'Phlox AI',     sub: 'Farmacologista clínico' },
  { href: '/strategy',   icon: '⚖️', label: 'Estratégias',  sub: 'Alternativas terapêuticas' },
  { href: '/med-review', icon: '📋', label: 'Revisão',      sub: 'Análise do perfil' },
  { href: '/mymeds',     icon: '💊', label: 'Medicação',    sub: 'Verificar interações' },
  { href: '/protocol',   icon: '📄', label: 'Protocolo',    sub: 'Baseado em guidelines' },
]

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

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'
  const isStudent = plan === 'student' || isPro

  const loadMeds = useCallback(async () => {
    if (!user) return
    setMedsLoading(true)
    const { data } = await supabase.from('personal_meds').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMeds(data || []); setMedsLoading(false)
  }, [user, supabase])

  const loadHist = useCallback(async () => {
    if (!user) return
    setHistLoading(true)
    const { data } = await supabase.from('search_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setHist(data || []); setHistLoading(false)
  }, [user, supabase])

  useEffect(() => { loadMeds(); loadHist() }, [loadMeds, loadHist])

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return
    setAdding(true); setAddErr('')
    try {
      const { data, error } = await supabase.from('personal_meds')
        .insert({ user_id: user.id, name: newMed.name.trim(), dose: newMed.dose || null, frequency: newMed.frequency || null })
        .select().single()
      if (error) throw error
      setMeds(p => [data, ...p]); setNewMed({ name: '', dose: '', frequency: '' })
    } catch (e: any) { setAddErr(e.message) }
    finally { setAdding(false) }
  }

  const removeMed = async (id: string) => {
    await supabase.from('personal_meds').delete().eq('id', id).eq('user_id', user!.id)
    setMeds(p => p.filter(m => m.id !== id))
  }

  if (!user) return null

  const S = (active: boolean) => ({
    padding: '11px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400,
    color: active ? 'var(--green)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)',
    letterSpacing: '-0.01em', marginBottom: -1, transition: 'color 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%' }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700 }}>{(user.name?.[0] || 'U').toUpperCase()}</div>
            }
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{user.name || 'Utilizador'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: isPro ? '#dbeafe' : isStudent ? '#ede9fe' : 'var(--bg-3)', color: isPro ? '#1e40af' : isStudent ? '#7c3aed' : 'var(--ink-4)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, letterSpacing: '0.04em' }}>{plan.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{user.email}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            {([['overview','Visão geral'], ['meds','Medicamentos'], ['history','Histórico'], ['account','Conta']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={S(tab === id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {tab === 'overview' && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Acesso rápido</div>
            <div className="card-grid-3" style={{ gap: 8, marginBottom: 24 }}>
              {QUICK_TOOLS.map(({ href, icon, label, sub }) => (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{sub}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="card-grid-3" style={{ gap: 8, marginBottom: 24 }}>
              {[
                { n: meds.length,    label: 'Medicamentos registados', click: () => setTab('meds') },
                { n: hist.length,    label: 'Pesquisas no histórico',  click: () => setTab('history') },
                { n: hist.filter(h => h.result_severity === 'GRAVE').length, label: 'Interações graves encontradas', click: () => setTab('history') },
              ].map(({ n, label, click }) => (
                <button key={label} onClick={click} style={{ padding: '20px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--green)', marginBottom: 4, letterSpacing: '-0.02em' }}>{n}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{label}</div>
                </button>
              ))}
            </div>

            {!isPro && (
              <div style={{ background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, padding: '22px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 5, letterSpacing: '-0.01em' }}>{isStudent ? 'Upgrade para Pro' : 'Upgrade para Student'}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{isStudent ? 'Protocolo, estratégias terapêuticas e revisão de medicação.' : 'Interpretação de análises, Phlox AI e casos clínicos.'}</div>
                </div>
                <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                  {isStudent ? '12,99€/mês' : '3,99€/mês'} →
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === 'meds' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Os meus medicamentos</h2>
              {meds.length >= 2 && <Link href="/mymeds" style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', fontWeight: 600 }}>Verificar interações →</Link>}
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Adicionar medicamento</div>
              <div className="add-med-form">
                <input value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMed()} placeholder="Nome *" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))} placeholder="Dose" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))} placeholder="Frequência" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={addMed} disabled={!newMed.name.trim() || adding} style={{ background: newMed.name.trim() && !adding ? 'var(--green)' : 'var(--bg-3)', color: newMed.name.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: newMed.name.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>{adding ? '...' : 'Adicionar'}</button>
              </div>
              {addErr && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8, fontFamily: 'var(--font-mono)' }}>{addErr}</div>}
            </div>

            {medsLoading ? <div className="skeleton" style={{ height: 160, borderRadius: 10 }} /> : meds.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>Sem medicamentos registados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {meds.map(med => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                      {(med.dose || med.frequency) && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Link href={'/drugs/' + med.name.toLowerCase().replace(/\s+/g, '-')} style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Info</Link>
                      <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-5)')}>×</button>
                    </div>
                  </div>
                ))}
                {meds.length >= 2 && (
                  <Link href="/mymeds" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, marginTop: 6 }}>Verificar interações →</Link>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.01em' }}>Histórico</h2>
            {histLoading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : hist.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>Nenhuma pesquisa ainda</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {hist.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '11px 16px', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {item.result_severity && <div style={{ width: 7, height: 7, borderRadius: '50%', background: SEV_COLOR[item.result_severity] || 'var(--ink-4)', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{item.query}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{new Date(item.created_at).toLocaleDateString('pt-PT')} · {item.type}</div>
                      </div>
                    </div>
                    {item.result_severity && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: SEV_COLOR[item.result_severity], background: SEV_COLOR[item.result_severity] + '15', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{item.result_severity.replace('_', ' ')}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'account' && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.01em' }}>Conta e plano</h2>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '18px 20px', background: isPro ? 'var(--green)' : isStudent ? '#ede9fe' : 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isPro ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Plano actual</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: isPro ? 'white' : 'var(--ink)', letterSpacing: '-0.01em' }}>{plan === 'free' ? 'Gratuito' : plan === 'student' ? 'Student' : 'Pro'}</div>
              </div>
              <div style={{ padding: '14px 20px' }}>
                {!isPro && <Link href="/pricing" style={{ display: 'block', textAlign: 'center', padding: '10px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.01em' }}>{isStudent ? 'Upgrade para Pro — 12,99€/mês' : 'Upgrade — 3,99€/mês'} →</Link>}
                <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Cancelamentos: <a href="mailto:hello@phlox.health" style={{ color: 'var(--green-2)' }}>hello@phlox.health</a></div>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              {[{ l: 'Nome', v: user.name || '—' }, { l: 'Email', v: user.email }, { l: 'Login', v: 'Google OAuth' }].map(({ l, v }, i, arr) => (
                <div key={l} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}><span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</span></div>
                  <div style={{ padding: '12px 14px' }}><span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{v}</span></div>
                </div>
              ))}
            </div>
            <button onClick={signOut} style={{ width: '100%', padding: '11px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              Terminar sessão
            </button>
          </div>
        )}
      </div>
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