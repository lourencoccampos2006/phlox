// ─── lib/profileContext.ts ───
// Gere o perfil activo no localStorage para pré-preencher ferramentas.

export interface ActiveProfile {
  id: string | 'self'
  name: string
  type: 'self' | 'family'
  // ─── campos opcionais para pré-preenchimento de ferramentas ───
  age?: number | null
  sex?: string | null
  weight?: number | null
  conditions?: string | null
  allergies?: string | null
}

const STORAGE_KEY = 'phlox-active-profile'

export function getActiveProfile(): ActiveProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveProfile) : null
  } catch { return null }
}

export function setActiveProfile(profile: ActiveProfile | null): void {
  if (typeof window === 'undefined') return
  if (profile === null) window.localStorage.removeItem(STORAGE_KEY)
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function clearActiveProfile(): void {
  setActiveProfile(null)
}