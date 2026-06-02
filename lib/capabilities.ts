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
  patients:     { label: 'Doentes / utentes',    color: '#1d4ed8' },
  episodes:     { label: 'Episódios clínicos',   color: '#0d6e42' },
  prescription: { label: 'Prescrição',           color: '#7c3aed' },
  mar:          { label: 'MAR',                  color: '#0891b2' },
  rounds:       { label: 'Rondas farmacêuticas', color: '#b45309' },
  stock:        { label: 'Stock / farmácia',     color: '#475569' },
  billing:      { label: 'Faturação',            color: '#dc2626' },
  pos:          { label: 'POS',                  color: '#dc2626' },
  team:         { label: 'Equipa',               color: '#0d6e42' },
  quality:      { label: 'Qualidade / auditoria',color: '#7c3aed' },
  audit:        { label: 'Audit trail',          color: '#0f172a' },
  org:          { label: 'Organização',          color: '#0f172a' },
}

export const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  owner:      { label: 'Proprietário',  color: '#0f172a', description: 'Tudo. Inclui apagar a organização.' },
  admin:      { label: 'Administrador', color: '#1d4ed8', description: 'Gere identidade, equipa, integrações, faturação.' },
  clinician:  { label: 'Médico / clínico', color: '#0d6e42', description: 'Vê e edita doentes, prescreve, faz rondas.' },
  pharmacist: { label: 'Farmacêutico',  color: '#7c3aed', description: 'Valida prescrição, stock, POS, intervenções.' },
  nurse:      { label: 'Enfermeiro',    color: '#0891b2', description: 'MAR, cuidados, avaliações, eventos.' },
  assistant:  { label: 'Assistente',    color: '#94a3b8', description: 'Receção, marcações, faturação.' },
  accountant: { label: 'Contabilidade', color: '#dc2626', description: 'Faturação e exportações fiscais.' },
  viewer:     { label: 'Observador',    color: '#475569', description: 'Acesso só de leitura.' },
  student:    { label: 'Estudante',     color: '#7c3aed', description: 'Estágio / observação.' },
  caregiver:  { label: 'Cuidador',      color: '#b45309', description: 'Cuidador familiar com permissões de administração de medicação.' },
  self:       { label: 'Próprio',       color: '#0d6e42', description: 'O próprio utente — só vê os seus dados.' },
}
