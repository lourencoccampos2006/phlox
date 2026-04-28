'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'

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
  // ─── NOVO: campos do Sprint 1 ───
  experience_mode: 'clinical' | 'caregiver' | 'personal' | 'student'
  onboarded: boolean
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
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
          // ─── NOVO: defaults dos campos Sprint 1 ───
          experience_mode: 'personal' as const,
          onboarded: false,
          created_at: new Date().toISOString(),
        }
        const { error: insertError } = await supabase.from('profiles').insert(newProfile)
        if (insertError) console.error('Profile insert error:', insertError.message)
        setUser(newProfile)
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
          // ─── NOVO: ler campos Sprint 1 do Supabase ───
          experience_mode: data.experience_mode || 'personal',
          onboarded: data.onboarded || false,
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

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) console.error('SignOut error:', error.message)
    setUser(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)