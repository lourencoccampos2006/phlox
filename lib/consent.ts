// lib/consent.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única do estado de CONSENTIMENTO de cookies (RGPD / ePrivacy).
//
// Categorias:
//   • essenciais — sempre (autenticação, segurança). Não precisam de consentimento.
//   • publicidade/analytics — SÓ com consentimento explícito do utilizador.
//
// O AdSense (e qualquer cookie não-essencial) só pode carregar quando o estado for
// 'accepted'. Por defeito é 'unset' → tratado como NEGADO até o utilizador decidir.
// Retirar o consentimento é tão fácil como dá-lo (mudar em /cookies).
// ─────────────────────────────────────────────────────────────────────────────

export type ConsentState = 'accepted' | 'declined' | 'unset'

const KEY = 'phlox-cookie-consent'
export const CONSENT_EVENT = 'phlox-consent-changed'

/** Lê o estado atual. 'unset' = ainda não decidiu (= negado por defeito). */
export function getConsent(): ConsentState {
  if (typeof localStorage === 'undefined') return 'unset'
  try {
    const v = localStorage.getItem(KEY)
    return v === 'accepted' || v === 'declined' ? v : 'unset'
  } catch { return 'unset' }
}

/** true só quando o utilizador aceitou explicitamente cookies não-essenciais. */
export function adsAllowed(): boolean {
  return getConsent() === 'accepted'
}

/** Grava a escolha e avisa a app (o AdScript reage a este evento). */
export function setConsent(state: 'accepted' | 'declined'): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, state)
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }))
  } catch { /* modo privado — segue sem persistir */ }
}

// Hook React para componentes reagirem à mudança de consentimento.
import { useEffect, useState } from 'react'
export function useConsent(): { consent: ConsentState; ads: boolean } {
  const [consent, setState] = useState<ConsentState>('unset')
  useEffect(() => {
    const refresh = () => setState(getConsent())
    refresh()
    window.addEventListener(CONSENT_EVENT, refresh)
    return () => window.removeEventListener(CONSENT_EVENT, refresh)
  }, [])
  return { consent, ads: consent === 'accepted' }
}
