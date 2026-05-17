'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'

type AccessLevel = 'meds_only' | 'meds_vitals' | 'full'

interface LinkInfo {
  code: string
  access_level: AccessLevel
  label: string | null
  views: number
  created_at: string
  expires_at: string | null
}

const ACCESS_OPTIONS: { value: AccessLevel; label: string; desc: string; icon: string }[] = [
  { value: 'meds_only', label: 'Só Medicação', desc: 'Mostra a lista de medicamentos e alergias', icon: '💊' },
  { value: 'meds_vitals', label: 'Medicação + Sinais Vitais', desc: 'Inclui também tensão arterial, peso e outros registos', icon: '📊' },
  { value: 'full', label: 'Perfil Completo', desc: 'Tudo: medicação, sinais vitais, condições e historial', icon: '🏥' },
]

export default function LinkPage() {
  const { user, supabase } = useAuth()
  const [link, setLink] = useState<LinkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('meds_only')
  const [label, setLabel] = useState('')
  const [expireDays, setExpireDays] = useState<number | ''>('')
  const [copied, setCopied] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('phlox_links')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLink(data as LinkInfo)
        setLoading(false)
      })
  }, [user, supabase])

  const generate = async () => {
    if (!user) return
    setGenerating(true)
    setGenError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token
      if (!token) { setGenError('Sessão expirada. Recarrega a página.'); return }
      const res = await fetch('/api/link/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ access_level: accessLevel, label: label || null, expires_in_days: expireDays || null }),
      })
      const data = await res.json()
      if (!res.ok) { setGenError(data.error || 'Erro ao criar link'); return }
      if (data.code) {
        const { data: linkData } = await supabase.from('phlox_links').select('*').eq('code', data.code).maybeSingle()
        if (linkData) setLink(linkData as LinkInfo)
        else setLink({ code: data.code, access_level: accessLevel, label: label || null, views: 0, created_at: new Date().toISOString(), expires_at: null })
        setShowSetup(false)
      } else {
        setGenError(data.error || 'Erro inesperado')
      }
    } catch (e: any) {
      setGenError(e.message || 'Erro de ligação')
    } finally {
      setGenerating(false)
    }
  }

  const revoke = async () => {
    if (!user || !link) return
    setRevoking(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      await fetch('/api/link/generate', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sd.session?.access_token}` },
      })
      setLink(null)
    } finally {
      setRevoking(false)
    }
  }

  const updateAccess = async (level: AccessLevel) => {
    if (!user || !link) return
    try {
      const { data: sd } = await supabase.auth.getSession()
      await fetch('/api/link/generate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ access_level: level }),
      })
      setLink(l => l ? { ...l, access_level: level } : l)
    } catch {}
  }

  const linkUrl = link ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${link.code}` : null

  const copyLink = () => {
    if (!linkUrl) return
    navigator.clipboard?.writeText(linkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Phlox Link</div>
        <div style={{ fontSize: 15, color: 'var(--ink-4)' }}>Inicia sessão para criar o teu link de saúde partilhado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Phlox Link</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>O teu elo de cuidado</div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 560 }}>
            Partilha um link seguro com o teu farmacêutico, médico ou familiar. Eles veem exatamente o que autorizas — sem criar conta.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 680 }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
          </div>
        ) : link ? (

          /* ─── Active link ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Link card */}
            <div style={{ background: 'white', border: '2px solid #10b981', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ background: '#10b981', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🟢</span>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Link ativo</div>
                  <div style={{ fontSize: 14, color: 'white', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>{link.code}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{link.views} visualizações</div>
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <input readOnly value={linkUrl || ''} style={{
                    flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px',
                    fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'var(--bg-2)', outline: 'none',
                  }} />
                  <button onClick={copyLink} style={{
                    padding: '10px 16px', background: copied ? '#10b981' : 'var(--green)', color: 'white',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {copied ? '✓ Copiado' : '📋 Copiar'}
                  </button>
                </div>

                {/* QR */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(linkUrl || '')}`}
                      alt="QR Phlox Link" style={{ width: 96, height: 96, borderRadius: 8, border: '2px solid var(--border)' }} />
                    <div style={{ fontSize: 9, color: 'var(--ink-5)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Digitalizar</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>
                      O teu farmacêutico ou médico pode digitalizar este QR para aceder aos teus dados de saúde sem precisar de criar conta no Phlox.
                    </div>
                    {link.expires_at && (
                      <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                        ⏱️ Expira em {new Date(link.expires_at).toLocaleDateString('pt-PT')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Access level control */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>🔒 Controlar o que é visível</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ACCESS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => updateAccess(opt.value)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: `2px solid ${link.access_level === opt.value ? '#10b981' : 'var(--border)'}`,
                    borderRadius: 10, background: link.access_level === opt.value ? '#f0fdf4' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                    </div>
                    {link.access_level === opt.value && <span style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Revoke */}
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>Revogar link</div>
                <div style={{ fontSize: 11, color: '#b91c1c' }}>O link deixa de funcionar imediatamente. Podes criar um novo a qualquer momento.</div>
              </div>
              <button onClick={revoke} disabled={revoking} style={{
                padding: '9px 16px', background: '#dc2626', color: 'white', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {revoking ? 'A revogar...' : '🗑️ Revogar'}
              </button>
            </div>
          </div>

        ) : showSetup ? (

          /* ─── Setup form ─── */
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>🔗 Criar Phlox Link</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>
              Escolhe o que partilhas e com quem. Podes alterar ou revogar a qualquer momento.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Nível de acesso</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ACCESS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setAccessLevel(opt.value)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      border: `2px solid ${accessLevel === opt.value ? '#10b981' : 'var(--border)'}`,
                      borderRadius: 10, background: accessLevel === opt.value ? '#f0fdf4' : 'white',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                      </div>
                      {accessLevel === opt.value && <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Etiqueta (opcional)</div>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Para o Dr. António Silva"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Expirar após (opcional)</div>
                <select value={expireDays} onChange={e => setExpireDays(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
                  <option value="">Sem expiração</option>
                  <option value="1">1 dia</option>
                  <option value="7">1 semana</option>
                  <option value="30">30 dias</option>
                  <option value="90">3 meses</option>
                </select>
              </div>
            </div>

            {genError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b', marginTop: 8 }}>
                ⚠️ {genError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={generate} disabled={generating} style={{
                flex: 1, padding: '13px', background: 'var(--green)', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              }}>
                {generating ? 'A criar...' : '🔗 Criar Link'}
              </button>
              <button onClick={() => setShowSetup(false)} style={{
                padding: '13px 16px', background: 'white', color: 'var(--ink-4)',
                border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </div>

        ) : (

          /* ─── No link yet ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Nenhum link ativo</div>
              <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
                Cria um link seguro para partilhar os teus dados de saúde com quem precisas — sem obrigares ninguém a criar conta.
              </div>
              <button onClick={() => setShowSetup(true)} style={{
                padding: '14px 28px', background: 'var(--green)', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}>
                🔗 Criar o meu Phlox Link
              </button>
            </div>

            {/* How it works */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Como funciona</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '🔗', title: 'Crias um link único', desc: 'Recebes um código pessoal tipo PHL-4A2F e um QR code' },
                  { icon: '🎯', title: 'Escolhes o que partilhas', desc: 'Só medicação, ou também sinais vitais, ou tudo — tu decides' },
                  { icon: '📲', title: 'O profissional digitaliza', desc: 'O teu farmacêutico ou médico abre o link e vê os teus dados sem conta' },
                  { icon: '🔒', title: 'Revoga quando quiseres', desc: 'O link desativa-se imediatamente. Total controlo.' },
                ].map(step => (
                  <div key={step.icon} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
