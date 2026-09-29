// lib/modelos.ts
// ─────────────────────────────────────────────────────────────────────────────
// Modelos de documentos: escreve-se uma vez, preenche-se para cada pessoa.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Em documentos deveria de conseguir enviar-se apenas uma "template" de um
//  documento, por exemplo, do documento de inscrição, e aquilo preenchia o
//  documento com base nas condições da pessoa.»
//
// ── DE ONDE VÊM OS CAMPOS ───────────────────────────────────────────────────
// Do mesmo sítio que a ficha de inscrição: `lib/inscricao.ts`. Não há aqui
// uma segunda lista de campos — os que se podem pôr num modelo são exatamente
// os que existem na ficha, e um campo novo lá aparece aqui sozinho.
//
// Fazer duas listas parece inofensivo e é a maneira certa de, dentro de meio
// ano, ter um modelo que pede `{{telefone}}` quando a ficha guarda `telemovel`
// — e o documento sai com um espaço em branco onde devia estar um número.
//
// ── A DECISÃO QUE IMPORTA: UM CAMPO EM FALTA TEM DE SE VER ─────────────────
// A tentação é substituir o que se encontra e deixar o resto em branco. Num
// documento de inscrição isso é grave: sai um contrato com o NIF em branco,
// alguém assina, e só se descobre quando a Segurança Social o devolve.
//
// Por isso `preencher` devolve SEMPRE o que não conseguiu preencher, e o ecrã
// não deixa imprimir sem mostrar essa lista primeiro. Preencher às escuras é
// pior do que não preencher.
// ─────────────────────────────────────────────────────────────────────────────

import { SECCOES, rotuloDe } from './inscricao'

export type Campo = {
  /** O que se escreve no modelo, sem as chavetas: `nome`, `nif`, `casa.nome`. */
  id: string
  rotulo: string
  /** De onde sai o valor. */
  fonte: 'pessoa' | 'casa' | 'calculado'
  exemplo?: string
}

/** Os campos da casa. Não são da pessoa e não estão na ficha dela. */
export const CAMPOS_DA_CASA: Campo[] = [
  { id: 'casa.nome', rotulo: 'Nome da instituição', fonte: 'casa' },
  { id: 'casa.morada', rotulo: 'Morada da instituição', fonte: 'casa' },
  { id: 'casa.nif', rotulo: 'NIF da instituição', fonte: 'casa' },
  { id: 'casa.telefone', rotulo: 'Telefone da instituição', fonte: 'casa' },
  // Quem assina pela casa. Num contrato de prestação de serviços é obrigatório
  // identificar o representante, e sem este campo ficava escrito à mão em cada
  // documento — ou seja, ficava por escrever.
  { id: 'casa.diretor', rotulo: 'Quem representa a instituição', fonte: 'casa' },
  { id: 'casa.cidade', rotulo: 'Localidade da instituição', fonte: 'casa' },
]

/** O que se calcula na hora e não está guardado em coluna nenhuma. */
export const CAMPOS_CALCULADOS: Campo[] = [
  { id: 'idade', rotulo: 'Idade (anos completos)', fonte: 'calculado', exemplo: '86' },
  { id: 'hoje', rotulo: 'Data de hoje', fonte: 'calculado', exemplo: '27 de setembro de 2026' },
  { id: 'hoje.curto', rotulo: 'Data de hoje (27/09/2026)', fonte: 'calculado' },
]

/**
 * Todos os campos que se podem pôr num modelo.
 *
 * Os da pessoa saem das secções da ficha — a MESMA lista que o formulário de
 * inscrição desenha.
 */
export function campos(): Campo[] {
  const daPessoa: Campo[] = SECCOES.flatMap(s => s.campos.map(c => ({
    id: c.id,
    rotulo: `${c.rotulo} (${s.titulo.toLowerCase()})`,
    fonte: 'pessoa' as const,
  })))
  // Sem repetidos: um campo que apareça em duas secções entra uma vez.
  const vistos = new Set<string>()
  const unicos = daPessoa.filter(c => (vistos.has(c.id) ? false : (vistos.add(c.id), true)))
  return [...unicos, ...CAMPOS_CALCULADOS, ...CAMPOS_DA_CASA]
}

export const CAMPOS_VALIDOS = () => new Set(campos().map(c => c.id))

/* ── Ler um modelo ────────────────────────────────────────────────────────── */

const MARCA = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

/** Os campos que um modelo usa, sem repetições e na ordem em que aparecem. */
export function marcasDe(corpo: string): string[] {
  const achadas: string[] = []
  for (const m of String(corpo || '').matchAll(MARCA)) {
    if (!achadas.includes(m[1])) achadas.push(m[1])
  }
  return achadas
}

