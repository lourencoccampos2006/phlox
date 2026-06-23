'use client'

// /tudo — "Tudo o que o Phlox faz". O catálogo completo das ferramentas do
// modo do utilizador, com pesquisa simples. É o destino do botão "Tudo" na barra
// inferior. Pensado para ser óbvio: nomes claros, ícones grandes, uma linha a
// explicar cada coisa. Mobile-first.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { getNavForMode } from '@/lib/navigation'
import type { ExperienceMode } from '@/lib/experienceMode'

export default function TudoPage() {
  const { user, loading } = useAuth() as any
  const [q, setQ] = useState('')
  const mode: ExperienceMode = user?.experience_mode || 'personal'
  const navMode = (mode === 'clinical' ? 'clinical' : mode) as 'personal' | 'caregiver' | 'student' | 'clinical'

  const cats = useMemo(() => getNavForMode(navMode), [navMode])
  const term = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!term) return cats
    return cats
      .map(c => ({ ...c, tools: c.tools.filter(t => t.label.toLowerCase().includes(term) || t.desc.toLowerCase().includes(term)) }))
      .filter(c => c.tools.length > 0)
  }, [cats, term])

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Tudo o que o Phlox faz
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: '0 0 16px' }}>Escolhe o que precisas. Se não encontras, escreve aqui.</p>

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar… (ex: comprimidos, tensão, dúvida)"
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 42px', fontSize: 16, border: '1.5px solid var(--border)', borderRadius: 12, outline: 'none', background: 'white', color: 'var(--ink)' }} />
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 14, padding: '36px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
            Nada encontrado para “{q}”. Tenta outra palavra.
          </div>
        ) : filtered.map(cat => (
          <div key={cat.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }} className="tudo-grid">
              {cat.tools.map(t => (
                <Link key={t.href} href={t.href} style={{
                  display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
                  background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 16px',
                }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{t.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{t.label}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-4)', marginTop: 1 }}>{t.desc}</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`@media (min-width: 640px) { .tudo-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </div>
  )
}
