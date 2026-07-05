// ─── lib/profileContext.ts ───
// Gere o perfil activo no localStorage para pré-preencher ferramentas.

export interface ActiveProfile {
  id: string | 'self'
  name: string
  // 'self' = o próprio · 'family' = familiar (perfil pessoal) · 'patient' = doente/utente
  // da instituição (tabela patients; só Pro/Institucional).
  type: 'self' | 'family' | 'patient'
  // ─── campos opcionais para pré-preenchimento de ferramentas ───
  age?: number | null
  sex?: string | null
  weight?: number | null
  conditions?: string | null
  allergies?: string | null
  // ─── SEGURANÇA (Ronda 12) ───
  // Dono do perfil ativo. O perfil ativo vive em localStorage e é GLOBAL; sem
  // isto, ao trocar de conta na mesma máquina o utilizador via o perfil da conta
  // anterior (bug reportado: cuidador viu um doente "Rosa" que nunca criou).
  ownerId?: string | null
}

const STORAGE_KEY = 'phlox-active-profile'

// getActiveProfile(currentUserId): só devolve o perfil se pertencer ao utilizador
// atual. Sem currentUserId, mantém-se compatível (devolve o guardado) — mas os
// chamadores em contexto autenticado DEVEM passar o user.id.
export function getActiveProfile(currentUserId?: string | null): ActiveProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ActiveProfile
    // Se sabemos quem está logado e o perfil tem dono diferente → não é desta conta.
    if (currentUserId && p.ownerId && p.ownerId !== currentUserId) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return p
  } catch { return null }
}

export function setActiveProfile(profile: (ActiveProfile & { ownerId?: string | null }) | null): void {
  if (typeof window === 'undefined') return
  if (profile === null) window.localStorage.removeItem(STORAGE_KEY)
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function clearActiveProfile(): void {
  setActiveProfile(null)
}