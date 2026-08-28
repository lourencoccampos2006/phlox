// lib/consent.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única do estado de CONSENTIMENTO de cookies (RGPD / ePrivacy).
//
// Categorias:
//   • essenciais — sempre (autenticação, segurança). Não precisam de consentimento.
//   • não-essenciais — SÓ com consentimento explícito do utilizador.
//
// NOTA (2026-08-28): a publicidade foi removida do produto inteiro, e com ela o
// único terceiro que punha cookies. A analítica que resta é PRÓPRIA — rota
// própria, base de dados própria, ligada ao utilizador autenticado por token —
// e não põe cookie nenhum.
//
// Ou seja: neste momento o site pode já não ter cookies não-essenciais
// nenhuns, e o banner de consentimento pode ser dispensável. Isso é uma
// decisão legal, não técnica, por isso este módulo fica de pé e o banner
// também. Se se confirmar, apagar os dois é uma simplificação real.
//
// Por defeito o estado é 'unset' → tratado como NEGADO até o utilizador decidir.
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
export function naoEssenciaisPermitidos(): boolean {
  return getConsent() === 'accepted'
}

/** Grava a escolha e avisa a app. */
export function setConsent(state: 'accepted' | 'declined'): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, state)
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }))
  } catch { /* modo privado — segue sem persistir */ }
}

// Hook React para componentes reagirem à mudança de consentimento.
import { useEffect, useState } from 'react'
export function useConsent(): { consent: ConsentState; permitido: boolean } {
  const [consent, setState] = useState<ConsentState>('unset')
  useEffect(() => {
    const refresh = () => setState(getConsent())
    refresh()
    window.addEventListener(CONSENT_EVENT, refresh)
    return () => window.removeEventListener(CONSENT_EVENT, refresh)
  }, [])
  return { consent, permitido: consent === 'accepted' }
}
