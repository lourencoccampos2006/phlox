'use client'

// /telemed/sala/[token] — Sala virtual pública (paciente OU clínico via link)
// Implementação simples baseada em Jitsi Meet (iframe) — sem necessidade de
// servidor próprio. O token da sessão Phlox vira o nome da sala Jitsi.

import { useEffect, useState, use } from 'react'

interface SessionInfo {
  id: string; status: string; scheduled_at: string; duration_min: number
  motive: string|null; provider: string; room_token: string; recording_consent: boolean
}

const ACCENT = '#0d6e42'

export default function TelemedRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    fetch(`/api/telemed/room/${token}`)
      .then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setInfo(j.session) })
      .catch(e => setErr(e.message))
  }, [token])

  if (err) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sala indisponível</h1>
          <p style={{ color: '#dc2626' }}>{err}</p>
        </div>
      </main>
    )
  }

  if (!info) return <main style={page}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  if (joined) {
    const roomName = `phlox-${info.room_token}`
    const displayName = encodeURIComponent(name || 'Convidado')
    // Usa meet.jit.si como backend. Em produção pode trocar para auto-hosting.
    const src = `https://meet.jit.si/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`
    return (
      <main style={{ position: 'fixed', inset: 0, background: 'black' }}>
        <iframe
          src={src}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </main>
    )
  }

  return (
    <main style={page}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: ACCENT, color: 'white', fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>📹</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sala de consulta</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {new Date(info.scheduled_at).toLocaleString('pt-PT')} · {info.duration_min} min
          </p>
        </div>

        {info.motive && (
          <div style={{ background: '#f9fafb', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            <b>Motivo:</b> {info.motive}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>O teu nome</label>
        <input value={name} onChange={e => setName(e.target.value)} style={input} placeholder="Como te chamas?" />

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginTop: 14, color: '#374151' }}>
          <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Aceito participar nesta consulta virtual. Compreendo que poderá ser gravada se for dado consentimento adicional pelo profissional de saúde. A consulta é em tempo real entre mim e o profissional clínico.
          </span>
        </label>

        <button
          disabled={!consentChecked || !name.trim()}
          onClick={() => setJoined(true)}
          style={{
            marginTop: 16, padding: '12px 18px', border: 'none', borderRadius: 10,
            cursor: (!consentChecked || !name.trim()) ? 'not-allowed' : 'pointer',
            background: ACCENT, color: 'white', fontWeight: 700, fontSize: 15, width: '100%',
            opacity: (!consentChecked || !name.trim()) ? 0.5 : 1,
          }}
        >
          Entrar na sala
        </button>

        <p style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
          A consulta usa cifra ponto-a-ponto. Verifica a tua câmara e microfone antes de entrar.
        </p>
      </div>
    </main>
  )
}

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#f9fafb', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 16,
}
const card: React.CSSProperties = {
  background: 'white', borderRadius: 14, padding: 24, maxWidth: 440, width: '100%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
}
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
}
