'use client'

// PhloxCopilot — assistente contextual flutuante (Pro).
// Atalho: Cmd/Ctrl+K abre. Sabe a página atual e qualquer texto selecionado.
// Só aparece para plano Pro (e nunca em páginas públicas).

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { getPhloxContext, subscribePhloxContext, serializeContext } from '@/lib/copilotContext'

const PUBLIC_PREFIXES = ['/', '/about', '/pricing', '/login', '/terms', '/privacy', '/trust', '/institucional', '/blog', '/onboarding']

interface Msg { role: 'user' | 'assistant'; content: string }

export default function PhloxCopilot() {
  const { user, supabase } = useAuth() as any
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState('')
  const [ctxLabel, setCtxLabel] = useState('')   // contexto da página (ex: "Medicamento aberto")
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)  // posição do botão (arrastável)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ ox: number; oy: number; moved: boolean } | null>(null)

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  const isPublic = !user || PUBLIC_PREFIXES.some(p => p === pathname)

  // Acompanha o contexto publicado pelas ferramentas
  useEffect(() => {
    const update = () => setCtxLabel(getPhloxContext()?.label || '')
    update()
    return subscribePhloxContext(update)
  }, [])

  // Posição inicial e persistência do botão
  useEffect(() => {
    try { const s = localStorage.getItem('phlox_copilot_pos'); if (s) setPos(JSON.parse(s)) } catch {}
  }, [])

  // Atalho de teclado Cmd/Ctrl+K
  useEffect(() => {
    if (!isPro || isPublic) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const sel = window.getSelection()?.toString() || ''
        setSelection(sel.slice(0, 1500))
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPro, isPublic])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [msgs, busy])

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    const newMsgs = [...msgs, { role: 'user' as const, content: q }]
    setMsgs(newMsgs); setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const pageContext = serializeContext(getPhloxContext())
      const r = await fetch('/api/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ message: q, path: pathname, selection, context: pageContext, history: newMsgs.slice(-6) }),
      })
      const j = await r.json()
      setMsgs(m => [...m, { role: 'assistant', content: j.reply || j.error || 'Sem resposta.' }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Erro de ligação.' }])
    } finally { setBusy(false); setSelection('') }
  }, [input, busy, msgs, pathname, selection, supabase])

  if (!isPro || isPublic) return null

  // Drag do botão
  function onPointerDown(e: React.PointerEvent) {
    const startX = e.clientX, startY = e.clientY
    const base = pos || { x: window.innerWidth - 72, y: window.innerHeight - 72 }
    dragRef.current = { ox: base.x - startX, oy: base.y - startY, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const nx = Math.max(8, Math.min(window.innerWidth - 60, e.clientX + dragRef.current.ox))
    const ny = Math.max(8, Math.min(window.innerHeight - 60, e.clientY + dragRef.current.oy))
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) dragRef.current.moved = true
    setPos({ x: nx, y: ny })
  }
  function onPointerUp() {
    if (pos) { try { localStorage.setItem('phlox_copilot_pos', JSON.stringify(pos)) } catch {} }
    setTimeout(() => { dragRef.current = null }, 0)
  }
  const btnStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 9000 }
    : { position: 'fixed', bottom: 20, right: 20, zIndex: 9000 }

  return (
    <>
      {/* Botão flutuante arrastável */}
      {!open && (
        <button
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onClick={() => { if (dragRef.current?.moved) return; const s = window.getSelection()?.toString() || ''; setSelection(s.slice(0, 1500)); setOpen(true) }}
          aria-label="Abrir Phlox Copilot"
          title={ctxLabel ? `Copilot · sabe: ${ctxLabel}` : 'Phlox Copilot (⌘K)'}
          style={{
            ...btnStyle, touchAction: 'none',
            width: 52, height: 52, borderRadius: '50%', border: '1px solid #23262d',
            background: '#16181d', color: 'white', cursor: 'grab', boxShadow: '0 6px 24px rgba(22,24,29,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>✦
          {ctxLabel && <span style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: '#0d6e42', border: '2px solid white' }} />}
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9001,
          width: 'min(400px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 100px))',
          background: 'white', border: '1px solid #e7e8ea', borderRadius: 14,
          boxShadow: '0 16px 48px rgba(22,24,29,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #e7e8ea' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#0d6e42', fontSize: 16 }}>✦</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Phlox Copilot</span>
              <span style={{ fontSize: 10, color: '#8b8f99', fontFamily: 'monospace' }}>⌘K</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#8b8f99' }}>×</button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ctxLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#0d6e42', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px' }}>
                <span>👁</span> Estou a ver: <b>{ctxLabel}</b>
              </div>
            )}
            {msgs.length === 0 && (
              <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                Pergunta-me qualquer coisa sobre o que estás a ver. Sei em que página estás{ctxLabel ? ', o que abriste' : ''}{selection ? ' e o que selecionaste' : ''}.
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Explica isto de forma simples', 'Quais os riscos clínicos aqui?', 'Faz-me 3 perguntas sobre isto'].map(s => (
                    <button key={s} onClick={() => setInput(s)} style={{ textAlign: 'left', padding: '8px 10px', background: '#f6f7f8', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: '#374151' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                <div style={{
                  padding: '9px 12px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? '#16181d' : '#f6f7f8',
                  color: m.role === 'user' ? 'white' : '#16181d',
                }}>{m.content}</div>
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#8b8f99', fontSize: 13 }}>A pensar…</div>}
          </div>

          {/* Input */}
          <div style={{ padding: 10, borderTop: '1px solid #e7e8ea' }}>
            {selection && <div style={{ fontSize: 11, color: '#6d28d9', marginBottom: 6, background: '#faf5ff', padding: '4px 8px', borderRadius: 6 }}>↳ com a tua seleção</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Pergunta…" rows={1}
                style={{ flex: 1, resize: 'none', padding: '9px 11px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', maxHeight: 100, boxSizing: 'border-box' }} />
              <button onClick={send} disabled={busy || !input.trim()} style={{
                padding: '9px 14px', background: '#16181d', color: 'white', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: busy || !input.trim() ? 0.5 : 1,
              }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
