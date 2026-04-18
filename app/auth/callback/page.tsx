'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // O PKCE flow precisa de trocar o code por uma sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        // Tenta trocar o code da URL
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')

        if (code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
              console.error('Code exchange error:', error.message)
              router.replace('/login')
            } else {
              router.replace('/dashboard')
            }
          })
        } else {
          router.replace('/login')
        }
      }
    })
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
        <p style={{ fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          A autenticar...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}