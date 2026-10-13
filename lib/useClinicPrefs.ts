'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { reportError } from '@/lib/clientError'
import { leituraPartilhada } from '@/lib/leituraPartilhada'

export type ClinicalRole =
  | 'pharmacist'
  | 'pharmacist_director'
  | 'nurse'
  | 'coordinator'
  | 'doctor'
  | 'administrator'

// ── DOIS TIPOS. SÓ DOIS. (decisão do Fernando, reafirmada 2026-10-12) ──────
// O Phlox institucional serve lares (ERPI) e centros de dia. Mais nada.
//
// Havia cinco: `clinic`, `pharmacy_community` e `health_center` sobraram de
// quando o produto ainda tentava servir farmácias e clínicas. Cada um deles
// trazia um plano de ecrã, um conjunto de ferramentas e um vocabulário
// próprios — e tudo isso era código que ninguém usava mas que era preciso
// manter a par do resto a cada mudança.
//
// Não é o mesmo que o PLANO `clinic`, que fica: esse é o escalão de conta de
// quem pertence a uma instituição, e não tem nada que ver com o tipo dela.
export type InstitutionType =
  | 'nursing_home'
  | 'day_care'

export const ROLE_META: Record<ClinicalRole, { label: string; icon: string; color: string }> = {
  pharmacist:          { label: 'Farmacêutico Clínico',     icon: 'flask', color: 'var(--blue)' },
  pharmacist_director: { label: 'Director de Farmácia',     icon: '🏛',  color: 'var(--roxo)' },
  nurse:               { label: 'Enfermeiro/a',             icon: 'stethoscope', color: 'var(--green-3)' },
  coordinator:         { label: 'Coordenador/a de Serviço', icon: 'chart', color: 'var(--amber)' },
  doctor:              { label: 'Médico/a',                 icon: 'stethoscope', color: 'var(--red)' },
  administrator:       { label: 'Administrador/a',          icon: 'building', color: 'var(--blue)' },
}

export const INST_META: Record<InstitutionType, { label: string; icon: string; shortLabel: string }> = {
  nursing_home:       { label: 'Lar / ERPI',                icon: 'users', shortLabel: 'Lar/ERPI' },
  day_care:           { label: 'Centro de Dia',             icon: 'clock', shortLabel: 'C. Dia' },
}

// Tipos de instituição OFERECIDOS a novos utilizadores. Por decisão do Fernando,
// para já SÓ centro de dia e lar (o foco real). Farmácia, clínica e centro de
// saúde estão ARQUIVADOS (código mantido no repo, mas fora do produto). Todos os
// seletores de tipo leem daqui — mudar aqui muda em todo o lado.
export const OFFERED_INSTITUTIONS: InstitutionType[] = ['day_care', 'nursing_home']

const ROLE_KEY = 'phlox-clinic-role'
const INST_KEY = 'phlox-clinic-institution'

// ── DE ONDE VEM O TIPO DE INSTITUIÇÃO ─────────────────────────────────────
// Até 2026-09-07 vinha SÓ do localStorage. Consequência: o /settings lia o
// localStorage e dizia "Lar", o /equipa lia `organizations.kind` do servidor e
// dizia "Centro de Dia", e o /admin escrevia na base de dados sem que nada no
// ecrã mudasse. Três respostas diferentes para a mesma pergunta.
//
// Agora a FONTE DE VERDADE é o servidor: `profiles.institution_type` (e, para
// quem pertence a uma organização, o `organizations.kind` manda sobre esse).
// O localStorage passa a ser só uma cache para a primeira pintura não piscar.
export function useClinicPrefs() {
  const [role, setRoleState] = useState<ClinicalRole>('pharmacist')
  const [institution, setInstState] = useState<InstitutionType>('nursing_home')

  useEffect(() => {
    const r = localStorage.getItem(ROLE_KEY) as ClinicalRole | null
    const i = localStorage.getItem(INST_KEY) as InstitutionType | null
    if (r && r in ROLE_META) setRoleState(r)
    if (i && i in INST_META) setInstState(i)   // cache: evita o pisca inicial
  }, [])

  // A verdade vem do perfil (AuthContext já o carrega — nenhuma consulta
  // extra) e, para quem pertence a uma organização, do `organizations.kind`
  // dessa casa, que é o que o dono do Phlox muda no /admin.
  const { user, supabase } = useAuth() as any
  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      let tipo: string | null = user.institution_type || null
      const org = user.active_org_id || user.org_id
      if (org && supabase) {
        try {
          // Partilhada: este hook e chamado por dezenas de componentes e todos
          // perguntavam o mesmo ao mesmo tempo. Medido num browser: 55 pedidos
          // a `organizations` para abrir seis paginas. Agora e um.
          //
          // O tipo de uma casa nao muda a meio de um turno — e quando mudar
          // (nas definicoes), `invalidar('org-kind')` limpa isto.
          const { data, error: erroLeitura } = await leituraPartilhada<{ data: { kind?: string } | null; error: any }>(
            `org-kind:${org}`,
            () => supabase.from('organizations').select('kind').eq('id', org).maybeSingle(),
          )
          if (erroLeitura) reportError('clinic-kind', erroLeitura)
          if (data?.kind) tipo = data.kind
        } catch { /* fica o do perfil */ }
      }
      if (vivo && tipo && tipo in INST_META) {
        setInstState(tipo as InstitutionType)
        try { localStorage.setItem(INST_KEY, tipo) } catch {}
      }
    })()
    return () => { vivo = false }
  }, [user?.institution_type, user?.active_org_id, user?.org_id, supabase])

  const setRole = (r: ClinicalRole) => {
    setRoleState(r)
    localStorage.setItem(ROLE_KEY, r)
  }

  const setInstitution = (i: InstitutionType) => {
    setInstState(i)
    localStorage.setItem(INST_KEY, i)
  }

  // Estavel enquanto o papel e o tipo de casa nao mudarem. Este hook e chamado
  // em dezenas de paginas; se devolvesse um objeto novo a cada render, qualquer
  // uma delas ficava a um `useCallback([cfg])` de distancia de um ciclo
  // infinito. Ver scripts/check-hooks-estaveis.mjs.
  return useMemo(
    () => ({ role, institution, setRole, setInstitution }),
    // As duas funcoes so tocam em `setState` e no localStorage: nao fecham
    // sobre nada que mude, por isso nao precisam de entrar na chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, institution])
}
