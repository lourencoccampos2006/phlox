'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import NotificationBell from '@/components/NotificationBell'
import { useState, useEffect, useRef, useCallback } from 'react'
import { NAV_CATEGORIES, PERSONA_NAV, MODE_QUICK_ACTIONS, type NavTool } from '@/lib/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

// ─── Types ────────────────────────────────────────────────────────────────────

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

function SearchBar({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allTools: (NavTool & { categoryLabel: string; categoryColor: string })[] = NAV_CATEGORIES.flatMap(cat =>
    cat.tools.map(t => ({ ...t, categoryLabel: cat.label, categoryColor: cat.color }))
  )

  const popularTools = allTools.slice(0, 8)

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
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
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
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
      animation: 'fadeInOverlay 0.15s ease',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 'min(640px, 94vw)',
        background: 'white',
        borderRadius: 18,
        boxShadow: '0 32px 100px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        animation: 'searchSlideDown 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Search input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar ferramentas..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 16,
              color: '#0f172a', background: 'transparent', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: '#f1f5f9', border: 'none', borderRadius: '50%',
              width: 22, height: 22, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <kbd style={{
            fontSize: 11, color: '#94a3b8', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: 5,
            padding: '2px 7px', fontFamily: 'inherit', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results or popular */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {query.trim() ? (
            filtered.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '6px 18px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                </div>
                {filtered.map(tool => (
                  <Link key={tool.href} href={tool.href} onClick={onClose}
                    className="srch-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      padding: '10px 18px', textDecoration: 'none',
                    }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: `${tool.categoryColor}14`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {tool.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{tool.desc}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: tool.categoryColor,
                      background: `${tool.categoryColor}14`, padding: '2px 7px',
                      borderRadius: 4, flexShrink: 0, letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {tool.categoryLabel}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                Nenhuma ferramenta encontrada para "{query}"
              </div>
            )
          ) : (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Ferramentas populares
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {popularTools.map(tool => (
                  <Link key={tool.href} href={tool.href} onClick={onClose}
                    className="srch-pop-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10,
                      border: '1px solid #f1f5f9',
                      textDecoration: 'none', transition: 'all 0.12s',
                    }}>
                    <span style={{ fontSize: 18 }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{tool.categoryLabel}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f8fafc', display: 'flex', justifyContent: 'center' }}>
                <Link href="/ferramentas" onClick={onClose}
                  style={{ fontSize: 13, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>
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

// ─── PersonaModeBar ───────────────────────────────────────────────────────────

function PersonaModeBar({ user, supabase }: { user: HeaderUser; supabase: any }) {
  const [switching, setSwitching] = useState<string | null>(null)
  const currentMode: ExperienceMode = user.experience_mode || 'personal'

  const modes: { id: ExperienceMode; label: string; icon: string }[] = [
    { id: 'personal',  label: 'Pessoal',   icon: '👤' },
    { id: 'caregiver', label: 'Família',   icon: '👨‍👩‍👧' },
    { id: 'clinical',  label: 'Clínico',   icon: '🏥' },
    { id: 'student',   label: 'Estudante', icon: '🎓' },
  ]

  async function handleSwitch(modeId: ExperienceMode) {
    if (modeId === currentMode || switching) return
    setSwitching(modeId)
    try {
      await supabase.from('profiles').update({ experience_mode: modeId }).eq('id', user.id)
      window.location.reload()
    } catch {
      setSwitching(null)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="hdr-mode-tabs">
      {modes.map(m => {
        const meta = MODE_META[m.id]
        const active = currentMode === m.id
        const isLoading = switching === m.id
        return (
          <button
            key={m.id}
            onClick={() => handleSwitch(m.id)}
            disabled={!!switching}
            title={meta.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8,
              border: active ? `1px solid ${meta.color}40` : '1px solid transparent',
              background: active ? `${meta.color}10` : 'transparent',
              cursor: switching ? 'wait' : active ? 'default' : 'pointer',
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? meta.color : '#64748b',
              fontFamily: 'inherit', transition: 'all 0.12s',
              opacity: isLoading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}>
            {isLoading ? (
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${meta.color}40`, borderTopColor: meta.color, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <span style={{ fontSize: 13 }}>{m.icon}</span>
            )}
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── ToolsDropdown ────────────────────────────────────────────────────────────

function ToolsDropdown({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
      <div style={{
        position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(880px, 96vw)',
        background: 'white',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
        zIndex: 150,
        animation: 'dropDown 0.18s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {NAV_CATEGORIES.map((cat, ci) => (
            <div key={cat.id} style={{
              padding: '20px 16px',
              borderRight: ci < NAV_CATEGORIES.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 10, fontWeight: 700, color: cat.color,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                {cat.label}
              </div>
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} onClick={onClose}
                  className="mega-item"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9,
                    padding: '7px 8px', borderRadius: 9,
                    textDecoration: 'none', marginBottom: 2,
                  }}>
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{tool.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{tool.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3, marginTop: 1 }}>{tool.desc}</div>
                  </div>
                  {tool.badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: cat.color,
                      background: `${cat.color}18`, padding: '1px 5px', borderRadius: 3,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      flexShrink: 0, marginTop: 2,
                    }}>
                      {tool.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>35+ ferramentas disponíveis</span>
          <Link href="/ferramentas" onClick={onClose}
            style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            Ver todas
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── QuickActionsDropdown ─────────────────────────────────────────────────────

const SAFETY_TOOLS = [
  { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Combinação segura?' },
  { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',   desc: 'O que não misturar' },
  { href: '/bula',         icon: '📄', label: 'Perceber uma bula',    desc: 'Em linguagem simples' },
  { href: '/schedule',     icon: '⏰', label: 'Horário inteligente',  desc: 'IA cria o horário ideal' },
  { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',  desc: 'STOPP/START e genéricos' },
]

function QuickActionsDropdown({ user, onClose }: { user: HeaderUser; onClose: () => void }) {
  const mode: ExperienceMode = user.experience_mode || 'personal'
  const actions = MODE_QUICK_ACTIONS[mode] || MODE_QUICK_ACTIONS.personal
  const meta = MODE_META[mode]
  const isClinical = mode === 'clinical'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
      <div style={{
        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
        width: 320, background: 'white',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        zIndex: 150, overflow: 'hidden',
        animation: 'dropDown2 0.16s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px 10px',
          borderBottom: '1px solid #f1f5f9',
          background: `${meta.color}06`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Ações rápidas
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              Modo: {meta.label}
            </div>
          </div>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: `${meta.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            ⚡
          </div>
        </div>

        {/* Mode-specific quick actions */}
        <div>
          {actions.map((action, i) => (
            <Link key={action.href} href={action.href} onClick={onClose}
              className="qa-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 16px', textDecoration: 'none',
                borderBottom: i < actions.length - 1 ? '1px solid #fafafa' : 'none',
              }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: `${meta.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>
                {action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{action.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.desc}</div>
              </div>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}
        </div>

        {/* Safety tools section — always visible */}
        {!isClinical && (
          <div style={{ borderTop: '1px solid #f1f5f9' }}>
            <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Verificação rápida
            </div>
            {SAFETY_TOOLS.map(tool => (
              <Link key={tool.href} href={tool.href} onClick={onClose}
                className="qa-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px', textDecoration: 'none',
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: '#0d948812',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {tool.icon}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 0.5 }}>{tool.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/ferramentas" onClick={onClose}
            style={{ fontSize: 12, color: meta.color, fontWeight: 700, textDecoration: 'none' }}>
            Todas as ferramentas →
          </Link>
          <Link href="/dashboard" onClick={onClose}
            style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>
            Painel
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── DesktopModeIndicator ──────────────────────────────────────────────────────

function DesktopModeIndicator({ user, supabase }: { user: HeaderUser; supabase: any }) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<ExperienceMode | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const mode = user.experience_mode || 'personal'
  const meta = MODE_META[mode]

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function switchMode(m: ExperienceMode) {
    setSwitching(m)
    await supabase.from('profiles').update({ experience_mode: m }).eq('id', user.id)
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px 4px 7px',
          background: `${meta.color}12`,
          border: `1px solid ${meta.color}25`,
          borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
          {meta.labelShort}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'absolute', left: 0, top: 'calc(100% + 8px)',
            background: 'white', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
            minWidth: 200, zIndex: 150, overflow: 'hidden',
            animation: 'dropDown2 0.15s cubic-bezier(0.16,1,0.3,1)',
            padding: '6px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px' }}>
              Mudar modo
            </div>
            {(['personal', 'caregiver', 'clinical', 'student'] as ExperienceMode[]).map(m => {
              const mm = MODE_META[m]
              const active = mode === m
              const isLoading = switching === m
              return (
                <button key={m} onClick={() => switchMode(m)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 9, border: 'none',
                  background: active ? `${mm.color}10` : 'transparent',
                  cursor: isLoading ? 'wait' : active ? 'default' : 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.1s',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? mm.color : '#374151' }}>
                    {mm.label}
                  </span>
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mm.color} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                  {isLoading && (
                    <span style={{ marginLeft: 'auto', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${mm.color}30`, borderTopColor: mm.color, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, signOut, supabase, isDark }: {
  user: HeaderUser; signOut: () => void; supabase: any; isDark: boolean
}) {
  const [open, setOpen] = useState(false)
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

  const menuLinks = [
    { href: '/inicio',       label: 'Início',           icon: '🏠' },
    { href: '/dashboard',    label: 'Painel',            icon: '📊' },
    { href: '/ferramentas',  label: 'Ferramentas',       icon: '🔧' },
    { href: '/settings',     label: 'Definições',        icon: '⚙️' },
    { href: '/passport',     label: 'Passaporte',        icon: '🆘' },
    { href: '/vitals',       label: 'Sinais vitais',     icon: '❤️' },
    { href: '/ai',           label: 'Phlox AI',          icon: '🤖' },
  ]

  const planLabels: Record<string, string> = {
    free: 'Grátis', student: 'Estudante', pro: 'Pro', clinic: 'Clínica',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '4px 10px 4px 4px',
          background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
          borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontSize: 12,
          fontWeight: 700, overflow: 'hidden',
        }}>
          {user.avatar
            ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (user.name?.[0] || 'U').toUpperCase()}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name?.split(' ')[0]}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af'}
          strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            background: 'white', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
            minWidth: 252, zIndex: 999, overflow: 'hidden',
            animation: 'dropDown2 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* User info card */}
            <div style={{ padding: '16px', background: `${color}08`, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', fontSize: 16,
                  fontWeight: 700, overflow: 'hidden', flexShrink: 0,
                  border: `2px solid ${color}30`,
                }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name?.[0] || 'U').toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20,
                  background: `${color}18`,
                  fontSize: 11, fontWeight: 700, color: color,
                  letterSpacing: '0.04em',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                  {modeMeta.labelShort}
                </span>
                {user.plan && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 9px', borderRadius: 20,
                    background: '#f1f5f9',
                    fontSize: 11, fontWeight: 600, color: '#64748b',
                  }}>
                    {planLabels[user.plan] || user.plan}
                  </span>
                )}
              </div>
            </div>

            {/* Nav links */}
            {menuLinks.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="um-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', fontSize: 13, color: '#374151',
                  textDecoration: 'none',
                }}>
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            {/* Mode-specific quick access */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 0 2px' }}>
              <div style={{ padding: '3px 16px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Acesso rápido — {modeMeta.labelShort}
              </div>
              {(MODE_QUICK_ACTIONS[mode] || MODE_QUICK_ACTIONS.personal).slice(0, 3).map(tool => (
                <Link key={tool.href} href={tool.href} onClick={() => setOpen(false)}
                  className="um-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 16px', textDecoration: 'none',
                  }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: `${color}12`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, flexShrink: 0,
                  }}>
                    {tool.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{tool.label}</span>
                </Link>
              ))}
            </div>

            {/* Mode switcher */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Mudar modo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {(['personal', 'caregiver', 'clinical', 'student'] as const).map(m => {
                  const mm = MODE_META[m]
                  const active = mode === m
                  return (
                    <button key={m} onClick={() => switchMode(m)} style={{
                      padding: '7px 9px', borderRadius: 9,
                      border: `1px solid ${active ? mm.color + '35' : '#f1f5f9'}`,
                      background: active ? mm.color + '10' : '#f8fafc',
                      cursor: 'pointer', fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      color: active ? mm.color : '#64748b',
                      fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center',
                      gap: 5, transition: 'all 0.1s',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: mm.color, flexShrink: 0 }} />
                      {mm.labelShort}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => { signOut(); setOpen(false) }}
              style={{
                width: '100%', padding: '10px 16px', textAlign: 'left',
                background: 'none', border: 'none',
                borderTop: '1px solid #f1f5f9',
                cursor: 'pointer', fontSize: 13, color: '#ef4444',
                fontFamily: 'inherit',
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

// ─── MobileDrawer ─────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, user, signOut, supabase }: {
  open: boolean
  onClose: () => void
  user: HeaderUser | null
  signOut: () => void
  supabase: any
}) {
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal

  async function handleModeSwitch(m: ExperienceMode) {
    if (!user || m === mode || switching) return
    setSwitching(m)
    try {
      await supabase.from('profiles').update({ experience_mode: m }).eq('id', user.id)
      window.location.reload()
    } catch {
      setSwitching(null)
    }
  }

  const modes: { id: ExperienceMode; icon: string; label: string }[] = [
    { id: 'personal',  icon: '👤', label: 'Pessoal' },
    { id: 'caregiver', icon: '👨‍👩‍👧', label: 'Família' },
    { id: 'clinical',  icon: '🏥', label: 'Clínico' },
    { id: 'student',   icon: '🎓', label: 'Estudante' },
  ]

  const personaLinks = user ? (PERSONA_NAV[mode] || PERSONA_NAV.personal) : []

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(360px, 100vw)',
        background: 'white', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.2)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header row */}
        <div style={{
          padding: '16px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9',
          flexShrink: 0, background: 'white',
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Menu</span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* User info + mode badge */}
          {user && (
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f8fafc', background: `${modeMeta.color}06` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: modeMeta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 17, fontWeight: 700,
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{user.email}</div>
                </div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 20,
                background: `${modeMeta.color}18`,
                fontSize: 11, fontWeight: 700, color: modeMeta.color,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: modeMeta.color }} />
                {modeMeta.labelShort}
              </div>
            </div>
          )}

          {/* Quick actions grid */}
          {user && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Ações rápidas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {(MODE_QUICK_ACTIONS[mode] || MODE_QUICK_ACTIONS.personal).slice(0, 4).map(action => (
                  <Link key={action.href} href={action.href} onClick={onClose}
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 13,
                      background: `${modeMeta.color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>
                      {action.icon}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', textAlign: 'center', lineHeight: 1.2 }}>
                      {action.label.split(' ')[0]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 2×2 persona switcher grid */}
          {user && (
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Mudar modo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {modes.map(m => {
                  const mm = MODE_META[m.id]
                  const active = mode === m.id
                  const isLoading = switching === m.id
                  return (
                    <button key={m.id} onClick={() => handleModeSwitch(m.id)}
                      disabled={!!switching}
                      style={{
                        padding: '10px 10px',
                        borderRadius: 11,
                        border: active ? `1.5px solid ${mm.color}40` : '1px solid #f1f5f9',
                        background: active ? `${mm.color}10` : '#f8fafc',
                        cursor: switching ? 'wait' : active ? 'default' : 'pointer',
                        fontFamily: 'inherit', textAlign: 'left',
                      }}>
                      <div style={{ fontSize: 20, marginBottom: 5 }}>
                        {isLoading ? (
                          <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${mm.color}30`, borderTopColor: mm.color, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        ) : m.icon}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: active ? 700 : 600, color: active ? mm.color : '#374151' }}>{m.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Persona nav links */}
          {user && personaLinks.length > 0 && (
            <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ padding: '0 18px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Navegação
              </div>
              {personaLinks.map(link => (
                <Link key={link.href} href={link.href} onClick={onClose}
                  className="mob-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', textDecoration: 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{link.label}</span>
                </Link>
              ))}
              <Link href="/dashboard" onClick={onClose}
                className="mob-item"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', textDecoration: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Painel</span>
              </Link>
            </div>
          )}

          {/* All tools by category */}
          {NAV_CATEGORIES.map(cat => (
            <div key={cat.id} style={{ padding: '12px 0 4px' }}>
              <div style={{ padding: '0 18px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {cat.label}
                </span>
              </div>
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} onClick={onClose}
                  className="mob-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', textDecoration: 'none' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${cat.color}12`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {tool.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{tool.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{tool.desc}</div>
                  </div>
                  {tool.badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: cat.color,
                      background: `${cat.color}15`, padding: '1px 5px',
                      borderRadius: 3, letterSpacing: '0.05em',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      {tool.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}

          <div style={{ padding: '10px 18px 16px' }}>
            <Link href="/ferramentas" onClick={onClose}
              style={{
                display: 'block', padding: '11px 16px', background: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: 12,
                fontSize: 14, fontWeight: 700, color: '#0f172a',
                textDecoration: 'none', textAlign: 'center',
              }}>
              Ver todas as ferramentas →
            </Link>
          </div>
        </div>

        {/* Footer: sign out or login */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: 'white' }}>
          {user ? (
            <button
              onClick={() => { signOut(); onClose() }}
              style={{
                width: '100%', padding: '11px', background: 'transparent',
                border: '1px solid #e2e8f0', borderRadius: 10,
                fontSize: 13, color: '#ef4444', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Terminar sessão
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/login" onClick={onClose}
                style={{
                  display: 'block', padding: '11px', background: '#0f172a',
                  color: 'white', textDecoration: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 800, textAlign: 'center',
                }}>
                Entrar
              </Link>
              <Link href="/login" onClick={onClose}
                style={{
                  display: 'block', padding: '10px',
                  border: '1px solid #e2e8f0', color: '#0f172a',
                  textDecoration: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, textAlign: 'center',
                }}>
                Criar conta grátis
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── KeyboardShortcutsOverlay ─────────────────────────────────────────────────

function KeyboardShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const shortcuts = [
    { keys: ['⌘', 'K'],      label: 'Abrir pesquisa global',    desc: 'Encontra qualquer ferramenta instantaneamente' },
    { keys: ['⌘', '/'],      label: 'Atalhos de teclado',       desc: 'Mostra este painel de atalhos' },
    { keys: ['Esc'],          label: 'Fechar modal/pesquisa',    desc: 'Fecha qualquer painel ou overlay aberto' },
    { keys: ['Tab'],          label: 'Navegar entre campos',     desc: 'Move o foco entre elementos interativos' },
    { keys: ['Shift', 'Tab'], label: 'Navegar para trás',       desc: 'Move o foco para o elemento anterior' },
    { keys: ['Enter'],        label: 'Confirmar seleção',        desc: 'Confirma seleção ou abre item com foco' },
    { keys: ['Space'],        label: 'Ativar botão',             desc: 'Activa o botão ou checkbox com foco' },
    { keys: ['↑', '↓'],      label: 'Navegar lista',            desc: 'Move seleção em listas e menus' },
    { keys: ['⌘', '1-4'],    label: 'Mudar modo (futuro)',      desc: 'Troca entre pessoal, família, clínico, estudante' },
  ]

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 499,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeInOverlay 0.15s ease',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(480px, 94vw)',
        background: 'white', borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
        zIndex: 500, overflow: 'hidden',
        animation: 'searchSlideDown 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Atalhos de teclado</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Navegação rápida no Phlox</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ padding: '8px 0 12px' }}>
          {shortcuts.map(sc => (
            <div key={sc.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80, flexShrink: 0 }}>
                {sc.keys.map(k => (
                  <kbd key={k} style={{
                    fontSize: 11, padding: '2px 6px', borderRadius: 5,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    fontFamily: 'monospace', fontWeight: 700, color: '#374151',
                  }}>
                    {k}
                  </kbd>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{sc.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sc.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Prima</span>
          <kbd style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 700, color: '#374151' }}>Esc</kbd>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>para fechar</span>
        </div>
      </div>
    </>
  )
}

// ─── Main Header ──────────────────────────────────────────────────────────────

export default function Header() {
  const { user, loading, signOut, supabase } = useAuth()
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const quickActionsRef = useRef<HTMLDivElement>(null)

  const isHomepage = pathname === '/'
  const mode: ExperienceMode = (user?.experience_mode as ExperienceMode) || 'personal'
  const modeMeta = MODE_META[mode] || MODE_META.personal
  const modeColor = modeMeta.color
  const isDark = user ? mode === 'clinical' : false

  const headerBg = isDark ? '#0f172a' : 'rgba(255,255,255,0.92)'
  const personaLinks = user ? (PERSONA_NAV[mode] || PERSONA_NAV.personal) : []

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(s => !s)
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  // Close quick actions on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setQuickActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const textColor = isDark ? 'rgba(255,255,255,0.75)' : '#374151'
  const textColorActive = isDark ? 'white' : '#0f172a'

  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), [])
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
        <div style={{
          height: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 0,
        }}>

          {/* Logo */}
          <Link href={user ? '/inicio' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: isDark ? '#1e40af' : '#0d6e42',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.25s',
            }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: isDark ? 'white' : '#0f172a', letterSpacing: '-0.04em', transition: 'color 0.25s' }}>
              Phlox
            </span>
          </Link>

          {/* Desktop nav — logged-in persona links + dashboard */}
          {!loading && user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 1, marginLeft: 12 }} className="hdr-nav">
              {personaLinks.map(link => (
                <Link key={link.href} href={link.href}
                  style={{
                    fontSize: 13,
                    fontWeight: pathname === link.href ? 700 : 500,
                    padding: '5px 9px',
                    color: pathname === link.href ? textColorActive : textColor,
                    textDecoration: 'none', borderRadius: 7,
                    transition: 'color 0.15s', whiteSpace: 'nowrap',
                    background: pathname === link.href
                      ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
                      : 'transparent',
                  }}>
                  {link.label}
                </Link>
              ))}
              <Link href="/dashboard"
                style={{
                  fontSize: 13,
                  fontWeight: pathname === '/dashboard' ? 700 : 500,
                  padding: '5px 9px',
                  color: pathname === '/dashboard' ? textColorActive : textColor,
                  textDecoration: 'none', borderRadius: 7,
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                  background: pathname === '/dashboard'
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
                    : 'transparent',
                }}>
                Painel
              </Link>
            </nav>
          )}

          {/* Desktop nav — logged-out */}
          {!loading && !user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 20 }} className="hdr-nav">
              <div style={{ position: 'relative' }}>
                <button onClick={() => setToolsOpen(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 9px', background: 'none', border: 'none',
                  cursor: 'pointer', borderRadius: 7, fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 500, color: '#374151',
                  transition: 'color 0.15s',
                }}>
                  Ferramentas
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {toolsOpen && <ToolsDropdown onClose={() => setToolsOpen(false)} />}
              </div>
              <Link href="/pricing" style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>
                Preços
              </Link>
              <Link href="/about" style={{ padding: '5px 9px', fontSize: 13, fontWeight: 500, color: '#374151', textDecoration: 'none', borderRadius: 7 }}>
                Sobre
              </Link>
            </nav>
          )}

          {/* Persona mode bar — logged-in, desktop only */}
          {!loading && user && (
            <div style={{ marginLeft: 16 }} className="hdr-mode-tabs">
              <PersonaModeBar user={user as HeaderUser} supabase={supabase} />
            </div>
          )}

          {/* Compact mode pill — shows on 769–1249px where full mode tabs are hidden */}
          {!loading && user && (
            <div style={{ marginLeft: 8, display: 'none' }} className="hdr-mode-pill-compact">
              <DesktopModeIndicator user={user as HeaderUser} supabase={supabase} />
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />
          {/* Mobile spacer (also fills gap on mobile) */}
          <div style={{ flex: 1 }} className="hdr-spacer" />

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>

            {/* Logged-in right side */}
            {!loading && user && (
              <>
                {/* Search button — desktop */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="hdr-search-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 9,
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8',
                    fontSize: 13, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <span className="hdr-search-label" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>Pesquisar</span>
                  <kbd className="hdr-search-kbd" style={{
                    fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#cbd5e1',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'white',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit',
                  }}>⌘K</kbd>
                </button>

                {/* Quick actions */}
                <div ref={quickActionsRef} style={{ position: 'relative' }} className="hdr-nav">
                  <button
                    onClick={() => setQuickActionsOpen(o => !o)}
                    title="Ações rápidas"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, transition: 'all 0.12s',
                    }}>
                    ⚡
                  </button>
                  {quickActionsOpen && (
                    <QuickActionsDropdown user={user as HeaderUser} onClose={() => setQuickActionsOpen(false)} />
                  )}
                </div>

                {/* Notifications */}
                <div className="hdr-nav">
                  <NotificationBell />
                </div>

                {/* User menu */}
                <UserMenu user={user as HeaderUser} signOut={signOut} supabase={supabase} isDark={isDark} />
              </>
            )}

            {/* Logged-out right side */}
            {!loading && !user && (
              <>
                <Link href="/login" className="hdr-nav" style={{
                  padding: '7px 13px', fontSize: 13, fontWeight: 600,
                  color: '#374151', textDecoration: 'none', borderRadius: 7,
                  border: '1px solid #e2e8f0', transition: 'all 0.15s',
                }}>
                  Entrar
                </Link>
                <Link href="/login" style={{
                  padding: '7px 15px', fontSize: 13, fontWeight: 800,
                  background: '#0f172a', color: 'white',
                  textDecoration: 'none', borderRadius: 7,
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                }}>
                  Começar →
                </Link>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="hdr-hamburger"
              aria-label="Abrir menu"
              style={{
                width: 34, height: 34, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                border: 'none', borderRadius: 7, cursor: 'pointer', flexShrink: 0,
              }}>
              <span style={{ width: 16, height: 1.5, background: isDark ? 'rgba(255,255,255,0.8)' : '#374151', borderRadius: 1, display: 'block' }} />
              <span style={{ width: 11, height: 1.5, background: isDark ? 'rgba(255,255,255,0.8)' : '#374151', borderRadius: 1, display: 'block' }} />
              <span style={{ width: 16, height: 1.5, background: isDark ? 'rgba(255,255,255,0.8)' : '#374151', borderRadius: 1, display: 'block' }} />
            </button>
          </div>
        </div>

        {/* Color accent bar at bottom */}
        {!loading && user && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 2, background: modeColor, opacity: 0.75,
          }} />
        )}
      </header>

      {/* Content spacer — NOT on homepage */}
      {!isHomepage && <div style={{ height: 56 }} />}

      {/* Overlays */}
      {searchOpen && <SearchBar onClose={closeSearch} />}
      {shortcutsOpen && <KeyboardShortcutsOverlay onClose={closeShortcuts} />}

      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        user={user as HeaderUser | null}
        signOut={signOut}
        supabase={supabase}
      />

      <style>{`
        @keyframes dropDown       { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes dropDown2      { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight   { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes fadeInOverlay  { from { opacity:0; } to { opacity:1; } }
        @keyframes searchSlideDown { from { opacity:0; transform:translateY(-16px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes spin           { to { transform:rotate(360deg); } }
        @keyframes pulseRing      { 0% { box-shadow:0 0 0 0 rgba(13,148,136,0.35); } 70% { box-shadow:0 0 0 6px rgba(13,148,136,0); } 100% { box-shadow:0 0 0 0 rgba(13,148,136,0); } }

        .mega-item:hover     { background:#f8fafc !important; }
        .um-item:hover       { background:#f8fafc !important; }
        .mob-item:hover      { background:#f8fafc !important; }
        .qa-item:hover       { background:#f8fafc !important; }
        .srch-item:hover     { background:#f8fafc !important; }
        .srch-pop-item:hover { background:#f8fafc !important; border-color:#e2e8f0 !important; }
        .hdr-search-btn:hover { background:#e9ecf0 !important; }
        .hdr-nav-link:hover  { color:#0f172a !important; }
        .hdr-logo:hover      { opacity:0.85; }

        /* Focus ring for accessibility */
        button:focus-visible,
        a:focus-visible {
          outline: 2px solid #0d9488;
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Smooth mode color transitions */
        .mode-pill {
          transition: background 0.25s, color 0.25s, border-color 0.25s;
        }

        /* Desktop ≥769px: hide hamburger and mobile spacer */
        @media (min-width:769px) {
          .hdr-hamburger         { display:none !important; }
          .hdr-spacer            { display:none !important; }
        }
        /* Mobile ≤768px: hide desktop elements */
        @media (max-width:768px) {
          .hdr-nav               { display:none !important; }
          .hdr-mode-tabs         { display:none !important; }
          .hdr-search-btn        { display:none !important; }
          .hdr-mode-pill-compact { display:none !important; }
        }
        /* Medium desktop 769–1249px: hide full mode tabs, show compact pill */
        @media (min-width:769px) and (max-width:1249px) {
          .hdr-mode-tabs         { display:none !important; }
          .hdr-mode-pill-compact { display:flex !important; }
        }
        /* Wide desktop ≥1250px: show full mode tabs, hide compact pill */
        @media (min-width:1250px) {
          .hdr-mode-pill-compact { display:none !important; }
        }
        /* Hide search label/kbd on narrower desktops */
        @media (max-width:1100px) {
          .hdr-search-label { display:none !important; }
          .hdr-search-kbd   { display:none !important; }
        }
        /* Notification bell pulse */
        .notif-bell-active {
          animation: pulseRing 2s cubic-bezier(0.455,0.03,0.515,0.955) infinite;
        }
        /* Tool grid gap fix on small screens */
        @media (max-width: 400px) {
          .mob-tool-grid { gap: 4px !important; }
          .hdr-search-btn { padding: 6px 8px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </>
  )
}
