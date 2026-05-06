'use client'

// ─── REDESIGN: app/vaccines/page.tsx ───
// Verificador de vacinas completamente redesenhado.
// Ligado aos perfis reais (pessoal + familiares).
// Mostra o PNV português concreto, não uma resposta genérica.

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'

interface VaccineResult {
  profile: string
  due_now: { vaccine: string; why: string; urgency: 'alta' | 'normal' | 'baixa'; where: string }[]
  up_to_date: { vaccine: string; schedule: string }[]
  travel_specific?: { destination: string; vaccines: { name: string; notes: string }[] } | null
  next_appointment: string
  general_advice: string
}

// ─── Calendário PNV estático por grupo ───────────────────────────────────────
// Fonte: DGS Portugal, PNV 2024

const PNV_GROUPS = [
  { id: 'adult',             label: 'Adulto (18–64 anos)',     icon: '👤' },
  { id: 'elderly',           label: 'Idoso (≥65 anos)',        icon: '👴' },
  { id: 'child_0_2',         label: 'Bebé (0–2 anos)',         icon: '👶' },
  { id: 'child_3_10',        label: 'Criança (3–10 anos)',     icon: '🧒' },
  { id: 'adolescent',        label: 'Adolescente (11–17 anos)', icon: '🧑' },
  { id: 'pregnancy',         label: 'Grávida',                 icon: '🤰' },
  { id: 'immunocompromised', label: 'Imunodeprimido',          icon: '💊' },
  { id: 'healthcare',        label: 'Profissional de saúde',   icon: '⚕️' },
  { id: 'traveler',          label: 'Viajante internacional',  icon: '✈️' },
]

const TRAVEL_DESTINATIONS = [
  'Brasil', 'Angola', 'Moçambique', 'Cabo Verde', 'Índia',
  'Tailândia', 'Vietname', 'África Subsaariana', 'América Central',
  'América do Sul', 'Sudeste Asiático', 'Médio Oriente', 'Marrocos',
]

