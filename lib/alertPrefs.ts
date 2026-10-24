// lib/alertPrefs.ts
// "Avisos personalizados" (pedido 2026-07-21) — que TIPOS de aviso de saúde
// aparecem em "A minha saúde" no /inicio. Mesmo padrão de lib/inicioModules.ts
// (localStorage, tudo ligado por defeito).

export type AlertCategory = 'stock' | 'adherence'

export interface AlertCategoryMeta { id: AlertCategory; label: string; hint: string }

export const ALERT_CATEGORIES: AlertCategoryMeta[] = [
  /* Saíram as categorias que julgavam: «sinais vitais» (uma tensão lida e
     classificada), «interações e regras clínicas» e «sintomas». Classificar a
     leitura de um doente é apoio à decisão — ver a Regra 11. Ficam as duas que
     contam coisas: comprimidos e tomas marcadas. */
  { id: 'stock', label: 'Stock de medicação', hint: 'Comprimidos a acabar' },
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
