// lib/modeTheme.ts
// Personalidade visual POR MODO. Decisão do Fernando: pessoal/cuidador = quente e
// humano; estudante/profissional/instituição = clínico e premium. Cada superfície
// (inicio, ferramentas, barras) lê estes tokens para se sentir certa para QUEM usa.
//
// Não reinventa a paleta base do Phlox — afina temperatura, contraste, raio e tom.

import type { ExperienceMode } from '@/lib/experienceMode'

export interface ModeTheme {
  mode: ExperienceMode
  feel: 'warm' | 'premium'
  // cor de acento principal (chamadas à ação, destaques)
  accent: string
  accentSoft: string          // fundo suave do acento (chips, ícones)
  accentInk: string           // texto sobre accentSoft
  // fundo da página e das superfícies
  pageBg: string
  surface: string             // cartões
  surfaceMuted: string        // cartões secundários / fundos calmos
  border: string
  // texto
  ink: string                 // títulos
  inkSoft: string             // corpo
  inkFaint: string            // legendas
  // forma
  radius: number              // raio dos cartões
  radiusLg: number            // raio de heros / destaques
  // saudação (afeta tom)
  greetWarm: boolean
  // gradiente do foco principal (hero)
  heroFrom: string
  heroTo: string
}

const WARM_PERSONAL: ModeTheme = {
  mode: 'personal', feel: 'warm',
  accent: '#0d7a4d', accentSoft: '#e7f6ee', accentInk: '#0a5c3a',
  pageBg: '#fbfaf7', surface: '#ffffff', surfaceMuted: '#f5f3ee', border: '#ece8e0',
  ink: '#1a2b22', inkSoft: '#4f5a54', inkFaint: '#8a938d',
  radius: 18, radiusLg: 24, greetWarm: true,
  heroFrom: '#0d7a4d', heroTo: '#0e8a6f',
}

const WARM_CAREGIVER: ModeTheme = {
  ...WARM_PERSONAL, mode: 'caregiver',
  accent: '#b9690e', accentSoft: '#fdf1de', accentInk: '#8a4e0a',
  pageBg: '#fcfaf6', surfaceMuted: '#f7f1e7', border: '#efe6d6',
  ink: '#2a2118', inkSoft: '#5b5145', inkFaint: '#998f7f',
  heroFrom: '#bd6c10', heroTo: '#cf8a2a',
}

const PREMIUM_STUDENT: ModeTheme = {
  mode: 'student', feel: 'premium',
  accent: '#7c3aed', accentSoft: '#f1ecfe', accentInk: '#5b21b6',
  pageBg: '#0b0b12', surface: '#15151f', surfaceMuted: '#1d1d2b', border: '#2a2a3a',
  ink: '#f4f3fb', inkSoft: '#b9b7cb', inkFaint: '#7d7b93',
  radius: 16, radiusLg: 22, greetWarm: false,
  heroFrom: '#7c3aed', heroTo: '#9d5cf0',
}

const PREMIUM_CLINICAL: ModeTheme = {
  ...PREMIUM_STUDENT, mode: 'clinical',
  accent: '#3b82f6', accentSoft: '#172033', accentInk: '#bcd4ff',
  pageBg: '#0a0e16', surface: '#111722', surfaceMuted: '#161d2b', border: '#222c3d',
  ink: '#eef3fb', inkSoft: '#aab6c8', inkFaint: '#6f7c91',
  heroFrom: '#1d4ed8', heroTo: '#2563eb',
}

const THEMES: Record<ExperienceMode, ModeTheme> = {
  personal: WARM_PERSONAL,
  caregiver: WARM_CAREGIVER,
  student: PREMIUM_STUDENT,
  clinical: PREMIUM_CLINICAL,
}

export function modeTheme(mode: string | null | undefined): ModeTheme {
  return THEMES[(mode as ExperienceMode)] || WARM_PERSONAL
}

export const isPremiumMode = (mode: string | null | undefined) =>
  mode === 'student' || mode === 'clinical'
