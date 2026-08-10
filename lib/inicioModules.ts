// lib/inicioModules.ts
// REBUILD 2026-07-21 — /inicio deixou de ser uma pilha fixa de secções e
// passou a um sistema de MÓDULOS: cada modo tem os módulos que fazem sentido
// para si (experiências diferentes, não o mesmo molde recolorido), e o
// utilizador liga/desliga os que quer em /settings — "super customizável",
// como pedido. "Explorar" e o destaque do momento fica sempre ligado (é a
// navegação base do site); o resto é opcional.

export type ModuleId = 'today' | 'health' | 'roster' | 'progress' | 'shortcuts'

export interface ModuleMeta { id: ModuleId; label: string; hint: string }

export const MODULES_BY_MODE: Record<string, ModuleMeta[]> = {
  personal: [
    { id: 'today', label: 'O meu dia', hint: 'A medicação de hoje, hora a hora' },
    { id: 'health', label: 'A minha saúde', hint: 'Índice de risco e tendências recentes' },
    { id: 'shortcuts', label: 'Widgets', hint: 'O estado de cada coisa, num relance' },
  ],
  caregiver: [
    { id: 'roster', label: 'As pessoas de quem cuido', hint: 'O estado de cada pessoa, num relance' },
    { id: 'health', label: 'A minha própria saúde', hint: 'Índice de risco e tendências recentes' },
    { id: 'shortcuts', label: 'Widgets', hint: 'O estado de cada coisa, num relance' },
  ],
  student: [
    { id: 'progress', label: 'O meu progresso', hint: 'Sequência, XP e onde focar hoje' },
    { id: 'shortcuts', label: 'Atalhos', hint: 'As ferramentas que escolheres fixar' },
  ],
}

const DEFAULT_ON: ModuleId[] = ['today', 'health', 'roster', 'progress', 'shortcuts']

function key(mode: string) { return `phlox-inicio-modules-${mode}` }

export function getModulePrefs(mode: string): ModuleId[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ON
  try {
    const raw = localStorage.getItem(key(mode))
    return raw ? JSON.parse(raw) : DEFAULT_ON
  } catch { return DEFAULT_ON }
}

export function setModulePrefs(mode: string, ids: ModuleId[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(key(mode), JSON.stringify(ids)) } catch { /* noop */ }
}

export function toggleModule(mode: string, id: ModuleId): ModuleId[] {
  const cur = getModulePrefs(mode)
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  setModulePrefs(mode, next)
  return next
}
