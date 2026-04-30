'use client'

// ─── NOVO: app/perfil/[id]/page.tsx ───
// Detalhe de perfil familiar. Tabs: Visão Geral | Medicação | Notas.
// Inclui CrCl (Cockcroft-Gault) automático.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface FamilyProfile {
  id: string; name: string; relation?: string; age?: number; sex?: string
  weight?: number; height?: number; creatinine?: number; conditions?: string
  allergies?: string; notes?: string
}
interface Med { id: string; name: string; dose?: string; frequency?: string; indication?: string; started_at?: string }

// Cockcroft-Gault para CrCl em mL/min
function calcCrCl(age?: number, weight?: number, sex?: string, creatinine?: number): number | null {
  if (!age || !weight || !creatinine || creatinine <= 0) return null
  const base = ((140 - age) * weight) / (72 * creatinine)
  return Math.round(base * (sex === 'F' ? 0.85 : 1) * 10) / 10
}

function crClLabel(crcl: number | null): { label: string; color: string } | null {
  if (crcl === null) return null
  if (crcl >= 90) return { label: 'Normal (≥90)', color: 'var(--green)' }
  if (crcl >= 60) return { label: 'Ligeira (60–89)', color: '#d97706' }
  if (crcl >= 30) return { label: 'Moderada (30–59)', color: '#f97316' }
  if (crcl >= 15) return { label: 'Grave (15–29)', color: '#dc2626' }
  return { label: 'Falência (<15)', color: '#7f1d1d' }
}

