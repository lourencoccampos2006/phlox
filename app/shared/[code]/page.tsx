'use client'

import { useState, useEffect, use } from 'react'

interface Med { name: string; dose: string | null; frequency: string | null; indication: string | null; started_at: string | null }
interface Vital { recorded_at: string; hr: number | null; bp_sys: number | null; bp_dia: number | null; spo2: number | null; weight: number | null; glucose: number | null; temp: number | null }

interface LinkData {
  access_level: 'meds_only' | 'meds_vitals' | 'full'
  label: string | null
  medications: Med[]
  name: string | null
  allergies: string | null
  blood_type: string | null
  emergency_contact: string | null
  vitals?: Vital[]
  generated_at: string
}

export default function SharedPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [data, setData] = useState<LinkData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    fetch(`/api/link/${code.toUpperCase()}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [code])

  const latestVital = data?.vitals?.[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>A carregar...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
      <div style={{ fontSize: 48 }}>{error.includes('revogado') ? '🔒' : error.includes('expirou') ? '⏰' : '❌'}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Link inválido</div>
      <div style={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 340 }}>{error}</div>
      <a href="https://phlox.pt" style={{ marginTop: 8, fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>Conhecer o Phlox →</a>
    </div>
  )

  if (!data) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Phlox banner */}
      <div style={{ background: '#0f172a', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>Phlox</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>· {code.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          {new Date(data.generated_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header card */}
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ background: '#0f172a', padding: '18px 20px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Perfil de Saúde Partilhado
              {data.label && ` · ${data.label}`}
            </div>
            <div style={{ fontSize: 22, color: 'white', fontWeight: 600 }}>{data.name || 'Utilizador Phlox'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9', background: data.blood_type ? '#eff6ff' : '#f8fafc' }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Grupo Sanguíneo</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: data.blood_type ? '#1d4ed8' : '#94a3b8', fontFamily: 'monospace' }}>
                {data.blood_type || '—'}
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9', background: data.allergies ? '#fef2f2' : '#f8fafc' }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Alergias</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: data.allergies ? '#991b1b' : '#94a3b8', lineHeight: 1.4 }}>
                {data.allergies || 'Sem alergias conhecidas'}
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Medicamentos</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {data.medications.length}
              </div>
            </div>
          </div>

          {data.emergency_contact && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#fffbeb' }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 8 }}>Contacto de Emergência</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>{data.emergency_contact}</span>
            </div>
          )}
        </div>

        {/* Medications */}
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💊</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Medicação Atual ({data.medications.length})</span>
          </div>
          {data.medications.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Nenhum medicamento registado</div>
          ) : (
            <div>
              {data.medications.map((m, i) => (
                <div key={i} style={{ padding: '12px 18px', borderBottom: i < data.medications.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                    {m.indication && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 1 }}>{m.indication}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {m.dose && <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 600 }}>{m.dose}</div>}
                    {m.frequency && <div style={{ fontSize: 11, color: '#64748b' }}>{m.frequency}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vitals (if access allows) */}
        {data.vitals && data.vitals.length > 0 && latestVital && (
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Último registo de sinais vitais</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                {new Date(latestVital.recorded_at).toLocaleDateString('pt-PT')}
              </span>
            </div>
            <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {latestVital.bp_sys && latestVital.bp_dia && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Tensão</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{latestVital.bp_sys}/{latestVital.bp_dia}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>mmHg</div>
                </div>
              )}
              {latestVital.hr && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>FC</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{latestVital.hr}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>bpm</div>
                </div>
              )}
              {latestVital.spo2 && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>SpO₂</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{latestVital.spo2}%</div>
                </div>
              )}
              {latestVital.weight && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Peso</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{latestVital.weight}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>kg</div>
                </div>
              )}
              {latestVital.glucose && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Glicemia</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{latestVital.glucose}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>mg/dL</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Dados partilhados de forma segura via Phlox</div>
          <a href="https://phlox.pt" style={{ fontSize: 12, color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>Criar o meu perfil de saúde →</a>
        </div>
      </div>
    </div>
  )
}
