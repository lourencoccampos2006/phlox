'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import { ensureUserScope, clearUserScopeOnSignOut } from '@/lib/userScope'

// Cria o cliente uma vez, fora do componente, ao nível do módulo
// Isto garante que é o mesmo cliente em toda a app independentemente de renders
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storageKey: 'phlox-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)

type User = {
  id: string
  email: string
  name: string
  avatar: string
  plan: 'free' | 'student' | 'pro' | 'clinic'
  searches_today: number
  profile_type: 'personal' | 'student' | 'professional' | null
  profile_sub: string | null
  // ─── NOVO: campos de experiência e organização ───
  experience_mode: 'clinical' | 'caregiver' | 'personal' | 'student'
  context_secondary: 'clinical' | 'caregiver' | 'personal' | 'student' | null
  onboarded: boolean
  org_id: string | null
  org_role: 'owner' | 'admin' | 'member' | null
  active_org_id: string | null
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => ({ needsConfirmation: false }),
  signOut: async () => {},
  refreshUser: async () => {},
  supabase,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Recupera sessão existente do localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        loadProfile(session.user).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_IN' && session?.user) {
        loadProfile(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token refrescado automaticamente — não precisa de recarregar perfil
        setLoading(false)
      } else if (event === 'INITIAL_SESSION') {
        if (!session) setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(authUser: any) {
    // Isolamento por conta: se a conta mudou neste browser, limpa os dados
    // locais da conta anterior (guardados, atalhos, etc.) antes de tudo.
    try { ensureUserScope(authUser?.id) } catch {}
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Profile error:', error.message)
      }

      if (!data) {
        // Cria perfil novo
        const newProfile = {
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Utilizador',
          avatar: authUser.user_metadata?.avatar_url || '',
          plan: 'free' as const,
          profile_type: null,
          profile_sub: null,
          searches_today: 0,
          // ─── NOVO: defaults dos campos experiência e organização ───
          experience_mode: 'personal' as const,
          context_secondary: null,
          onboarded: false,
          org_id: null,
          org_role: null,
          active_org_id: null,
          created_at: new Date().toISOString(),
        }
        const { error: insertError } = await supabase.from('profiles').insert(newProfile)
        if (insertError) console.error('Profile insert error:', insertError.message)
        setUser(newProfile)
        // Conta nova → email de boas-vindas (best-effort, idempotente no servidor).
        // Não bloqueia o login; falha em silêncio se o Resend não estiver pronto.
        try {
          const tok = (await supabase.auth.getSession()).data.session?.access_token
          if (tok) {
            fetch('/api/email/welcome', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {})
          }
        } catch {}
      } else {
        setUser({
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.avatar || '',
          plan: data.plan || 'free',
          profile_type: data.profile_type || null,
          profile_sub: data.profile_sub || null,
          searches_today: data.searches_today || 0,
          // ─── NOVO: ler campos experiência e organização do Supabase ───
          experience_mode: data.experience_mode || 'personal',
          context_secondary: data.context_secondary || null,
          onboarded: data.onboarded || false,
          org_id: data.org_id || null,
          org_role: data.org_role || null,
          active_org_id: data.active_org_id || data.org_id || null,
        })
      }
    } catch (e: any) {
      console.error('loadProfile error:', e?.message)
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })
    if (error) throw error
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw new Error(
      /invalid login credentials/i.test(error.message) ? 'Email ou palavra-passe incorretos.' :
      /email not confirmed/i.test(error.message) ? 'Confirma o teu email primeiro (vê a caixa de entrada).' :
      error.message
    )
    // onAuthStateChange (SIGNED_IN) trata de carregar o perfil.
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw new Error(
      /already registered|already exists/i.test(error.message) ? 'Já existe uma conta com este email. Tenta entrar.' :
      /password/i.test(error.message) ? 'A palavra-passe precisa de pelo menos 6 caracteres.' :
      error.message
    )
    // Se a confirmação de email estiver ligada no Supabase, não há sessão imediata.
    return { needsConfirmation: !data.session }
  }

  const signOut = async () => {
    setLoading(true)
    // Limpa os dados locais da conta antes de sair (privacidade no dispositivo).
    try { clearUserScopeOnSignOut() } catch {}
    const { error } = await supabase.auth.signOut()
    if (error) console.error('SignOut error:', error.message)
    setUser(null)
    setLoading(false)
  }

  // Re-lê o perfil do utilizador atual SEM recarregar a página. Usado depois de
  // mudar o modo/definições, para a app refletir já a mudança (na "app instalada"
  // não há refresh do browser, por isso isto é essencial).
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await loadProfile(session.user)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, supabase, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)