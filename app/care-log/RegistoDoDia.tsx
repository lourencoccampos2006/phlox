'use client'

// RegistoDoDia — a fusão "Registo do dia": care-log + hidratação + feridas +
// atividades num só ecrã premium. Cada ferramenta antiga foi extraída como
// componente (CareLogTool, HidratacaoTool, FeridasTool, AtividadesTool) — ZERO
// funcionalidade reescrita, só reorganizada em abas. As abas e o tom adaptam-se
// ao tipo de instituição via blueprint (centro de dia: warm, sem feridas como
// destaque; lar: tem feridas; etc). Reformulação institucional 2026-06-13.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { CareLogTool } from './page'
import { HidratacaoTool } from '../hidratacao/page'
import { FeridasTool } from '../feridas/page'
import { AtividadesTool } from '../activities/page'

type TabId = 'registo' | 'hidratacao' | 'feridas' | 'atividades'
const TAB_META: Record<TabId, { label: string; icon: string }> = {
  registo:    { label: 'Registo',    icon: '📝' },
  hidratacao: { label: 'Hidratação', icon: '💧' },
  atividades: { label: 'Atividades', icon: '🎯' },
  feridas:    { label: 'Feridas',    icon: '🩹' },
}

// Que abas cada tipo de instituição vê (ordem importa). Centro de dia destaca
// atividades; lar/hospital têm feridas; farmácias não usam este registo.
const TABS_BY_INST: Record<string, TabId[]> = {
  day_care:      ['registo', 'hidratacao', 'atividades'],
  nursing_home:  ['registo', 'hidratacao', 'feridas', 'atividades'],
  hospital:      ['registo', 'hidratacao', 'feridas'],
  clinic:        ['registo', 'hidratacao'],
  health_center: ['registo', 'hidratacao'],
}

export default function RegistoDoDia() {
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'
  const tabs = TABS_BY_INST[institution] || ['registo', 'hidratacao', 'atividades']

  const sp = useSearchParams()
  const requested = sp?.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(requested && tabs.includes(requested) ? requested : tabs[0])

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 8px' }}>
        {/* Cabeçalho */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 5 }}>Cuidado diário</div>
          <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(24px,4vw,32px)' : 'clamp(21px,3vw,27px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>
            Registo do dia
          </h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '5px 0 0' }}>
            Tudo o que se regista sobre cada {cfg.personNoun.toLowerCase()} ao longo do dia, num só sítio.
          </p>
        </div>

        {/* Abas — adaptadas ao tipo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #eceef0' }}>
          {tabs.map(t => {
            const m = TAB_META[t]
            const active = tab === t
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none',
                  borderBottom: `2.5px solid ${active ? bp.accent : 'transparent'}`, cursor: 'pointer',
                  fontSize: 14, fontWeight: active ? 800 : 600, color: active ? bp.accent : '#64748b', marginBottom: -1,
                  fontFamily: 'var(--font-sans)',
                }}>
                <span style={{ fontSize: 15 }}>{m.icon}</span> {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo da aba — o componente real, intacto */}
      <div>
        {tab === 'registo' && <CareLogTool />}
        {tab === 'hidratacao' && <HidratacaoTool />}
        {tab === 'feridas' && <FeridasTool />}
        {tab === 'atividades' && <AtividadesTool />}
      </div>
    </div>
  )
}
