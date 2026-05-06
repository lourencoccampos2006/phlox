'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Patient {
  id: string
  name: string
  age: number | null
  sex: string | null
  conditions: string | null
  allergies: string | null
  meds_count?: number
  alerts?: number
  updated_at?: string
}

export default function PatientsPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', sex: '', conditions: '', allergies: '' })

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setPatients(data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const addPatient = async () => {
    if (!newP.name.trim() || !user) return
    setAdding(true)
    const { data, error } = await supabase.from('patients').insert({
      user_id: user.id,
      name: newP.name.trim(),
      age: newP.age ? parseInt(newP.age) : null,
      sex: newP.sex || null,
      conditions: newP.conditions.trim() || null,
      allergies: newP.allergies.trim() || null,
    }).select().single()
    if (error) console.error('addPatient error:', error.message)
    if (data) {
      router.push(`/patients/${data.id}`)
    }
    setAdding(false)
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.conditions || '').toLowerCase().includes(search.toLowerCase())
  )

  // ─── Risco heurístico por número de alertas ───
  const riskBadge = (p: Patient) => {
    if (p.alerts && p.alerts > 0) return { label: `${p.alerts} alerta${p.alerts > 1 ? 's' : ''}`, bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
    if (p.meds_count && p.meds_count >= 5) return { label: 'Polimedicado', bg: '#fef9c3', color: '#854d0e', border: '#fde68a' }
    return null
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ── Header clínico ───────────────────────────────────────────────── */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 2, background: '#1d4ed8', borderRadius: 1 }} />
                Doentes / Utentes
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em' }}>
                {loading ? '—' : `${patients.length} ${patients.length === 1 ? 'doente' : 'doentes'}`}
              </div>
            </div>
            {isPro && (
              <button onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Novo doente
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {!isPro ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🏥</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Gestão de Doentes</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
              Cria perfis clínicos para os teus doentes com medicação, diagnósticos e função renal. O Phlox AI responde com contexto real de cada doente.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Activar Pro →
            </Link>
          </div>
        ) : (
          <>
            {/* Modal novo doente */}
            {showAdd && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: 'white', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Novo doente / utente</div>
                    <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nome completo *" autoFocus
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input value={newP.age} onChange={e => setNewP(p => ({ ...p, age: e.target.value }))}
                        placeholder="Idade" type="number"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <select value={newP.sex} onChange={e => setNewP(p => ({ ...p, sex: e.target.value }))}
                        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', color: newP.sex ? 'var(--ink)' : 'var(--ink-4)' }}>
                        <option value="">Sexo</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <input value={newP.conditions} onChange={e => setNewP(p => ({ ...p, conditions: e.target.value }))}
                      placeholder="Diagnósticos (ex: HTA, DM2, FA, IRC grau 3)"
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                    <input value={newP.allergies} onChange={e => setNewP(p => ({ ...p, allergies: e.target.value }))}
                      placeholder="Alergias medicamentosas"
                      style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <button onClick={addPatient} disabled={!newP.name.trim() || adding}
                      style={{ flex: 1, background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: newP.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', opacity: newP.name.trim() ? 1 : 0.5 }}>
                      {adding ? 'A criar...' : 'Criar perfil →'}
                    </button>
                    <button onClick={() => setShowAdd(false)}
                      style={{ padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou diagnóstico..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 14px 11px 40px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
            </div>

            {/* Stats */}
            {patients.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Total', value: patients.length, color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'Com alertas', value: patients.filter(p => p.alerts && p.alerts > 0).length, color: '#991b1b', bg: '#fee2e2' },
                  { label: 'Polimedicados', value: patients.filter(p => p.meds_count && p.meds_count >= 5).length, color: '#854d0e', bg: '#fef9c3' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.color, fontWeight: 400 }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
                {search ? (
                  <>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 8 }}>Nenhum doente corresponde a "{search}"</div>
                    <button onClick={() => setSearch('')} style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>Limpar pesquisa</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Nenhum doente ainda</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>Cria o primeiro perfil clínico.</div>
                    <button onClick={() => setShowAdd(true)}
                      style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Criar primeiro doente →
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {filtered.map((patient, i) => {
                  const badge = riskBadge(patient)
                  return (
                    <Link key={patient.id} href={`/patients/${patient.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textDecoration: 'none', borderBottom: i < filtered.length - 1 ? '1px solid var(--bg-3)' : 'none', transition: 'background 0.1s' }}
                      className="patient-row">
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{patient.name}</span>
                          {badge && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[
                            patient.age ? `${patient.age}a` : null,
                            patient.sex === 'M' ? 'M' : patient.sex === 'F' ? 'F' : null,
                            patient.conditions,
                          ].filter(Boolean).join(' · ') || 'Sem informação clínica'}
                        </div>
                      </div>
                      {/* Meds count + arrow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                          {patient.meds_count || 0} med.
                        </span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`.patient-row:hover { background: #eff6ff !important; }`}</style>
    </div>
  )
}