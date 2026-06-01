// lib/userPrefs.ts
// Preferências de utilizador guardadas em localStorage. Sem PII, sem rede.
//
// Atualmente:
//   • hiddenTools — hrefs de ferramentas que o utilizador NÃO quer ver no nav
//   • pinnedTools — atalhos extra (compatibilidade com lib/pinnedTools)

const LS_KEY = 'phlox-prefs-v1'

interface Prefs {
  hiddenTools: string[]
}

function read(): Prefs {
  if (typeof window === 'undefined') return { hiddenTools: [] }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { hiddenTools: [] }
    const p = JSON.parse(raw)
    return { hiddenTools: Array.isArray(p?.hiddenTools) ? p.hiddenTools : [] }
  } catch { return { hiddenTools: [] } }
}

function write(p: Prefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(p))
  window.dispatchEvent(new CustomEvent('phlox-prefs-changed'))
}

export const PREFS_EVENT = 'phlox-prefs-changed'

export function getHiddenTools(): string[] { return read().hiddenTools }
export function isHidden(href: string): boolean { return read().hiddenTools.includes(href) }
export function setHidden(href: string, hidden: boolean) {
  const p = read()
  if (hidden && !p.hiddenTools.includes(href)) p.hiddenTools.push(href)
  if (!hidden) p.hiddenTools = p.hiddenTools.filter(h => h !== href)
  write(p)
}
export function resetHidden() { write({ hiddenTools: [] }) }
