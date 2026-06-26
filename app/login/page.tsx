'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const INK = '#16181d'
const INK_3 = '#545862'
const INK_4 = '#767b86'
const GREEN = '#0d6e42'
const BORDER = '#e7e8ea'
const PAPER = '#fbfaf7'

const FREE_FEATURES = [
  'A sua lista de medicamentos, com lembretes',
  'Foto à receita ou caixa (3 por dia)',
  'Ver se os medicamentos se dão bem (3 por dia)',
  'Tirar dúvidas de saúde (3 por dia)',
  'A sua história de saúde, guardada',
]

const MODE_MESSAGES: Record<string, { heading: string; sub: string }> = {
  clinical:  { heading: 'Acesso profissional', sub: 'Painel da instituição, medicação, ronda e portal das famílias.' },
  student:   { heading: 'Acesso estudante', sub: 'Arena, simulador, OSCE e tutor com IA.' },
  caregiver: { heading: 'Acesso familiar', sub: 'Perfis da família, lembretes de toma e alertas.' },
  personal:  { heading: 'Acesso pessoal', sub: 'A sua medicação, a sua história de saúde e a IA do Phlox.' },
}

function LoginContent() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || ''
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  // Email/password
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setEmailMsg('')
    if (!email.trim() || !password) { setError('Preenche o email e a palavra-passe.'); return }
    setEmailBusy(true)
    try {
      if (emailMode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(email, password)
        if (needsConfirmation) { setEmailMsg('Conta criada! Confirma o email na tua caixa de entrada para entrares.'); setEmailBusy(false); return }
      } else {
        await signInWithEmail(email, password)
      }
      // sucesso → o useEffect redireciona quando o user carregar
    } catch (e: any) {
      setError(e.message || 'Não foi possível autenticar.')
      setEmailBusy(false)
    }
  }

  useEffect(() => {
    // Encaminha pelo estado de onboarding — uma conta NOVA (ex.: signup por email)
    // tem de passar pela configuração inicial, não saltar logo para /inicio.
    if (user) router.push((user as any).onboarded ? '/inicio' : '/onboarding')
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
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-sans)', color: INK }}>
      <div className="lg-split">

        {/* ── Painel editorial (desktop) ── */}
        <aside className="lg-aside">
          <div className="lg-aside-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 'auto' }}>
              <span style={{ width: 34, height: 1.5, background: GREEN }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: INK_4, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>Phlox · Saúde em português</span>
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,3.4vw,40px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.06, margin: '0 0 18px' }}>
                A sua saúde,<br /><em style={{ fontStyle: 'italic', color: GREEN }}>sem confusões.</em>
              </h2>
              <p style={{ fontSize: 15.5, color: INK_3, lineHeight: 1.62, maxWidth: '40ch', margin: 0 }}>
                A sua medicação organizada, dúvidas respondidas em português simples, e um aviso
                quando algo merece atenção. Entre — ou crie conta — e comece.
              </p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 26, borderTop: `1px solid ${BORDER}` }}>
              {FREE_FEATURES.slice(0, 4).map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
                  <span style={{ color: GREEN, flexShrink: 0, fontSize: 14 }}>—</span>
                  <span style={{ fontSize: 13.5, color: INK_3, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Coluna de autenticação ── */}
        <main className="lg-main">
          <div className="lg-form">

            <div style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK_4, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
                {modeInfo ? 'Entrar' : 'Bem-vindo'}
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: INK, margin: 0, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.08 }}>
                {modeInfo ? modeInfo.heading : 'Entrar no Phlox'}
              </h1>
              <p style={{ fontSize: 14, color: INK_3, lineHeight: 1.6, marginTop: 10 }}>
                {modeInfo ? modeInfo.sub : 'Guarde as suas pesquisas, faça a gestão da sua medicação e aceda a tudo.'}
              </p>
            </div>

            <div>

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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em' }}>ou com email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Email + password */}
              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="o-teu@email.pt" autoComplete="email"
                  style={{ border: '1.5px solid var(--border-2)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={emailMode === 'signup' ? 'Cria uma palavra-passe (mín. 6)' : 'Palavra-passe'} autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                  style={{ border: '1.5px solid var(--border-2)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
                <button type="submit" disabled={emailBusy}
                  style={{ background: emailBusy ? 'var(--bg-3)' : 'var(--green)', color: emailBusy ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r)', padding: '13px', fontSize: 14, fontWeight: 800, cursor: emailBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {emailBusy ? 'A processar…' : emailMode === 'signup' ? 'Criar conta' : 'Entrar'}
                </button>
              </form>
              {emailMsg && <div style={{ fontSize: 12.5, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', marginBottom: 12 }}>{emailMsg}</div>}
              <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 16 }}>
                {emailMode === 'signin' ? (
                  <>Ainda não tens conta? <button onClick={() => { setEmailMode('signup'); setError(''); setEmailMsg('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-sans)' }}>Criar conta</button></>
                ) : (
                  <>Já tens conta? <button onClick={() => { setEmailMode('signin'); setError(''); setEmailMsg('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-sans)' }}>Entrar</button></>
                )}
              </div>

              {/* Divider 2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <Link href="/interactions"
                style={{ display: 'block', textAlign: 'center', fontSize: 13, color: INK_3, textDecoration: 'none', padding: '11px', borderRadius: 2, border: `1px solid ${BORDER}` }}
                className="anon-link">
                Usar sem conta — ferramentas gratuitas
              </Link>

              {/* Conta gratuita inclui — só no mobile (no desktop está no painel) */}
              <div className="lg-free-mobile" style={{ marginTop: 22, padding: '16px 18px', background: PAPER, borderRadius: 2, border: `1px solid ${BORDER}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK_4, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Conta gratuita inclui</div>
                {FREE_FEATURES.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: GREEN, flexShrink: 0, fontSize: 13 }}>—</span>
                    <span style={{ fontSize: 12.5, color: INK_3, lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: INK_4, marginTop: 20, lineHeight: 1.7, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                Ao entrar, aceita os{' '}
                <Link href="/terms" style={{ color: GREEN, textDecoration: 'none' }}>Termos</Link>{' '}e a{' '}
                <Link href="/privacy" style={{ color: GREEN, textDecoration: 'none' }}>Privacidade</Link>.
              </p>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .lg-split { min-height: 100vh; display: grid; grid-template-columns: 1fr; }
        .lg-aside { display: none; }
        .lg-main { display: flex; align-items: center; justify-content: center; padding: 40px 20px 64px; }
        .lg-form { width: 100%; max-width: 400px; }
        .google-btn:hover:not(:disabled) { border-color: ${INK} !important; }
        .anon-link:hover { border-color: ${INK} !important; color: ${INK} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes phlox-pulse { 0%,100%{opacity:0.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1)} }
        @media (min-width: 860px) {
          .lg-split { grid-template-columns: 1.05fr 0.95fr; }
          .lg-aside { display: block; background: ${PAPER}; border-right: 1px solid ${BORDER}; }
          .lg-aside-inner { min-height: 100vh; display: flex; flex-direction: column; padding: clamp(40px,5vw,68px); box-sizing: border-box; }
          .lg-free-mobile { display: none; }
        }
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
