// lib/registoEmPalavras.ts
// ─────────────────────────────────────────────────────────────────────────────
// O registo do dia, dito em português.
//
// ── O BUG QUE ISTO RESOLVE ─────────────────────────────────────────────────
// A ficha do utente mostrava, a sério:
//
//     Registo do dia — Alimentação: [object Object] · Humor: [object Object]
//
// Porque `care_records.nutrition` e `care_records.mood` não são texto: são
// objetos jsonb com vários campos lá dentro. Escrever `${r.nutrition}` num
// template dá o nome do tipo, não o conteúdo.
//
// ── PORQUE É QUE ISTO É UM FICHEIRO E NÃO UMA LINHA CORRIGIDA ──────────────
// Porque o mesmo registo é lido em vários sítios — a ficha, a linha do tempo,
// o resumo à família, o dossier que se imprime — e cada um tinha de decidir
// sozinho como dizer «almoçou 75%». Quando cada sítio decide, cada sítio diz
// de maneira diferente, e a família recebe uma frase e a inspeção outra.
//
// O vocabulário é o mesmo do formulário (app/care-log/page.tsx). Se lá mudar,
// muda aqui — e é por isso que os valores estão escritos e não adivinhados.
//
// ── O TOM ──────────────────────────────────────────────────────────────────
// Frases de quem cuida, não campos de base de dados. «Comeu pouco ao almoço»
// em vez de «lunch: 25». E o que não foi registado não se menciona: uma frase
// cheia de «sem registo» é pior do que uma frase curta.
// ─────────────────────────────────────────────────────────────────────────────

export interface Nutricao {
  breakfast?: number | null
  lunch?: number | null
  dinner?: number | null
  appetite?: string | null
  fluid_ml?: number | null
}

export interface Humor {
  level?: number | null
  behavior?: string | null
  activities?: string | null
}

export interface Continencia {
  urinary?: string | null
  bowel?: string | null
}

export interface Pele {
  integrity?: string | null
  description?: string | null
}

/** O mesmo do formulário. 1 é o pior, 5 o melhor. */
export const HUMOR: Record<number, string> = {
  1: 'agitado', 2: 'ansioso', 3: 'neutro', 4: 'bem-disposto', 5: 'muito bem',
}

/** A percentagem comida, em palavras. Ninguém diz «ingeriu 75%». */
function quantoComeu(pct: number): string {
  if (pct <= 0) return 'não comeu'
  if (pct <= 25) return 'comeu pouco'
  if (pct <= 50) return 'comeu metade'
  if (pct <= 75) return 'comeu quase tudo'
  return 'comeu tudo'
}

const REFEICOES: [keyof Nutricao, string][] = [
  ['breakfast', 'ao pequeno-almoço'],
  ['lunch', 'ao almoço'],
  ['dinner', 'ao jantar'],
]

/** O que comeu, numa frase. Vazio quando não há nada registado. */
export function alimentacaoEmPalavras(n: Nutricao | null | undefined): string {
  if (!n || typeof n !== 'object') return ''
  const partes: string[] = []

  for (const [campo, quando] of REFEICOES) {
    const v = n[campo]
    if (typeof v !== 'number') continue
    partes.push(`${quantoComeu(v)} ${quando}`)
  }

  // O apetite só se diz quando não é o óbvio. Dizer «comeu tudo, apetite bom»
  // é repetir; dizer «comeu pouco, apetite fraco» explica.
  if (n.appetite && !partes.length) partes.push(`apetite ${n.appetite.toLowerCase()}`)
  else if (n.appetite && /fraco|recusou/i.test(n.appetite)) partes.push(`apetite ${n.appetite.toLowerCase()}`)

  if (typeof n.fluid_ml === 'number' && n.fluid_ml > 0) partes.push(`${n.fluid_ml} ml de líquidos`)

  return partes.join(', ')
}

/** Como estava, numa frase. */
export function humorEmPalavras(h: Humor | null | undefined): string {
  if (!h || typeof h !== 'object') return ''
  const partes: string[] = []
  if (typeof h.level === 'number' && HUMOR[h.level]) partes.push(HUMOR[h.level])
  if (h.behavior?.trim()) partes.push(h.behavior.trim())
  return partes.join(' — ')
}

export function continenciaEmPalavras(c: Continencia | null | undefined): string {
  if (!c || typeof c !== 'object') return ''
  const partes: string[] = []
  // «Sem registo» é uma opção do formulário e não é informação nenhuma.
  if (c.urinary && !/sem registo/i.test(c.urinary)) partes.push(c.urinary.toLowerCase())
  if (c.bowel && !/sem registo|^normal$/i.test(c.bowel)) partes.push(`intestinal: ${c.bowel.toLowerCase()}`)
  return partes.join(', ')
}

export function peleEmPalavras(p: Pele | null | undefined): string {
  if (!p || typeof p !== 'object') return ''
  // Pele íntegra é o normal — não precisa de ser dito. O que não é íntegro,
  // sim, e com a descrição a seguir.
  if (!p.integrity || /íntegra|integra/i.test(p.integrity)) return ''
  return [p.integrity.toLowerCase(), p.description?.trim()].filter(Boolean).join(' — ')
}

export interface RegistoDoDia {
  nutrition?: Nutricao | null
  mood?: Humor | null
  continence?: Continencia | null
  skin?: Pele | null
  notes?: string | null
}

/**
 * O registo inteiro, numa linha.
 *
 * Devolve vazio quando não há nada a dizer — e quem chama deve tratar isso
 * como «não há resumo», não como «está tudo bem». Um registo aberto e deixado
 * em branco não é um dia sem novidades.
 */
export function registoEmPalavras(r: RegistoDoDia | null | undefined): string {
  if (!r) return ''
  const partes = [
    alimentacaoEmPalavras(r.nutrition),
    humorEmPalavras(r.mood),
    continenciaEmPalavras(r.continence),
    peleEmPalavras(r.skin),
  ].filter(Boolean)
  return partes.join(' · ')
}

/** A versão etiquetada, para listas onde o contexto não se percebe sozinho. */
export function registoEmCampos(r: RegistoDoDia | null | undefined): { rotulo: string; valor: string }[] {
  if (!r) return []
  return [
    { rotulo: 'Alimentação', valor: alimentacaoEmPalavras(r.nutrition) },
    { rotulo: 'Humor', valor: humorEmPalavras(r.mood) },
    { rotulo: 'Continência', valor: continenciaEmPalavras(r.continence) },
    { rotulo: 'Pele', valor: peleEmPalavras(r.skin) },
  ].filter(x => x.valor)
}