const URGENCY = {
  alta:   { label: 'URGENTE',      bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', dot: '#dc2626' },
  normal: { label: 'EM FALTA',     bg: '#fef9c3', border: '#fde68a', color: '#854d0e', dot: '#d97706' },
  baixa:  { label: 'RECOMENDADO',  bg: '#f0fdf5', border: '#bbf7d0', color: '#14532d', dot: '#16a34a' },
}

export default function VaccinesPage() {
  const { user, supabase } = useAuth()
  const [group, setGroup] = useState('adult')
  const [destination, setDestination] = useState('')
  const [knownVaccines, setKnownVaccines] = useState('')
  const [age, setAge] = useState('')
  const [result, setResult] = useState<VaccineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeProfile, setActiveProfile] = useState(getActiveProfile())

  // ─── Auto-preencher grupo a partir do perfil activo ─────────────────────
  useEffect(() => {
    const p = getActiveProfile()
    setActiveProfile(p)
    // ─── age agora faz parte do tipo ActiveProfile ───
    if (p && p.age) {
      const a = p.age
      if (a < 3)        setGroup('child_0_2')
      else if (a < 11)  setGroup('child_3_10')
      else if (a < 18)  setGroup('adolescent')
      else if (a >= 65) setGroup('elderly')
      else              setGroup('adult')
      setAge(String(a))
    }
  }, [])

  const check = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/vaccines', {
        method: 'POST', headers,
        body: JSON.stringify({
          profile: group,
          age: age ? parseInt(age) : null,
          destination: destination.trim(),
          own_vaccines: knownVaccines.trim(),
          profile_name: activeProfile?.name || null,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const selectedGroup = PNV_GROUPS.find(g => g.id === group)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: 'var(--green)', borderRadius: 1 }} />
            Imunização · PNV Portugal
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8 }}>
            Verificador de Vacinas
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 520 }}>
            Com base no Programa Nacional de Vacinação (DGS Portugal) e guidelines ECDC. Diz-nos o perfil e o que já tomaste.
          </p>
        </div>

        <div className="interactions-layout">
          {/* ── Painel esquerdo ─────────────────────────────────────────── */}
          <div className="sticky-panel">

            {/* Selector de perfil */}
            {user && (
              <div style={{ marginBottom: 12 }}>
                <ProfileSelector
                  onChange={p => {
                    setActiveProfile(p)
                    if (p.age) {
                      const a = p.age
                      if (a < 3)        setGroup('child_0_2')
                      else if (a < 11)  setGroup('child_3_10')
                      else if (a < 18)  setGroup('adolescent')
                      else if (a >= 65) setGroup('elderly')
                      else              setGroup('adult')
                      setAge(String(a))
                    }
                  }}
                />
              </div>
            )}

            {/* Grupo etário / perfil */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Perfil
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {PNV_GROUPS.map(g => (
                  <button key={g.id} onClick={() => setGroup(g.id)}
                    style={{ padding: '8px 10px', border: `1.5px solid ${group === g.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 7, background: group === g.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: group === g.id ? 700 : 400, color: group === g.id ? 'var(--green-2)' : 'var(--ink-2)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{g.icon}</span>
                    <span style={{ lineHeight: 1.3 }}>{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Idade (opcional) */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Idade (opcional)</div>
              <input value={age} onChange={e => setAge(e.target.value)} type="number" min="0" max="120"
                placeholder="ex: 68"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                Permite recomendações mais precisas
              </div>
            </div>

            {/* Destino de viagem */}
            {(group === 'traveler' || group === 'adult' || group === 'elderly') && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Destino de viagem (opcional)
                </div>
                <select value={destination} onChange={e => setDestination(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', color: destination ? 'var(--ink)' : 'var(--ink-4)' }}>
                  <option value="">Sem viagem planeada</option>
                  {TRAVEL_DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Vacinas já tomadas */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Vacinas já tomadas (opcional)
              </div>
              <textarea value={knownVaccines} onChange={e => setKnownVaccines(e.target.value)}
                placeholder="ex: COVID-19 (3 doses), Gripe 2023, Tétano 2019..."
                rows={3}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
                Quanto mais detalhe, melhor a análise
              </div>
            </div>

            <button onClick={check} disabled={loading}
              style={{ width: '100%', background: loading ? 'var(--bg-3)' : 'var(--ink)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}>
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid var(--ink-4)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  A consultar PNV...
                </>
              ) : (
                <>
                  <span>💉</span> Verificar vacinas {activeProfile?.name ? `de ${activeProfile.name}` : ''}
                </>
              )}
            </button>

            {error && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                {error}
              </div>
            )}
          </div>

          {/* ── Painel direito — resultado ───────────────────────────────── */}
          <div>
            {!result && !loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💉</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 10, fontWeight: 400 }}>
                  Programa Nacional de Vacinação
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }}>
                  Selecciona o perfil {selectedGroup ? `(${selectedGroup.icon} ${selectedGroup.label})` : ''}, preenche as vacinas já tomadas e recebe o que está em falta com base no PNV Portugal actualizado.
                </p>
                {/* Mini guia PNV estático */}
                <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left', maxWidth: 480, margin: '24px auto 0' }}>
                  {[
                    { v: 'Covid-19', note: 'Reforço anual recomendado (>60a, grupos risco)' },
                    { v: 'Gripe', note: 'Anual, Outubro–Novembro' },
                    { v: 'Tétano-Difteria', note: 'Reforço de 10 em 10 anos (Td)' },
                    { v: 'Pneumocócica', note: 'Dose única ≥65a ou doenças crónicas' },
                    { v: 'Herpes Zóster', note: 'Recomendada ≥65a (Shingrix, 2 doses)' },
                    { v: 'VPH', note: 'Rapazes e raparigas, 10–13 anos (PNV)' },
                  ].map(({ v, note }) => (
                    <div key={v} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{v}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--ink-3)' }}>
                  <div style={{ width: 20, height: 20, border: '2.5px solid var(--green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>A consultar PNV e guidelines ECDC...</span>
                </div>
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Em falta / urgentes */}
                {result.due_now.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Vacinas em falta ou a actualizar
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{result.due_now.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {result.due_now.map((item, i) => {
                        const u = URGENCY[item.urgency] || URGENCY.baixa
                        return (
                          <div key={i} style={{ padding: '16px 18px', borderBottom: i < result.due_now.length - 1 ? '1px solid var(--bg-3)' : 'none', background: i % 2 === 0 ? 'white' : 'var(--bg-2)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: u.dot, flexShrink: 0, marginTop: 2 }} />
                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{item.vaccine}</span>
                              </div>
                              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: u.color, background: u.bg, border: `1px solid ${u.border}`, borderRadius: 3, padding: '2px 7px', letterSpacing: '0.06em', flexShrink: 0 }}>
                                {u.label}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 6px 16px' }}>{item.why}</p>
                            {item.where && (
                              <div style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', margin: '0 0 0 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>📍</span> {item.where}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Vacinas em dia */}
                {result.up_to_date.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Calendário de vacinação
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0 }}>
                      {result.up_to_date.map((item, i) => (
                        <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-3)', borderRight: '1px solid var(--bg-3)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{item.vaccine}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{item.schedule}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Viagem */}
                {result.travel_specific && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '18px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✈️</span> Vacinas para {result.travel_specific.destination}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.travel_specific.vaccines.map((v, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: '#1d4ed8', fontSize: 13, flexShrink: 0, marginTop: 1 }}>→</span>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{v.name}</span>
                            {v.notes && <span style={{ fontSize: 12, color: '#3b82f6', marginLeft: 6 }}>{v.notes}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>
                      Consulta de medicina de viagem recomendada ≥4 semanas antes da partida
                    </div>
                  </div>
                )}

                {/* Próxima consulta */}
                {result.next_appointment && (
                  <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>📅</span>
                    <div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Próximo passo</div>
                      <div style={{ fontSize: 14, color: 'var(--green-2)', lineHeight: 1.6 }}>{result.next_appointment}</div>
                    </div>
                  </div>
                )}

                {/* Conselho geral */}
                {result.general_advice && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Nota clínica</div>
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{result.general_advice}</p>
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                      Fonte: DGS Portugal · PNV 2024 · ECDC Guidelines
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                  ⚠️ Informação baseada no PNV Portugal e guidelines ECDC. Confirma sempre com o teu médico ou centro de saúde, especialmente em casos de imunodepressão, gravidez ou doenças crónicas.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}