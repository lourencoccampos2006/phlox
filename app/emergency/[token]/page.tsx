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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--badge-red-bg)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{error}</div>
        <p style={{ fontSize: 14, color: 'var(--red)', marginTop: 8 }}>Este cartão pode ter sido desativado pelo proprietário.</p>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-4)' }}>A carregar cartão de emergência...</div>
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
          .card-root { box-shadow: none !important; border: 2px solid var(--red) !important; max-width: 100% !important; }
        }
        body { margin: 0; background: var(--bg-3); font-family: var(--font-sans); }
      `}</style>

      <div className="no-print" style={{ background: 'var(--red)', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🆘</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>CARTÃO DE EMERGÊNCIA MÉDICA — Gerado pelo Phlox</span>
        </div>
        <button onClick={() => window.print()}
          style={{ padding: '7px 18px', background: 'white', color: 'var(--red)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          🖨 Imprimir cartão
        </button>
      </div>

      <div style={{ minHeight: 'calc(100vh - 44px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', background: 'var(--bg-3)' }}>
        <div className="card-root" style={{ width: '100%', maxWidth: 640, background: 'white', borderRadius: 'var(--r-xl)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ background: 'var(--red)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--badge-red-border)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                🆘 MEDICAÇÃO DE EMERGÊNCIA
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: 'white', fontWeight: 400, marginBottom: 2 }}>
                {data.name || 'Portador do cartão'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--badge-red-border)' }}>Actualizado em {updatedDate}</div>
            </div>
            <img src={qrUrl} alt="QR" width={80} height={80} style={{ borderRadius: 'var(--r)', flexShrink: 0 }}
              onError={e => (e.currentTarget.style.display = 'none')} />
          </div>

          {/* Critical info row */}
          {(data.allergies || data.blood_type || data.emergency_contact) && (
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--red)' }}>
              {data.allergies && (
                <div style={{ flex: 1, background: 'var(--badge-red-bg)', padding: '12px 16px', borderRight: '1px solid var(--badge-red-border)' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>⚠ Alergias</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', lineHeight: 1.4 }}>{data.allergies}</div>
                </div>
              )}
              {data.blood_type && (
                <div style={{ background: 'var(--bg-2)', padding: '12px 16px', borderRight: data.emergency_contact ? '1px solid var(--border)' : 'none', minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Grupo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-2)', textAlign: 'center' }}>{data.blood_type}</div>
                </div>
              )}
              {data.emergency_contact && (
                <div style={{ flex: 1, background: 'var(--badge-green-bg)', padding: '12px 16px' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--green-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>📞 Contacto de emergência</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-3)', lineHeight: 1.4 }}>{data.emergency_contact}</div>
                </div>
              )}
            </div>
          )}

          {/* Medication list */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Medicação actual</span>
              <span style={{ background: 'var(--bg-3)', color: 'var(--ink-4)', padding: '2px 8px', borderRadius: 'var(--r-lg)', fontSize: 10, fontWeight: 700 }}>{data.medications.length}</span>
            </div>

            {data.medications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-5)', fontSize: 14 }}>Sem medicamentos registados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {data.medications.map((med, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < data.medications.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{med.name}</span>
                        {med.dose && <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{med.dose}</span>}
                        {med.frequency && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{med.frequency}</span>}
                      </div>
                      {med.indication && (
                        <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{med.indication}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--bg-3)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>
              Gerado pelo <strong style={{ color: 'var(--red)' }}>Phlox</strong> · phloxclinical.com
            </div>
            <div style={{ fontSize: 10, color: 'var(--border-2)', fontFamily: 'monospace' }}>
              Digitalizar QR para versão mais recente
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