/** Marcas escritas no modelo que não correspondem a campo nenhum. */
export function marcasDesconhecidas(corpo: string): string[] {
  const validos = CAMPOS_VALIDOS()
  return marcasDe(corpo).filter(m => !validos.has(m))
}

/* ── Preencher ────────────────────────────────────────────────────────────── */

export type Casa = {
  nome?: string | null
  morada?: string | null
  nif?: string | null
  telefone?: string | null
  diretor?: string | null
  cidade?: string | null
}

export type Preenchido = {
  texto: string
  /** Campos do modelo que a ficha da pessoa não tem preenchidos. */
  emFalta: { id: string; rotulo: string }[]
  /** Marcas que não correspondem a campo nenhum (engano de quem escreveu). */
  desconhecidas: string[]
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** '2026-09-27' → '27 de setembro de 2026'. */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return iso || ''
  return `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}`
}

/** '2026-09-27' → '27/09/2026'. Como se escreve num documento em Portugal. */
export function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '')
}

function idadeDe(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const d = new Date(String(nascimento).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const h = new Date()
  let a = h.getFullYear() - d.getFullYear()
  const mm = h.getMonth() - d.getMonth()
  if (mm < 0 || (mm === 0 && h.getDate() < d.getDate())) a--
  return a > 0 && a < 130 ? a : null
}

/**
 * O modelo, com os valores desta pessoa.
 *
 * `ficha` são os campos da ficha pelos IDs de `lib/inscricao.ts` (o que
 * `paraFicha()` devolve), não as colunas cruas da base de dados — assim uma
 * mudança de nome de coluna não obriga a mexer nos modelos.
 */
export function preencher(
  corpo: string, ficha: Record<string, string>, casa: Casa, hoje: string,
): Preenchido {
  const validos = CAMPOS_VALIDOS()
  const rotulos = new Map(campos().map(c => [c.id, c.rotulo]))
  const emFalta: { id: string; rotulo: string }[] = []
  const desconhecidas: string[] = []

  const valorDe = (id: string): string | null => {
    switch (id) {
      case 'casa.nome': return casa.nome?.trim() || null
      case 'casa.morada': return casa.morada?.trim() || null
      case 'casa.nif': return casa.nif?.trim() || null
      case 'casa.telefone': return casa.telefone?.trim() || null
      case 'casa.diretor': return casa.diretor?.trim() || null
      case 'casa.cidade': return casa.cidade?.trim() || null
      case 'hoje': return dataPorExtenso(hoje)
      case 'hoje.curto': return dataCurta(hoje)
      case 'idade': { const a = idadeDe(ficha.data_nascimento); return a === null ? null : String(a) }
      default: {
        const cru = (ficha[id] ?? '').trim()
        if (!cru) return null
        // Datas em português, e escolhas por extenso: um documento com
        // «mobilidade: cadeira» ou «1938-04-02» parece o que é — uma base de
        // dados a sair pela impressora.
        if (/^\d{4}-\d{2}-\d{2}$/.test(cru)) return dataCurta(cru)
        return rotuloDe(id, cru) || cru
      }
    }
  }

  const texto = String(corpo || '').replace(MARCA, (inteiro, id: string) => {
    if (!validos.has(id)) {
      if (!desconhecidas.includes(id)) desconhecidas.push(id)
      // Fica à vista tal como foi escrito. Apagá-la em silêncio escondia o
      // engano e o documento saía com uma frase a meio.
      return inteiro
    }
    const v = valorDe(id)
    if (v === null) {
      if (!emFalta.some(x => x.id === id)) {
        emFalta.push({ id, rotulo: rotulos.get(id) || id })
      }
      // Um traço de sublinhado é o que um documento em papel tem onde falta
      // preencher — e vê-se, ao contrário de um espaço em branco.
      return '__________'
    }
    return v
  })

  return { texto, emFalta, desconhecidas }
}

/** Está pronto a imprimir? (Nada em falta e nenhuma marca errada.) */
export const estaPronto = (p: Preenchido) => !p.emFalta.length && !p.desconhecidas.length

/* ── Os modelos que vêm de origem ─────────────────────────────────────────── */

export const CATEGORIAS = [
  { id: 'inscricao', rotulo: 'Inscrição e admissão' },
  { id: 'contrato', rotulo: 'Contratos' },
  { id: 'consentimento', rotulo: 'Consentimentos' },
  { id: 'declaracao', rotulo: 'Declarações' },
  { id: 'outro', rotulo: 'Outros' },
] as const

export const categoriaDe = (id?: string | null) =>
  CATEGORIAS.find(c => c.id === id)?.rotulo || 'Outros'
