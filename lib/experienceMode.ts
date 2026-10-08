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
  clinical:  { label: 'Instituição', labelShort: 'Instituição',   color: 'var(--blue)', bg: 'var(--blue-light)', border: 'var(--blue-light)', headerBg: 'var(--badge-blue-fg)', headerText: 'var(--bg-2)' },
  student:   { label: 'Estudante',             labelShort: 'Estudante', color: 'var(--roxo)', bg: 'var(--roxo-claro)', border: 'var(--roxo-borda)', headerBg: 'var(--bg)', headerText: 'var(--ink)' },
  caregiver: { label: 'Cuidador Familiar',     labelShort: 'Família',   color: 'var(--amber)', bg: 'var(--amber-light)', border: 'var(--badge-amber-border)', headerBg: 'var(--bg)', headerText: 'var(--ink)' },
  personal:  { label: 'Uso Pessoal',           labelShort: 'Pessoal',   color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-mid)', headerBg: 'var(--bg)', headerText: 'var(--ink)' },
}
