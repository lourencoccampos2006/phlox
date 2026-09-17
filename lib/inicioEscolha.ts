// lib/inicioEscolha.ts
// ─────────────────────────────────────────────────────────────────────────────
// Que ferramentas aparecem no /inicio de cada pessoa.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// O /inicio novo ficou com uma ação e quatro linhas — simples, e foi o que se
// pediu. Mas quatro é o que cabe bem, não o que cada pessoa precisa: quem usa
// o Phlox para acompanhar a tensão quer os vitais ali; quem cuida da mãe quer
// o perfil dela. O catálogo tem onze ferramentas no modo pessoal e só quatro
// estavam à vista.
//
// A diferença para o sistema anterior (que foi removido) é o que se escolhe:
// dantes ligavam-se e desligavam-se SECÇÕES inteiras — "Hoje", "A minha
// saúde", "Explorar" — e a página mudava de forma conforme a configuração.
// Aqui a forma é sempre a mesma: uma ação e uma lista. Só muda o que está na
// lista. Configurar não pode transformar a página noutra coisa.
//
// Guarda-se por modo e só o que a pessoa mexeu. Sem escolha, usam-se as
// omissões — que são as quatro que já lá estavam.
// ─────────────────────────────────────────────────────────────────────────────
import { TOOLS, type ToolMode } from './toolRegistry'

const CHAVE = 'phlox.inicio.escolha.v1'

/** Quantas cabem sem a página deixar de ser uma lista curta. */
export const MAXIMO = 8
export const MINIMO = 2

/** As de omissão, por modo. São as que o /inicio mostrava antes de haver
 *  escolha — quem nunca entrar nas definições não vê nada mudar. */
export const OMISSAO: Record<string, string[]> = {
  personal:  ['/mymeds', '/vault', '/labs', '/timeline'],
  caregiver: ['/familia', '/mymeds', '/vault', '/timeline'],
  student:   ['/arena', '/osce', '/study360'],
}

/** O que se pode escolher: o catálogo do modo, menos a ação principal (que
 *  está sempre em destaque no topo e não faz sentido repetir na lista). */
export function escolhiveis(modo: string, principal: string) {
  return TOOLS
    .filter(t => t.modes.includes(modo as ToolMode) && t.id !== principal)
    .map(t => ({ id: t.id, label: t.label, desc: t.desc, category: t.category, plan: t.plan }))
}

function ler(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') } catch { return {} }
}

export function getEscolha(modo: string): string[] {
  const guardado = ler()[modo]
  if (!Array.isArray(guardado) || !guardado.length) return OMISSAO[modo] || OMISSAO.personal
  // Uma ferramenta pode ter sido cortada do catálogo desde que foi escolhida —
  // filtra-se, senão o /inicio mostrava uma linha que vai dar a 404.
  const existem = new Set(TOOLS.map(t => t.id))
  const vivas = guardado.filter(id => existem.has(id))
  return vivas.length ? vivas.slice(0, MAXIMO) : (OMISSAO[modo] || OMISSAO.personal)
}

export function setEscolha(modo: string, ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const tudo = ler()
    tudo[modo] = ids.slice(0, MAXIMO)
    localStorage.setItem(CHAVE, JSON.stringify(tudo))
  } catch { /* sem armazenamento, fica a omissão — não vale rebentar por isto */ }
}

export function alternar(modo: string, id: string): string[] {
  const atual = getEscolha(modo)
  const proximo = atual.includes(id)
    ? atual.filter(x => x !== id)
    : [...atual, id]
  // Nunca deixar a lista vazia: uma página inicial sem nada é um erro, não uma
  // escolha. Abaixo do mínimo, a remoção não acontece.
  if (proximo.length < MINIMO) return atual
  if (proximo.length > MAXIMO) return atual
  setEscolha(modo, proximo)
  return proximo
}
