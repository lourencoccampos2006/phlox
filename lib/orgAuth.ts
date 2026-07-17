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
 * Confirma que `userId` tem um dos `roles` na organização `orgId` (membro
 * ativo). Devolve `null` se sim, ou uma NextResponse 403 pronta a devolver
 * se não — uso: `const denied = await requireOrgRole(...); if (denied) return denied`.
 */
export async function requireOrgRole(
  sb: SupabaseClient, userId: string, orgId: string, roles: ('owner' | 'admin')[]
): Promise<NextResponse | null> {
  const { data } = await sb.from('org_members')
    .select('role').eq('org_id', orgId).eq('user_id', userId).eq('active', true).maybeSingle()
  if (!data || !roles.includes(data.role)) {
    return NextResponse.json({ error: 'Sem permissão — só admins/owner da instituição.' }, { status: 403 })
  }
  return null
}
