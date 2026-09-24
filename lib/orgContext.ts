'use client'

// lib/orgContext.ts
// Active organization context. Cada utilizador pode pertencer a várias
// organizações (lar, centro de dia, farmácia comunitária, clínica). A "active
// org" decide que dados clínicos aparecem na UI e que capabilities estão em vigor.

import { useEffect, useState, useCallback } from 'react'

const LS_KEY = 'phlox-active-org'
const EVT = 'phlox-org-changed'

// ── As permissões vivem em lib/permissoes.ts ────────────────────────────────
// Esta lista era aqui, escrita à mão, e falava de `pos.use`, `loyalty.write` e
// `suppliers.read` — a farmácia, que saiu do produto. Agora vem do catálogo,
// que é também de onde o SQL é gerado: não podem divergir.
import { TODAS, permissoesDe, PAPEL_ANTIGO_PARA_NOVO } from './permissoes'

/** @deprecated Usa `TODAS` de lib/permissoes. Fica por compatibilidade com
 *  app/convite/[token]/page.tsx, o único sítio que ainda a importava. */
export const ALL_CAPABILITIES = TODAS

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
import { reportError } from '@/lib/clientError'

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

      // 2) As permissões efetivas de cada membership.
      //
      //    Calculadas AQUI, a partir de lib/permissoes, e não com um
      //    `rpc('default_capabilities')` por organização. Duas razões: poupa
      //    uma ida à rede por cada casa a que a pessoa pertence, e usa
      //    exatamente a mesma fonte de onde o SQL foi gerado — se um dia
      //    discordassem, a interface mostraria uma coisa e a base de dados
      //    faria outra.
      //
      //    O `PAPEL_ANTIGO_PARA_NOVO` está aqui de propósito: entre o dia em
      //    que este código sobe e o dia em que a migração corre, a base de
      //    dados ainda tem os papéis antigos. Sem esta tradução, toda a gente
      //    ficava sem permissões nenhumas nesse intervalo.
      const out: OrgMembership[] = (members || []).map((m: any) => {
        const papelBruto: string = m.role
        const papel = PAPEL_ANTIGO_PARA_NOVO[papelBruto] || papelBruto
        const sobreposicao: string[] = Array.isArray(m.capabilities) ? m.capabilities : []
        return {
          org: m.organizations as OrgSummary,
          role: papel,
          capabilities: permissoesDe(papel, sobreposicao),
          department: m.department,
        }
      })
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
