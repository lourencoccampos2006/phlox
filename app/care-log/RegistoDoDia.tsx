'use client'

// RegistoDoDia — a fusão "Registo do dia": care-log + feridas + atividades num
// só ecrã premium. Cada ferramenta antiga foi extraída como componente
// (CareLogTool, FeridasTool, AtividadesTool) — ZERO funcionalidade reescrita,
// só reorganizada em abas. As abas e o tom adaptam-se ao tipo de instituição
// via blueprint (centro de dia: warm, sem feridas como destaque; lar: tem
// feridas; etc). Reformulação institucional 2026-06-13. Aba "Hidratação"
// removida 2026-08-07 (redundante com "Registo" — ver comentário abaixo).
//
// Abas "Saúde & Apoio" e "Cuidados" TAMBÉM saíram 2026-08-07 — fundidas para
// dentro de /ronda-guiada (reconstruído): tarefas de cuidado recorrentes
// (care_checklists) e o registo rápido por pessoa passam a acontecer no fluxo
// já guiado residente-a-residente, em vez de ser mais uma aba separada para
// abrir. SaudeApoioTool.tsx/CuidadosTool.tsx ficam no repo mas deixam de estar
// ligados a nada — ver app/ronda-guiada/page.tsx.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import Icon from '@/components/Icon'
import { CareLogTool } from './page'
import { FeridasTool } from '../feridas/page'
import { AtividadesTool } from '../activities/page'

type TabId = 'registo' | 'feridas' | 'atividades'
const TAB_META: Record<TabId, { label: string; icon: string }> = {
  registo:    { label: 'Registo',    icon: 'note' },
  atividades: { label: 'Atividades', icon: 'target' },
  feridas:    { label: 'Feridas',    icon: 'bandage' },
}

// Que abas cada tipo de instituição vê (ordem importa). Centro de dia destaca
// atividades; lar tem feridas; farmácias não usam este registo.
// BUG CORRIGIDO 2026-08-07: a aba "Hidratação" foi removida — os mesmos campos
// já existem dentro de "Registo" (CareLogTool), era um formulário duplicado a
// pedir os mesmos dados duas vezes. A ferramenta /hidratacao standalone
// (tracking clínico mais profundo — Bristol, obstipação — via ⌘K) mantém-se,
// só esta aba redundante saiu.
const TABS_BY_INST: Record<string, TabId[]> = {
  day_care:      ['registo', 'atividades'],
  nursing_home:  ['registo', 'feridas', 'atividades'],
  clinic:        ['registo'],
  health_center: ['registo'],
}

export default function RegistoDoDia() {
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const warm = bp.tone === 'warm'
  const tabs = TABS_BY_INST[institution] || ['registo', 'atividades']

  const sp = useSearchParams()
  const requested = sp?.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(requested && tabs.includes(requested) ? requested : tabs[0])

  return (
    <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f7f8fa', overflowX: 'hidden' }}>
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
                <Icon name={m.icon} size={16} color={active ? bp.accent : '#64748b'} /> {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo da aba — o componente real, intacto */}
      <div>
        {tab === 'registo' && <CareLogTool />}
        {tab === 'feridas' && <FeridasTool />}
        {tab === 'atividades' && <AtividadesTool />}
      </div>
    </div>
  )
}
