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
import { useMemberships } from './orgContext'
import {
  AREAS, PAPEL_ANTIGO_PARA_NOVO, type Nivel,
  pode as podePermissao, veArea as veAreaPermissao,
} from './permissoes'

export interface OrgScope {
  /** id da organização ativa, ou null para conta individual */
  orgId: string | null
  /** id do utilizador atual (sempre presente quando há sessão) */
  userId: string | null
  /** papel do utilizador na organização: owner/admin têm acesso ao painel do dono */
  role: string | null
  /** true se for dono ou administrador (vê auditoria, gere equipa) */
  isManager: boolean
  /** false quando a pessoa não pode escrever nesta casa.
   *  Conta individual (sem org) pode sempre editar. */
  canEdit: boolean
  /** As permissões efetivas nesta organização (`area.nivel`). Vazio fora de
   *  uma instituição — aí não há nada a limitar. */
  permissoes: string[]
  /** Pode fazer isto? A pergunta que as páginas devem fazer, em vez de olhar
   *  para o papel. Fora de uma instituição devolve sempre true. */
  pode: (area: string, nivel: Nivel) => boolean
  /** Deve esta área aparecer no menu? */
  ve: (area: string) => boolean
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
  const { active } = useMemberships()
  const orgId: string | null = user?.active_org_id || user?.org_id || null
  const userId: string | null = user?.id || null

  // ── De onde vem o papel ───────────────────────────────────────────────────
  // `org_members.role` é a fonte; `profiles.org_role` é uma cópia grosseira
  // que só alguma vez recebe 'owner', 'admin' ou 'member'. Fica como recurso
  // para o instante em que as memberships ainda não carregaram.
  const papelCopia: string | null = user?.org_role || null
  const papel: string | null = active?.role
    || (papelCopia ? (PAPEL_ANTIGO_PARA_NOVO[papelCopia] || papelCopia) : null)

  const permissoes: string[] = orgId ? (active?.capabilities || []) : []

  // Quem gere a casa: vê o painel do dono, a auditoria, a equipa.
  // Passou a ser uma PERMISSÃO e não uma lista de papéis — era
  // `role === 'owner' || role === 'admin'`, e depois da migração (sprint152)
  // não existe nenhum papel com esses nomes: o painel fechava-se ao dono.
  const isManager = !!orgId && (
    papel === 'dono' || podePermissao(permissoes, 'definicoes', 'editar')
  )

  // ── Só leitura ────────────────────────────────────────────────────────────
  // Isto estava escrito `role !== 'viewer'` — e `profiles.org_role` NUNCA
  // recebe 'viewer'. Ou seja: era sempre verdadeiro, e o papel de só-leitura
  // nunca chegou a ser imposto do lado do cliente.
  //
  // Agora é o que devia ser desde o início: pode escrever quem tiver alguma
  // permissão de editar. Enquanto as memberships carregam, não se assume que
  // pode — é meio segundo de botões desativados em vez de uma escrita que não
  // devia acontecer.
  const canEdit = !orgId || AREAS.some(a => podePermissao(permissoes, a.id, 'editar'))

  const pode = (area: string, nivel: Nivel): boolean =>
    !orgId ? true : podePermissao(permissoes, area, nivel)

  const ve = (area: string): boolean =>
    !orgId ? true : veAreaPermissao(permissoes, area)

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
    orgId, userId, role: papel, isManager, canEdit,
    permissoes, pode, ve,
    filter, stamp,
    liveFilterColumn: orgId ? 'org_id' : 'user_id',
    liveFilterValue: orgId || userId,
  }
}
