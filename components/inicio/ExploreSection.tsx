'use client'

// ExploreSection — REBUILD 2026-07-21, revisto no mesmo dia depois de feedback
// direto: a versão anterior mostrava TODAS as categorias já abertas — para o
// modo pessoal isso eram ~18 linhas na categoria Saúde sozinha, uma parede que
// "avassalava". Agora as categorias vêm FECHADAS por padrão (um acordeão — só
// o cabeçalho com o total de ferramentas), e há um filtro simples (não é a
// pesquisa do header, é só para esta lista) que abre automaticamente as
// categorias com resultado. Continua sem página/vista à parte: é só a parte
// de baixo de /inicio.

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { getNavForMode } from '@/lib/navigation'
import type { ModeTheme } from '@/lib/modeTheme'

const CATEGORY_ICON: Record<string, string> = {
  medication: 'pill', health: 'heart', caregiver: 'family', clinical: 'briefcase', student: 'book',
}

export default function ExploreSection({ mode, theme: t }: { mode: string; theme: ModeTheme }) {
  const navMode = (mode === 'clinical' ? 'clinical' : mode) as 'personal' | 'caregiver' | 'student' | 'clinical'
  const cats = getNavForMode(navMode)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const term = q.trim().toLowerCase()
  const filtered = !term ? cats : cats
    .map(c => ({ ...c, tools: c.tools.filter(x => x.label.toLowerCase().includes(term) || x.desc.toLowerCase().includes(term)) }))
    .filter(c => c.tools.length > 0)

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Filtrar esta lista…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: 13.5,
            border: `1px solid ${t.border}`, borderRadius: 10, outline: 'none',
            background: t.surface, color: t.ink, fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: t.inkFaint, padding: '10px 0' }}>Nada encontrado para "{q}".</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(cat => {
            const expanded = !!term || open.has(cat.id)
            return (
              <div key={cat.id} style={{ borderTop: `1px solid ${t.border}`, paddingTop: 4 }}>
                <button
                  onClick={() => toggle(cat.id)}
                  aria-expanded={expanded}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 0',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                  <Icon name={CATEGORY_ICON[cat.id] || 'grid'} size={17} color={t.inkFaint} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {cat.label} <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>· {cat.tools.length}</span>
                  </span>
                  <Icon name="chevron" size={15} color={t.inkFaint} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {expanded && (
                  <div style={{ paddingBottom: 6 }}>
                    {cat.tools.map((tool, i) => (
                      <Link key={tool.href} href={tool.href} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        padding: '11px 0 11px 26px', textDecoration: 'none', borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
                      }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{tool.label}</span>
                            {tool.badge && <span style={{ fontSize: 9, fontWeight: 800, color: t.accent, background: t.accentSoft, padding: '1px 6px', borderRadius: 4 }}>{tool.badge}</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
                        </span>
                        <Icon name="chevron" size={15} color={t.inkFaint} style={{ flexShrink: 0 }} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
