'use client'

// Cartão de Emergência — estilo Apple Wallet / Google Pay. Gera um link/QR público
// que qualquer médico pode abrir sem login. Inclui nome, grupo sanguíneo, alergias
// e contacto. Imprimível em formato carteira (CR80 simulado).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

interface Card {
  token: string
  name?: string | null
  allergies?: string | null
  blood_type?: string | null
  emergency_contact?: string | null
  active: boolean
  updated_at: string
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function CartaoEmergenciaPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [card, setCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState<Partial<Card>>({})
  const [origin, setOrigin] = useState('')

  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin) }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('emergency_tokens').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: Card | null }) => { setCard(data); setEdit(data || {}); setLoading(false) })
  }, [user, supabase])

  async function generate() {
    if (!user) return
    setSaving(true)
    const t = (await supabase.auth.getSession()).data.session?.access_token
    const r = await fetch('/api/emergency-card/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({
        name: edit.name || null,
        allergies: edit.allergies || null,
        blood_type: edit.blood_type || null,
        emergency_contact: edit.emergency_contact || null,
      }),
    })
    const j = await r.json()
    if (!r.ok) toast.error('Falha ao gerar', j.error || 'erro')
    else {
      // Recarrega a partir da DB
      const { data } = await supabase.from('emergency_tokens').select('*').eq('user_id', user.id).maybeSingle()
      setCard(data); setEdit(data || {})
      toast.success('Cartão atualizado', 'O QR público foi gerado.')
    }
    setSaving(false)
  }

  async function deactivate() {
    if (!confirm('Desativar o cartão? O link público deixa de funcionar.')) return
    await supabase.from('emergency_tokens').update({ active: false }).eq('user_id', user.id)
    setCard(prev => prev ? { ...prev, active: false } : null)
    toast.info('Cartão desativado')
  }

  const link = card && card.active ? `${origin}/emergency/${card.token}` : ''
  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(link)}&size=200x200&margin=2&color=ffffff&bgcolor=dc2626` : ''

  function copyLink() { if (link) { navigator.clipboard.writeText(link); toast.success('Link copiado') } }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fef2f2,#fafbfc 60%)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 640 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,40px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Cartão de Emergência</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Um QR code que qualquer médico ou socorrista pode digitalizar para ver as tuas alergias, grupo sanguíneo e contacto. Sem login. Sem app.</p>
        </div>

        {/* Wallet-style card preview */}
        <div className="wallet-card" style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%)',
          borderRadius: 16, padding: '20px 22px', color: 'white', marginBottom: 16,
          boxShadow: '0 16px 40px -12px rgba(220,38,38,0.45), 0 4px 12px -6px rgba(0,0,0,0.18)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>EMERGÊNCIA · EMERGENCY</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginTop: 4 }}>{card?.name || edit.name || (user?.name) || 'O teu nome'}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 6, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>PHLOX</div>
          </div>

          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, opacity: 0.6, letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>GRUPO</div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.02em', marginTop: 1 }}>{(card?.blood_type || edit.blood_type) || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, opacity: 0.6, letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>ALERGIAS</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1, lineHeight: 1.4 }}>{(card?.allergies || edit.allergies) || 'Nenhuma conhecida'}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, opacity: 0.6, letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>EMERGÊNCIA · LIGAR</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1 }}>{(card?.emergency_contact || edit.emergency_contact) || '—'}</div>
              </div>
            </div>
            <div style={{ background: 'white', padding: 5, borderRadius: 10, lineHeight: 0 }}>
              {qrUrl ? <img src={qrUrl} alt="QR" width={88} height={88} style={{ display: 'block', borderRadius: 6 }} /> :
                <div style={{ width: 88, height: 88, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b', fontSize: 11, fontWeight: 700, borderRadius: 6, textAlign: 'center', padding: 6 }}>QR aparece após gerar</div>
              }
            </div>
          </div>

          <div style={{ position: 'relative', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', fontSize: 10.5, opacity: 0.8, lineHeight: 1.5 }}>
            Digitalize o QR para ver alergias e medicação atual · phloxclinical.com/emergency
          </div>
        </div>

        {/* Acções */}
        {card && card.active && (
          <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', marginBottom: 14, border: '1px solid #e5e7eb', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={copyLink} style={{ flex: 1, padding: '10px 14px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Copiar link</button>
            <button onClick={() => window.print()} style={{ flex: 1, padding: '10px 14px', background: 'white', color: '#0b1120', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>🖨 Imprimir cartão</button>
            <a href={qrUrl} download="phlox-emergency-qr.png" style={{ flex: 1, padding: '10px 14px', background: 'white', color: '#0b1120', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'center', textDecoration: 'none' }}>↓ Guardar QR</a>
          </div>
        )}

        {/* Editor */}
        <div className="focus-hide" style={{ background: 'white', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 12 }}>{card ? 'Atualizar dados' : 'Preencher dados'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>Nome</label>
              <input value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="O teu nome completo" style={inp} />
            </div>
            <div>
              <label style={lbl}>Grupo sanguíneo</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {BLOOD_TYPES.map(bt => {
                  const active = edit.blood_type === bt
                  return (
                    <button key={bt} type="button" onClick={() => setEdit({ ...edit, blood_type: active ? '' : bt })}
                      style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 800, fontFamily: 'var(--font-mono)', border: `1.5px solid ${active ? '#dc2626' : '#e5e7eb'}`, background: active ? '#fef2f2' : 'white', color: active ? '#991b1b' : '#64748b', cursor: 'pointer' }}>
                      {bt}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={lbl}>Alergias</label>
              <textarea rows={2} value={edit.allergies || ''} onChange={e => setEdit({ ...edit, allergies: e.target.value })} placeholder="Ex: Penicilina, AINEs, frutos secos…" style={{ ...inp, resize: 'vertical', minHeight: 60 }} />
            </div>
            <div>
              <label style={lbl}>Contacto de emergência</label>
              <input value={edit.emergency_contact || ''} onChange={e => setEdit({ ...edit, emergency_contact: e.target.value })} placeholder="Ex: Maria Silva, 91X XXX XXX" style={inp} />
            </div>
            <button onClick={generate} disabled={saving} style={{ marginTop: 6, padding: '12px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {saving ? 'A gerar…' : card ? 'Atualizar cartão' : 'Gerar cartão'}
            </button>
            {card && card.active && (
              <button onClick={deactivate} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Desativar cartão
              </button>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center', lineHeight: 1.55 }}>
          O link é público — só inclui o que escreves aqui (sem medicação detalhada nem dados sensíveis). Podes desativá-lo a qualquer momento.
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .wallet-card, .wallet-card * { visibility: visible !important; }
          .wallet-card { position: absolute !important; top: 20mm; left: 20mm; width: 85.6mm; aspect-ratio: 1.586 / 1; }
        }
      `}</style>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }
