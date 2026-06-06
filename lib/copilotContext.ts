// lib/copilotContext.ts
// Registo GLOBAL de contexto para o Phlox Copilot. Qualquer página/ferramenta
// publica aqui o que o utilizador está a ver/fez (pesquisa, item aberto, dados).
// O Copilot lê este contexto para responder com conhecimento REAL — não só a rota.
//
// Uso numa página:
//   import { usePhloxContext } from '@/lib/copilotContext'
//   usePhloxContext('Medicamento pesquisado', { nome: 'Guronsan', resultado: ... })
//
// Sem dependências externas: um simples store + evento.

import { useEffect } from 'react'

export interface CopilotCtx {
  label: string                 // descrição curta: "Medicamento aberto", "ECG em análise"
  data: Record<string, any>     // dados estruturados relevantes (serializados de forma compacta)
  updatedAt: number
}

let current: CopilotCtx | null = null
const listeners = new Set<() => void>()

export function setPhloxContext(label: string, data: Record<string, any>) {
  current = { label, data: data || {}, updatedAt: Date.now() }
  listeners.forEach(l => l())
}
export function clearPhloxContext() {
  current = null
  listeners.forEach(l => l())
}
export function getPhloxContext(): CopilotCtx | null {
  // expira contexto com mais de 10 min (evita usar dados velhos)
  if (current && Date.now() - current.updatedAt > 10 * 60_000) return null
  return current
}
export function subscribePhloxContext(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Hook: publica contexto enquanto o componente está montado; limpa ao sair.
export function usePhloxContext(label: string, data: Record<string, any> | null | undefined) {
  useEffect(() => {
    if (!label || !data) return
    setPhloxContext(label, data)
    // não limpamos no unmount imediato — deixamos o próximo contexto sobrepor-se,
    // para a transição entre páginas não apagar contexto útil cedo demais.
  }, [label, JSON.stringify(data)]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Serializa o contexto para enviar à IA (compacto, máx ~1500 chars)
export function serializeContext(c: CopilotCtx | null): string {
  if (!c) return ''
  try {
    const json = JSON.stringify(c.data)
    return `${c.label}: ${json.length > 1500 ? json.slice(0, 1500) + '…' : json}`
  } catch { return c.label }
}
