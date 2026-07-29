import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Helper partilhado pelas rotas de "gestão a dois" (sprint121) — convite de
// partilha com papel 'editor'. Todas usam service-role (para poder ler/
// escrever em perfis que não são do próprio) e por isso este check é a
// ÚNICA barreira de autorização: nunca confiar em profile_id vindo do
// cliente sem passar por aqui primeiro. Mesmo padrão de /api/family-help
// (hasAccess), mas mais estrito — exige role='editor', não basta ter uma
// partilha de visualização.

export function adminDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Dono do perfil OU partilha ativa (não revogada) com papel 'editor'.
export async function hasEditorAccess(db: SupabaseClient, userId: string, profileId: string): Promise<boolean> {
  const { data: owned } = await db.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (owned) return true
  const { data: shared } = await db.from('family_profile_shares').select('id')
    .eq('profile_id', profileId).eq('viewer_user_id', userId).eq('role', 'editor').is('revoked_at', null).maybeSingle()
  return !!shared
}
