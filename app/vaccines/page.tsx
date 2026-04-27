'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

interface VaccineResult {
  profile: string
  up_to_date: { vaccine: string; last_dose?: string; status: string }[]
  due_now: { vaccine: string; why: string; urgency: 'alta' | 'normal' | 'baixa' }[]
  travel_specific?: { destination: string; vaccines: string[] }
  general_advice: string
}

const PROFILES = [
  { id: 'adult', label: 'Adulto saudável' },
  { id: 'elderly', label: 'Idoso (>65 anos)' },
  { id: 'child', label: 'Criança / adolescente' },
  { id: 'pregnancy', label: 'Grávida' },
  { id: 'immunocompromised', label: 'Imunodeprimido' },
  { id: 'traveler', label: 'Viajante' },
  { id: 'healthcare', label: 'Profissional de saúde' },
]

const TRAVEL_DESTINATIONS = [
  'Brasil', 'Angola', 'Moçambique', 'Índia', 'Tailândia', 'África Sub-Sahariana',
  'América Central', 'América do Sul', 'Sudeste Asiático', 'Médio Oriente',
]

export default function VaccinesPage() {
  const { supabase } = useAuth()
  const [profile, setProfile] = useState('adult')
  const [destination, setDestination] = useState('')
  const [result, setResult] = useState<VaccineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/vaccines', { method: 'POST', headers,
        body: JSON.stringify({ profile, destination: destination.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const URGENCY_STYLE = {
    alta:   { bg: 'var(--red-light)', border: '#fecaca', color: 'var(--red)', label: 'URGENTE' },
    normal: { bg: 'var(--amber-light)', border: '#fde68a', color: 'var(--amber)', label: 'EM FALTA' },
    baixa:  { bg: 'var(--green-light)', border: 'var(--green-mid)', color: 'var(--green)', label: 'RECOMENDADO' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Imunização</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 6 }}>Verificador de Vacinas</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Que vacinas estão em falta? O que tomar antes de viajar?</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>O teu perfil</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PROFILES.map(p => (
                  <button key={p.id} onClick={() => setProfile(p.id)}
                    style={{ padding: '9px 12px', border: `1.5px solid ${profile === p.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 6, background: profile === p.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: profile === p.id ? 600 : 400, color: profile === p.id ? 'var(--green)' : 'var(--ink-2)', transition: 'all 0.15s' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {profile === 'traveler' && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Destino de viagem</label>
                <input value={destination} onChange={e => setDestination(e.target.value)}
                  placeholder="Ex: Brasil, Índia, Tailândia..."
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 8 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {TRAVEL_DESTINATIONS.map(d => (
                    <button key={d} onClick={() => setDestination(d)}
                      style={{ background: destination === d ? 'var(--green-light)' : 'var(--bg-2)', border: `1px solid ${destination === d ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: destination === d ? 'var(--green)' : 'var(--ink-3)' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={check} disabled={loading}
              style={{ width: '100%', background: !loading ? 'var(--ink)' : 'var(--bg-3)', color: !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 700, cursor: !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {loading ? 'A verificar...' : 'Verificar vacinação →'}
            </button>
          </div>

          <div>
            {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[60, 100, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}</div>}
            {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{error}</p></div>}
            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)', marginBottom: 10, fontWeight: 400, fontStyle: 'italic' }}>Vacinação em dia?</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Selecciona o teu perfil e verifica que vacinas estão em falta. Para viajantes, recomendações específicas por destino.
                </p>
              </div>
            )}
            {result && !loading && (
              <div className="fade-in">
                <div style={{ background: 'var(--ink)', borderRadius: '10px 10px 0 0', padding: '16px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4, textTransform: 'uppercase' }}>Verificador de Vacinação</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', fontWeight: 400, fontStyle: 'italic' }}>{result.profile}</div>
                </div>

                {result.due_now.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '18px 22px', background: 'white' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Em falta / a actualizar</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.due_now.map((v, i) => {
                        const s = URGENCY_STYLE[v.urgency]
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '12px 14px', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>{v.vaccine}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{v.why}</div>
                            </div>
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, border: `1px solid ${s.border}`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.1em', flexShrink: 0 }}>{s.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {result.travel_specific && (
                  <div style={{ border: '1px solid #bfdbfe', borderTop: 'none', padding: '16px 22px', background: 'var(--blue-light)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Vacinas para {result.travel_specific.destination}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.travel_specific.vaccines.map(v => (
                        <span key={v} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', background: 'white', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: 20 }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.up_to_date.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '16px 22px', background: 'white', borderRadius: '0 0 10px 10px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Vacinação regular</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {result.up_to_date.map((v, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bg-3)', fontSize: 13, color: 'var(--ink-2)' }}>
                          <span style={{ fontWeight: 500 }}>{v.vaccine}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{v.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Confirma sempre com o teu médico ou centro de saúde. As recomendações variam com o historial individual.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}