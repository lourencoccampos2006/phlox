'use client'

// Portal público do familiar — acesso por código do residente, sem conta Phlox.
// Vê o fio de conversa do seu ente querido (atualizações, fotos, boletins) e responde.

import { useState, useEffect, useRef, useCallback } from 'react'

interface Msg {
  id: string; author_side: 'staff' | 'family'; author_name?: string
  kind: 'message' | 'update' | 'wellbeing' | 'photo' | 'milestone' | 'system'
  content?: string; photo_url?: string; mood?: string; meals?: string; activity?: string; created_at: string
}

const MOOD = { bom: '😊 Bem-disposto(a)', razoavel: '😐 Razoável', mau: '😔 Em baixo' } as Record<string, string>
const MEALS = { tudo: '🍽️ Comeu tudo', parte: '🥄 Comeu parte', pouco: '⚠️ Comeu pouco' } as Record<string, string>
const ACT = { ativo: '🚶 Ativo(a)', calmo: '🛋️ Tranquilo(a)', na_cama: '🛏️ Mais na cama' } as Record<string, string>

export default function FamilyPortalPage() {
  const [code, setCode] = useState('')
  const [entered, setEntered] = useState('')
  const [patient, setPatient] = useState<{ name: string; room_number?: string } | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Lembrar código e nome neste dispositivo
  useEffect(() => {
    const c = localStorage.getItem('phlox-familia-code')
    const n = localStorage.getItem('phlox-familia-name')
    if (n) setName(n)
    if (c) { setCode(c); setEntered(c) }
  }, [])

  const fetchThread = useCallback(async (c: string) => {
    if (!c) return
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/family-portal?code=${encodeURIComponent(c)}`)
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erro'); setPatient(null); setEntered(''); localStorage.removeItem('phlox-familia-code'); return }
      setPatient(data.patient); setMsgs(data.messages || [])
      localStorage.setItem('phlox-familia-code', c)
    } catch { setErr('Falha de ligação. Tenta novamente.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (entered) fetchThread(entered) }, [entered, fetchThread])

  // Poll leve enquanto o fio está aberto (sem auth → sem realtime)
  useEffect(() => {
    if (!entered || !patient) return
    const t = setInterval(() => fetchThread(entered), 20000)
    return () => clearInterval(t)
  }, [entered, patient, fetchThread])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      localStorage.setItem('phlox-familia-name', name)
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: entered, name, content: text.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.message) { setMsgs(prev => [...prev, data.message]); setText('') }
    } finally { setSending(false) }
  }

  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }

  // ── Ecrã de entrada (código) ──
  if (!patient) {
    return (
      <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Phlox · Portal Família</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1120', margin: '0 0 6px' }}>Acompanhe o seu familiar</h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 22px' }}>Introduza o código que a instituição lhe forneceu para ver as atualizações e falar com a equipa.</p>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Código de acesso</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: AB12CD"
            onKeyDown={e => e.key === 'Enter' && code.trim() && setEntered(code.trim())}
            style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center', boxSizing: 'border-box', outline: 'none', textTransform: 'uppercase' }} />
          {err && <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}
          <button onClick={() => code.trim() && setEntered(code.trim())} disabled={!code.trim() || loading}
            style={{ width: '100%', marginTop: 16, padding: 14, background: code.trim() ? '#2563eb' : '#e5e7eb', color: code.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: code.trim() ? 'pointer' : 'default' }}>
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
          <div style={{ marginTop: 18, fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>O acesso é pessoal. Não partilhe o código fora do círculo familiar.</div>
        </div>
      </div>
    )
  }

  // ── Fio de conversa ──
  return (
    <div style={wrap}>
      <div style={{ background: '#2563eb', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Portal Família · Phlox</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{patient.name}{patient.room_number ? ` · Quarto ${patient.room_number}` : ''}</div>
        </div>
        <button onClick={() => { setEntered(''); setPatient(null); localStorage.removeItem('phlox-familia-code') }}
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {msgs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40, lineHeight: 1.6 }}>Ainda não há mensagens. A equipa irá partilhar atualizações sobre {patient.name} aqui.</div>
        ) : msgs.map(m => {
          const isFamily = m.author_side === 'family'
          const time = new Date(m.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isFamily ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{ maxWidth: '82%' }}>
                <div style={{ background: isFamily ? '#2563eb' : '#fff', color: isFamily ? '#fff' : '#0b1120', border: isFamily ? 'none' : '1px solid #e5e7eb', borderRadius: isFamily ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '11px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {m.kind === 'wellbeing' ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: 6 }}>Como correu o dia</div>
                      {[MOOD[m.mood || ''], MEALS[m.meals || ''], ACT[m.activity || '']].filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 14, marginBottom: 2 }}>{l}</div>)}
                      {m.content && <div style={{ fontSize: 14, marginTop: 7, lineHeight: 1.5 }}>{m.content}</div>}
                    </div>
                  ) : (
                    <>
                      {m.kind === 'update' && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.65, marginBottom: 4 }}>📋 Atualização</div>}
                      {m.photo_url && <img src={m.photo_url} alt="" style={{ width: '100%', borderRadius: 9, marginBottom: m.content ? 7 : 0, display: 'block' }} />}
                      {m.content && <div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, textAlign: isFamily ? 'right' : 'left' }}>{m.author_name || (isFamily ? 'Família' : 'Equipa')} · {time}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff', padding: '10px 14px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!name && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="O seu nome (ex: Maria, filha)"
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={1} placeholder="Escreva uma mensagem à equipa…"
              style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 13px', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ flexShrink: 0, padding: '11px 18px', background: text.trim() ? '#2563eb' : '#e5e7eb', color: text.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'default' }}>
              {sending ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
