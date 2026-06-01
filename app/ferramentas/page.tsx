'use client'

// /ferramentas — Hub de ferramentas (filtrado por modo).
// Atualização 2026-06-01: ISOLAMENTO POR MODO. Quem é clínico não vê pessoais.
// Quem está em /settings pode esconder ferramentas individuais que não usa.

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getNavForMode, type NavCategory } from '@/lib/navigation'
import { useAuth } from '@/components/AuthContext'
import { type ExperienceMode } from '@/lib/experienceMode'
import { getHiddenTools } from '@/lib/userPrefs'

export default function FerramentasPage() {
  const { user } = useAuth()
  const mode = ((user as any)?.experience_mode || 'personal') as ExperienceMode
  const [query, setQuery] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => { setHidden(new Set(getHiddenTools())) }, [])

  const q = query.toLowerCase().trim()
  const base = getNavForMode(mode).map(cat => ({
    ...cat,
    tools: cat.tools.filter(t => !hidden.has(t.href)),
  })).filter(cat => cat.tools.length > 0)

  const totalTools = base.reduce((s, c) => s + c.tools.length, 0)

  const filtered: NavCategory[] = q
    ? base.map(cat => ({
        ...cat,
        tools: cat.tools.filter(t =>
          t.label.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q)
        ),
      })).filter(cat => cat.tools.length > 0)
    : base

  const modeLabel = ({ personal: 'Uso pessoal', caregiver: 'Cuidador familiar', student: 'Estudante', clinical: 'Profissional de saúde' } as const)[mode]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: '#0f172a', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
            Hub de ferramentas · {modeLabel}
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.1 }}>
            As tuas ferramentas
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 18px', maxWidth: 560 }}>
            Só vês o que faz sentido para o teu modo de utilização. <Link href="/settings/tools" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 700 }}>Personalizar →</Link>
          </p>
          <div style={{ position: 'relative', maxWidth: 460 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Pesquisar em ${totalTools} ferramentas...`}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, fontSize: 13.5, color: 'white', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>
        {q && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
            Nenhuma ferramenta encontrada para &quot;{query}&quot;.
          </div>
        )}

        {filtered.map(cat => (
          <section key={cat.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 3, height: 16, background: cat.color, borderRadius: 2 }} />
              <h2 style={{ fontSize: 12, fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                {cat.label}
              </h2>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{cat.tools.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
              {cat.tools.map(t => (
                <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                    padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', height: '100%', boxSizing: 'border-box',
                    transition: 'transform 0.1s, border-color 0.1s',
                  }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = cat.color }}
                     onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#e5e7eb' }}>
                    <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120' }}>{t.label}</span>
                        {t.badge && <span style={{ fontSize: 9, fontWeight: 800, color: cat.color, background: cat.color + '14', border: `1px solid ${cat.color}40`, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.badge}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>{t.desc}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
