// lib/pinnedTools.ts
// Atalhos fixos do utilizador — escolhidos por ele em "Personalizar Pins".
// Diferente do MyTopTools (que aprende automaticamente do uso): aqui o utilizador
// decide explicitamente. Aparece no /inicio e no header.

const LS_KEY = 'phlox-pinned-tools'
const MAX = 6

// Lista das ferramentas que faz sentido fixar (com label amigável + ícone).
export const PINNABLE_TOOLS: { path: string; label: string; icon: string; group: string }[] = [
  // Pessoal
  { path: '/mymeds',            label: 'A minha medicação',     icon: 'pill', group: 'Pessoal' },
  { path: '/scan',              label: 'Perceber bula',          icon: 'note', group: 'Pessoal' },
  { path: '/sintomas',          label: 'Sintomas',               icon: 'droplet', group: 'Pessoal' },
  { path: '/passport',          label: 'Cartão emergência',      icon: 'alert', group: 'Pessoal' },
  { path: '/vitals',            label: 'Sinais vitais',          icon: '💓', group: 'Pessoal' },
  { path: '/health-import',     label: 'Importar Apple Health',  icon: 'inbox', group: 'Pessoal' },
  { path: '/guardados',         label: 'Guardados',              icon: '★',  group: 'Pessoal' },
  { path: '/calendario',        label: 'Calendário',             icon: 'calendar', group: 'Pessoal' },
  { path: '/vigia-ruturas',     label: 'Vigia de ruturas',        icon: 'package', group: 'Pessoal' },
  // Cuidador
  { path: '/familia',           label: 'Perfis de família',      icon: 'family', group: 'Cuidador' },
  // Estudante
  { path: '/arena',             label: 'Arena',                  icon: 'trophy', group: 'Estudante' },
  { path: '/osce',              label: 'OSCE',                   icon: 'stethoscope', group: 'Estudante' },
  { path: '/tutor',             label: 'AI Tutor',               icon: '🧑‍🏫', group: 'Estudante' },
  { path: '/anatomia-3d',       label: 'Atlas 3D',               icon: 'heart', group: 'Estudante' },
  { path: '/mnemonicas',        label: 'Mnemónicas visuais',     icon: 'spark', group: 'Estudante' },
  { path: '/modo-exame',        label: 'Modo Exame',             icon: 'clock', group: 'Estudante' },
  // Comum
  { path: '/ai',                label: 'Phlox AI',               icon: '✨', group: 'Geral' },
  { path: '/relatorio?tab=diario', label: 'Brief de hoje',       icon: 'clock', group: 'Geral' },
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
