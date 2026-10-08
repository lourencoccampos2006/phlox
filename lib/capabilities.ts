'use client'

// lib/capabilities.ts
// Hooks e helpers para verificar capabilities no cliente.
//
// Server-side, a verificação é feita pelas RLS policies (has_capability(...))
// e por checagem explícita nos handlers /api/*. O cliente usa estes helpers
// apenas para esconder/desabilitar UI — nunca como linha de defesa única.

import { useActiveOrg, useMemberships } from '@/lib/orgContext'

/** Retorna se o utilizador atual tem a capability na org ativa. */
export function useCapability(cap: string): boolean {
  const { caps } = useActiveOrg()
  return caps.includes(cap)
}

export function useAnyCapability(caps: string[]): boolean {
  const { caps: have } = useActiveOrg()
  return caps.some(c => have.includes(c))
}

export function useAllCapabilities(caps: string[]): boolean {
  const { caps: have } = useActiveOrg()
  return caps.every(c => have.includes(c))
}

/** Versão direta (não-hook) — útil em handlers. */
export function hasCap(userCaps: string[], cap: string): boolean {
  return userCaps.includes(cap)
}

// ─── Catálogo cliente — espelho de capability_catalog ───────────────────────
// Mantido aqui para autocomplete/UI; o source-of-truth é a tabela SQL.
export const CAPABILITY_CATEGORIES: Record<string, { label: string; color: string }> = {
  patients:     { label: 'Doentes / utentes',    color: 'var(--blue)' },
  episodes:     { label: 'Episódios clínicos',   color: 'var(--green)' },
  prescription: { label: 'Prescrição',           color: 'var(--roxo)' },
  mar:          { label: 'MAR',                  color: 'var(--green)' },
  rounds:       { label: 'Rondas farmacêuticas', color: 'var(--amber)' },
  stock:        { label: 'Stock / farmácia',     color: 'var(--blue)' },
  billing:      { label: 'Faturação',            color: 'var(--red)' },
  pos:          { label: 'POS',                  color: 'var(--red)' },
  team:         { label: 'Equipa',               color: 'var(--green)' },
  quality:      { label: 'Qualidade / auditoria',color: 'var(--roxo)' },
  audit:        { label: 'Audit trail',          color: 'var(--badge-blue-fg)' },
  org:          { label: 'Organização',          color: 'var(--badge-blue-fg)' },
}

export const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  owner:      { label: 'Proprietário',  color: 'var(--badge-blue-fg)', description: 'Tudo. Inclui apagar a organização.' },
  admin:      { label: 'Administrador', color: 'var(--blue)', description: 'Gere identidade, equipa, integrações, faturação.' },
  clinician:  { label: 'Médico / clínico', color: 'var(--green)', description: 'Vê e edita doentes, prescreve, faz rondas.' },
  pharmacist: { label: 'Farmacêutico',  color: 'var(--roxo)', description: 'Valida prescrição, stock, POS, intervenções.' },
  nurse:      { label: 'Enfermeiro',    color: 'var(--green)', description: 'MAR, cuidados, avaliações, eventos.' },
  assistant:  { label: 'Assistente',    color: 'var(--badge-blue-border)', description: 'Receção, marcações, faturação.' },
  accountant: { label: 'Contabilidade', color: 'var(--red)', description: 'Faturação e exportações fiscais.' },
  viewer:     { label: 'Observador',    color: 'var(--blue)', description: 'Acesso só de leitura.' },
  student:    { label: 'Estudante',     color: 'var(--roxo)', description: 'Estágio / observação.' },
  caregiver:  { label: 'Cuidador',      color: 'var(--amber)', description: 'Cuidador familiar com permissões de administração de medicação.' },
  self:       { label: 'Próprio',       color: 'var(--green)', description: 'O próprio utente — só vê os seus dados.' },
}
