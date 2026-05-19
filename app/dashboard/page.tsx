'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NAV_CATEGORIES } from '@/lib/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

const MODES = [
  { id: 'personal',  icon: '👤', label: 'Pessoal',   desc: 'A minha saúde' },
  { id: 'caregiver', icon: '👨‍👩‍👧', label: 'Cuidador',  desc: 'Cuidar da família' },
  { id: 'clinical',  icon: '🏥', label: 'Clínico',   desc: 'Profissional de saúde' },
  { id: 'student',   icon: '🎓', label: 'Estudante', desc: 'Aprender farmácia' },
] as const

function DashboardContent() {
  const { user, supabase } = useAuth()
  const mode = (user?.experience_mode as string) || 'personal'
  const [saving, setSaving] = useState(false)

  async function switchMode(newMode: string) {
    if (!user || saving) return
    setSaving(true)
    await supabase.from('profiles').update({ experience_mode: newMode }).eq('id', user.id)
    window.location.reload()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Phlox</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>Painel de controlo</h1>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 72px' }}>

        {/* ── Mode switcher ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Modo ativo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
            {MODES.map(m => {
              const active = mode === m.id
              const meta = MODE_META[m.id as ExperienceMode]
              return (
                <button
                  key={m.id}
                  onClick={() => !active && switchMode(m.id)}
                  disabled={saving || active}
                  className={!active ? 'dash-mode-btn' : ''}
                  style={{
                    background: active ? `${meta.color}08` : 'white',
                    border: active ? `2px solid ${meta.color}50` : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 14, padding: '16px 14px', textAlign: 'left',
                    cursor: active ? 'default' : 'pointer',
                    transition: 'all 0.12s', position: 'relative',
                    opacity: saving && !active ? 0.6 : 1,
                  }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.desc}</div>
                  {active && (
                    <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── All tools by category ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>Ferramentas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {NAV_CATEGORIES.map(cat => (
              <div key={cat.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 16, background: cat.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 8 }}>
                  {cat.tools.map(t => (
                    <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }} className="dash-tool">
                      <div style={{
                        background: 'white', borderRadius: 12, padding: '12px 14px',
                        border: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'transform 0.1s, box-shadow 0.1s',
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${cat.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {t.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            {t.label}
                            {t.badge && (
                              <span style={{ fontSize: 8, fontWeight: 700, color: cat.color, background: `${cat.color}15`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {t.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginTop: 2 }}>{t.desc}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Account ── */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Conta</div>
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {[
              { href: '/profile',       label: 'O meu perfil',         desc: 'Nome, email, foto de perfil' },
              { href: '/notifications', label: 'Notificações',          desc: 'Lembretes e alertas' },
              { href: '/passport',      label: 'Passaporte de saúde',  desc: 'QR code de emergência' },
              { href: '/ferramentas',   label: 'Todas as ferramentas', desc: 'Pesquisa e acesso rápido' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div
                  className="dash-account-row"
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .dash-mode-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .dash-tool > div:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.07) !important; }
        .dash-account-row:hover { background: #f8fafc; }
      `}</style>
    </div>
  )
}

function DashboardRouter() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!(user as any).onboarded) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #e2e8f0', borderTopColor: '#0d6e42', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  return <DashboardContent />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <DashboardRouter />
    </Suspense>
  )
}
