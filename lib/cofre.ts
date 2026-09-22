// lib/cofre.ts
// ─────────────────────────────────────────────────────────────────────────────
// As categorias do cofre. Uma lista, num sítio.
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// Havia três ideias diferentes do que é uma categoria de documento:
//
//   • a base de dados tem um `check (category in (...))` com sete valores em
//     inglês — 'exam', 'prescription', 'report'…
//   • o /vault tinha a mesma lista, copiada à mão;
//   • o /scan inventava 'analises', 'receitas', 'relatorios', 'outros'.
//
// Resultado: o botão "Guardar no cofre" do Explicar NUNCA funcionou. Todos os
// inserts batiam no `check` e devolviam 400. E como a mesma função servia o
// guardar automático dos planos pagos, esse também nunca guardou nada.
//
// Não foi um descuido de escrita — foi não haver um sítio onde a resposta
// estivesse. Agora há. Quem precisar de uma categoria pede-a aqui, e a
// verificação em scripts/teste-cofre.mjs garante que o que sai daqui é
// exatamente o que a base de dados aceita.
// ─────────────────────────────────────────────────────────────────────────────

/** Os valores que a coluna `health_vault.category` aceita. Mexer nesta lista
 *  obriga a mexer no `check` da tabela — e ao contrário. */
export const CATEGORIAS_COFRE = [
  { id: 'exam',         label: 'Análises',    icon: '🧪', color: '#0891b2' },
  { id: 'prescription', label: 'Receita',     icon: '📄', color: '#7c3aed' },
  { id: 'imaging',      label: 'Imagiologia', icon: '🔬', color: '#0d6e42' },
  { id: 'vaccine',      label: 'Vacina',      icon: '💉', color: '#16a34a' },
  { id: 'report',       label: 'Relatório',   icon: '📋', color: '#475569' },
  { id: 'letter',       label: 'Carta',       icon: '✉',  color: '#b45309' },
  { id: 'other',        label: 'Outro',       icon: '📁', color: '#94a3b8' },
] as const

export type CategoriaCofre = typeof CATEGORIAS_COFRE[number]['id']

const VALIDAS = new Set<string>(CATEGORIAS_COFRE.map(c => c.id))

export function categoriaValida(id: string | null | undefined): boolean {
  return !!id && VALIDAS.has(id)
}

/** A categoria do cofre para o tipo de documento que a IA identificou.
 *
 *  Os dois vocabulários existem por boas razões e não se devem fundir: o `kind`
 *  descreve o que o papel é para quem o lê ("bula", "medicamento"), e a
 *  categoria é uma gaveta de arquivo. Esta função é a tradução entre os dois —
 *  e é aqui, e só aqui, que ela vive.
 *
 *  Nunca devolve nada que a base de dados recuse: o que não se sabe traduzir
 *  vai para 'other', que é honesto e guarda o documento. */
export function categoriaDoKind(kind: string | null | undefined): CategoriaCofre {
  switch (kind) {
    case 'analise':     return 'exam'
    case 'receita':     return 'prescription'
    case 'relatorio':   return 'report'
    // Uma caixa de comprimidos ou um folheto informativo não são uma receita —
    // ninguém os quer a aparecer na gaveta das receitas quando procura a sua.
    case 'medicamento': return 'other'
    case 'bula':        return 'other'
    default:            return 'other'
  }
}

export function metaCategoria(id: string | null | undefined) {
  return CATEGORIAS_COFRE.find(c => c.id === id) || CATEGORIAS_COFRE[CATEGORIAS_COFRE.length - 1]
}
