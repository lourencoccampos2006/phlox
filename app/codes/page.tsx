'use client'

// Phlox Codes — gerador de QR codes para link, vCard, WiFi ou texto.
// Personalizável (tamanho, margem, cor), pronto a descarregar.
// Útil para profissionais, instituições e marketing.

import { useState, useMemo } from 'react'

type Kind = 'url' | 'text' | 'wifi' | 'vcard' | 'email'

const KINDS: { id: Kind; label: string; icon: string }[] = [
  { id: 'url', label: 'Link', icon: '🔗' },
  { id: 'text', label: 'Texto', icon: '✎' },
  { id: 'wifi', label: 'WiFi', icon: '📶' },
  { id: 'vcard', label: 'Cartão de visita', icon: '👤' },
  { id: 'email', label: 'Email', icon: '✉' },
]

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 5, display: 'block' }

function esc(s: string) { return (s || '').replace(/[\\;,:"]/g, '\\$&') }

export default function CodesPage() {
  const [kind, setKind] = useState<Kind>('url')
  const [size, setSize] = useState(280)
  const [color, setColor] = useState('#0b1120')
  const [margin, setMargin] = useState(2)

  // por tipo
  const [url, setUrl] = useState('https://phloxclinical.com')
  const [text, setText] = useState('')
  const [wifi, setWifi] = useState({ ssid: '', password: '', security: 'WPA' as 'WPA' | 'WEP' | 'nopass' })
  const [vcard, setVcard] = useState({ name: '', org: '', phone: '', email: '', url: '' })
  const [email, setEmail] = useState({ to: '', subject: '', body: '' })

  const data = useMemo(() => {
    switch (kind) {
      case 'url': return url
      case 'text': return text || 'phlox'
      case 'wifi': return `WIFI:T:${wifi.security};S:${esc(wifi.ssid)};${wifi.security !== 'nopass' ? `P:${esc(wifi.password)};` : ''};`
      case 'vcard': return [
        'BEGIN:VCARD', 'VERSION:3.0',
        `FN:${vcard.name}`,
        vcard.org ? `ORG:${vcard.org}` : '',
        vcard.phone ? `TEL:${vcard.phone}` : '',
        vcard.email ? `EMAIL:${vcard.email}` : '',
        vcard.url ? `URL:${vcard.url}` : '',
        'END:VCARD',
      ].filter(Boolean).join('\n')
      case 'email': return `mailto:${email.to}${email.subject || email.body ? '?' : ''}${[
        email.subject ? `subject=${encodeURIComponent(email.subject)}` : '',
        email.body ? `body=${encodeURIComponent(email.body)}` : '',
      ].filter(Boolean).join('&')}`
    }
  }, [kind, url, text, wifi, vcard, email])

  const colorHex = color.replace('#', '')
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}&color=${colorHex}&margin=${margin}&format=png&qzone=${margin}`

  function download() {
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `phlox-qr-${kind}.png`
    a.target = '_blank'
    a.click()
  }

  function copyData() { navigator.clipboard.writeText(data) }

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 940 }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Codes</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Gerar QR Code</h1>
          <p style={{ fontSize: 13.5, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Link, texto, rede WiFi, cartão de visita ou email. Personaliza tamanho, cor e margem; descarrega como PNG.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)', gap: 16, alignItems: 'start' }} className="codes-grid">

          {/* Form */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {KINDS.map(k => (
                <button key={k.id} onClick={() => setKind(k.id)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${kind === k.id ? '#0d6e42' : '#e5e7eb'}`, background: kind === k.id ? '#f0fdf4' : 'white', color: kind === k.id ? '#0d6e42' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {k.icon} {k.label}
                </button>
              ))}
            </div>

            {kind === 'url' && (
              <div><label style={lbl}>URL</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" style={inp} /></div>
            )}
            {kind === 'text' && (
              <div><label style={lbl}>Texto</label><textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Qualquer texto…" style={{ ...inp, resize: 'vertical' }} /></div>
            )}
            {kind === 'wifi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={lbl}>Nome da rede (SSID)</label><input value={wifi.ssid} onChange={e => setWifi({ ...wifi, ssid: e.target.value })} style={inp} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
                  <div><label style={lbl}>Palavra-passe</label><input value={wifi.password} onChange={e => setWifi({ ...wifi, password: e.target.value })} style={inp} /></div>
                  <div><label style={lbl}>Segurança</label><select value={wifi.security} onChange={e => setWifi({ ...wifi, security: e.target.value as any })} style={{ ...inp, cursor: 'pointer' } as any}><option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option><option value="nopass">Aberta</option></select></div>
                </div>
              </div>
            )}
            {kind === 'vcard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={lbl}>Nome</label><input value={vcard.name} onChange={e => setVcard({ ...vcard, name: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>Organização</label><input value={vcard.org} onChange={e => setVcard({ ...vcard, org: e.target.value })} style={inp} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Telefone</label><input value={vcard.phone} onChange={e => setVcard({ ...vcard, phone: e.target.value })} style={inp} /></div>
                  <div><label style={lbl}>Email</label><input value={vcard.email} onChange={e => setVcard({ ...vcard, email: e.target.value })} style={inp} /></div>
                </div>
                <div><label style={lbl}>Site</label><input value={vcard.url} onChange={e => setVcard({ ...vcard, url: e.target.value })} style={inp} /></div>
              </div>
            )}
            {kind === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={lbl}>Para</label><input value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} placeholder="alguem@dominio.pt" style={inp} /></div>
                <div><label style={lbl}>Assunto</label><input value={email.subject} onChange={e => setEmail({ ...email, subject: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>Mensagem</label><textarea value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
              </div>
            )}

            {/* Personalização */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Tamanho ({size}px)</label>
                <input type="range" min={128} max={600} step={16} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={lbl}>Cor</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white' }} />
              </div>
              <div>
                <label style={lbl}>Margem</label>
                <input type="range" min={0} max={6} step={1} value={margin} onChange={e => setMargin(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22, position: 'sticky', top: 80 }}>
            <div style={{ aspectRatio: '1', maxWidth: 320, margin: '0 auto', background: '#f8fafc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} width={size} height={size} alt="QR Code" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={download} style={{ flex: 1, padding: 11, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Descarregar PNG</button>
              <button onClick={copyData} style={{ padding: '11px 14px', background: 'white', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Copiar</button>
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 10, textAlign: 'center', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{data.slice(0, 80)}{data.length > 80 ? '…' : ''}</div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 760px){ .codes-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
