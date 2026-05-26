'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { setActiveProfile } from '@/lib/profileContext'
import Link from 'next/link'
import type { Metadata } from 'next'

interface FamilyProfile {
  id: string; name: string; relation?: string; age?: number | null
  conditions?: string | null; allergies?: string | null; sex?: string | null
}
interface FamilyMed { id: string; profile_id: string; name: string; dose?: string; frequency?: string; reminder_times?: string[] }

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function getRisk(p: FamilyProfile, medCount: number) {
  let score = 0
  if ((p.age || 0) >= 75) score += 30
  if (medCount >= 5) score += 25
  if (p.allergies) score += 10
  if ((p.conditions || '').toLowerCase().includes('renal')) score += 20
  if (score >= 50) return { label: 'Alto risco', color: '#dc2626', bg: '#fee2e2' }
  if (score >= 25) return { label: 'Atenção', color: '#d97706', bg: '#fffbeb' }
  return { label: 'OK', color: '#059669', bg: '#d1fae5' }
}

function stoppFlags(p: FamilyProfile, meds: FamilyMed[]): string[] {
  const flags: string[] = []
  const medNames = meds.map(m => m.name.toLowerCase())
  const age = p.age || 0
  if (age >= 75) {
    if (medNames.some(m => m.includes('diazepam') || m.includes('lorazepam') || m.includes('alprazolam') || m.includes('benzodiazep')))
      flags.push('Benzodiazepina em idoso')
    if (medNames.some(m => m.includes('ibuprofeno') || m.includes('naproxeno') || m.includes('diclofenac')) &&
        medNames.some(m => m.includes('varfarina') || m.includes('rivaroxaban') || m.includes('apixaban')))
      flags.push('AINE + anticoagulante')
    if (meds.length >= 5)
      flags.push(`Polimedicação (${meds.length} meds)`)
  }
  return flags
}

export default function FamiliaPage() {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [allMeds, setAllMeds] = useState<FamilyMed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: p } = await supabase.from('family_profiles')
        .select('id,name,relation,age,sex,conditions,allergies')
        .eq('user_id', user.id).order('name')
      const profileList = p ?? []
      setProfiles(profileList)
      if (profileList.length > 0) {
        const { data: m } = await supabase.from('family_profile_meds')
          .select('id,profile_id,name,dose,frequency,reminder_times')
          .in('profile_id', profileList.map((x: any) => x.id))
        setAllMeds(m ?? [])
      }
      setLoading(false)
    })()
  }, [user?.id])

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div>
        <Link href="/login" style={{ color: 'var(--green)', fontWeight: 700 }}>Iniciar sessão →</Link>
      </div>
    </div>
  )

  const totalMeds = allMeds.length
  const totalProfiles = profiles.length
  const highRiskCount = profiles.filter(p => {
    const mc = allMeds.filter(m => m.profile_id === p.id).length
    return getRisk(p, mc).label === 'Alto risco'
  }).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>

      <div style={{ background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)', padding: '28px 24px 24px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Dashboard</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'white', fontWeight: 400, marginBottom: 14 }}>A minha família</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Perfis', value: totalProfiles },
              { label: 'Medicamentos', value: totalMeds },
              { label: 'Alto risco', value: highRiskCount },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'white', fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Atalho: Portal Família (lar) — comunicar com a instituição do ente querido */}
        <Link href="/portal-familia" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
          <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>O seu familiar está num lar?</div>
              <div style={{ fontSize: 12.5, color: '#3b5bdb', lineHeight: 1.45 }}>Entre no Portal Família com o código que a instituição lhe deu — veja atualizações, fotos e fale com a equipa.</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </Link>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
          </div>
        ) : profiles.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed #fde68a', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>👨‍👩‍👧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Nenhum familiar adicionado</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>Adiciona perfis familiares para gerir a sua medicação e saúde.</div>
            <Link href="/perfis" style={{ padding: '11px 24px', background: '#d97706', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Adicionar familiar →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {profiles.map(p => {
              const meds = allMeds.filter(m => m.profile_id === p.id)
              const risk = getRisk(p, meds.length)
              const flags = stoppFlags(p, meds)
              return (
                <div key={p.id} style={{ background: 'white', border: `1px solid ${risk.label === 'Alto risco' ? '#fca5a5' : risk.label === 'Atenção' ? '#fde68a' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#d97706', flexShrink: 0 }}>
                      {getInitials(p.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {p.relation && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.relation}</span>}
                        {p.age && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{p.age} anos</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, color: risk.color, background: risk.bg, border: `1px solid ${risk.color}40`, borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>{risk.label}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href="/mymeds" onClick={() => setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, conditions: p.conditions, allergies: p.allergies })}
                        style={{ padding: '8px 14px', background: '#d97706', color: 'white', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        Gerir medicação
                      </Link>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '14px 20px' }}>
                    {p.conditions && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 8 }}>📋 {p.conditions}</div>}
                    {p.allergies && <div style={{ fontSize: 12, color: '#dc2626', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'inline-block' }}>⚠️ Alergia: {p.allergies}</div>}

                    {flags.length > 0 && (
                      <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {flags.map(f => (
                          <span key={f} style={{ fontSize: 10, fontWeight: 700, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>
                            ⚠️ STOPP: {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {meds.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                          {meds.length} medicamento{meds.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {meds.map(m => (
                            <span key={m.id} style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>
                              {m.name}{m.dose ? ` ${m.dose}` : ''}
                            </span>
                          ))}
                        </div>
                        {meds.length >= 2 && (
                          <div style={{ marginTop: 12 }}>
                            <Link href={`/interactions?drugs=${meds.map(m => m.name).join(',')}`}
                              style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 12px', display: 'inline-block' }}>
                              🔍 Verificar interações entre estes medicamentos →
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--ink-5)', fontStyle: 'italic' }}>Nenhum medicamento registado.</div>
                    )}
                  </div>
                </div>
              )
            })}

            <Link href="/perfis" style={{ display: 'block', padding: '14px', background: 'white', border: '2px dashed #fde68a', borderRadius: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#d97706', textDecoration: 'none' }}>
              + Adicionar familiar
            </Link>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
