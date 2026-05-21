'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

export interface PickedPatient {
  id: string
  name: string
  age: number | null
  sex: string | null
  conditions: string | null
  allergies: string | null
}

interface Props {
  value?: PickedPatient | null
  onSelect: (p: PickedPatient | null) => void
  placeholder?: string
  label?: string
  institutionLabel?: string // 'Doente' | 'Residente' | 'Cliente' | etc.
}

export default function PatientPicker({
  value,
  onSelect,
  placeholder,
  label,
  institutionLabel = 'Doente',
}: Props) {
  const { user, supabase } = useAuth() as any
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickedPatient[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!user || !supabase) return
    setLoading(true)
    const req = supabase.from('patients').select('id,name,age,sex,conditions,allergies').eq('user_id', user.id)
    const { data } = q.trim()
      ? await req.ilike('name', `%${q.trim()}%`).limit(8)
      : await req.order('updated_at', { ascending: false }).limit(8)
    setResults(data ?? [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 220)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open, search])

  useEffect(() => {
    if (open) search(query)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (p: PickedPatient) => {
    onSelect(p)
    setQuery('')
    setOpen(false)
  }

  const clear = () => {
    onSelect(null)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
      )}

      {value ? (
        /* Selected state */
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 8,
          cursor: 'pointer',
        }} onClick={() => { onSelect(null); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{value.name}</div>
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>
              {[value.age ? `${value.age} anos` : null, value.sex, value.conditions].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); clear() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      ) : (
        /* Search input */
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', color: '#94a3b8' }}>
            🔍
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? `Pesquisar ${institutionLabel.toLowerCase()}...`}
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              border: open ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: 14, background: 'white', color: '#0f172a',
              outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
            }}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !value && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999, maxHeight: 260, overflowY: 'auto',
        }}>
          {loading && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8' }}>A pesquisar…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {query.trim() ? `Nenhum ${institutionLabel.toLowerCase()} encontrado` : `Sem ${institutionLabel.toLowerCase()}s registados`}
              </div>
              <a href="/patients" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', display: 'block', marginTop: 4 }}>
                + Adicionar {institutionLabel.toLowerCase()} →
              </a>
            </div>
          )}
          {!loading && results.map(p => (
            <button
              key={p.id}
              onMouseDown={e => { e.preventDefault(); select(p) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f1f5f9',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, fontWeight: 700, color: '#2563eb',
              }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {[p.age ? `${p.age} anos` : null, p.sex, p.conditions].filter(Boolean).join(' · ') || 'Sem dados adicionais'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
