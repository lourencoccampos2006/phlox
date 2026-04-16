'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

function clearSupabaseLocks() {
  try {
    Object.keys(localStorage)
      .filter(k => k.includes('lock'))
      .forEach(k => localStorage.removeItem(k))
  } catch { }
}

function createSupabaseClient() {
  clearSupabaseLocks()
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
}

type User = {
  id: string
  email: string
  name: string
  avatar: string
  plan: 'free' | 'student' | 'pro'
  searches_today: number
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
  supabase: null as any,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createSupabaseClient()
  }
  const supabase = supabaseRef.current

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return
      if (error) { setLoading(false); return }
      if (session?.user) {
        loadUserProfile(session.user.id, session.user).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true)
        await loadUserProfile(session.user.id, session.user)
        if (mounted) setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadUserProfile(userId: string, authUser: any) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!data) {
        const newProfile = {
          id: userId,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Utilizador',
          avatar: authUser.user_metadata?.avatar_url || '',
          plan: 'free',
          searches_today: 0,
          created_at: new Date().toISOString(),
        }
        await supabase.from('profiles').insert(newProfile)
        setUser({ ...newProfile, plan: 'free' as const })
      } else {
        setUser({
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.avatar || '',
          plan: data.plan || 'free',
          searches_today: data.searches_today || 0,
        })
      }
    } catch (e) {
      console.error('loadUserProfile error:', e)
    }
  }

  const signInWithGoogle = async () => {
    clearSupabaseLocks()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    try {
      Object.keys(localStorage)
        .filter(k => k.includes('supabase') || k.includes('sb-'))
        .forEach(k => localStorage.removeItem(k))
    } catch { }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)