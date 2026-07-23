// lib/clientError.ts
// ─────────────────────────────────────────────────────────────────────────────
// Nenhuma mensagem visível ao cliente pode conter detalhe técnico/de-dev (nomes
// de sprints, tabelas, buckets, env vars, "corre o X.sql"). O cliente vê algo
// calmo e genérico; o detalhe REAL vai para a consola com um código curto, para
// o dev diagnosticar. Ver memória: feedback-erros-nunca-tecnicos.
// ─────────────────────────────────────────────────────────────────────────────

/** Mensagens amigas, calmas e genéricas — seguras para qualquer cliente ver. */
export const MSG = {
  save: 'Não foi possível guardar agora. Verifica a ligação e tenta de novo.',
  load: 'Não foi possível carregar agora. Verifica a ligação e tenta de novo.',
  upload: 'Não foi possível guardar a foto agora. Tenta de novo.',
  unavailable: 'Esta parte ainda não está disponível nesta conta.',
  readonly: 'A tua conta é só de leitura — não podes fazer alterações.',
  generic: 'Algo não correu como esperado. Tenta de novo daqui a pouco.',
} as const

/**
 * Loga o detalhe técnico REAL na consola (para o dev diagnosticar), com um
 * código curto, e devolve a mensagem amiga para mostrar ao cliente. O cliente
 * nunca vê `technical`.
 *
 *   setErr(reportError('cockpit-attendance', error, MSG.save))
 */
export function reportError(code: string, technical: unknown, friendly: string = MSG.generic): string {
  try { console.error(`[phlox:${code}]`, technical) } catch { /* noop */ }
  return friendly
}

/**
 * Deteta se um erro do Supabase é "recurso ainda não existe" (setup pendente do
 * lado do dev: tabela/coluna/bucket) — para o cliente ver "ainda não disponível"
 * em vez de um erro assustador, e o dev perceber pelo log.
 */
export function isSetupError(err: any): boolean {
  const msg = String(err?.message || err || '')
  const code = String(err?.code || '')
  return code === '42P01' || code === '42703'
    || /does not exist|relation .* does not exist|column .* does not exist|bucket .* not found|could not find the table/i.test(msg)
}
