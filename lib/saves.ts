// lib/saves.ts
// Sistema UNIVERSAL de guardar qualquer coisa que o utilizador produz no Phlox.
// Mnemónicas, explicações, análises de medicação, briefings, calculadoras,
// modelos 3D, consultas preparadas — tudo entra aqui e fica visível em /guardados.
//
// Armazenamento em localStorage (privacidade total, zero rede). Tudo num único
// índice central com tipos discriminados; cada ferramenta sabe o seu kind.

export type SavedKind =
  | 'mnemonic'             // /mnemonicas
  | 'explanation'          // /explica
  | 'med_check'            // /quickcheck
  | 'consult_prep'         // /preparar-consulta
  | 'triage'               // /triagem
  | 'anatomy_model'        // /anatomia-3d
  | 'calc_result'          // /calc, /calculos
  | 'briefing'             // /briefing
  | 'note'                 // notas livres do utilizador
  | 'other'

export interface SavedItem<T = any> {
  id: string                  // ULID-like
  kind: SavedKind
  title: string               // visível na lista
  preview?: string            // sub-texto curto (ex: primeira linha do conteúdo)
  data: T                     // payload original da ferramenta
  href?: string               // de onde veio (rota onde foi criado)
  tags?: string[]
  createdAt: string           // ISO
  pinned?: boolean
}

const LS_KEY = 'phlox-saves-v1'
const MAX_ITEMS = 500

function safeRead(): SavedItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const r = localStorage.getItem(LS_KEY)
    if (!r) return []
    const arr = JSON.parse(r)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function safeWrite(items: SavedItem[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS))) } catch { /* quota */ }
}

function genId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${t}${r}`
}

export const SAVES_EVENT = 'phlox-saves-changed'
function broadcast() { try { window.dispatchEvent(new CustomEvent(SAVES_EVENT)) } catch { /* noop */ } }

// ─── API pública ──────────────────────────────────────────────────────────────

export function getAllSaves(): SavedItem[] { return safeRead() }
export function getSavesByKind(kind: SavedKind): SavedItem[] { return safeRead().filter(s => s.kind === kind) }

export function findSave(predicate: (s: SavedItem) => boolean): SavedItem | undefined {
  return safeRead().find(predicate)
}

export interface NewSave<T> {
  kind: SavedKind
  title: string
  preview?: string
  data: T
  href?: string
  tags?: string[]
}

export function save<T>(input: NewSave<T>): SavedItem<T> {
  const list = safeRead()
  // Evita duplicar exatamente o mesmo title+kind nos últimos 30 itens
  const dup = list.slice(0, 30).find(x => x.kind === input.kind && x.title === input.title)
  if (dup) {
    dup.createdAt = new Date().toISOString()
    dup.data = input.data
    dup.preview = input.preview ?? dup.preview
    safeWrite([dup, ...list.filter(x => x.id !== dup.id)])
    broadcast()
    return dup as SavedItem<T>
  }
  const item: SavedItem<T> = {
    id: genId(),
    kind: input.kind,
    title: input.title.slice(0, 200),
    preview: input.preview?.slice(0, 280),
    data: input.data,
    href: input.href,
    tags: input.tags,
    createdAt: new Date().toISOString(),
  }
  safeWrite([item, ...list])
  broadcast()
  return item
}

export function remove(id: string): void {
  safeWrite(safeRead().filter(s => s.id !== id))
  broadcast()
}

export function togglePin(id: string): void {
  const list = safeRead()
  const i = list.findIndex(s => s.id === id)
  if (i === -1) return
  list[i] = { ...list[i], pinned: !list[i].pinned }
  safeWrite(list)
  broadcast()
}

export function clearAll(): void { safeWrite([]); broadcast() }

// ─── Reabrir guardados na ferramenta original ─────────────────────────────────
// Em /guardados, o utilizador clica num item. Em vez de abrir a ferramenta
// vazia, fazemos com que ela receba o `data` do save via query-param + uma
// chamada `consumeReopen()` no cliente que devolve o payload e o limpa.

export function getSave(id: string): SavedItem | undefined {
  return safeRead().find(s => s.id === id)
}

/**
 * Lê `?reopen=<saveId>` da URL atual e devolve o data correspondente, depois
 * limpa o param do URL (sem reload) para não duplicar em refresh.
 * Devolve null se não houver nada ou se já foi consumido.
 */
export function consumeReopen<T = any>(): T | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const id = url.searchParams.get('reopen')
  if (!id) return null
  const item = getSave(id)
  // Remove o param para evitar reaplicar em navegações subsequentes
  url.searchParams.delete('reopen')
  window.history.replaceState({}, '', url.toString())
  return (item?.data as T) ?? null
}

// ─── Metadados visuais por kind ───────────────────────────────────────────────

export const KIND_META: Record<SavedKind, { label: string; icon: string; color: string }> = {
  mnemonic:      { label: 'Mnemónica',          icon: '🧠', color: '#7c3aed' },
  explanation:   { label: 'Explicação',         icon: '✨', color: '#0891b2' },
  med_check:     { label: 'Análise de meds',    icon: '⚗', color: '#0d6e42' },
  consult_prep:  { label: 'Preparação consulta',icon: '📋', color: '#1d4ed8' },
  triage:        { label: 'Triagem',            icon: '🏥', color: '#dc2626' },
  anatomy_model: { label: 'Modelo 3D',          icon: '🫀', color: '#7c3aed' },
  calc_result:   { label: 'Cálculo',            icon: '∑',  color: '#0b1120' },
  briefing:      { label: 'Briefing clínico',   icon: '📊', color: '#b45309' },
  note:          { label: 'Nota',               icon: '✎',  color: '#475569' },
  other:         { label: 'Outro',              icon: '📌', color: '#64748b' },
}
