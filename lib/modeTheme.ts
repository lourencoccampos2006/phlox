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
  pageBg: 'var(--bg-2)', surface: 'var(--bg)', surfaceMuted: 'var(--amber-light)', border: 'var(--amber-light)',
  ink: 'var(--green-3)', inkSoft: 'var(--ink-3)', inkFaint: 'var(--ink-4)',
  radius: 18, radiusLg: 24, greetWarm: true,
} as const

const PERSONAL: ModeTheme = {
  mode: 'personal', ...NEUTRAL,
  accent: 'var(--green-3)', accentSoft: 'var(--green-light)', accentInk: 'var(--green-3)',
  heroFrom: 'var(--green-3)', heroTo: 'var(--green-3)',
}

const CAREGIVER: ModeTheme = {
  mode: 'caregiver', ...NEUTRAL,
  accent: 'var(--amber)', accentSoft: 'var(--amber-light)', accentInk: 'var(--badge-amber-fg)',
  heroFrom: 'var(--amber)', heroTo: 'var(--amber)',
}

const STUDENT: ModeTheme = {
  mode: 'student', ...NEUTRAL,
  accent: 'var(--roxo)', accentSoft: 'var(--roxo-claro)', accentInk: 'var(--roxo-escuro)',
  heroFrom: 'var(--roxo)', heroTo: 'var(--roxo)',
}

const CLINICAL: ModeTheme = {
  mode: 'clinical', ...NEUTRAL,
  /* ── O VERDE DA CASA, E NÃO AZUL (2026-10-14) ─────────────────────────
     O azul vinha de quando o modo clínico servia clínicas e hospitais. Hoje
     serve lares e centros de dia, e toda a interface institucional — a barra
     lateral, os botões, os separadores — usa o verde da marca. O azul só
     aparecia onde este tema fosse lido, e a barra de navegação de baixo
     passou a lê-lo: a aba ativa saía azul no meio de um ecrã verde. */
  accent: 'var(--green)', accentSoft: 'var(--green-light)', accentInk: 'var(--green)',
  heroFrom: 'var(--green)', heroTo: 'var(--green)',
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
