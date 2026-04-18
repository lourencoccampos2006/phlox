'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'

type SearchHistory = {
  id: string
  type: 'interaction' | 'drug'
  query: string
  result_severity?: string
  created_at: string
}

type PersonalMed = {
  id: string
  name: string
  dose?: string
  frequency?: string
}

const SEVERITY_COLOR: Record<string, string> = {
  GRAVE: '#c53030', MODERADA: '#dd6b20', LIGEIRA: '#d69e2e', SEM_INTERACAO: '#276749',
}

function DashboardContent() {
  const { user, loading: authLoading, signOut, supabase } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'history' | 'meds' | 'account'>((tabParam as any) || 'history')
  const [history, setHistory] = useState<SearchHistory[]>([])
  const [meds, setMeds] = useState<PersonalMed[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [medsLoading, setMedsLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [medsError, setMedsError] = useState('')
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '' })
  const [addingMed, setAddingMed] = useState(false)
  const [addMedError, setAddMedError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const { data, error } = await supabase
        .from('search_history').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      setHistory(data || [])
    } catch {
      setHistoryError('Executa o schema.sql no Supabase SQL Editor para criar as tabelas.')
    } finally { setHistoryLoading(false) }
  }, [user, supabase])

  const loadMeds = useCallback(async () => {
    if (!user) return
    setMedsLoading(true)
    setMedsError('')
    try {
      const { data, error } = await supabase
        .from('personal_meds').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMeds(data || [])
    } catch {
      setMedsError('Executa o schema.sql no Supabase SQL Editor para criar as tabelas.')
    } finally { setMedsLoading(false) }
  }, [user, supabase])

  useEffect(() => {
    if (user) { loadHistory(); loadMeds() }
  }, [user])

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return
    setAddingMed(true)
    setAddMedError('')
    try {
      const { data, error } = await supabase.from('personal_meds')
        .insert({ user_id: user.id, name: newMed.name.trim(), dose: newMed.dose.trim() || null, frequency: newMed.frequency.trim() || null })
        .select().single()
      if (error) throw error
      setMeds(prev => [data, ...prev])
      setNewMed({ name: '', dose: '', frequency: '' })
    } catch (e: any) {
      setAddMedError('Erro ao adicionar: ' + (e.message || 'Verifica se executaste o schema.sql'))
    } finally { setAddingMed(false) }
  }

  const removeMed = async (id: string) => {
    const { error } = await supabase.from('personal_meds').delete().eq('id', id).eq('user_id', user!.id)
    if (!error) setMeds(prev => prev.filter(m => m.id !== id))
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>A carregar...</div>
    </div>
  )

  if (!user) return null

  return (
    <div className="page-container page-body">
      <div className="dashboard-layout" style={{ alignItems: 'start' }}>

        {/* Sidebar */}
        <div>
          {/* Profile card */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {user.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{user.name[0]}</div>
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
            <div style={{ display: 'inline-block', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>
              {user.plan === 'free' ? 'Gratuito' : user.plan}
            </div>
          </div>

          {/* Tab nav */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {([
              { id: 'history', label: 'Histórico', count: history.length },
              { id: 'meds', label: 'Os meus medicamentos', count: meds.length },
              { id: 'account', label: 'Conta e plano', count: null },
            ] as const).map(({ id, label, count }, i) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: activeTab === id ? 'var(--green-light)' : 'none', border: 'none', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: activeTab === id ? 'var(--green)' : 'var(--ink-2)', fontWeight: activeTab === id ? 600 : 400, fontFamily: 'var(--font-sans)' }}>
                {label}
                {count !== null && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{count}</span>}
              </button>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ href: '/interactions', label: 'Verificar Interações' }, { href: '/drugs', label: 'Pesquisar Medicamento' }, { href: '/study', label: 'Estudar Farmacologia' }].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>→ {label}</Link>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div>

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: 0 }}>Histórico de Pesquisas</h2>
                  <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>Últimas 30 pesquisas</p>
                </div>
                <button onClick={loadHistory} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>↻ Actualizar</button>
              </div>
              {historyLoading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>A carregar...</div>}
              {historyError && <div style={{ padding: '20px', background: '#fff5f5' }}><p style={{ fontSize: 13, color: '#742a2a', margin: 0 }}>{historyError}</p></div>}
              {!historyLoading && !historyError && history.length === 0 && (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 16 }}>Ainda não fizeste pesquisas com a conta activa.</p>
                  <Link href="/interactions" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '8px 20px', fontSize: 13, fontWeight: 600 }}>Verificar Interações →</Link>
                </div>
              )}
              {!historyLoading && history.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'white', background: item.type === 'interaction' ? 'var(--ink-3)' : 'var(--green)', borderRadius: 3, padding: '3px 8px', textAlign: 'center', textTransform: 'uppercase', flexShrink: 0 }}>
                    {item.type === 'interaction' ? 'Interação' : 'Fármaco'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.query}</div>
                    {item.result_severity && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: SEVERITY_COLOR[item.result_severity] || 'var(--ink-4)', marginTop: 2 }}>{item.result_severity}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(item.created_at).toLocaleDateString('pt-PT')}</div>
                </div>
              ))}
            </div>
          )}

          {/* MEDS TAB */}
          {activeTab === 'meds' && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: '0 0 4px' }}>Os meus medicamentos</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--font-mono)' }}>Lista pessoal de medicamentos que tomas</p>
              </div>
              {/* Add med form */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>ADICIONAR MEDICAMENTO</div>
                <div className="add-med-form">
                  <input type="text" value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMed()} placeholder="Nome do medicamento *" style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }} />
                  <input type="text" value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))} placeholder="Dose (ex: 500mg)" style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }} />
                  <input type="text" value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))} placeholder="Frequência (ex: 2x/dia)" style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }} />
                  <button onClick={addMed} disabled={!newMed.name.trim() || addingMed}
                    style={{ background: newMed.name.trim() && !addingMed ? 'var(--green)' : 'var(--bg-3)', color: newMed.name.trim() && !addingMed ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: newMed.name.trim() && !addingMed ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                    {addingMed ? '...' : '+ Adicionar'}
                  </button>
                </div>
                {addMedError && <p style={{ fontSize: 12, color: '#742a2a', margin: '8px 0 0', fontFamily: 'var(--font-mono)' }}>{addMedError}</p>}
              </div>
              {medsLoading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>A carregar...</div>}
              {medsError && <div style={{ padding: '20px', background: '#fff5f5' }}><p style={{ fontSize: 13, color: '#742a2a', margin: 0 }}>{medsError}</p></div>}
              {!medsLoading && !medsError && meds.length === 0 && <div style={{ padding: '48px 20px', textAlign: 'center' }}><p style={{ fontSize: 14, color: 'var(--ink-4)' }}>Ainda não adicionaste medicamentos. Usa o formulário acima.</p></div>}
              {!medsLoading && meds.length > 0 && (
                <div>
                  {meds.length >= 2 && (
                    <div style={{ padding: '12px 20px', background: 'var(--green-light)', borderBottom: '1px solid var(--border)' }}>
                      <Link href="/interactions" style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>Verificar interações entre os teus {meds.length} medicamentos →</Link>
                    </div>
                  )}
                  {meds.map((med, i) => (
                    <div key={med.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: i < meds.length - 1 ? '1px solid var(--border)' : 'none', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{med.name}</div>
                        {(med.dose || med.frequency) && <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                        <Link href={`/drugs/${med.name.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>Ver info →</Link>
                        <Link href="/interactions" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>Interações →</Link>
                        <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACCOUNT TAB */}
          {activeTab === 'account' && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: 0 }}>Conta e Plano</h2>
              </div>
              <div style={{ padding: '20px' }}>
                <div className="plans-grid" style={{ marginBottom: 24 }}>
                  {[
                    { name: 'Gratuito', price: '0€', current: user.plan === 'free', href: null, features: ['10 interações/dia', '15 pesquisas/dia', 'Calculadoras básicas'] },
                    { name: 'Student', price: '3,99€/mês', current: user.plan === 'student', href: '/pricing', features: ['Pesquisas ilimitadas', 'Flashcards e quizzes', 'Sem anúncios'] },
                    { name: 'Pro', price: '12,99€/mês', current: user.plan === 'pro', href: '/pricing', features: ['Tudo do Student', 'Calculadoras avançadas', 'Exportação PDF'] },
                  ].map(plan => (
                    <div key={plan.name} style={{ background: plan.current ? 'var(--green-light)' : 'white', padding: '20px 16px', outline: plan.current ? '2px solid var(--green)' : 'none', outlineOffset: -2 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: plan.current ? 'var(--green)' : 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>{plan.current ? '✓ PLANO ACTUAL' : plan.name.toUpperCase()}</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 4 }}>{plan.name}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: plan.current ? 'var(--green)' : 'var(--ink)', marginBottom: 12 }}>{plan.price}</div>
                      {plan.features.map(f => (<div key={f} style={{ display: 'flex', gap: 6, marginBottom: 4 }}><span style={{ color: 'var(--green-2)', fontSize: 11 }}>✓</span><span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{f}</span></div>))}
                      {!plan.current && plan.href && <Link href={plan.href} style={{ display: 'block', marginTop: 16, background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '8px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>Ver planos →</Link>}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 12 }}>CONTA</div>
                  <button onClick={signOut} style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 16px', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Terminar sessão</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>A carregar...</div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  )
}