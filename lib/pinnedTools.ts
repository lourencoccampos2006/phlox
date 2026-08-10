// lib/pinnedTools.ts
// Atalhos fixos do utilizador — escolhidos por ele em "Personalizar Pins".
// Diferente do MyTopTools (que aprende automaticamente do uso): aqui o utilizador
// decide explicitamente. Aparece no /inicio e no header.

const LS_KEY = 'phlox-pinned-tools'
const MAX = 6

// Lista das ferramentas que faz sentido fixar (com label amigável + ícone).
export const PINNABLE_TOOLS: { path: string; label: string; icon: string; group: string }[] = [
  // Pessoal
  { path: '/mymeds',            label: 'A minha medicação',     icon: '💊', group: 'Pessoal' },
  { path: '/interactions',      label: 'Verificar interações',  icon: '⚗',  group: 'Pessoal' },
  { path: '/scan',              label: 'Perceber bula',          icon: '📄', group: 'Pessoal' },
  { path: '/sintomas',          label: 'Sintomas',               icon: '🌡', group: 'Pessoal' },
  { path: '/passport',          label: 'Cartão emergência',      icon: '🆘', group: 'Pessoal' },
  { path: '/quickcheck',        label: 'Análise rápida meds',    icon: '⚡', group: 'Pessoal' },
  { path: '/vitals',            label: 'Sinais vitais',          icon: '💓', group: 'Pessoal' },
  { path: '/adherencia',        label: 'Adesão à medicação',     icon: '📈', group: 'Pessoal' },
  { path: '/health-import',     label: 'Importar Apple Health',  icon: '📥', group: 'Pessoal' },
  { path: '/guardados',         label: 'Guardados',              icon: '★',  group: 'Pessoal' },
  { path: '/calendario',        label: 'Calendário',             icon: '📅', group: 'Pessoal' },
  { path: '/plano-peso',        label: 'Plano de perda de peso', icon: '⚖️', group: 'Pessoal' },
  { path: '/rastreio-visual',   label: 'Rastreio visual',        icon: '🔬', group: 'Pessoal' },
  { path: '/vigia-ruturas',     label: 'Vigia de ruturas',        icon: '📦', group: 'Pessoal' },
  // Cuidador
  { path: '/familia',           label: 'Perfis de família',      icon: '👨‍👩‍👧', group: 'Cuidador' },
  // Estudante
  { path: '/arena',             label: 'Arena',                  icon: '🏆', group: 'Estudante' },
  { path: '/osce',              label: 'OSCE',                   icon: '🩺', group: 'Estudante' },
  { path: '/tutor',             label: 'AI Tutor',               icon: '🧑‍🏫', group: 'Estudante' },
  { path: '/simulador',         label: 'Casos clínicos',         icon: '📚', group: 'Estudante' },
  { path: '/anatomia-3d',       label: 'Atlas 3D',               icon: '🫀', group: 'Estudante' },
  { path: '/calculos',          label: 'Calculadoras',           icon: '∑',  group: 'Estudante' },
  { path: '/mnemonicas',        label: 'Mnemónicas visuais',     icon: '🧠', group: 'Estudante' },
  { path: '/modo-exame',        label: 'Modo Exame',             icon: '⏳', group: 'Estudante' },
  // Comum
  { path: '/ai',                label: 'Phlox AI',               icon: '✨', group: 'Geral' },
  { path: '/relatorio?tab=diario', label: 'Brief de hoje',       icon: '☀', group: 'Geral' },
  // 2026-08-09: o grupo "Clínico" (Cockpit/Doentes/Decision Engine/AI Copilot/
  // Atendimentos/POS) foi removido daqui — o modo clínico nem sequer usa este
  // sistema de pins (não tem o módulo "atalhos" em /inicio), por isso só
  // servia para vazar ferramentas institucionais para o pin-picker de contas
  // pessoais/cuidador via PinPickerGrid (que não filtra por modo).
]

export function getPins(): string[] {
  if (typeof localStorage === 'undefined') return []
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
export function setPins(paths: string[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(paths.slice(0, MAX))) } catch { /* noop */ }
}
export function togglePin(path: string): string[] {
  const current = getPins()
  const next = current.includes(path) ? current.filter(p => p !== path) : [...current, path].slice(0, MAX)
  setPins(next); return next
}
export const PIN_MAX = MAX