export default function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<FamilyProfile | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [tab, setTab] = useState<'overview' | 'meds' | 'notes'>('overview')
  const [loading, setLoading] = useState(true)
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '', indication: '' })
  const [addingMed, setAddingMed] = useState(false)

  useEffect(() => {
    params.then(p => setProfileId(p.id))
  }, [params])

  const load = useCallback(async () => {
    if (!user || !profileId) return
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('family_profiles').select('*').eq('id', profileId).eq('user_id', user.id).single(),
      supabase.from('family_profile_meds').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }),
    ])
    if (!p) { setLoading(false); return }
    setProfile(p)
    setMeds(m || [])
    setLoading(false)
  }, [user, supabase, profileId])

  useEffect(() => { if (profileId) load() }, [load, profileId])

  async function addMed() {
    if (!newMed.name.trim() || !user || !profileId) return
    setAddingMed(true)
    const { data } = await supabase.from('family_profile_meds').insert({
      profile_id: profileId, user_id: user.id,
      name: newMed.name.trim(), dose: newMed.dose || null,
      frequency: newMed.frequency || null, indication: newMed.indication || null,
    }).select().single()
    if (data) setMeds(m => [data, ...m])
    setNewMed({ name: '', dose: '', frequency: '', indication: '' })
    setAddingMed(false)
  }

  async function removeMed(id: string) {
    await supabase.from('family_profile_meds').delete().eq('id', id).eq('user_id', user!.id)
    setMeds(m => m.filter(med => med.id !== id))
  }

  const crcl = profile ? calcCrCl(profile.age, profile.weight, profile.sex, profile.creatinine) : null
  const crclInfo = crClLabel(crcl)

  const tabStyle = (t: string) => ({
    padding: '10px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
    whiteSpace: 'nowrap' as const,
  })

  const inputStyle = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="skeleton" style={{ height: 120, borderRadius: 10, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
      </div>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)' }}>
      <Header />
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 16 }}>Perfil não encontrado</div>
        <Link href="/perfis" style={{ color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>← Voltar aos perfis</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Header da página */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
          <Link href="/perfis" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Todos os perfis
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 4 }}>{profile.name}</h1>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {profile.relation && <span>{profile.relation}</span>}
                {profile.age && <span>{profile.age} anos</span>}
                {profile.sex && <span>{{ M: 'Masculino', F: 'Feminino', outro: 'Outro' }[profile.sex] || profile.sex}</span>}
                {profile.weight && <span>{profile.weight} kg</span>}
              </div>
            </div>
            {/* Botões de acção */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Link href={`/ai?profile=${profile.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                <svg width="11" height="11" viewBox="0 0 28 28" fill="none"><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                Consultar Phlox AI
              </Link>
              <Link href={`/interactions?profile=${profile.id}`} style={{ padding: '9px 14px', background: 'white', color: 'var(--ink)', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                Interações
              </Link>
              <Link href={`/consult-prep?profile=${profile.id}`} style={{ padding: '9px 14px', background: 'white', color: 'var(--ink)', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                Preparar consulta
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
            {([['overview', 'Visão Geral'], ['meds', 'Medicação'], ['notes', 'Notas']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* VISÃO GERAL */}
        {tab === 'overview' && (
          <div style={{ maxWidth: 680 }}>
            {/* AI CTA banner */}
            <Link href={`/ai?profile=${profile.id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', background: 'var(--ink)', borderRadius: 12, textDecoration: 'none', marginBottom: 16 }}
              className="ai-banner">
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox AI · Contexto carregado</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                  Consultar sobre {profile.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                  Medicação, diagnósticos e função renal já carregados
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'white', color: 'var(--ink)', padding: '9px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                Abrir AI
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </Link>

            {/* Dados clínicos */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Dados Clínicos</span>
              </div>
              {[
                ['Condições', profile.conditions],
                ['Alergias', profile.allergies],
                ['Peso', profile.weight ? `${profile.weight} kg` : null],
                ['Altura', profile.height ? `${profile.height} cm` : null],
                ['Creatinina', profile.creatinine ? `${profile.creatinine} mg/dL` : null],
              ].filter(([, v]) => v).map(([l, v], i, arr) => (
                <div key={String(l)} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '11px 14px', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>{l}</div>
                  <div style={{ padding: '11px 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{String(v)}</div>
                </div>
              ))}
            </div>

            {/* CrCl calculado */}
            {crcl !== null && crclInfo && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
                  Função Renal — Cockcroft-Gault
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: crclInfo.color, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}>{crcl}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>mL/min</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: crclInfo.color, letterSpacing: '-0.01em' }}>IRC {crclInfo.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      ({profile.age} anos · {profile.weight} kg · Cr {profile.creatinine})
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Medicação resumo */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Medicação ({meds.length})</span>
                <button onClick={() => setTab('meds')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Gerir →</button>
              </div>
              {meds.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Sem medicamentos registados.</div>
              ) : meds.slice(0, 5).map((m, i) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < Math.min(meds.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
              {meds.length > 5 && (
                <div style={{ padding: '11px 18px', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  + {meds.length - 5} mais
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEDICAÇÃO */}
        {tab === 'meds' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Adicionar medicamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 8, marginBottom: 8 }}>
                <input value={newMed.name} onChange={e => setNewMed(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMed()}
                  placeholder="Nome do medicamento *" style={inputStyle} />
                <input value={newMed.dose} onChange={e => setNewMed(f => ({ ...f, dose: e.target.value }))}
                  placeholder="Dose" style={inputStyle} />
                <input value={newMed.frequency} onChange={e => setNewMed(f => ({ ...f, frequency: e.target.value }))}
                  placeholder="Frequência" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input value={newMed.indication} onChange={e => setNewMed(f => ({ ...f, indication: e.target.value }))}
                  placeholder="Indicação (opcional)" style={inputStyle} />
                <button onClick={addMed} disabled={!newMed.name.trim() || addingMed}
                  style={{ padding: '10px 18px', background: newMed.name.trim() && !addingMed ? 'var(--ink)' : 'var(--bg-3)', color: newMed.name.trim() && !addingMed ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: newMed.name.trim() && !addingMed ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {addingMed ? '...' : 'Adicionar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {meds.length === 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                  Sem medicamentos adicionados.
                </div>
              )}
              {meds.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{m.name}</div>
                    {(m.dose || m.frequency || m.indication) && (
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {[m.dose, m.frequency, m.indication ? `para ${m.indication}` : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeMed(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px', flexShrink: 0 }} className="remove-btn">×</button>
                </div>
              ))}
            </div>

            {meds.length >= 2 && (
              <div style={{ marginTop: 14 }}>
                <Link href={`/interactions?profile=${profile.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', background: 'var(--green-light)', color: 'var(--green)', textDecoration: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid var(--green-mid)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Verificar interações entre {meds.length} medicamentos →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* NOTAS */}
        {tab === 'notes' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Notas clínicas</div>
              {profile.notes ? (
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{profile.notes}</div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                  Sem notas. Edita este perfil em <Link href="/perfis" style={{ color: 'var(--green)' }}>Perfis</Link> para adicionar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .remove-btn:hover { color: var(--red) !important; }
        .ai-banner:hover { background: #1a1a2e !important; }
      `}</style>
    </div>
  )
}
