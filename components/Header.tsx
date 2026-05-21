'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import NotificationBell from '@/components/NotificationBell'
import { useState, useEffect, useRef, useCallback } from 'react'
import { NAV_CATEGORIES, PERSONA_NAV, MODE_QUICK_ACTIONS, type NavTool } from '@/lib/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

type HeaderUser = {
  id: string
  name: string
  email: string
  avatar: string
  experience_mode: ExperienceMode
  plan: string
  onboarded: boolean
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

function SearchBar({ onClose, mode }: { onClose: () => void; mode: ExperienceMode }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allTools: (NavTool & { categoryLabel: string; categoryColor: string })[] = NAV_CATEGORIES.flatMap(cat =>
    cat.tools.map(t => ({ ...t, categoryLabel: cat.label, categoryColor: cat.color }))
  )

  const modeQuickHrefs = new Set((MODE_QUICK_ACTIONS[mode] || MODE_QUICK_ACTIONS.personal).map(a => a.href))
  const popularTools = [
    ...allTools.filter(t => modeQuickHrefs.has(t.href)),
    ...allTools.filter(t => !modeQuickHrefs.has(t.href)),
  ].slice(0, 8)

  const filtered = query.trim()
    ? allTools.filter(t =>
        t.label.toLowerCase().includes(query.toLowerCase()) ||
        t.desc.toLowerCase().includes(query.toLowerCase()) ||
        t.categoryLabel.toLowerCase().includes(query.toLowerCase())
      )
    : []

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fn)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 'min(640px, 94vw)', background: 'white',
        borderRadius: 18, boxShadow: '0 32px 100px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        animation: 'searchSlideDown 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar ferramentas..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: '#0f172a', background: 'transparent', fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <kbd style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 7px', fontFamily: 'inherit' }}>Esc</kbd>
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {query.trim() ? (
            filtered.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '6px 18px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                </div>
                {filtered.map(tool => (
                  <Link key={tool.href} href={tool.href} onClick={onClose} className="srch-item"
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 18px', textDecoration: 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tool.categoryColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {tool.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{tool.desc}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tool.categoryColor, background: `${tool.categoryColor}14`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' }}>
                      {tool.categoryLabel}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                Nenhuma ferramenta encontrada para &quot;{query}&quot;
              </div>
            )
          ) : (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Ferramentas populares
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {popularTools.map(tool => (
                  <Link key={tool.href} href={tool.href} onClick={onClose} className="srch-pop-item"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid #f1f5f9', textDecoration: 'none' }}>
                    <span style={{ fontSize: 18 }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{tool.categoryLabel}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f8fafc', display: 'flex', justifyContent: 'center' }}>
                <Link href="/ferramentas" onClick={onClose} style={{ fontSize: 13, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>
                  Ver todas as ferramentas →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── UserMenu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase, isDark }: {
  user: HeaderUser; signOut: () => void; supabase: any; isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dropRight, setDropRight] = useState(20)
  const ref = useRef<HTMLDivElement>(null)
  const mode: ExperienceMode = user.experience_mode || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const color = modeMeta.color

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function switchMode(m: ExperienceMode) {
    setOpen(false)
    await supabase.from('profiles').update({ experience_mode: m }).eq('id', user.id)
    window.location.reload()
  }

  const planLabels: Record<string, string> = { free: 'Grátis', student: 'Estudante', pro: 'Pro', clinic: 'Clínica' }

  const MODES_LIST = [
    { id: 'personal'  as ExperienceMode, icon: '👤', labelShort: 'Pessoal',   color: MODE_META.personal.color },
    { id: 'caregiver' as ExperienceMode, icon: '👨‍👩‍👧', labelShort: 'Família',   color: MODE_META.caregiver.color },
    { id: 'clinical'  as ExperienceMode, icon: '🏥', labelShort: 'Clínico',   color: MODE_META.clinical.color },
    { id: 'student'   as ExperienceMode, icon: '🎓', labelShort: 'Estudante', color: MODE_META.student.color },
  ]

  const avatarContent = user.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : (user.name?.[0] || 'U').toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setDropRight(window.innerWidth - rect.right)
          }
          setOpen(o => !o)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '4px 8px 4px 4px',
          background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
          borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 12, fontWeight: 700, overflow: 'hidden',
        }}>
          {avatarContent}
        </div>
        <span className="hdr-user-name" style={{
          fontSize: 13, fontWeight: 600,
          color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name?.split(' ')[0]}
        </span>
        <svg className="hdr-user-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af'}
          strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'fixed', right: dropRight, top: 64,
            background: 'white', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
            width: 248, zIndex: 999, overflow: 'hidden',
            animation: 'dropDown2 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* User card */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 700, overflow: 'hidden' }}>
                  {avatarContent}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: `${color}15`, fontSize: 10, fontWeight: 700, color }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
                      {modeMeta.labelShort}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                      {planLabels[user.plan || ''] || 'Grátis'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {[
              { href: '/inicio',      label: 'Início',      icon: '🏠' },
              { href: '/ferramentas', label: 'Ferramentas', icon: '🔧' },
              { href: '/settings',    label: 'Definições',  icon: '⚙️' },
            ].map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="um-item"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none' }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, paddingLeft: 4 }}>
                Mudar modo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {MODES_LIST.map(m => {
                  const active = mode === m.id
                  return (
                    <button key={m.id} onClick={() => switchMode(m.id)} style={{
                      padding: '7px 8px', borderRadius: 8,
                      border: `1px solid ${active ? m.color + '40' : '#f1f5f9'}`,
                      background: active ? m.color + '10' : '#f8fafc',
                      cursor: active ? 'default' : 'pointer',
                      fontSize: 11, fontWeight: active ? 700 : 500,
                      color: active ? m.color : '#64748b',
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ fontSize: 13 }}>{m.icon}</span>
                      {m.labelShort}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={() => { signOut(); setOpen(false) }} style={{
              width: '100%', padding: '10px 16px', textAlign: 'left',
              background: 'none', border: 'none', borderTop: '1px solid #f1f5f9',
              cursor: 'pointer', fontSize: 13, color: '#ef4444', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Terminar sessão
            </button>
          </div>
        </>
      )}
    </div>
  )
}


// ─── MobileDrawer (non-clinical mode only) ───────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut }: {
  open: boolean; onClose: () => void
  user: HeaderUser | null; signOut: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const personaLinks = user ? (PERSONA_NAV[mode] || PERSONA_NAV.personal) : []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(320px, 100vw)',
        background: 'white', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.16)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Menu</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {user && (
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: modeMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                  {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{user.email}</div>
                </div>
              </div>
            </div>
          )}

          {personaLinks.length > 0 && (
            <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ padding: '4px 18px 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Navegação</div>
              {personaLinks.map((link: any) => (
                <Link key={link.href} href={link.href} onClick={onClose} className="mob-item"
                  style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', textDecoration: 'none', fontSize: 14, fontWeight: 500, color: '#0f172a' }}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {[
            { href: '/ferramentas', label: 'Todas as ferramentas' },
            { href: '/dashboard',   label: 'Painel de controlo' },
            { href: '/settings',    label: 'Definições' },
          ].map(item => (
            <Link key={item.href} href={item.href} onClick={onClose} className="mob-item"
              style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', textDecoration: 'none', fontSize: 14, fontWeight: 500, color: '#0f172a', borderBottom: '1px solid #f8fafc' }}>
              {item.label}
            </Link>
          ))}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          {user ? (
            <button onClick={() => { signOut(); onClose() }} style={{
              width: '100%', padding: '11px', background: 'transparent',
              border: '1px solid #e2e8f0', borderRadius: 10,
              fontSize: 13, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Terminar sessão
            </button>
          ) : (
            <Link href="/login" onClick={onClose} style={{ display: 'block', padding: '11px', background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, textAlign: 'center' }}>
              Entrar
            </Link>
          )}
        </div>
      </div>
    </>
  )
}


// ─── Main Header ──────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const isHomepage = pathname === '/'
  const mode: ExperienceMode = (user?.experience_mode as ExperienceMode) || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const modeColor = modeMeta.color
  const isDark = user ? mode === 'clinical' : false
  const headerBg = isDark ? '#0f172a' : 'rgba(255,255,255,0.96)'

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 56,
        background: headerBg,
        backdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: isDark ? 'none' : 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${isDark ? '#1e293b' : 'rgba(0,0,0,0.07)'}`,
        transition: 'background 0.25s, border-color 0.25s',
      }}>
        <div style={{ height: '100%', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link href={user ? '/inicio' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: isDark ? '#1e40af' : '#0d6e42',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 900, color: isDark ? 'white' : '#0f172a', letterSpacing: '-0.04em' }}>
              Phlox
            </span>
          </Link>

          {/* Logged-out nav */}
          {!loading && !user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12 }}>
              <Link href="/ferramentas" style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>Ferramentas</Link>
              <Link href="/pricing"     style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>Preços</Link>
              <Link href="/about"       style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>Sobre</Link>
            </nav>
          )}

          <div style={{ flex: 1 }} />

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

            {!loading && user && (
              <>
                {/* Search — desktop only */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="hdr-search-btn"
                  title="Pesquisar (⌘K)"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 9,
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8',
                    fontSize: 13, fontFamily: 'inherit',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <span className="hdr-search-label" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>Pesquisar</span>
                  <kbd className="hdr-search-kbd" style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#cbd5e1', background: isDark ? 'rgba(255,255,255,0.06)' : 'white', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>⌘K</kbd>
                </button>

                <NotificationBell />

                <UserMenu user={user as HeaderUser} signOut={signOut} supabase={supabase} isDark={isDark} />

                {/* Hamburger — mobile only, non-clinical only */}
                {!isDark && (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="hdr-hamburger"
                    aria-label="Abrir menu"
                    style={{
                      width: 34, height: 34, display: 'none', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: '#f1f5f9', border: 'none', borderRadius: 7,
                      cursor: 'pointer', flexShrink: 0,
                    }}>
                    <span style={{ width: 16, height: 1.5, background: '#374151', borderRadius: 1, display: 'block' }} />
                    <span style={{ width: 11, height: 1.5, background: '#374151', borderRadius: 1, display: 'block' }} />
                    <span style={{ width: 16, height: 1.5, background: '#374151', borderRadius: 1, display: 'block' }} />
                  </button>
                )}
              </>
            )}

            {!loading && !user && (
              <>
                <Link href="/login" style={{ padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', borderRadius: 7, border: '1px solid #e2e8f0' }}>Entrar</Link>
                <Link href="/login" style={{ padding: '7px 15px', fontSize: 13, fontWeight: 800, background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: 7, whiteSpace: 'nowrap' }}>Começar →</Link>
              </>
            )}
          </div>
        </div>

        {/* Mode accent bar */}
        {!loading && user && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: modeColor, opacity: 0.75 }} />
        )}
      </header>

      {/* Content spacer */}
      {!isHomepage && <div style={{ height: 56 }} />}

      {searchOpen && <SearchBar onClose={closeSearch} mode={mode} />}

      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        user={user as HeaderUser | null}
        signOut={signOut}
      />

      <style>{`
        @keyframes dropDown2      { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight   { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes searchSlideDown { from { opacity:0; transform:translateY(-16px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes spin           { to { transform:rotate(360deg); } }
        @keyframes pulseRing      { 0% { box-shadow:0 0 0 0 rgba(13,148,136,0.35); } 70% { box-shadow:0 0 0 6px rgba(13,148,136,0); } 100% { box-shadow:0 0 0 0 rgba(13,148,136,0); } }

        .um-item:hover       { background:#f8fafc !important; }
        .mob-item:hover      { background:#f8fafc !important; }
        .srch-item:hover     { background:#f8fafc !important; }
        .srch-pop-item:hover { background:#f8fafc !important; border-color:#e2e8f0 !important; }

        button:focus-visible, a:focus-visible {
          outline: 2px solid #0d9488;
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Desktop: hide hamburger */
        @media (min-width:769px) {
          .hdr-hamburger { display:none !important; }
        }
        /* Mobile: show hamburger (for non-clinical), hide desktop-only search elements */
        @media (max-width:768px) {
          .hdr-hamburger     { display:flex !important; }
          .hdr-search-btn    { display:none !important; }
          .hdr-user-name     { display:none !important; }
          .hdr-user-chevron  { display:none !important; }
        }
        /* Medium desktop: hide search label/kbd */
        @media (max-width:1100px) {
          .hdr-search-label { display:none !important; }
          .hdr-search-kbd   { display:none !important; }
        }
        /* Notification bell pulse */
        .notif-bell-active {
          animation: pulseRing 2s cubic-bezier(0.455,0.03,0.515,0.955) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </>
  )
}
