// lib/userScope.ts
// ISOLAMENTO de dados locais por conta. Vários dados nossos vivem em localStorage
// (guardados, atalhos fixos, progresso de estudo, perfil ativo, mais-usadas…).
// localStorage é POR BROWSER, não por conta — por isso, ao trocar de conta no
// mesmo dispositivo, os dados da conta anterior vazavam para a nova (bug do
// /guardados a mostrar perfis "Eu"/"Fernando" numa conta nova).
//
// Solução: guardamos o id da conta ativa; quando muda, limpamos as chaves
// específicas-de-conta. Privacidade entre contas no mesmo dispositivo.

const OWNER_KEY = 'phlox-local-owner'

// Chaves locais que pertencem a UMA conta (apagar ao trocar de conta).
// Inclui prefixos (qualquer chave que comece por estes também é apagada).
const PER_USER_EXACT = [
  'phlox-saves-v1',            // /guardados
  'phlox-pinned-tools',        // atalhos fixos
  'phlox-study-progress-v1',   // progresso de estudo
  'phlox-active-profile',      // perfil/doente ativo
  'phlox-tool-use-count',      // mais-usadas
  'phlox-ai-chats',            // histórico do chat IA
  'phlox-daily-brief',         // briefing do dia
  'phlox-preventivo-perfil',   // dados do /preventivo
  'phlox-copilot-context',     // contexto do copilot
]
const PER_USER_PREFIX = [
  'phlox-tools-',              // ferramentas ativas por modo/instituição
  'phlox-saved-',             // quaisquer resultados guardados antigos
  'phlox-history-',           // históricos por ferramenta
]

function clearPerUser() {
  if (typeof localStorage === 'undefined') return
  try {
    PER_USER_EXACT.forEach(k => localStorage.removeItem(k))
    Object.keys(localStorage).forEach(k => {
      if (PER_USER_PREFIX.some(p => k.startsWith(p))) localStorage.removeItem(k)
    })
  } catch { /* quota/no-op */ }
}

/**
 * Chamar quando uma conta carrega. Se o dono dos dados locais mudou (ou é a 1ª
 * vez), limpa os dados específicos-de-conta para não vazar entre contas.
 * Devolve true se limpou (útil para refrescar vistas).
 */
export function ensureUserScope(userId: string | null | undefined): boolean {
  if (typeof localStorage === 'undefined' || !userId) return false
  let prev: string | null = null
  try { prev = localStorage.getItem(OWNER_KEY) } catch {}
  if (prev === userId) return false
  clearPerUser()
  try { localStorage.setItem(OWNER_KEY, userId) } catch {}
  // avisa as vistas abertas para recarregarem (guardados, etc.)
  try {
    window.dispatchEvent(new CustomEvent('phlox-saves-changed'))
    window.dispatchEvent(new CustomEvent('phlox-study-changed'))
  } catch {}
  return true
}

/** Ao terminar sessão: limpa os dados de conta e o registo de dono. */
export function clearUserScopeOnSignOut() {
  clearPerUser()
  try { localStorage.removeItem(OWNER_KEY) } catch {}
}
