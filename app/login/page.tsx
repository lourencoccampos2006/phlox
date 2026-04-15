'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

export default function LoginPage() {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafaf9',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', height: 56, display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>CLINICAL</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Card */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: 'var(--green)', padding: '28px 32px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>
                ACESSO À PLATAFORMA
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', margin: 0 }}>
                Entrar no Phlox
              </h1>
            </div>

            <div style={{ padding: '32px' }}>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 28 }}>
                Acede ao teu histórico de pesquisas, lista de medicamentos pessoais,
                e ferramentas avançadas de estudo.
              </p>

              {/* Google Sign In */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  background: 'white',
                  border: '1px solid var(--border-2)',
                  borderRadius: 4,
                  padding: '12px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontFamily: 'var(--font-sans)',
                  marginBottom: 16,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {/* Google icon */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </button>

              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <span style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  padding: '0 12px',
                  fontSize: 11,
                  color: 'var(--ink-4)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  OU
                </span>
              </div>

              {/* Continue without login */}
              <Link
                href="/"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--ink-3)',
                  textDecoration: 'none',
                  padding: '10px',
                }}
              >
                Continuar sem conta →
              </Link>

              {/* Free plan features */}
              <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg-2)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>
                  CONTA GRATUITA INCLUI
                </div>
                {[
                  'Histórico de pesquisas guardado',
                  'Lista de medicamentos pessoais',
                  'Acesso a flashcards e quizzes',
                  'Alertas de interações personalizados',
                ].map(feature => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--green-2)', fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-4)', marginTop: 16, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
            Ao entrares, aceitas os nossos{' '}
            <Link href="/terms" style={{ color: 'var(--green-2)', textDecoration: 'none' }}>Termos</Link>
            {' '}e{' '}
            <Link href="/privacy" style={{ color: 'var(--green-2)', textDecoration: 'none' }}>Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}