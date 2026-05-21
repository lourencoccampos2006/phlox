'use client'

import { useState, useEffect } from 'react'

export type ClinicalRole =
  | 'pharmacist'
  | 'pharmacist_director'
  | 'nurse'
  | 'coordinator'
  | 'doctor'
  | 'administrator'

export type InstitutionType =
  | 'hospital'
  | 'clinic'
  | 'pharmacy_hospital'
  | 'pharmacy_community'
  | 'nursing_home'
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
  hospital:           { label: 'Hospital',                  icon: '🏥', shortLabel: 'Hospital' },
  clinic:             { label: 'Clínica',                   icon: '🏠', shortLabel: 'Clínica' },
  pharmacy_hospital:  { label: 'Farmácia Hospitalar',       icon: '⚗️', shortLabel: 'Farm. Hosp.' },
  pharmacy_community: { label: 'Farmácia Comunitária',      icon: '🏪', shortLabel: 'Farm. Com.' },
  nursing_home:       { label: 'Lar / ERPI',                icon: '🤝', shortLabel: 'Lar/ERPI' },
  health_center:      { label: 'Centro de Saúde',           icon: '🌿', shortLabel: 'CSP' },
}

const ROLE_KEY = 'phlox-clinic-role'
const INST_KEY = 'phlox-clinic-institution'

export function useClinicPrefs() {
  const [role, setRoleState] = useState<ClinicalRole>('pharmacist')
  const [institution, setInstState] = useState<InstitutionType>('hospital')

  useEffect(() => {
    const r = localStorage.getItem(ROLE_KEY) as ClinicalRole | null
    const i = localStorage.getItem(INST_KEY) as InstitutionType | null
    if (r && r in ROLE_META) setRoleState(r)
    if (i && i in INST_META) setInstState(i)
  }, [])

  const setRole = (r: ClinicalRole) => {
    setRoleState(r)
    localStorage.setItem(ROLE_KEY, r)
  }

  const setInstitution = (i: InstitutionType) => {
    setInstState(i)
    localStorage.setItem(INST_KEY, i)
  }

  return { role, institution, setRole, setInstitution }
}
