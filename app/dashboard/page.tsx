'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  notes?: string
}

export default function DashboardPage() {
  const { user, loading, signOut, supabase } = useAuth()
  const router = useRouter()
  const [history, setHistory] = useState<SearchHistory[]>([])
  const [meds, setMeds] = useState<PersonalMed[]>([])
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '' })
  const [addingMed, setAddingMed] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'meds' | 'account'>('history')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadHistory()
      loadMeds()
    }
  }, [user])

  const loadHistory = async () => {
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setHistory(data)
  }

  const loadMeds = async () => {
    const { data } = await supabase
      .from('personal_meds')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
    if (data) setMeds(data)
  }

  const addMed = async () => {
    if (!newMed.name.trim()) return
    setAddingMed(true)
    const { data } = await supabase
      .from('personal_meds')
      .insert({ user_id: user?.id, ...newMed })
      .select()
      .single()
    if (data) {
      setMeds(prev => [data, ...prev])
      setNewMed({ name: '', dose: '', frequency: '' })
    }
    setAddingMed(false)
  }

  const removeMed = async (id: string) => {
    await supabase.from('personal_meds').delete().eq('id', id)
    setMeds(prev => prev.filter(m => m.id !== id))
  }

  const SEVERITY_COLOR: Record<string, string> = {
    GRAVE: '#c53030',
    MODERADA: '#dd6b20',
    LIGEIRA: '#d69e2e',
    SEM_INTERACAO: '#276749',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf9' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>A carregar...</div>
    </div>
  )

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>CLINICAL</span>
          </Link>
          <span style={{ color: 'var(--border-2)' }}>|</span>
          <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>O meu perfil</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            {user.avatar && (
              <img src={user.avatar} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)' }} />
            )}
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{user.name}</span>
            <button
              onClick={signOut}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 12px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'start' }}>

          {/* Sidebar */}
          <div style={{ position: 'sticky', top: 24 }}>
            {/* User card */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>{user.name[0]}</div>
                }
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{user.email}</div>
                </div>
              </div>
              <div style={{
                display: 'inline-block',
                background: user.plan === 'free' ? 'var(--bg-3)' : 'var(--green-light)',
                border: `1px solid ${user.plan === 'free' ? 'var(--border)' : 'var(--green-mid)'}`,
                borderRadius: 3,
                padding: '3px 10px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                color: user.plan === 'free' ? 'var(--ink-4)' : 'var(--green)',
                textTransform: 'uppercase',
              }}>
                {user.plan === 'free' ? 'Plano Gratuito' : user.plan === 'student' ? 'Plano Student' : 'Plano Pro'}
              </div>
            </div>

            {/* Nav */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              {([
                { id: 'history', label: 'Histórico', count: history.length },
                { id: 'meds', label: 'Os meus medicamentos', count: meds.length },
                { id: 'account', label: 'Conta e plano', count: null },
              ] as const).map(({ id, label, count }, i) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: activeTab === id ? 'var(--green-light)' : 'none',
                    border: 'none',
                    borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                    color: activeTab === id ? 'var(--green)' : 'var(--ink-2)',
                    fontWeight: activeTab === id ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {label}
                  {count !== null && (
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Quick links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/interactions', label: 'Verificar Interações' },
                { href: '/drugs', label: 'Pesquisar Medicamento' },
                { href: '/study', label: 'Estudar Farmacologia' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', padding: '6px 0', fontFamily: 'var(--font-mono)' }}>
                  → {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div>

            {/* History tab */}
            {activeTab === 'history' && (
              <div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: 0 }}>Histórico de Pesquisas</h2>
                      <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>Últimas 20 pesquisas</p>
                    </div>
                  </div>

                  {history.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: 'var(--ink-4)' }}>Ainda não fizeste pesquisas. Começa por verificar interações ou pesquisar um medicamento.</p>
                      <Link href="/interactions" style={{ display: 'inline-block', marginTop: 16, background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '8px 20px', fontSize: 13, fontWeight: 600 }}>
                        Verificar Interações →
                      </Link>
                    </div>
                  ) : (
                    <div>
                      {history.map((item, i) => (
                        <div key={item.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 1fr auto',
                          alignItems: 'center',
                          padding: '14px 24px',
                          borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                          gap: 16,
                        }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'white',
                            background: item.type === 'interaction' ? 'var(--ink-3)' : 'var(--green)',
                            borderRadius: 3,
                            padding: '3px 8px',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {item.type === 'interaction' ? 'Interação' : 'Fármaco'}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>{item.query}</div>
                            {item.result_severity && (
                              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: SEVERITY_COLOR[item.result_severity] || 'var(--ink-4)', marginTop: 2 }}>
                                {item.result_severity}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {new Date(item.created_at).toLocaleDateString('pt-PT')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meds tab */}
            {activeTab === 'meds' && (
              <div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: '0 0 4px' }}>Os meus medicamentos</h2>
                    <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--font-mono)' }}>Lista pessoal de medicamentos que tomas</p>
                  </div>

                  {/* Add medication */}
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 12 }}>ADICIONAR MEDICAMENTO</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px auto', gap: 8 }}>
                      <input
                        type="text"
                        value={newMed.name}
                        onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do medicamento"
                        style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}
                      />
                      <input
                        type="text"
                        value={newMed.dose}
                        onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                        placeholder="Dose (ex: 500mg)"
                        style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}
                      />
                      <input
                        type="text"
                        value={newMed.frequency}
                        onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
                        placeholder="Frequência (ex: 2x/dia)"
                        style={{ border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}
                      />
                      <button
                        onClick={addMed}
                        disabled={!newMed.name.trim() || addingMed}
                        style={{
                          background: newMed.name.trim() ? 'var(--green)' : 'var(--bg-3)',
                          color: newMed.name.trim() ? 'white' : 'var(--ink-4)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: newMed.name.trim() ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--font-sans)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>

                  {/* Meds list */}
                  {meds.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: 'var(--ink-4)' }}>Ainda não adicionaste medicamentos à tua lista.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Check interactions button */}
                      {meds.length >= 2 && (
                        <div style={{ padding: '12px 24px', background: 'var(--green-light)', borderBottom: '1px solid var(--border)' }}>
                          <Link
                            href={`/interactions?drugs=${meds.map(m => m.name).join(',')}`}
                            style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            Verificar interações entre os teus {meds.length} medicamentos →
                          </Link>
                        </div>
                      )}

                      {meds.map((med, i) => (
                        <div key={med.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto auto',
                          alignItems: 'center',
                          padding: '14px 24px',
                          borderBottom: i < meds.length - 1 ? '1px solid var(--border)' : 'none',
                          gap: 16,
                        }}>
                          <div>
                            <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{med.name}</div>
                            {(med.dose || med.frequency) && (
                              <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <Link
                            href={`/drugs/${med.name.toLowerCase().replace(/\s+/g, '-')}`}
                            style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}
                          >
                            Ver info →
                          </Link>
                          <Link
                            href={`/interactions?drugs=${med.name}`}
                            style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}
                          >
                            Interações →
                          </Link>
                          <button
                            onClick={() => removeMed(med.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account tab */}
            {activeTab === 'account' && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', margin: 0 }}>Conta e Plano</h2>
                </div>

                <div style={{ padding: '24px' }}>
                  {/* Plan comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
                    {[
                      {
                        name: 'Gratuito',
                        price: '0€',
                        current: user.plan === 'free',
                        features: ['Interações básicas', '15 pesquisas/dia', 'Flashcards básicos'],
                      },
                      {
                        name: 'Student',
                        price: '3,99€/mês',
                        current: user.plan === 'student',
                        features: ['Pesquisas ilimitadas', 'Quizzes adaptativos', 'Casos clínicos', 'Sem anúncios'],
                      },
                      {
                        name: 'Pro',
                        price: '12,99€/mês',
                        current: user.plan === 'pro',
                        features: ['Tudo do Student', 'Calculadoras clínicas', 'Exportação PDF', 'API access'],
                      },
                    ].map(plan => (
                      <div key={plan.name} style={{
                        background: plan.current ? 'var(--green-light)' : 'white',
                        padding: '20px',
                        border: plan.current ? '2px solid var(--green)' : 'none',
                      }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: plan.current ? 'var(--green)' : 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>
                          {plan.current ? '✓ PLANO ACTUAL' : plan.name.toUpperCase()}
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>{plan.name}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: plan.current ? 'var(--green)' : 'var(--ink)', marginBottom: 16 }}>{plan.price}</div>
                        {plan.features.map(f => (
                          <div key={f} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: 'var(--green-2)', fontSize: 11 }}>✓</span>
                            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{f}</span>
                          </div>
                        ))}
                        {!plan.current && (
                          <button style={{
                            width: '100%',
                            marginTop: 16,
                            background: 'var(--green)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            padding: '8px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            Upgradar →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Danger zone */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 12 }}>CONTA</div>
                    <button
                      onClick={signOut}
                      style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 4, padding: '8px 16px', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                    >
                      Terminar sessão
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}