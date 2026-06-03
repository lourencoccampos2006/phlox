'use client'

// components/OrgPatientPicker.tsx
// Picker de doente para contexto organizacional (hospital/clínica/farmácia).
// Usa a tabela `patients` via RLS (sem filtro user_id). Inclui pesquisa por
// nome e atalho "+ Criar novo doente" inline.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

export interface OrgPatient {
  id: string
  name: string
  age?: number | null
  sex?: string | null
  conditions?: string | null
}

interface Props {
  orgId?: string
  value?: OrgPatient | null
  onSelect: (p: OrgPatient | null) => void
  placeholder?: string
  label?: string
  allowCreate?: boolean
}

export default function OrgPatientPicker({
  orgId, value, onSelect, placeholder, label, allowCreate = true,
}: Props) {
  const { user, supabase } = useAuth() as any
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrgPatient[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [temporary, setTemporary] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!user || !supabase) return
    setLoading(true)
    let req = supabase.from('patients').select('id,name,age,sex,conditions').limit(10)
    if (q.trim()) req = req.ilike('name', `%${q.trim()}%`)
    else req = req.order('updated_at', { ascending: false })
    const { data } = await req
    setResults(data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 220)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open, search])

  useEffect(() => { if (open) search(query) }, [open]) // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function createPatient() {
    if (!newName.trim()) return
    setErr(null)
    const insert: any = { name: newName.trim() }
    if (user?.id) insert.user_id = user.id
    if (orgId) insert.org_id = orgId
    if (temporary) insert.temporary = true

    // Tenta o INSERT com todos os campos; em caso de erro por coluna inexistente,
    // remove a coluna culpada e tenta de novo. Apanha as duas formas de erro:
    //   - "column 'org_id' of relation 'patients' does not exist"
    //   - "Could not find the 'org_id' column of 'patients' in the schema cache"
    const colRegex = /(?:column "?([a-z_]+)"? .*does not exist|Could not find the '([^']+)' column)/i
    let attempts = 0
    let data: any = null
    let error: any = null
    while (attempts < 4) {
      const r = await supabase.from('patients').insert(insert).select('id,name,age,sex,conditions').single()
      data = r.data; error = r.error
      if (!error) break
      const m = colRegex.exec(error.message)
      const missing = m?.[1] || m?.[2]
      if (!missing || !(missing in insert)) break
      delete insert[missing]
      attempts++
    }
    if (error) { setErr(error.message); return }
    if (data) {
      onSelect(data as OrgPatient)
      setCreating(false); setNewName(''); setOpen(false); setQuery(''); setTemporary(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' }}>
          {label}
        </div>
      )}

      {value ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 8,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{value.name}</div>
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>
              {[value.age ? `${value.age} anos` : null, value.sex, value.conditions].filter(Boolean).join(' · ') || 'Sem dados adicionais'}
            </div>
          </div>
          <button onClick={() => onSelect(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      ) : creating ? (
        <div style={{ background: '#f0fdf5', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>Criar novo doente</div>
          <input
            autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createPatient() }}
            placeholder="Nome completo"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }}
          />
          <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: '#374151', marginBottom: 8 }}>
            <input type="checkbox" checked={temporary} onChange={e => setTemporary(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              <b>Visita única</b> — ficha temporária (para um atendimento avulso, walk-in, urgência sem seguimento)
            </span>
          </label>
          {err && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { setCreating(false); setNewName(''); setTemporary(false) }} style={{ padding: '5px 10px', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={createPatient} disabled={!newName.trim()} style={{ padding: '5px 10px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Criar</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            <input
              value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder || 'Procurar doente por nome…'}
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
                border: open ? '1.5px solid #3b82f6' : '1.5px solid #d1d5db', borderRadius: 8,
                fontSize: 14, background: 'white', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: 280, overflowY: 'auto',
            }}>
              {loading && <div style={{ padding: 12, fontSize: 13, color: '#94a3b8' }}>A pesquisar…</div>}
              {!loading && results.length === 0 && (
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                    {query.trim() ? `Nenhum doente "${query}"` : 'Sem doentes na lista'}
                  </div>
                  {allowCreate && (
                    <button onMouseDown={e => { e.preventDefault(); setCreating(true); setNewName(query); setOpen(false) }}
                      style={{ background: 'none', border: 'none', color: '#0d6e42', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      + Criar "{query || 'novo doente'}" →
                    </button>
                  )}
                </div>
              )}
              {!loading && results.map(p => (
                <button key={p.id}
                  onMouseDown={e => { e.preventDefault(); onSelect(p); setOpen(false); setQuery('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                    textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {[p.age ? `${p.age} anos` : null, p.sex, p.conditions].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </button>
              ))}
              {allowCreate && results.length > 0 && (
                <button onMouseDown={e => { e.preventDefault(); setCreating(true); setNewName(query); setOpen(false) }}
                  style={{ width: '100%', padding: '8px 14px', border: 'none', background: '#f9fafb', color: '#0d6e42', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  + Criar novo doente {query ? `"${query}"` : ''}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
