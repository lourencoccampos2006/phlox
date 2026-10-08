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

  /* ══════════════════════════════════════════════════════════════════════
     A MOLDURA DAS TRÊS FERRAMENTAS — refeita (2026-10-07)
     ══════════════════════════════════════════════════════════════════════
     Tinha um cabeçalho de 230px: a migalha de pão, um título em serifa, uma
     frase de explicação, e só depois as abas. Por baixo vinha a barra de
     trabalho da ferramenta — duas camadas de cabeçalho antes de aparecer
     uma única linha de conteúdo.

     Quem abre isto cinquenta vezes por dia não precisa de ler «Tudo o que se
     regista sobre cada utente ao longo do dia» cinquenta vezes. Precisa das
     abas e do trabalho.

     Fica uma tira fina, da altura de um separador, e nada mais.
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: 'var(--chao)', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={{
        display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: 'wrap',
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '0 clamp(10px, 1.2vw, 16px)',
      }}>
        {tabs.map(t => {
          const m = TAB_META[t]
          const on = tab === t
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${on ? 'var(--green)' : 'transparent'}`, marginBottom: -1,
              fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '.08em',
              textTransform: 'uppercase',
              fontWeight: on ? 700 : 500, color: on ? 'var(--green)' : 'var(--ink-4)',
            }}>
              <Icon name={m.icon} size={14} color={on ? 'var(--green)' : 'var(--ink-4)'} /> {m.label}
            </button>
          )
        })}
      </div>

      {tab === 'registo' && <CareLogTool />}
      {tab === 'feridas' && <FeridasTool />}
      {tab === 'atividades' && <AtividadesTool />}
    </div>
  )
}
