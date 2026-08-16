// lib/adminAuth.ts
// Verificação partilhada para as rotas /api/admin/* — só a conta pessoal do
// Fernando (não um papel de organização, não um plano). Extraído de
// app/api/admin/ai-usage/route.ts (2026-08-16) para não duplicar a lista de
// e-mails e a verificação em cada rota admin nova.
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractToken } from '@/lib/planGate'

export const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']

export function adminDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Devolve o utilizador autenticado se (e só se) for admin — null caso contrário
// (não autenticado, token inválido, ou autenticado mas não é a conta admin).
export async function requireAdmin(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const token = extractToken(req)
  if (!token) return null
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: auth, error } = await authClient.auth.getUser(token)
  if (error || !auth?.user?.email || !ADMIN_EMAILS.includes(auth.user.email)) return null
  return { id: auth.user.id, email: auth.user.email }
}
