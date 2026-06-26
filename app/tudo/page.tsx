'use client'

// /tudo — "Tudo o que o Phlox faz". O catálogo completo das ferramentas do
// modo, com pesquisa. Destino do botão "Tudo" na barra inferior. Adapta-se ao
// TEMA do modo (warm/dark premium) para o fluxo ser coerente — sem saltar de um
// /inicio escuro para uma página branca.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { getNavForMode } from '@/lib/navigation'
import { modeTheme } from '@/lib/modeTheme'
import type { ExperienceMode } from '@/lib/experienceMode'

export default function TudoPage() {
  const { user, loading } = useAuth() as any
  const [q, setQ] = useState('')
  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const navMode = (mode === 'clinical' ? 'clinical' : mode) as 'personal' | 'caregiver' | 'student' | 'clinical'
  const t = modeTheme(mode)

  const cats = useMemo(() => getNavForMode(navMode), [navMode])
  const term = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!term) return cats
    return cats
      .map(c => ({ ...c, tools: c.tools.filter(x => x.label.toLowerCase().includes(term) || x.desc.toLowerCase().includes(term)) }))
      .filter(c => c.tools.length > 0)
  }, [cats, term])

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 16px 40px' }}>
        <h1 style={{ fontFamily: t.greetWarm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 'clamp(24px,5.5vw,30px)', color: t.ink, fontWeight: t.greetWarm ? 400 : 800, letterSpacing: '-0.02em', margin: '0 0 5px' }}>
          Tudo o que o Phlox faz
        </h1>
        <p style={{ fontSize: 14.5, color: t.inkSoft, margin: '0 0 18px' }}>Escolha o que precisa. Se não encontrar, escreva aqui.</p>

        <div style={{ position: 'relative', marginBottom: 22 }}>
          <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: t.inkFaint }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar… (ex: comprimidos, tensão, dúvida)"
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 44px', fontSize: 16, border: `1.5px solid ${t.border}`, borderRadius: t.radius, outline: 'none', background: t.surface, color: t.ink }} />
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: t.surface, border: `1px dashed ${t.border}`, borderRadius: t.radius, padding: '36px 20px', textAlign: 'center', color: t.inkFaint, fontSize: 14 }}>
            Nada encontrado para “{q}”. Tente outra palavra.
          </div>
        ) : filtered.map(cat => (
          <div key={cat.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }} className="tudo-grid">
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} className="tudo-card" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>{tool.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{tool.label}</span>
                    <span style={{ display: 'block', fontSize: 13, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .tudo-card { display: flex; align-items: center; gap: 14px; text-decoration: none; border-radius: ${t.radius}px; padding: 15px 16px; transition: transform .12s; }
        .tudo-card:active { transform: scale(0.99); }
        @media (min-width: 640px) { .tudo-grid { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  )
}
