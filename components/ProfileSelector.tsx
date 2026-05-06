'use client'

// ─── NOVO: components/ProfileSelector.tsx ───
// Dropdown reutilizável para seleccionar o perfil activo (próprio ou familiar).
// Usa e actualiza profileContext no localStorage.

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile, setActiveProfile, ActiveProfile } from '@/lib/profileContext'

interface FamilyProfile {
  id: string
  name: string
  relation?: string
  age?: number | null
  sex?: string | null
  weight?: number | null
  conditions?: string | null
  allergies?: string | null
}

interface ProfileSelectorProps {
  onChange?: (profile: ActiveProfile) => void
}

export default function ProfileSelector({ onChange }: ProfileSelectorProps) {
  const { user, supabase } = useAuth()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<ActiveProfile | null>(null)
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  // Carrega o perfil activo do localStorage e os perfis familiares do Supabase
  useEffect(() => {
    const current = getActiveProfile()
    if (current) setActive(current)

    if (!user) { setLoading(false); return }

    supabase
      .from('family_profiles')
      .select('id, name, relation, age, sex, weight, conditions, allergies')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setProfiles(data || [])
        setLoading(false)
        // Se não há perfil activo guardado, usa "self" como default
        if (!current && user) {
          const selfProfile: ActiveProfile = { id: 'self', name: user.name, type: 'self' }
          setActive(selfProfile)
          setActiveProfile(selfProfile)
        }
      })
  }, [user, supabase])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function select(profile: ActiveProfile) {
    setActive(profile)
    setActiveProfile(profile)
    setOpen(false)
    onChange?.(profile)
  }

  if (!user) return null

  const selfProfile: ActiveProfile = { id: 'self', name: user.name, type: 'self' }
  const displayName = active?.type === 'self' ? `Eu (${user.name.split(' ')[0]})` : active?.name || 'Seleccionar perfil'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'white',
          border: '1.5px solid var(--border)',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          color: 'var(--ink)',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        {/* Avatar do perfil */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: active?.type === 'family' ? '#e9d5ff' : 'var(--green-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
          color: active?.type === 'family' ? '#7c3aed' : 'var(--green)',
          flexShrink: 0,
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'white', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          minWidth: 220, overflow: 'hidden',
        }}>
          {/* Cabeçalho */}
          <div style={{ padding: '10px 14px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Perfil activo
          </div>

          {/* Eu */}
          <button
            onClick={() => select(selfProfile)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: active?.id === 'self' ? 'var(--green-light)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              borderLeft: `3px solid ${active?.id === 'self' ? 'var(--green)' : 'transparent'}`,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (active?.id !== 'self') e.currentTarget.style.background = 'var(--bg-2)' }}
            onMouseLeave={e => { if (active?.id !== 'self') e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--green-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--green)', flexShrink: 0,
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Eu ({user.name.split(' ')[0]})
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Perfil próprio</div>
            </div>
            {active?.id === 'self' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            )}
          </button>

          {/* Perfis familiares */}
          {profiles.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <div style={{ padding: '6px 14px 4px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Família
              </div>
              {profiles.map(p => {
                const isActive = active?.id === p.id
                const fp: ActiveProfile = {
                    id: p.id, name: p.name, type: 'family',
                    age: p.age ?? null,
                    sex: p.sex ?? null,
                    weight: p.weight ?? null,
                    conditions: p.conditions ?? null,
                    allergies: p.allergies ?? null,
                  }
                return (
                  <button
                    key={p.id}
                    onClick={() => select(fp)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', background: isActive ? '#faf5ff' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderLeft: `3px solid ${isActive ? '#7c3aed' : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#e9d5ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#7c3aed', flexShrink: 0,
                    }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {p.relation || 'Familiar'}{p.age ? ` · ${p.age} anos` : ''}
                      </div>
                    </div>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </>
          )}

          {/* Novo perfil */}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <a
            href="/perfis"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px 12px',
              fontSize: 13, fontWeight: 600,
              color: 'var(--green)',
              textDecoration: 'none',
              fontFamily: 'var(--font-sans)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-light)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Novo perfil familiar
          </a>
        </div>
      )}
    </div>
  )
}