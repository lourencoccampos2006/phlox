'use client'

// lib/orgScope.ts
// ─────────────────────────────────────────────────────────────────────────────
// Partilha de dados por ORGANIZAÇÃO (plano Institucional).
//
// Problema que resolve: as ferramentas filtravam tudo por user_id, por isso cada
// funcionário só via o que ELE registava e o dono não via nada da equipa. Agora,
// quando o utilizador pertence a uma organização, lemos e escrevemos por org_id —
// toda a equipa trabalha sobre os mesmos utentes/registos, e cada registo guarda
// QUEM o fez (recorded_by_id) para auditoria.
//
// Retrocompatível: sem organização (conta individual), tudo funciona como antes
// (scoping por user_id, org_id fica null).
//
// Uso típico numa ferramenta:
//   const scope = useOrgScope()
//   // leitura:
//   let q = supabase.from('care_records').select('*')
//   q = scope.filter(q)                      // .eq('org_id', X) OU .eq('user_id', me)
//   // escrita:
//   await supabase.from('care_records').insert(scope.stamp({ patient_id, ... }))
// ─────────────────────────────────────────────────────────────────────────────

import { useAuth } from '@/components/AuthContext'

export interface OrgScope {
  /** id da organização ativa, ou null para conta individual */
  orgId: string | null
  /** id do utilizador atual (sempre presente quando há sessão) */
  userId: string | null
  /** papel do utilizador na organização: owner/admin têm acesso ao painel do dono */
  role: string | null
  /** true se for dono ou administrador (vê auditoria, gere equipa) */
  isManager: boolean
  /** false quando o papel é "viewer" (Só leitura) — NÃO pode criar/editar/apagar.
   *  Conta individual (sem org) pode sempre editar. */
  canEdit: boolean
  /** Aplica o filtro de leitura certo a uma query supabase. */
  filter: <T>(query: T) => T
  /** Carimba uma linha a inserir com os campos de partilha + auditoria. */
  stamp: <T extends Record<string, any>>(row: T) => T
  /** Tabelas a que o realtime deve subscrever, scoped por org quando aplicável. */
  liveFilterColumn: 'org_id' | 'user_id'
  liveFilterValue: string | null
}

export function useOrgScope(): OrgScope {
  const { user } = useAuth() as any
  const orgId: string | null = user?.active_org_id || user?.org_id || null
  const userId: string | null = user?.id || null
  const role: string | null = user?.org_role || null
  const isManager = !!orgId && (role === 'owner' || role === 'admin')
  // Só leitura: pertence a uma org com papel viewer. Conta individual edita sempre.
  const canEdit = !orgId || role !== 'viewer'

  const filter = <T,>(query: T): T => {
    const q = query as any
    if (orgId) return q.eq('org_id', orgId)
    return q.eq('user_id', userId)
  }

  const stamp = <T extends Record<string, any>>(row: T): T => {
    const out: any = { ...row }
    // user_id mantém-se sempre (compat + RLS "_own")
    if (userId && out.user_id === undefined) out.user_id = userId
    // org partilha + auditoria, só quando há organização
    if (orgId) {
      out.org_id = orgId
      if (out.recorded_by_id === undefined) out.recorded_by_id = userId
    }
    return out
  }

  return {
    orgId, userId, role, isManager, canEdit,
    filter, stamp,
    liveFilterColumn: orgId ? 'org_id' : 'user_id',
    liveFilterValue: orgId || userId,
  }
}
