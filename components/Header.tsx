'use client'

import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em' }}>Phlox</span>
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Clinical</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {[
            { href: '/interactions', label: 'Interações' },
            { href: '/drugs', label: 'Medicamentos' },
            { href: '/calculators', label: 'Calculadoras' },
            { href: '/study', label: 'Estudantes' },
            { href: '/pricing', label: 'Preços' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}

          {/* Auth */}
          {loading ? (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', animation: 'pulse 1s infinite' }} />
          ) : user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(!menuOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px 5px 5px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} style={{ width: 24, height: 24, borderRadius: '50%' }} />
                  : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{user.name[0]}</div>
                }
                <span style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name.split(' ')[0]}</span>
                <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>▾</span>
              </button>

              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 220, zIndex: 50, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{user.email}</div>
                      <div style={{ display: 'inline-block', marginTop: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>
                        {user.plan === 'free' ? 'Gratuito' : user.plan}
                      </div>
                    </div>
                    {[
                      { href: '/dashboard', label: 'O meu perfil', icon: '👤' },
                      { href: '/dashboard?tab=history', label: 'Histórico', icon: '🕐' },
                      { href: '/dashboard?tab=meds', label: 'Os meus medicamentos', icon: '💊' },
                      { href: '/dashboard?tab=account', label: 'Conta e plano', icon: '⚙️' },
                    ].map(({ href, label, icon }) => (
                      <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 14 }}>{icon}</span>{label}
                      </Link>
                    ))}
                    <button onClick={() => { signOut(); setMenuOpen(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                      <span style={{ fontSize: 14 }}>→</span>Terminar sessão
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
              Entrar
            </Link>
          )}
        </nav>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </header>
  )
}