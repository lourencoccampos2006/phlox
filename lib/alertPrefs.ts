// lib/alertPrefs.ts
// "Avisos personalizados" (pedido 2026-07-21) — que TIPOS de aviso de saúde
// aparecem em "A minha saúde" no /inicio. Mesmo padrão de lib/inicioModules.ts
// (localStorage, tudo ligado por defeito).

import type { AlertCategory } from '@/lib/healthAlerts'

export interface AlertCategoryMeta { id: AlertCategory; label: string; hint: string }

export const ALERT_CATEGORIES: AlertCategoryMeta[] = [
  { id: 'vitals', label: 'Sinais vitais', hint: 'Tensão, oxigenação, glicemia, frequência cardíaca, peso' },
  { id: 'interactions', label: 'Interações e regras clínicas', hint: 'Combinações a evitar, ajustes por idade ou função renal' },
  { id: 'stock', label: 'Stock de medicação', hint: 'Comprimidos a acabar' },
  { id: 'symptoms', label: 'Sintomas', hint: 'Febre ou dor repetidas' },
  { id: 'adherence', label: 'Adesão à medicação', hint: 'Quando as tomas começam a falhar' },
]

const DEFAULT_ON: AlertCategory[] = ALERT_CATEGORIES.map(c => c.id)
const KEY = 'phlox-alert-prefs'

export function getAlertPrefs(): AlertCategory[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ON
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : DEFAULT_ON
  } catch { return DEFAULT_ON }
}

export function setAlertPrefs(ids: AlertCategory[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* noop */ }
}

export function toggleAlertCategory(id: AlertCategory): AlertCategory[] {
  const cur = getAlertPrefs()
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  setAlertPrefs(next)
  return next
}
