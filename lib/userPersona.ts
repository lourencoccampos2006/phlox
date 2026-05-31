// lib/userPersona.ts
// Fonte ÚNICA da persona do utilizador: o que ele é + o que precisa de ver
// primeiro. Usado pelo /inicio, quick switcher, sugestões inteligentes.
// Mantém o site simples: cada persona vê o que faz sentido, nada mais.

export type ExperienceMode = 'personal' | 'caregiver' | 'student' | 'clinical'
export type InstitutionType = 'pharmacy_community' | 'pharmacy_hospital' | 'nursing_home' | 'clinic' | 'health_center' | 'hospital' | null

export interface PersonaHero {
  title: string
  subtitle: string
  cta_label: string
  cta_href: string
  accent: string                  // cor de destaque
}

export interface PersonaTopTool { label: string; href: string; icon: string; desc?: string }

export interface PersonaConfig {
  mode: ExperienceMode
  label: string                   // "Pessoal", "Cuidador", "Estudante", "Clínico"
  emoji: string                   // ícone curto
  color: string
  hero: PersonaHero
  starters: PersonaTopTool[]      // primeiras coisas a fazer / explorar
  daily: PersonaTopTool[]         // ferramentas usadas diariamente
  hint: string                    // 1 linha de contexto
}

// ── Personas ──────────────────────────────────────────────────────────────────
const PERSONAS: Record<ExperienceMode, PersonaConfig> = {
  personal: {
    mode: 'personal', label: 'Pessoal', emoji: '👤', color: '#0d9488',
    hint: 'Cuidar de mim e da minha saúde.',
    hero: {
      title: 'A minha saúde, sob controlo',
      subtitle: 'A tua lista de medicação, lembretes e verificação de interações — feito para o teu dia-a-dia.',
      cta_label: 'Ver a minha medicação', cta_href: '/mymeds', accent: '#0d9488',
    },
    starters: [
      { label: 'Adicionar medicação', href: '/mymeds', icon: '💊', desc: 'A base de tudo' },
      { label: 'Cartão de emergência', href: '/cartao-emergencia', icon: '🆘', desc: 'Para qualquer médico ver em segundos' },
      { label: 'Preparar consulta', href: '/preparar-consulta', icon: '📋', desc: 'Levar tudo organizado' },
    ],
    daily: [
      { label: 'Sintomas de hoje', href: '/sintomas', icon: '🌡' },
      { label: 'Verificar interações', href: '/interactions', icon: '⚗' },
      { label: 'Perceber bula', href: '/bula', icon: '📄' },
      { label: 'Hidratação', href: '/agua', icon: '💧' },
      { label: 'Peso', href: '/pesar', icon: '⚖' },
      { label: 'Phlox AI', href: '/ai', icon: '✨' },
    ],
  },
  caregiver: {
    mode: 'caregiver', label: 'Cuidador', emoji: '🤝', color: '#b45309',
    hint: 'Cuidar da família ou de quem precisa.',
    hero: {
      title: 'Os perfis de quem cuidas',
      subtitle: 'Acompanha a medicação, sintomas e saúde de cada pessoa, num só sítio.',
      cta_label: 'Abrir família', cta_href: '/familia', accent: '#b45309',
    },
    starters: [
      { label: 'Adicionar perfil familiar', href: '/familia', icon: '👨‍👩‍👧', desc: 'Criar um perfil por pessoa' },
      { label: 'Verificar interações', href: '/interactions', icon: '⚗', desc: 'Cruzar toda a medicação' },
      { label: 'Cartão de emergência', href: '/cartao-emergencia', icon: '🆘', desc: 'Cada pessoa pode ter o seu' },
    ],
    daily: [
      { label: 'Sintomas / diário', href: '/sintomas', icon: '🌡' },
      { label: 'Preparar consulta', href: '/preparar-consulta', icon: '📋' },
      { label: 'Perceber bula', href: '/bula', icon: '📄' },
      { label: 'Phlox AI', href: '/ai', icon: '✨' },
    ],
  },
  student: {
    mode: 'student', label: 'Estudante', emoji: '🎓', color: '#7c3aed',
    hint: 'Estudar farmacologia / clínica com casos reais.',
    hero: {
      title: 'Treina, joga, aprende',
      subtitle: 'Arena de ligas, OSCE simulado, AI Tutor socrático. Estuda o que conta.',
      cta_label: 'Entrar na Arena', cta_href: '/arena', accent: '#7c3aed',
    },
    starters: [
      { label: 'Arena de ligas', href: '/arena', icon: '🏆', desc: 'Sobe de Bronze a Diamante' },
      { label: 'OSCE simulado', href: '/exam', icon: '🩺', desc: 'Cenário com AI como doente' },
      { label: 'AI Tutor', href: '/tutor', icon: '🧑‍🏫', desc: 'Socrático, força raciocínio' },
    ],
    daily: [
      { label: 'Casos clínicos', href: '/cases', icon: '📚' },
      { label: 'Phlox Hive', href: '/hive', icon: '🐝' },
      { label: 'Calculadoras', href: '/calc', icon: '∑' },
      { label: 'Phlox AI', href: '/ai', icon: '✨' },
    ],
  },
  clinical: {
    mode: 'clinical', label: 'Clínico', emoji: '🩺', color: '#1d4ed8',
    hint: 'Trabalho clínico diário na minha instituição.',
    hero: {
      title: 'O teu cockpit, ao vivo',
      subtitle: 'Doentes, ronda, MAR, ocorrências e indicadores — adaptado ao teu tipo de instituição.',
      cta_label: 'Abrir cockpit', cta_href: '/cockpit', accent: '#1d4ed8',
    },
    starters: [
      { label: 'Cockpit institucional', href: '/cockpit', icon: '📊' },
      { label: 'AI Copilot (Pro)', href: '/copiloto', icon: '✨', desc: 'Ancorado no Decision Engine' },
      { label: 'Trust Center', href: '/trust', icon: '🛡' },
    ],
    daily: [
      { label: 'Doentes / utentes', href: '/patients', icon: '👥' },
      { label: 'Decision Engine', href: '/motor-clinico', icon: '🧠' },
      { label: 'Calculadoras', href: '/calc', icon: '∑' },
      { label: 'Phlox AI', href: '/ai', icon: '✨' },
    ],
  },
}

export function personaFor(mode: string | null | undefined): PersonaConfig {
  return PERSONAS[(mode as ExperienceMode) || 'personal'] || PERSONAS.personal
}

export const ALL_PERSONAS = Object.values(PERSONAS)

// ── Localmente: ferramentas mais usadas (heurística simples por localStorage) ──
const LS_KEY = 'phlox-tool-use-count'

export function trackToolUse(path: string) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    map[path] = (map[path] || 0) + 1
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch { /* silent */ }
}

export function getTopTools(max: number = 5): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return []
    const map: Record<string, number> = JSON.parse(raw)
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, max).map(([p]) => p)
  } catch { return [] }
}
