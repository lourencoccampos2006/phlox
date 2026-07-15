// ─── lib/experienceMode.ts ─── Metadados visuais por modo de experiência
//
// 2026-07-15: removidos ROUTE_GROUPS, getAIPersona() e getPlanLimits() — os 3
// eram dados/funções mortos (zero consumidores em todo o código, verificado
// antes de apagar), e ROUTE_GROUPS tinha ~20 links partidos para rotas já
// apagadas (/oracle, /carta, /migrar, /nota-clinica, /link, /prescription,
// /adherencia, /grand-round, /progresso, /counseling, /drug-info, /nursing,
// /monitor, /integracoes, /food-drug, /residentes). O catálogo real de
// navegação por modo é lib/navigation.ts (NAV_CATEGORIES) + lib/toolRegistry.ts.

export type ExperienceMode = 'clinical' | 'caregiver' | 'personal' | 'student'

export const MODE_META: Record<ExperienceMode, {
  label: string; labelShort: string; color: string
  bg: string; border: string; headerBg: string; headerText: string
}> = {
  clinical:  { label: 'Profissional de Saúde', labelShort: 'Clínico',   color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', headerBg: '#0f172a', headerText: '#f8fafc' },
  student:   { label: 'Estudante',             labelShort: 'Estudante', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', headerBg: '#ffffff', headerText: '#0a0a0a' },
  caregiver: { label: 'Cuidador Familiar',     labelShort: 'Família',   color: '#b45309', bg: '#fffbeb', border: '#fde68a', headerBg: '#ffffff', headerText: '#0a0a0a' },
  personal:  { label: 'Uso Pessoal',           labelShort: 'Pessoal',   color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0', headerBg: '#ffffff', headerText: '#0a0a0a' },
}
