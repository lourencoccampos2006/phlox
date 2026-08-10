// lib/homeWidgets.ts
// Catálogo dos WIDGETS de /inicio (pessoal + cuidador) — 2026-08-09.
// Substitui, para estes dois modos, o antigo sistema de "pins" genérico
// (lib/pinnedTools.ts): o Fernando pediu widgets a sério — cada um mostra
// estado vivo e, nalguns, uma ação direta — não uma grelha de botões
// maiores a apontar para uma ferramenta. A ORDEM é fixa por desenho (não
// arrastável): o utilizador só liga/desliga, para a disposição nunca ficar
// confusa. Ver components/inicio/HomeWidgets.tsx para os componentes.

export type PersonalWidgetId = 'symptoms' | 'vitals' | 'interactions' | 'adherence' | 'scan' | 'ai' | 'reach'
export type CaregiverWidgetId = 'familyNews' | 'scan' | 'interactions' | 'ai' | 'reach'
export type HomeWidgetId = PersonalWidgetId | CaregiverWidgetId

export interface WidgetMeta { id: HomeWidgetId; label: string; hint: string }

// Ordem = a disposição desenhada. O 1º de cada lista é o widget "herói"
// (largura cheia, com ação direta); os restantes são os cartões pequenos.
export const WIDGETS_BY_MODE: Record<string, WidgetMeta[]> = {
  personal: [
    { id: 'symptoms', label: 'Como se sente', hint: 'Registo de 1 toque, sem abrir nada' },
    { id: 'vitals', label: 'Sinais vitais', hint: 'A última leitura' },
    { id: 'interactions', label: 'Interações', hint: 'Os medicamentos ativos' },
    { id: 'adherence', label: 'Adesão', hint: 'Percentagem dos últimos 7 dias' },
    { id: 'scan', label: 'Nova receita', hint: 'Foto à receita ou caixa' },
    { id: 'ai', label: 'Phlox AI', hint: 'Tirar uma dúvida' },
    { id: 'reach', label: 'Convidar amigos', hint: 'Ganhe 1 mês de Pro por cada amigo' },
  ],
  caregiver: [
    { id: 'familyNews', label: 'Novidades da família', hint: 'Mensagens do lar/centro de dia' },
    { id: 'scan', label: 'Nova receita', hint: 'Foto à receita de alguém' },
    { id: 'interactions', label: 'Interações', hint: 'Verificar a medicação de alguém' },
    { id: 'ai', label: 'Phlox AI', hint: 'Tirar uma dúvida' },
    { id: 'reach', label: 'Convidar amigos', hint: 'Ganhe 1 mês de Pro por cada amigo' },
  ],
}

const DEFAULT_ON: Record<string, HomeWidgetId[]> = {
  personal: ['symptoms', 'vitals', 'interactions', 'adherence', 'scan', 'ai', 'reach'],
  caregiver: ['familyNews', 'scan', 'interactions', 'ai', 'reach'],
}

function key(mode: string) { return `phlox-inicio-widgets-${mode}` }

export function getWidgetPrefs(mode: string): HomeWidgetId[] {
  const fallback = DEFAULT_ON[mode] || []
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key(mode))
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export function setWidgetPrefs(mode: string, ids: HomeWidgetId[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(key(mode), JSON.stringify(ids)) } catch { /* noop */ }
}

export function toggleWidget(mode: string, id: HomeWidgetId): HomeWidgetId[] {
  const cur = getWidgetPrefs(mode)
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  setWidgetPrefs(mode, next)
  return next
}

// Devolve os widgets ativos do modo, na ordem desenhada (nunca na ordem em
// que o utilizador os ligou) — é o que garante a disposição cuidada.
export function activeWidgets(mode: string): WidgetMeta[] {
  const catalog = WIDGETS_BY_MODE[mode] || []
  const on = new Set(getWidgetPrefs(mode))
  return catalog.filter(w => on.has(w.id))
}
