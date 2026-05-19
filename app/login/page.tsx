'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const FREE_FEATURES = [
  'Histórico de pesquisas guardado',
  'Lista de medicamentos pessoais',
  'Verificador de interações (10/dia)',
  'Tradutor de Bula ilimitado',
  'Dose Pediátrica ilimitado',
]

const MODE_MESSAGES: Record<string, { heading: string; sub: string; color: string }> = {
  clinical:  { heading: 'Acesso Clínico', sub: 'Ward, Connect, Rounds e co-piloto farmacológico.', color: '#1d4ed8' },
  student:   { heading: 'Acesso Student', sub: 'Arena, OSCE, Hive e tutor socrático.', color: '#7c3aed' },
  caregiver: { heading: 'Acesso Familiar', sub: 'Perfis familiares, calendário de tomas e alertas.', color: '#b45309' },
  personal:  { heading: 'Acesso Pessoal', sub: 'A tua medicação, timeline e care plan.', color: '#0d6e42' },
}

function LoginContent() {
  const { signInWithGoogle, loading, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || ''
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (user) router.push('/dashboard')
  }, [user, router])

  const handleGoogleSignIn = async () => {
    setError('')
    setSigningIn(true)
    try {
      Object.keys(localStorage)
        .filter(k => k.includes('lock') || k.includes('-lock'))
        .forEach(k => localStorage.removeItem(k))
      await signInWithGoogle()
    } catch (e: any) {
      setError(e.message || 'Erro ao autenticar. Tenta novamente.')
      setSigningIn(false)
    }
  }

  const modeInfo = MODE_MESSAGES[mode] || null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ animation: 'phlox-pulse 1.4s ease-in-out infinite' }}>
          <rect width="28" height="28" rx="6" fill="var(--green)" opacity="0.15"/>
          <path d="M14 6v16M7 14h14" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em' }}>A verificar sessão</div>
      </div>
      <style>{`@keyframes phlox-pulse { 0%,100%{opacity:0.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )

  if (user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>


      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px 72px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Card */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>

            {/* Header do card */}
            <div style={{ background: modeInfo ? modeInfo.color : '#0f172a', padding: '28px 30px 24px' }}>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="rgba(255,255,255,0.15)"/>
                  <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>PHLOX</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', marginTop: 2 }}>CLINICAL</div>
                </div>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                {modeInfo ? 'Acesso à plataforma' : 'Acesso à plataforma'}
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'white', margin: 0, fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.1 }}>
                {modeInfo ? modeInfo.heading : 'Entrar no Phlox'}
              </h1>
              {modeInfo && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.5 }}>{modeInfo.sub}</p>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '28px 30px' }}>

              {!modeInfo && (
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24 }}>
                  Guarda pesquisas, gere a tua medicação pessoal e acede a ferramentas avançadas.
                </p>
              )}

              {error && (
                <div className="alert-strip alert-strip-red" style={{ marginBottom: 18, borderRadius: 'var(--r)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              {/* Google button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  background: signingIn ? 'var(--bg-3)' : 'white',
                  border: '1.5px solid var(--border-2)',
                  borderRadius: 'var(--r)',
                  padding: '13px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: signingIn ? 'var(--ink-4)' : 'var(--ink)',
                  cursor: signingIn ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  marginBottom: 14,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  letterSpacing: '-0.01em',
                }}
                className="google-btn"
              >
                {signingIn ? (
                  <>
                    <div className="spinner" style={{ color: 'var(--green)' }} />
                    A redirecionar para o Google...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Entrar com Google
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <Link href="/interactions"
                style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', padding: '10px', borderRadius: 'var(--r)', transition: 'color 0.12s', border: '1px solid transparent' }}
                className="anon-link">
                Usar sem conta — ferramentas gratuitas
              </Link>

              {/* Free features */}
              <div style={{ marginTop: 22, padding: '16px 18px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Conta gratuita inclui</div>
                {FREE_FEATURES.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 7, lineHeight: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="8" cy="8" r="7" fill="var(--green-light)" stroke="var(--green)" strokeWidth="1"/>
                      <path d="M5 8l2 2 4-4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legal */}
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-5)', marginTop: 18, lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
            Ao entrares, aceitas os nossos{' '}
            <Link href="/terms" style={{ color: 'var(--green)', textDecoration: 'none' }}>Termos</Link>
            {' '}e{' '}
            <Link href="/privacy" style={{ color: 'var(--green)', textDecoration: 'none' }}>Política de Privacidade</Link>.
          </p>
        </div>
      </div>

      <style>{`
        .google-btn:hover:not(:disabled) { border-color: var(--border-2) !important; box-shadow: var(--shadow-xs) !important; }
        .anon-link:hover { color: var(--green) !important; border-color: var(--border) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes phlox-pulse { 0%,100%{opacity:0.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <LoginContent />
    </Suspense>
  )
}
