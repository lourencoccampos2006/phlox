'use client'

// /sso/login — entrada para utilizadores da instituição. Escreve o email da empresa
// (ex: nome@minhaorg.pt) e o Phlox redireciona para o IdP correto via Supabase SSO.

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

export default function SSOLoginPage() {
  const { supabase } = useAuth() as any
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function start() {
    const m = email.trim().match(/@([\w.-]+)$/)
    if (!m) { setErr('Indica o teu email institucional completo (ex: nome@minhaorg.pt).'); return }
    const domain = m[1]
    setLoading(true); setErr('')
    try {
      // Supabase signInWithSSO procura o provider associado ao domain
      const { data, error } = await supabase.auth.signInWithSSO({ domain, options: { redirectTo: `${window.location.origin}/dashboard` } })
      if (error) throw new Error(error.message || 'O domínio não está registado para SSO.')
      if (data?.url) window.location.href = data.url
    } catch (e: any) { setErr(e?.message || 'Falha ao iniciar SSO.') }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(440px,100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox · SSO</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Entrar com a conta da organização</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6, marginBottom: 18, lineHeight: 1.55 }}>O Phlox redireciona-te para o teu Identity Provider (Microsoft Entra ID, Google Workspace, Okta…). Não digites a tua palavra-passe aqui.</p>

        <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && start()}
          placeholder="nome@minhaorg.pt"
          style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '12px 14px', fontSize: 14.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }} />

        {err && <div style={{ marginTop: 10, padding: '9px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}

        <button onClick={start} disabled={loading} style={{ width: '100%', marginTop: 12, padding: 13, background: loading ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 14.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
          {loading ? 'A redirecionar…' : 'Continuar →'}
        </button>

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.55 }}>
          Não tens SSO ainda? <Link href="/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Entrar com email</Link><br/>
          Administrador IT? <Link href="/sso-config" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Configurar SSO →</Link>
        </div>
      </div>
    </div>
  )
}
