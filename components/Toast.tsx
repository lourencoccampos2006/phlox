'use client'

// Phlox Toast — sistema de notificações in-app. Provider + hook useToast.
// Empilha múltiplas mensagens, com tipo (success/error/info), auto-dismiss e
// botão de fechar. Posição: canto inferior direito (não interfere com o cockpit).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ToastKind = 'success' | 'error' | 'info' | 'warn'
export interface ToastItem { id: string; kind: ToastKind; title: string; description?: string; duration?: number }

interface ToastCtx {
  toast: (input: Omit<ToastItem, 'id'>) => string
  success: (title: string, desc?: string) => string
  error: (title: string, desc?: string) => string
  info: (title: string, desc?: string) => string
  warn: (title: string, desc?: string) => string
  dismiss: (id: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const c = useContext(Ctx)
  if (!c) {
    // fallback silencioso (não rebenta em testes ou contextos sem Provider)
    return {
      toast: () => '',
      success: () => '',
      error: () => '',
      info: () => '',
      warn: () => '',
      dismiss: () => { /* noop */ },
    }
  }
  return c
}

let counter = 0
const newId = () => `t${++counter}-${Date.now()}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => setItems(p => p.filter(t => t.id !== id)), [])

  const toast = useCallback((input: Omit<ToastItem, 'id'>) => {
    const id = newId()
    const t: ToastItem = { id, duration: 5000, ...input }
    setItems(p => [...p, t].slice(-6))
    if ((t.duration || 0) > 0) setTimeout(() => dismiss(id), t.duration)
    return id
  }, [dismiss])

  const api: ToastCtx = {
    toast,
    success: (title, desc) => toast({ kind: 'success', title, description: desc }),
    error: (title, desc) => toast({ kind: 'error', title, description: desc, duration: 8000 }),
    info: (title, desc) => toast({ kind: 'info', title, description: desc }),
    warn: (title, desc) => toast({ kind: 'warn', title, description: desc }),
    dismiss,
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <Stack items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}

const STYLE: Record<ToastKind, { color: string; bg: string; icon: string }> = {
  success: { color: '#15803d', bg: '#f0fdf4', icon: '✓' },
  error:   { color: '#991b1b', bg: '#fef2f2', icon: '✗' },
  info:    { color: '#1e40af', bg: '#eff6ff', icon: 'i' },
  warn:    { color: '#92400e', bg: '#fffbeb', icon: '!' },
}

function Stack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  if (typeof window === 'undefined') return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 16, left: 'auto', zIndex: 9000, display: 'flex', flexDirection: 'column-reverse', gap: 10, maxWidth: 'min(380px, calc(100vw - 32px))', pointerEvents: 'none' }}>
      {items.map(t => <ToastNode key={t.id} t={t} onDismiss={onDismiss} />)}
    </div>
  )
}

function ToastNode({ t, onDismiss }: { t: ToastItem; onDismiss: (id: string) => void }) {
  const s = STYLE[t.kind]
  const [open, setOpen] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setOpen(true)) }, [])
  return (
    <div style={{
      pointerEvents: 'auto', background: 'white', border: `1px solid ${s.color}33`,
      borderLeft: `4px solid ${s.color}`, borderRadius: 12, padding: '12px 14px',
      boxShadow: '0 8px 26px -10px rgba(8,12,24,0.18), 0 4px 12px -6px rgba(8,12,24,0.08)',
      display: 'flex', gap: 11, alignItems: 'flex-start',
      transform: open ? 'translateX(0)' : 'translateX(24px)',
      opacity: open ? 1 : 0,
      transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.22s',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1, fontFamily: 'var(--font-mono)' }}>{s.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', lineHeight: 1.4 }}>{t.title}</div>
        {t.description && <div style={{ fontSize: 12.5, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>{t.description}</div>}
      </div>
      <button onClick={() => onDismiss(t.id)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}>×</button>
    </div>
  )
}
