// lib/orgAuth.ts
// Helper partilhado para rotas de API que atuam sobre uma organização.
// Antes desta consolidação, ~15 rotas reimplementavam o mesmo "cliente
// Supabase com o token do utilizador reencaminhado" e nenhuma verificava
// explicitamente o papel de admin/owner na própria rota — dependiam
// inteiramente da RLS (que já teve uma fuga real, ver sprint109). Isto dá
// uma segunda camada de defesa com uma resposta 403 limpa em vez de um erro
// bruto do Postgres.
//
// MELHORIAS 2026-07-17 (item A5 da auditoria): `authedClient` (e os aliases
// abaixo) passaram a ser o ÚNICO sítio com esta lógica em todo o site — o
// mesmo cliente "Supabase com o token Bearer do pedido" estava duplicado,
// quase byte-a-byte, em ~65 rotas fora do âmbito de organizações, sob nomes
// diferentes (sb/authClient/makeSupabase+getToken). Os aliases têm esses
// nomes de propósito, para os sites de chamada não precisarem de mudar,
// só o import — apesar do nome do ficheiro, este helper não é específico
// de organizações.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  PAPEL_ANTIGO_PARA_NOVO, permissoesDe, pode, type Nivel,
} from '@/lib/permissoes'

/** Cliente Supabase autenticado com o token Bearer do pedido (RLS do utilizador). */
export function authedClient(req: NextRequest): SupabaseClient {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

/** Extrai só o token Bearer (para rotas que também o reencaminham para outro fetch). */
export function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

/** Mesmo cliente que `authedClient`, mas a partir de um token já extraído. */
export function makeSupabase(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// Aliases — nomes que já existiam duplicados por rota, agora todos apontando
// para a mesma implementação única acima.
export const sb = authedClient
export const authClient = authedClient

/**
 * As permissões efetivas de alguém numa organização (`area.nivel`).
 * Vazio quando não é membro ativo.
 *
 * Lê de `org_members` e traduz o papel: entre o dia em que este código sobe e
 * o dia em que a migração (sprint152) corre, a base de dados ainda tem os
 * papéis antigos. Sem a tradução, toda a gente ficava sem permissões nenhumas
 * nesse intervalo — e são 70 rotas a passar por aqui.
 */
export async function permissoesNaOrg(
  sb: SupabaseClient, userId: string, orgId: string,
): Promise<string[]> {
  const { data, error } = await sb.from('org_members')
    .select('role, capabilities').eq('org_id', orgId).eq('user_id', userId).eq('active', true).maybeSingle()
  if (error || !data) return []
  const papel = PAPEL_ANTIGO_PARA_NOVO[data.role] || data.role
  return permissoesDe(papel, data.capabilities)
}

/**
 * Exige uma permissão concreta. É a forma que as rotas novas devem usar:
 *
 *   const negado = await requireOrgPermissao(sb, user.id, orgId, 'financeiro', 'editar')
 *   if (negado) return negado
 */
export async function requireOrgPermissao(
  sb: SupabaseClient, userId: string, orgId: string, area: string, nivel: Nivel,
): Promise<NextResponse | null> {
  const minhas = await permissoesNaOrg(sb, userId, orgId)
  if (pode(minhas, area, nivel)) return null
  return NextResponse.json({ error: 'Não tem acesso a esta parte.' }, { status: 403 })
}

/**
 * Confirma que `userId` gere a organização. Devolve `null` se sim, ou uma
 * NextResponse 403 pronta a devolver se não — uso:
 * `const denied = await requireOrgRole(...); if (denied) return denied`.
 *
 * ── PORQUE É QUE ISTO DEIXOU DE OLHAR PARA O NOME DO PAPEL ─────────────────
 * Estava escrito `roles.includes(data.role)` com `roles: ('owner'|'admin')[]`,
 * e é chamado por SETENTA rotas. Depois da migração (sprint152) não existe
 * nenhum papel chamado `owner` nem `admin` — as setenta passariam a devolver
 * 403 a toda a gente, incluindo ao dono da casa.
 *
 * Agora pergunta pela CAPACIDADE de gerir (`definicoes.editar`), que é o que
 * estas rotas querem dizer quando pedem "owner ou admin". O parâmetro `roles`
 * fica por compatibilidade com as chamadas existentes e é ignorado — quem
 * escrever uma rota nova deve usar `requireOrgPermissao`.
 */
export async function requireOrgRole(
  sb: SupabaseClient, userId: string, orgId: string, _roles?: string[],
): Promise<NextResponse | null> {
  const minhas = await permissoesNaOrg(sb, userId, orgId)
  if (!minhas.length) {
    return NextResponse.json({ error: 'Não pertence a esta instituição.' }, { status: 403 })
  }
  if (!pode(minhas, 'definicoes', 'editar')) {
    return NextResponse.json({ error: 'Não tem acesso a esta parte — fale com quem gere a casa.' }, { status: 403 })
  }
  return null
}
