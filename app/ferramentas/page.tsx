'use client'

import Link from 'next/link'
import { useState } from 'react'
import { NAV_CATEGORIES, type NavCategory } from '@/lib/navigation'

const FEATURED = [
  { href: '/interactions', icon: '🔍', label: 'Verificar interações', desc: 'Verifica a segurança de qualquer combinação de medicamentos', color: '#0d9488', tag: 'Mais usada' },
  { href: '/ai',           icon: '🤖', label: 'Phlox AI',             desc: 'Farmacêutico virtual disponível 24h. Qualquer dúvida de saúde.', color: '#7c3aed', tag: 'Popular' },
  { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos', desc: 'Lista, lembretes automáticos e chat com a tua medicação', color: '#0d9488', tag: 'Essencial' },
  { href: '/oracle',       icon: '🤖', label: 'Oracle AI',            desc: 'IA clínica para SOAP, revisão terapêutica e intervenção PCNE', color: '#2563eb', tag: 'Clínico' },
]

// Estatísticas calculadas dinamicamente (sem números falsos).

export default function FerramentasPage() {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase().trim()

  const totalTools = NAV_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0)

  const filtered: NavCategory[] = q
    ? NAV_CATEGORIES.map(cat => ({
        ...cat,
        tools: cat.tools.filter(t =>
          t.label.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q)
        ),
      })).filter(cat => cat.tools.length > 0)
    : NAV_CATEGORIES

  const totalFiltered = filtered.reduce((s, c) => s + c.tools.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '44px 24px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
            Phlox Platform
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '-0.04em', margin: '0 0 10px', lineHeight: 1.1 }}>
            Todas as ferramentas
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 28px', maxWidth: 500 }}>
            {totalTools} ferramentas organizadas por área. Medicina, farmácia e saúde pessoal num único lugar.
          </p>

          {/* Stats row — só números reais */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>{totalTools}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Ferramentas</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>{NAV_CATEGORIES.length}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Categorias</div>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar ferramenta..."
              style={{
                width: '100%', padding: '13px 16px 13px 44px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, fontSize: 14, color: 'white',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', fontSize: 14,
              }}>×</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 20px 80px' }}>

        {/* No results */}
        {q && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 }}>
            Nenhuma ferramenta encontrada para &quot;{query}&quot;
          </div>
        )}

        {/* Featured section — only when no search */}
        {!q && (
          <section style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 3, height: 18, background: '#0f172a', borderRadius: 2 }} />
              <h2 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Destaques
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              {FEATURED.map(f => (
                <Link key={f.href} href={f.href} style={{ textDecoration: 'none' }} className="feat-card">
                  <div style={{
                    background: 'white',
                    border: `1.5px solid ${f.color}20`,
                    borderRadius: 16,
                    padding: '20px',
                    height: '100%',
                    boxSizing: 'border-box',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      fontSize: 9, fontWeight: 700, color: f.color,
                      background: `${f.color}15`, padding: '2px 7px',
                      borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>{f.tag}</div>
                    <div style={{
                      width: 48, height: 48, borderRadius: 13,
                      background: `${f.color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, marginBottom: 14,
                    }}>{f.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: f.color }}>
                      Abrir
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search result count */}
        {q && (
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
            {totalFiltered} ferramenta{totalFiltered !== 1 ? 's' : ''} para <strong style={{ color: '#0f172a' }}>&quot;{query}&quot;</strong>
          </div>
        )}

        {/* Categories */}
        {filtered.map(cat => (
          <section key={cat.id} style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 18, background: cat.color, borderRadius: 2 }} />
                <h2 style={{ fontSize: 12, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                  {cat.label}
                </h2>
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{cat.tools.length} ferramenta{cat.tools.length !== 1 ? 's' : ''}</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 8,
            }}>
              {cat.tools.map(tool => (
                <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }} className="tool-card">
                  <div style={{
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: 13,
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 11,
                      background: `${cat.color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, flexShrink: 0,
                    }}>
                      {tool.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {tool.label}
                        {tool.badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, background: `${cat.color}15`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                        {tool.desc}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* Footer CTA */}
        {!q && (
          <div style={{ marginTop: 16, padding: '28px 24px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderRadius: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 8 }}>Não encontras o que procuras?</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 18 }}>Estamos sempre a adicionar novas ferramentas. Pede uma nova funcionalidade.</div>
            <Link href="/ai" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '11px 22px', borderRadius: 24,
              background: '#0d9488', color: 'white',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>
              🤖 Perguntar ao Phlox AI
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .tool-card > div:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
          border-color: rgba(0,0,0,0.1) !important;
        }
        .feat-card > div:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important;
        }
      `}</style>
    </div>
  )
}
