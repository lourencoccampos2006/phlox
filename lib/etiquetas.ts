// lib/etiquetas.ts
// ─────────────────────────────────────────────────────────────────────────────
// As etiquetas dos utentes: «risco de queda», «disfagia», «alergias».
//
// ── PARA QUE SERVEM ─────────────────────────────────────────────────────────
// Para o que hoje vive no meio das notas, onde só o encontra quem já sabe que
// está lá. Uma etiqueta vermelha numa lista de trinta pessoas vê-se antes de
// se ler seja o que for — e é por elas que se procura quando alguém pergunta
// «quem é que tem risco de queda?» antes de montar a escala da noite.
//
// ── A COR NÃO É ENFEITE ─────────────────────────────────────────────────────
// É o que faz uma etiqueta valer alguma coisa numa lista longa. Mas as cores
// vivem aqui, e não escritas à mão em cada sítio: o vermelho tem de ser o
// mesmo vermelho na ficha, na lista e no que se imprime, senão a cor deixa de
// querer dizer o que quer que seja.
// ─────────────────────────────────────────────────────────────────────────────

export interface Etiqueta {
  id: string
  nome: string
  cor: string
  descricao: string | null
  ativa: boolean
}

export interface Cor {
  fundo: string
  borda: string
  texto: string
  /** O ponto sólido, para quando não há espaço para a etiqueta inteira. */
  solido: string
}

/**
 * As oito cores. São poucas de propósito: com vinte, ninguém se lembra do que
 * cada uma quer dizer, e a cor passa a ser decoração.
 */
export const CORES_DE_ETIQUETA: Record<string, Cor> = {
  cinza:    { fundo: 'var(--bg-3)', borda: 'var(--border-2)', texto: 'var(--badge-blue-fg)', solido: 'var(--blue)' },
  vermelho: { fundo: 'var(--red-light)', borda: 'var(--badge-red-border)', texto: 'var(--red)', solido: 'var(--red)' },
  laranja:  { fundo: 'var(--amber-light)', borda: 'var(--badge-amber-border)', texto: 'var(--badge-red-fg)', solido: 'var(--amber)' },
  amarelo:  { fundo: 'var(--amber-light)', borda: 'var(--badge-amber-border)', texto: 'var(--badge-amber-fg)', solido: 'var(--amber)' },
  verde:    { fundo: 'var(--green-light)', borda: 'var(--green-mid)', texto: 'var(--green-3)', solido: 'var(--green)' },
  azul:     { fundo: 'var(--blue-light)', borda: 'var(--blue-light)', texto: 'var(--blue)', solido: 'var(--blue)' },
  roxo:     { fundo: 'var(--blue-light)', borda: 'var(--roxo-meio)', texto: 'var(--roxo-escuro)', solido: 'var(--roxo)' },
  rosa:     { fundo: 'var(--red-light)', borda: 'var(--red-light)', texto: 'var(--red)', solido: 'var(--red)' },
}

export const NOMES_DAS_CORES = Object.keys(CORES_DE_ETIQUETA)

export function corDe(nome: string | null | undefined): Cor {
  return CORES_DE_ETIQUETA[nome || 'cinza'] || CORES_DE_ETIQUETA.cinza
}

/**
 * Quem tem TODAS as etiquetas escolhidas.
 *
 * ── PORQUE É «TODAS» E NÃO «ALGUMA» ────────────────────────────────────────
 * Escolher «risco de queda» e «acamado» quer dizer «quem é as duas coisas»,
 * não «quem é uma ou outra». Com «alguma», acrescentar um filtro ALARGAVA a
 * lista — e um filtro que aumenta o resultado é o contrário do que a palavra
 * filtro quer dizer.
 */
export function filtrarPorEtiquetas<T extends { id: string }>(
  pessoas: T[],
  ligacoes: { patient_id: string; etiqueta_id: string }[],
  escolhidas: string[],
): T[] {
  if (!escolhidas.length) return pessoas

  const porPessoa = new Map<string, Set<string>>()
  for (const l of ligacoes) {
    const s = porPessoa.get(l.patient_id)
    if (s) s.add(l.etiqueta_id)
    else porPessoa.set(l.patient_id, new Set([l.etiqueta_id]))
  }

  return pessoas.filter(p => {
    const suas = porPessoa.get(p.id)
    if (!suas) return false
    return escolhidas.every(e => suas.has(e))
  })
}

/** Quantas pessoas têm cada etiqueta — para o filtro poder dizer o número. */
export function contarPorEtiqueta(
  ligacoes: { patient_id: string; etiqueta_id: string }[],
): Map<string, number> {
  const conta = new Map<string, number>()
  for (const l of ligacoes) conta.set(l.etiqueta_id, (conta.get(l.etiqueta_id) || 0) + 1)
  return conta
}
