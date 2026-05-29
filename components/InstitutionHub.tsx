'use client'

// Renderiza o ecossistema da instituição em secções organizadas (clínica, operações,
// secretaria, legal, equipa) — adaptado ao tipo de instituição e à função.
// Concebido para ser COMPLETO mas nunca confuso: secções claras, ferramentas com ícone,
// "Novo" sinalizado, e filtragem por função.

import Link from 'next/link'
import { INSTITUTION_HUB, SECTION_META, visibleTools } from '@/lib/institutionHub'
import type { InstitutionType, ClinicalRole } from '@/lib/useClinicPrefs'

export default function InstitutionHub({ institution, role, compact = false }: {
  institution: InstitutionType
  role: ClinicalRole
  compact?: boolean
}) {
  const sections = INSTITUTION_HUB[institution] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 14 : 18 }}>
      {sections.map(section => {
        const tools = visibleTools(section, role)
        if (tools.length === 0) return null
        const meta = SECTION_META[section.id]
        return (
          <div key={section.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120', letterSpacing: '-0.01em' }}>{meta.title}</span>
              <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500 }}>{section.hint}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 9 }}>
              {tools.map(t => (
                <Link key={t.href + t.label} href={t.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff', border: `1.5px solid ${meta.color}1f`, borderRadius: 12,
                    padding: '12px 13px', height: '100%', display: 'flex', gap: 10, alignItems: 'flex-start',
                    transition: 'border-color 0.12s',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {t.label}
                        {t.isNew && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: meta.color, padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>NOVO</span>}
                      </div>
                      {!compact && <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
