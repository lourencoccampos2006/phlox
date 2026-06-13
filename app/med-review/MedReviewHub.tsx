'use client'

// MedReviewHub — fusão "Revisão de medicação": junta a revisão/otimização
// (MedReviewTool), os critérios STOPP/START (StoppStartTool) e a revisão por
// pessoa com IA (ResidentesTool) num só ecrã com abas. Mesma família clínica
// (rever medicação para risco/otimização), agora num só sítio. Zero
// funcionalidade reescrita — cada aba é o componente original intacto.
// Adapta o tom/vocabulário ao tipo de instituição via blueprint.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { MedReviewTool } from './page'
import { StoppStartTool } from '../stopp-start/page'
import { ResidentesTool } from '../residentes/page'

type TabId = 'revisao' | 'stopp' | 'pessoa'
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'revisao', label: 'Revisão e otimização', icon: '🔬' },
  { id: 'stopp',   label: 'STOPP / START',        icon: '🛑' },
  { id: 'pessoa',  label: 'Por pessoa (IA)',       icon: '👤' },
]

export default function MedReviewHub() {
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'
  const sp = useSearchParams()
  const requested = sp?.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(requested && TABS.some(t => t.id === requested) ? requested : 'revisao')

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 8px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 5 }}>Medicação</div>
          <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(24px,4vw,32px)' : 'clamp(21px,3vw,27px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>
            Revisão de medicação
          </h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0' }}>
            Rever e otimizar a medicação de cada {cfg.personNoun.toLowerCase()} — risco, STOPP/START e análise por IA.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #eceef0' }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none',
                  borderBottom: `2.5px solid ${active ? bp.accent : 'transparent'}`, cursor: 'pointer',
                  fontSize: 14, fontWeight: active ? 800 : 600, color: active ? bp.accent : '#64748b', marginBottom: -1, fontFamily: 'var(--font-sans)' }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span> {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        {tab === 'revisao' && <MedReviewTool />}
        {tab === 'stopp' && <StoppStartTool />}
        {tab === 'pessoa' && <ResidentesTool />}
      </div>
    </div>
  )
}
