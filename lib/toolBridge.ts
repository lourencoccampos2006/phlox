// lib/toolBridge.ts
// ─────────────────────────────────────────────────────────────────────────────
// PONTE ENTRE FERRAMENTAS — o que torna o Phlox "interconectado".
// Uma ferramenta empacota dados e envia o utilizador para outra, que os recebe
// já preenchidos. Ex.: o Scan extrai medicamentos → manda-os para "Os meus
// medicamentos" prontos a guardar; uma análise → para o verificador de interações.
//
// Implementação: guarda o "pacote" em sessionStorage (sobrevive à navegação,
// limpa-se ao fechar o separador) e navega para a rota destino. A ferramenta
// destino lê o pacote uma vez (consome) ao montar.
//
// Uso — lado emissor:
//   import { sendToTool } from '@/lib/toolBridge'
//   sendToTool(router, '/mymeds', { kind: 'meds', meds: [...] }, 'Importado do Scan')
//
// Uso — lado recetor:
//   const handoff = useHandoff('meds')   // só devolve se o pacote for desse tipo
//   useEffect(() => { if (handoff) preencher(handoff.payload) }, [handoff])
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const KEY = 'phlox-handoff'

export interface Handoff<T = any> {
  kind: string          // 'meds' | 'drug' | 'labs' | 'symptom' | 'share' | ...
  payload: T            // dados estruturados
  note?: string         // origem legível: "Importado do Scan"
  from?: string         // rota de origem (para o "voltar")
  at: number
}

/** Empacota e navega. `router` é o do next/navigation (useRouter). */
export function sendToTool(
  router: { push: (href: string) => void },
  to: string,
  pkg: { kind: string; payload: any; note?: string; from?: string },
) {
  try {
    const h: Handoff = { ...pkg, at: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(h))
  } catch { /* sessionStorage indisponível — segue sem pré-preencher */ }
  router.push(to)
}

/** Lê (sem consumir) o pacote pendente, se for de um dos `kinds` aceites. */
export function peekHandoff(kinds?: string | string[]): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const h = JSON.parse(raw) as Handoff
    // expira pacotes com mais de 5 min (evita preencher com dados velhos)
    if (Date.now() - h.at > 5 * 60_000) { sessionStorage.removeItem(KEY); return null }
    if (kinds) {
      const list = Array.isArray(kinds) ? kinds : [kinds]
      if (!list.includes(h.kind)) return null
    }
    return h
  } catch { return null }
}

/** Consome (lê e apaga) o pacote pendente. */
export function consumeHandoff(kinds?: string | string[]): Handoff | null {
  const h = peekHandoff(kinds)
  if (h) { try { sessionStorage.removeItem(KEY) } catch {} }
  return h
}

/**
 * Hook recetor: ao montar, consome o pacote se for de um dos `kinds`.
 * Devolve-o uma vez (e depois null). A ferramenta usa-o para pré-preencher.
 */
export function useHandoff(kinds?: string | string[]): Handoff | null {
  const [h, setH] = useState<Handoff | null>(null)
  useEffect(() => { setH(consumeHandoff(kinds)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return h
}
