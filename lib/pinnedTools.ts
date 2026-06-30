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
  { path: '/preparar-consulta', label: 'Preparar consulta',      icon: '📋', group: 'Pessoal' },
  { path: '/cartao-emergencia', label: 'Cartão emergência',      icon: '🆘', group: 'Pessoal' },
  { path: '/triagem',           label: 'Devo ir ao médico?',     icon: '🏥', group: 'Pessoal' },
  { path: '/quickcheck',        label: 'Análise rápida meds',    icon: '⚡', group: 'Pessoal' },
  { path: '/agua',              label: 'Hidratação',             icon: '💧', group: 'Pessoal' },
  { path: '/pesar',             label: 'Peso',                   icon: '⚖',  group: 'Pessoal' },
  { path: '/health-import',     label: 'Importar Apple Health',  icon: '📥', group: 'Pessoal' },
  { path: '/guardados',         label: 'Guardados',              icon: '★',  group: 'Pessoal' },
  { path: '/calendario',        label: 'Calendário',             icon: '📅', group: 'Pessoal' },
  // Cuidador
  { path: '/familia',           label: 'Perfis de família',      icon: '👨‍👩‍👧', group: 'Cuidador' },
  // Estudante
  { path: '/arena',             label: 'Arena',                  icon: '🏆', group: 'Estudante' },
  { path: '/exam',              label: 'OSCE',                   icon: '🩺', group: 'Estudante' },
  { path: '/tutor',             label: 'AI Tutor',               icon: '🧑‍🏫', group: 'Estudante' },
  { path: '/simulador',         label: 'Casos clínicos',         icon: '📚', group: 'Estudante' },
  { path: '/hive',              label: 'Hive',                   icon: '🐝', group: 'Estudante' },
  { path: '/mnemonicas',        label: 'Mnemónicas',             icon: '🧠', group: 'Estudante' },
  { path: '/explica',           label: 'Explica-me',             icon: '✨', group: 'Estudante' },
  { path: '/anatomia-3d',       label: 'Atlas 3D',               icon: '🫀', group: 'Estudante' },
  { path: '/calculos',          label: 'Calculadoras',           icon: '∑',  group: 'Estudante' },
  // Comum
  { path: '/ai',                label: 'Phlox AI',               icon: '✨', group: 'Geral' },
  { path: '/brief',             label: 'Brief de hoje',          icon: '☀', group: 'Geral' },
  // Clínico
  { path: '/cockpit',           label: 'Cockpit',                icon: '📊', group: 'Clínico' },
  { path: '/patients',          label: 'Doentes',                icon: '👥', group: 'Clínico' },
  { path: '/motor-clinico',     label: 'Decision Engine',        icon: '🧠', group: 'Clínico' },
  { path: '/copiloto',          label: 'AI Copilot',             icon: '🤖', group: 'Clínico' },
  { path: '/atendimentos',      label: 'Atendimentos',           icon: '📝', group: 'Clínico' },
  { path: '/vendas',            label: 'POS',                    icon: '🧾', group: 'Clínico' },
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
