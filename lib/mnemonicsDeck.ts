// lib/mnemonicsDeck.ts
// Camada fina do baralho pessoal de mnemónicas (/mnemonicas). Espelha o
// espírito do lib/studyProgress.ts: cache local para pintura instantânea +
// escrita na conta (Supabase), com degradação graciosa se a tabela ainda não
// existir. Ao contrário do studyProgress (stream de eventos), aqui cada item
// tem um id estável do servidor — por isso não precisa de merge por-evento,
// só de "ler cache → pedir ao servidor → substituir cache".

export interface DeckMnemonic {
  id: string
  concept: string
  area?: string | null
  technique?: string | null
  mnemonic: string
  scene?: string | null
  icon?: string | null
  breakdown?: { letter: string; stands_for: string; icon?: string }[] | null
  tip?: string | null
  alt?: string | null
  created_at?: string
}

const LS_KEY = 'phlox-mnemonics-deck-cache-v1'

export function getCachedDeck(): DeckMnemonic[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const r = localStorage.getItem(LS_KEY)
    const arr = r ? JSON.parse(r) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function setCachedDeck(items: DeckMnemonic[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 200))) } catch { /* quota */ }
}

type AuthHeaders = Record<string, string>

export async function fetchDeck(headers: AuthHeaders): Promise<{ items: DeckMnemonic[]; needsMigration: boolean }> {
  try {
    const res = await fetch('/api/mnemonicas/deck', { headers })
    const j = await res.json().catch(() => ({}))
    const items: DeckMnemonic[] = Array.isArray(j.items) ? j.items : []
    if (!j.needs_migration) setCachedDeck(items)
    return { items, needsMigration: !!j.needs_migration }
  } catch {
    return { items: getCachedDeck(), needsMigration: false }
  }
}

export async function saveMnemonicToDeck(headers: AuthHeaders, item: Omit<DeckMnemonic, 'id' | 'created_at'>): Promise<DeckMnemonic | null> {
  try {
    const res = await fetch('/api/mnemonicas/deck', { method: 'POST', headers, body: JSON.stringify(item) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.item) return null
    const next = [j.item, ...getCachedDeck()]
    setCachedDeck(next)
    return j.item
  } catch { return null }
}

export async function removeMnemonicFromDeck(headers: AuthHeaders, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mnemonicas/deck/${id}`, { method: 'DELETE', headers })
    if (!res.ok) return false
    setCachedDeck(getCachedDeck().filter(i => i.id !== id))
    return true
  } catch { return false }
}
