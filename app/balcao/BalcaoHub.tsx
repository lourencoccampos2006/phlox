'use client'

// BalcaoHub — fusão "Balcão" (farmácia): atendimento por indicação, vendas/POS,
// sala de espera e aconselhamento, num só ecrã com abas. Cada aba é o componente
// original intacto (zero funcionalidade reescrita). Tom sóbrio (farmácia).

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { AtendimentoTool } from './page'
import { VendasTool } from '../vendas/page'
import { AtendimentosTool } from '../atendimentos/page'
import { SalaEsperaTool } from '../sala-espera/page'
import { CounselingTool } from '../counseling/page'

type TabId = 'atendimento' | 'vendas' | 'sala' | 'atendimentos' | 'conselho'
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'atendimento',  label: 'Indicação',      icon: '🩺' },
  { id: 'vendas',       label: 'Vendas',          icon: '🛒' },
  { id: 'sala',         label: 'Sala de espera',  icon: '⏳' },
  { id: 'atendimentos', label: 'Atendimentos',    icon: '📋' },
  { id: 'conselho',     label: 'Aconselhamento',  icon: '🗣️' },
]

export default function BalcaoHub() {
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const sp = useSearchParams()
  const requested = sp?.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(requested && TABS.some(t => t.id === requested) ? requested : 'atendimento')

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 8px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 5 }}>Balcão</div>
          <h1 style={{ fontSize: 'clamp(21px,3vw,27px)', fontWeight: 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>Atendimento ao balcão</h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0' }}>Indicação, vendas, fila e aconselhamento — sem perder ninguém.</p>
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
        {tab === 'atendimento' && <AtendimentoTool />}
        {tab === 'vendas' && <VendasTool />}
        {tab === 'sala' && <SalaEsperaTool />}
        {tab === 'atendimentos' && <AtendimentosTool />}
        {tab === 'conselho' && <CounselingTool />}
      </div>
    </div>
  )
}
