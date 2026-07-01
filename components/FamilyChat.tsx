'use client'

// FamilyChat — conversa família ↔ instituição, refeita de raiz (Ronda 8).
// Reutilizável dos DOIS lados: a família (via /api/family-portal, code+verify) e a
// instituição (/family, supabase direto). Não conhece a fonte dos dados — recebe as
// mensagens e uma função de envio. Estilo conversa limpo, bolhas, autoscroll, foto
// opcional, estado vazio acolhedor, envio com Enter. Adaptado ao espaço onde vive.

import { useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  author_side: 'family' | 'staff'
  author_name?: string | null
  content?: string | null
  photo_url?: string | null
  created_at: string
}

interface FamilyChatProps {
  messages: ChatMessage[]
  /** lado de QUEM está a usar este chat (as suas mensagens vão à direita) */
  mySide: 'family' | 'staff'
  /** envia uma mensagem (texto + foto opcional em base64). Devolve true se enviou. */
  onSend: (text: string, imageBase64?: string) => Promise<boolean>
  /** título opcional (ex.: nome do utente/familiar) */
  title?: string
  /** altura do painel de mensagens */
  height?: number
  accent?: string
  /** nome de quem está do outro lado (para o vazio) */
  otherLabel?: string
}

export default function FamilyChat({ messages, mySide, onSend, title, height = 380, accent = '#b45309', otherLabel = 'a instituição' }: FamilyChatProps) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sorted = [...messages].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function pickPhoto(file: File) {
    const dataUrl: string = await new Promise((res, rej) => {
      const img = new window.Image(); const url = URL.createObjectURL(file)
      img.onload = () => { URL.revokeObjectURL(url); let w = img.width, h = img.height; const max = 1280; if (w > max || h > max) { if (w >= h) { h = Math.round(h * max / w); w = max } else { w = Math.round(w * max / h); h = max } } const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); if (!ctx) return rej(new Error('canvas')); ctx.drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.82)) }
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')) }; img.src = url
    })
    setPhoto(dataUrl)
  }

  async function send() {
    const t = text.trim()
    if ((!t && !photo) || sending) return
    setSending(true)
    const ok = await onSend(t, photo ? photo.split(',')[1] : undefined)
    setSending(false)
    if (ok) { setText(''); setPhoto(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid #e9eaec', borderRadius: 16, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{title}</div>
      )}

      {/* Mensagens */}
      <div style={{ height, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fbfaf8' }}>
        {sorted.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', padding: 20 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>Ainda sem mensagens</div>
            <div style={{ fontSize: 12.5, marginTop: 2 }}>Escreva a primeira mensagem a {otherLabel}.</div>
          </div>
        ) : sorted.map(m => {
          const mine = m.author_side === mySide
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%', background: mine ? accent : 'white', color: mine ? 'white' : '#0b1120', border: mine ? 'none' : '1px solid #e9eaec', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: m.photo_url ? 4 : '9px 13px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                {!mine && m.author_name && <div style={{ fontSize: 11, fontWeight: 700, color: accent, padding: m.photo_url ? '5px 9px 2px' : '0 0 2px' }}>{m.author_name}</div>}
                {m.photo_url && <img src={m.photo_url} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginBottom: m.content ? 6 : 0 }} />}
                {m.content && <div style={{ fontSize: 14, lineHeight: 1.45, padding: m.photo_url ? '0 9px 6px' : 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>}
                <div style={{ fontSize: 10, opacity: 0.7, textAlign: 'right', padding: m.photo_url ? '0 9px 6px' : '3px 0 0' }}>{new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Pré-visualização da foto escolhida */}
      {photo && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={photo} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} />
          <span style={{ fontSize: 12.5, color: '#64748b', flex: 1 }}>Foto pronta a enviar</span>
          <button onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Barra de envio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} aria-label="Anexar foto" style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid #e9eaec', background: 'white', cursor: 'pointer', fontSize: 18, flexShrink: 0, color: '#64748b' }}>＋</button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Escreva uma mensagem…"
          style={{ flex: 1, minWidth: 0, border: '1.5px solid #e9eaec', borderRadius: 22, padding: '10px 16px', fontSize: 14, outline: 'none', background: '#f8fafc' }}
        />
        <button onClick={send} disabled={sending || (!text.trim() && !photo)} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: sending || (!text.trim() && !photo) ? '#e2e8f0' : accent, color: 'white', cursor: sending || (!text.trim() && !photo) ? 'default' : 'pointer', fontSize: 17, flexShrink: 0, fontWeight: 700 }}>↑</button>
      </div>
    </div>
  )
}
