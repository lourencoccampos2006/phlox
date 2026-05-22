'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface CardData {
  name: string | null
  allergies: string | null
  blood_type: string | null
  emergency_contact: string | null
  updated_at: string
  medications: { name: string; dose: string | null; frequency: string | null; indication: string | null }[]
}

export default function EmergencyCardPage() {
  const params = useParams()
  const token = params?.token as string
  const [data, setData] = useState<CardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    document.title = 'Cartão de Emergência — Phlox'
    fetch(`/api/emergency-card/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => { throw new Error(e.error) }))
      .then(setData)
      .catch(e => setError(e.message || 'Erro ao carregar cartão'))
  }, [token])

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>{error}</div>
        <p style={{ fontSize: 14, color: '#7f1d1d', marginTop: 8 }}>Este cartão pode ter sido desativado pelo proprietário.</p>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>A carregar cartão de emergência...</div>
    </div>
  )

  const updatedDate = new Date(data.updated_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
  const cardUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(cardUrl)}&bgcolor=ffffff&color=000000&margin=4`

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .card-root { box-shadow: none !important; border: 2px solid #dc2626 !important; max-width: 100% !important; }
        }
        body { margin: 0; background: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      <div className="no-print" style={{ background: '#dc2626', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🆘</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>CARTÃO DE EMERGÊNCIA MÉDICA — Gerado pelo Phlox</span>
        </div>
        <button onClick={() => window.print()}
          style={{ padding: '7px 18px', background: 'white', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          🖨 Imprimir cartão
        </button>
      </div>

      <div style={{ minHeight: 'calc(100vh - 44px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', background: '#f1f5f9' }}>
        <div className="card-root" style={{ width: '100%', maxWidth: 640, background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ background: '#dc2626', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fecaca', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                🆘 MEDICAÇÃO DE EMERGÊNCIA
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: 'white', fontWeight: 400, marginBottom: 2 }}>
                {data.name || 'Portador do cartão'}
              </div>
              <div style={{ fontSize: 11, color: '#fecaca' }}>Actualizado em {updatedDate}</div>
            </div>
            <img src={qrUrl} alt="QR" width={80} height={80} style={{ borderRadius: 6, flexShrink: 0 }}
              onError={e => (e.currentTarget.style.display = 'none')} />
          </div>

          {/* Critical info row */}
          {(data.allergies || data.blood_type || data.emergency_contact) && (
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #dc2626' }}>
              {data.allergies && (
                <div style={{ flex: 1, background: '#fee2e2', padding: '12px 16px', borderRight: '1px solid #fca5a5' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#991b1b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>⚠ Alergias</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#7f1d1d', lineHeight: 1.4 }}>{data.allergies}</div>
                </div>
              )}
              {data.blood_type && (
                <div style={{ background: '#eff6ff', padding: '12px 16px', borderRight: data.emergency_contact ? '1px solid #bfdbfe' : 'none', minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#1e40af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Grupo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', textAlign: 'center' }}>{data.blood_type}</div>
                </div>
              )}
              {data.emergency_contact && (
                <div style={{ flex: 1, background: '#f0fdf4', padding: '12px 16px' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#166534', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>📞 Contacto de emergência</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#14532d', lineHeight: 1.4 }}>{data.emergency_contact}</div>
                </div>
              )}
            </div>
          )}

          {/* Medication list */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Medicação actual</span>
              <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{data.medications.length}</span>
            </div>

            {data.medications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 14 }}>Sem medicamentos registados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {data.medications.map((med, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < data.medications.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{med.name}</span>
                        {med.dose && <span style={{ fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>{med.dose}</span>}
                        {med.frequency && <span style={{ fontSize: 12, color: '#6b7280' }}>{med.frequency}</span>}
                      </div>
                      {med.indication && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{med.indication}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              Gerado pelo <strong style={{ color: '#dc2626' }}>Phlox</strong> · phloxclinical.com
            </div>
            <div style={{ fontSize: 10, color: '#d1d5db', fontFamily: 'monospace' }}>
              Digitalizar QR para versão mais recente
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
