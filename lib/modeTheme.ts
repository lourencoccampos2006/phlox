// lib/modeTheme.ts
// Personalidade visual POR MODO. REDESIGN 2026-07-21: Fernando pediu para deixar
// de existir um modo "escuro/premium" (estudante+clínico) diferente do resto —
// os 4 modos partilham agora a MESMA base neutra (clara, papel), diferindo só na
// cor de acento. A identidade de cada modo vem do conteúdo e dos módulos, não de
// mudar a paleta toda.
//
// Não reinventa a paleta base do Phlox — afina só a cor de acento.

import type { ExperienceMode } from '@/lib/experienceMode'

export interface ModeTheme {
  mode: ExperienceMode
  // cor de acento principal (chamadas à ação, destaques) — a única coisa que
  // muda de modo para modo
  accent: string
  accentSoft: string          // fundo suave do acento (chips, ícones)
  accentInk: string           // texto sobre accentSoft
  // fundo da página e das superfícies — igual em todos os modos
  pageBg: string
  surface: string             // cartões
  surfaceMuted: string        // cartões secundários / fundos calmos
  border: string
  // texto — igual em todos os modos
  ink: string                 // títulos
  inkSoft: string             // corpo
  inkFaint: string            // legendas
  // forma
  radius: number              // raio dos cartões
  radiusLg: number            // raio de heros / destaques
  // saudação — serif em todos os modos agora (ver ToolHeader.tsx)
  greetWarm: boolean
  // gradiente do foco principal (hero) — usa o acento do modo
  heroFrom: string
  heroTo: string
}

const NEUTRAL = {
  pageBg: '#fbfaf7', surface: '#ffffff', surfaceMuted: '#f5f3ee', border: '#ece8e0',
  ink: '#1a2b22', inkSoft: '#4f5a54', inkFaint: '#8a938d',
  radius: 18, radiusLg: 24, greetWarm: true,
} as const

const PERSONAL: ModeTheme = {
  mode: 'personal', ...NEUTRAL,
  accent: '#0d7a4d', accentSoft: '#e7f6ee', accentInk: '#0a5c3a',
  heroFrom: '#0d7a4d', heroTo: '#0e8a6f',
}

const CAREGIVER: ModeTheme = {
  mode: 'caregiver', ...NEUTRAL,
  accent: '#b9690e', accentSoft: '#fdf1de', accentInk: '#8a4e0a',
  heroFrom: '#bd6c10', heroTo: '#cf8a2a',
}

const STUDENT: ModeTheme = {
  mode: 'student', ...NEUTRAL,
  accent: '#7c3aed', accentSoft: '#f1ecfe', accentInk: '#5b21b6',
  heroFrom: '#7c3aed', heroTo: '#9d5cf0',
}

const CLINICAL: ModeTheme = {
  mode: 'clinical', ...NEUTRAL,
  accent: '#2563eb', accentSoft: '#e8f0fe', accentInk: '#1d4ed8',
  heroFrom: '#1d4ed8', heroTo: '#2563eb',
}

const THEMES: Record<ExperienceMode, ModeTheme> = {
  personal: PERSONAL,
  caregiver: CAREGIVER,
  student: STUDENT,
  clinical: CLINICAL,
}

export function modeTheme(mode: string | null | undefined): ModeTheme {
  return THEMES[(mode as ExperienceMode)] || PERSONAL
}
