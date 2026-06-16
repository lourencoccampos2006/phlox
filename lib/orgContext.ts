'use client'

// lib/orgContext.ts
// Active organization context. Cada utilizador pode pertencer a várias
// organizações (lar, centro de dia, farmácia comunitária, clínica). A "active
// org" decide que dados clínicos aparecem na UI e que capabilities estão em vigor.

import { useEffect, useState, useCallback } from 'react'

const LS_KEY = 'phlox-active-org'
const EVT = 'phlox-org-changed'

// Lista completa de capabilities que owner/admin têm sempre — mantida em
// sincronia com `capability_catalog` SQL. Adicionar aqui sempre que se cria
// nova capability na BD.
export const ALL_CAPABILITIES = [
  'patients.read','patients.write','patients.delete',
  'episodes.read','episodes.write',
  'prescription.read','prescription.write','prescription.validate',
  'mar.read','mar.administer',
  'rounds.read','rounds.write',
  'stock.read','stock.write','stock.purchase','stock.inventory',
  'billing.read','billing.write','billing.fiscal_export',
  'pos.use',
  'team.read','team.manage','team.schedule',
  'quality.read','quality.write','audit.read',
  'org.admin','org.billing_settings',
  'suppliers.read','suppliers.write',
  'loyalty.read','loyalty.write',
  'translate.use',
]

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

      // 2) Para cada membership sem capabilities override, vai buscar defaults.
      //    Owner e admin têm SEMPRE tudo. Independentemente do estado do
      //    capability_catalog na BD (que pode estar vazia em instalações
      //    parciais), damos-lhes uma lista completa hardcoded no cliente.
      const out: OrgMembership[] = []
      for (const m of (members || [])) {
        const role = (m as any).role
        let caps: string[] = Array.isArray((m as any).capabilities) ? (m as any).capabilities : []
        if (role === 'owner' || role === 'admin') {
          caps = ALL_CAPABILITIES
        } else if (caps.length === 0) {
          const { data } = await supabase.rpc('default_capabilities', { role })
          caps = Array.isArray(data) ? data : []
        }
        out.push({
          org: (m as any).organizations as OrgSummary,
          role,
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
