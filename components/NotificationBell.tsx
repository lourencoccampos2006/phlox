'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface N { id: string; type: string; title: string; body: string; href: string; created_at: string; priority: 'high' | 'normal' }

function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`
}

export default function NotificationBell() {
  const { user, supabase } = useAuth()
  const [open, setOpen] = useState(false)
  const [dropRight, setDropRight] = useState(20)
  const [notifs, setNotifs] = useState<N[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      if (!token) return
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const d = await res.json()
      setNotifs(d.notifications || [])
      setUnread(d.unread || 0)
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [user, supabase])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!user) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => {
        const next = !open
        if (next && ref.current) {
          const rect = ref.current.getBoundingClientRect()
          setDropRight(window.innerWidth - rect.right)
        }
        setOpen(next)
        if (next) setUnread(0)
      }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 7, color: 'var(--ink-3)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', fontFamily: 'var(--font-mono)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 499 }} />
          <div style={{ position: 'fixed', right: Math.max(8, dropRight), top: 64, width: 'min(320px, calc(100vw - 16px))', background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.14)', zIndex: 500, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notificações</span>
            </div>
            {notifs.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Sem notificações recentes</div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifs.map((n, i) => (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                    className="notif-item"
                    style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: i < notifs.length - 1 ? '1px solid #f8fafc' : 'none', textDecoration: 'none', background: 'white' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.priority === 'high' ? '#dc2626' : '#3b82f6', flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                    </div>
                    <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0 }}>{ago(n.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

