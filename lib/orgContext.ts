'use client'

// lib/orgContext.ts
// Active organization context. Cada utilizador pode pertencer a várias
// organizações (hospital, clínica, farmácia, lar). A "active org" decide
// que dados clínicos aparecem na UI e que capabilities estão em vigor.

import { useEffect, useState, useCallback } from 'react'

const LS_KEY = 'phlox-active-org'
const EVT = 'phlox-org-changed'

export interface OrgSummary {
  id: string
  name: string
  short_name: string | null
  kind: string
  accent_color: string | null
}

export interface OrgMembership {
  org: OrgSummary
  role: string
  capabilities: string[]      // efetivas (override OR defaults)
  department: string | null
}

// ─── localStorage helpers ────────────────────────────────────────────────────
export function getActiveOrgId(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LS_KEY)
}

export function setActiveOrgId(id: string | null) {
  if (typeof localStorage === 'undefined') return
  if (id) localStorage.setItem(LS_KEY, id)
  else localStorage.removeItem(LS_KEY)
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: { id } })) } catch { /* noop */ }
}

// ─── Hook que carrega as memberships do utilizador atual ────────────────────
import { useAuth } from '@/components/AuthContext'

export function useMemberships(): { memberships: OrgMembership[]; active: OrgMembership | null; loading: boolean; refresh: () => void } {
  const { user, supabase } = useAuth() as any
  const [memberships, setMemberships] = useState<OrgMembership[]>([])
  const [activeId, setActiveId] = useState<string | null>(() => getActiveOrgId())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) { setMemberships([]); setLoading(false); return }
    setLoading(true)
    try {
      // 1) memberships ativas do utilizador
      const { data: members, error } = await supabase
        .from('org_members')
        .select('role, capabilities, department, organizations(id, name, short_name, kind, accent_color)')
        .eq('user_id', user.id)
        .eq('active', true)
      if (error) { console.error('[orgContext] memberships:', error); setMemberships([]); setLoading(false); return }

      // 2) Para cada membership sem capabilities override, vai buscar defaults
      const out: OrgMembership[] = []
      for (const m of (members || [])) {
        let caps: string[] = Array.isArray((m as any).capabilities) ? (m as any).capabilities : []
        if (caps.length === 0) {
          const { data } = await supabase.rpc('default_capabilities', { role: (m as any).role })
          caps = Array.isArray(data) ? data : []
        }
        out.push({
          org: (m as any).organizations as OrgSummary,
          role: (m as any).role,
          capabilities: caps,
          department: (m as any).department,
        })
      }
      setMemberships(out)

      // Se não houver active org ou a guardada já não pertence → pega primeira
      const current = getActiveOrgId()
      if ((!current || !out.find(x => x.org.id === current)) && out.length > 0) {
        setActiveOrgId(out[0].org.id)
        setActiveId(out[0].org.id)
      }
    } finally { setLoading(false) }
  }, [user?.id, supabase])

  useEffect(() => { refresh() }, [refresh])

  // Reage a mudanças no mesmo separador
  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<{ id: string | null }>
      setActiveId(ce.detail?.id ?? getActiveOrgId())
    }
    window.addEventListener(EVT, fn as EventListener)
    return () => window.removeEventListener(EVT, fn as EventListener)
  }, [])

  const active = memberships.find(m => m.org.id === activeId) || null
  return { memberships, active, loading, refresh }
}

// ─── Hook simples para apenas a org ativa ───────────────────────────────────
export function useActiveOrg(): { org: OrgSummary | null; role: string | null; caps: string[]; loading: boolean } {
  const { active, loading } = useMemberships()
  return { org: active?.org || null, role: active?.role || null, caps: active?.capabilities || [], loading }
}
