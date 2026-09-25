'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { reportError } from '@/lib/clientError'

export type ClinicalRole =
  | 'pharmacist'
  | 'pharmacist_director'
  | 'nurse'
  | 'coordinator'
  | 'doctor'
  | 'administrator'

// Tipos suportados. Hospital e farmácia hospitalar foram removidos (demasiado
// ambicioso para agora) — o foco é lar, centro de dia, farmácia comunitária,
// clínica e centro de saúde.
export type InstitutionType =
  | 'clinic'
  | 'pharmacy_community'
  | 'nursing_home'
  | 'day_care'
  | 'health_center'

export const ROLE_META: Record<ClinicalRole, { label: string; icon: string; color: string }> = {
  pharmacist:          { label: 'Farmacêutico Clínico',     icon: '🔬', color: '#2563eb' },
  pharmacist_director: { label: 'Director de Farmácia',     icon: '🏛',  color: '#7c3aed' },
  nurse:               { label: 'Enfermeiro/a',             icon: '👩‍⚕️', color: '#0d9488' },
  coordinator:         { label: 'Coordenador/a de Serviço', icon: '📊', color: '#ca8a04' },
  doctor:              { label: 'Médico/a',                 icon: '🩺', color: '#dc2626' },
  administrator:       { label: 'Administrador/a',          icon: '🏢', color: '#64748b' },
}

export const INST_META: Record<InstitutionType, { label: string; icon: string; shortLabel: string }> = {
  clinic:             { label: 'Clínica',                   icon: '🏠', shortLabel: 'Clínica' },
  pharmacy_community: { label: 'Farmácia Comunitária',      icon: '🏪', shortLabel: 'Farm. Com.' },
  nursing_home:       { label: 'Lar / ERPI',                icon: '🤝', shortLabel: 'Lar/ERPI' },
  day_care:           { label: 'Centro de Dia',             icon: '☀️', shortLabel: 'C. Dia' },
  health_center:      { label: 'Centro de Saúde',           icon: '🌿', shortLabel: 'CSP' },
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
          const { data, error: erroLeitura } = await supabase.from('organizations').select('kind').eq('id', org).maybeSingle()
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
