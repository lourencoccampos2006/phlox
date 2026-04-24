'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// Usa exactamente a mesma configuração do AuthContext
// para garantir que a sessão fica na mesma chave localStorage
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

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handle = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Erro explícito do OAuth
      if (error) {
        console.error('OAuth error:', error, errorDescription)
        router.replace('/login')
        return
      }

      // Já tem sessão activa (raro mas possível)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/onboarding')
        return
      }

      // Troca o code PKCE por sessão
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('Code exchange error:', exchangeError.message)
          router.replace('/login')
        } else {
          router.replace('/onboarding')
        }
        return
      }

      // Sem code nem sessão — redireciona para login
      router.replace('/login')
    }

    handle()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border)',
          borderTop: '3px solid var(--green)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
          A autenticar
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          A verificar credenciais com o Google...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}