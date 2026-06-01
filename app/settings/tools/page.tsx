'use client'

// /settings/tools — Personalização do nav.
// O utilizador escolhe que ferramentas quer ver. As escondidas saem do
// /ferramentas e da pesquisa. Ficam no localStorage; sem rede.

import { useState, useEffect } from 'react'
import { getNavForMode } from '@/lib/navigation'
import { useAuth } from '@/components/AuthContext'
import { type ExperienceMode } from '@/lib/experienceMode'
import { getHiddenTools, setHidden, resetHidden, PREFS_EVENT } from '@/lib/userPrefs'
import Link from 'next/link'

export default function SettingsToolsPage() {
  const { user } = useAuth()
  const mode = ((user as any)?.experience_mode || 'personal') as ExperienceMode
  const [hidden, setH] = useState<Set<string>>(new Set())

  useEffect(() => {
    const refresh = () => setH(new Set(getHiddenTools()))
    refresh()
    window.addEventListener(PREFS_EVENT, refresh)
    return () => window.removeEventListener(PREFS_EVENT, refresh)
  }, [])

  const cats = getNavForMode(mode)

  function toggle(href: string) {
    setHidden(href, !hidden.has(href))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/settings" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>← Definições</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0b1120', margin: '6px 0 4px', letterSpacing: '-0.02em' }}>Ferramentas visíveis</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.55 }}>
            Desliga as ferramentas que não usas. Não as eliminas — só deixam de aparecer no Hub e na pesquisa. Podes ligá-las outra vez aqui a qualquer momento.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => resetHidden()} style={{ padding: '8px 14px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Mostrar tudo</button>
          <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            {hidden.size} escondida{hidden.size === 1 ? '' : 's'}
          </div>
        </div>

        {cats.map(cat => (
          <section key={cat.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 3, height: 14, background: cat.color, borderRadius: 2 }} />
              <h2 style={{ fontSize: 11.5, fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{cat.label}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cat.tools.map(t => {
                const isHidden = hidden.has(t.href)
                return (
                  <div key={t.href} style={{ background: 'white', border: `1px solid ${isHidden ? '#fde68a' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, opacity: isHidden ? 0.65 : 1 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>{t.label}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>{t.desc}</div>
                    </div>
                    <button onClick={() => toggle(t.href)}
                      title={isHidden ? 'Mostrar no Hub' : 'Esconder do Hub'}
                      style={{ flexShrink: 0, padding: '6px 12px', background: isHidden ? '#fffbeb' : '#f0fdf4', color: isHidden ? '#b45309' : '#16a34a', border: `1.5px solid ${isHidden ? '#fde68a' : '#bbf7d0'}`, borderRadius: 7, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      {isHidden ? 'Esconder' : 'A mostrar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
