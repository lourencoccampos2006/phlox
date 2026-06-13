'use client'

// FusionTabs — shell de abas reutilizável para as ferramentas fundidas.
// Recebe um título, as abas (label + componente) e adapta o tom/cor ao tipo de
// instituição via blueprint. Cada aba renderiza o componente original intacto —
// é assim que fundimos sem reescrever nem perder funcionalidade.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor } from '@/lib/institutionBlueprint'

export interface FusionTab {
  id: string
  label: string
  icon: string
  render: () => React.ReactNode
}

export default function FusionTabs({ eyebrow, title, subtitle, tabs }: {
  eyebrow: string
  title: string
  subtitle?: string
  tabs: FusionTab[]
}) {
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'
  const sp = useSearchParams()
  const requested = sp?.get('tab')
  const [tab, setTab] = useState<string>(requested && tabs.some(t => t.id === requested) ? requested : tabs[0]?.id)
  const active = tabs.find(t => t.id === tab) || tabs[0]

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 8px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 5 }}>{eyebrow}</div>
          <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(24px,4vw,32px)' : 'clamp(21px,3vw,27px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0' }}>{subtitle}</p>}
        </div>
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #eceef0' }}>
            {tabs.map(t => {
              const on = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: `2.5px solid ${on ? bp.accent : 'transparent'}`, cursor: 'pointer',
                    fontSize: 14, fontWeight: on ? 800 : 600, color: on ? bp.accent : '#64748b', marginBottom: -1, fontFamily: 'var(--font-sans)' }}>
                  <span style={{ fontSize: 15 }}>{t.icon}</span> {t.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div>{active?.render()}</div>
    </div>
  )
}
