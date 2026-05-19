'use client'

import Link from 'next/link'
import { useState } from 'react'
import { NAV_CATEGORIES, type NavCategory } from '@/lib/navigation'

export default function FerramentasPage() {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase().trim()

  const filtered: NavCategory[] = q
    ? NAV_CATEGORIES.map(cat => ({
        ...cat,
        tools: cat.tools.filter(t =>
          t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
        ),
      })).filter(cat => cat.tools.length > 0)
    : NAV_CATEGORIES

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '40px 24px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, margin: '0 0 10px' }}>
            Phlox
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
            Todas as ferramentas
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 24px' }}>
            35+ ferramentas organizadas por área. Clica para abrir.
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar ferramenta..."
              style={{
                width: '100%', padding: '11px 14px 11px 42px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 10, fontSize: 14, color: '#0f172a',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 64px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 }}>
            Nenhuma ferramenta encontrada para &quot;{query}&quot;
          </div>
        )}

        {filtered.map(cat => (
          <section key={cat.id} style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 3, height: 18, background: cat.color, borderRadius: 2 }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                {cat.label}
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: 10,
            }}>
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }} className="tool-card">
                  <div style={{
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: 12,
                    padding: '16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${cat.color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {tool.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {tool.label}
                        {tool.badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, background: `${cat.color}15`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                        {tool.desc}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <style>{`
        .tool-card > div:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
        }
      `}</style>
    </div>
  )
}
