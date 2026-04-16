'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Limpa APENAS locks órfãos, nunca tokens de sessão válidos
function clearOrphanedLocks() {
  if (typeof window === 'undefined') return
  try {
    const lockKeys = Object.keys(localStorage).filter(k =>
      k.includes('-lock') || k.includes('lock:')
    )
    lockKeys.forEach(k => localStorage.removeItem(k))
  } catch { }
}

let supabaseInstance: SupabaseClient | null = null

function getSupabase() {
  if (supabaseInstance) return supabaseInstance
  clearOrphanedLocks()
  supabaseInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  )
  return supabaseInstance
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
  const supabase = getSupabase()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let mounted = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          await loadProfile(session.user)
        }
      } catch (e) {
        console.error('Auth init error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true)
        await loadProfile(session.user)
        if (mounted) setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(authUser: any) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!data) {
        const newProfile = {
          id: authUser.id,
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
      console.error('loadProfile error:', e)
    }
  }

  const signInWithGoogle = async () => {
    clearOrphanedLocks()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch { }
    // Limpa todo o estado do Supabase do localStorage
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k))
    } catch { }
    supabaseInstance = null
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)